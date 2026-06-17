/**
 * Domain helpers shared across the route plugins: third-party mappers,
 * appointment-slot math, stylist assignment, recommendation building, and the
 * mocked active-user state.
 */
import { randomUUID } from "node:crypto";
import { rerank, type StyleContext } from "../claude-reranker.js";
import { normalizeOutfitAnalysis } from "../outfit-analysis.js";
import {
	type CoarseCategory,
	coarseCategory,
	coarseCategoryFromText,
	parseColors,
	type RecommendationContext,
	rankCandidates,
	shortlistDiverse,
} from "../recommendation-scoring.js";
import {
	fetchThirdPartyStoreInventory,
	fetchThirdPartyUser,
} from "../recommendations.js";
import * as repository from "../repository.js";
import type {
	Appointment,
	AppointmentSlot,
	CatalogAudience,
	CatalogProduct,
	CreateAppointmentInput,
	CurrentUser,
	MuseTag,
	OrderHistory,
	OutfitAnalysis,
	OutfitGarment,
	Store,
	StoreInventoryItem,
	StoreSchedulePattern,
	StoreSchedulePatternList,
	StylistAvailabilityStatus,
	StylistProfile,
	SuggestedProduct,
	SuggestedProductPrepStatus,
	UserList,
} from "../types.js";
import {
	catalogAudienceEnum,
	productPrepStatusEnum,
	terminalAppointmentStatuses,
} from "./schemas.js";

// Mocked logged-in customer; switched via the admin routes for local testing.
let activeUserId = "cust_avery_001";

export function getActiveUserId() {
	return activeUserId;
}

export function setActiveUserId(customerId: string) {
	activeUserId = customerId;
}

export function filterStylists(
	stylists: StylistProfile[],
	filters: {
		specialty?: string;
		fit?: string;
		availability?: StylistAvailabilityStatus;
	},
) {
	return stylists.filter((stylist) => {
		const specialtyMatch = filters.specialty
			? stylist.specialties.includes(filters.specialty)
			: true;
		const fitMatch = filters.fit
			? stylist.supportedFits.includes(filters.fit)
			: true;
		const availabilityMatch = filters.availability
			? stylist.availability.status === filters.availability
			: true;

		return specialtyMatch && fitMatch && availabilityMatch;
	});
}

export const defaultStore: Store = {
	storeId: "anf_soho_001",
	name: "Abercrombie & Fitch SoHo",
	city: "New York",
	state: "NY",
	address: "547 Broadway, New York, NY 10012",
	phone: "+1 212-625-0868",
	timezone: "America/New_York",
};

export function isTerminalStatus(status: string) {
	return terminalAppointmentStatuses.includes(status);
}

export function isActiveStatus(status: string) {
	return status === "scheduled" || status === "checked_in";
}

export function addOneHour(isoDateTime: string) {
	const date = new Date(isoDateTime);
	date.setHours(date.getHours() + 1);
	return date.toISOString();
}

export function normalizeSlotKey(value: string) {
	return new Date(value).toISOString();
}

export function getDatePartsForTimezone(
	date: Date,
	timezone: string,
): { date: string; dayOfWeek: string } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		weekday: "long",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const value = (type: string) =>
		parts.find((part) => part.type === type)?.value ?? "";

	return {
		date: `${value("year")}-${value("month")}-${value("day")}`,
		dayOfWeek: value("weekday"),
	};
}

export function timezoneOffsetForSchedule(timezone: string) {
	return timezone === "America/Los_Angeles" ? "-07:00" : "-04:00";
}

export function hourRange(openTime: string, closeTime: string) {
	const openHour = Number(openTime.split(":")[0]);
	const closeHour = Number(closeTime.split(":")[0]);
	return Array.from(
		{ length: Math.max(closeHour - openHour, 0) },
		(_, index) => openHour + index,
	);
}

export function createStoreAppointmentSlots(
	pattern: StoreSchedulePattern,
	now = new Date(),
): AppointmentSlot[] {
	const offset = timezoneOffsetForSchedule(pattern.timezone);

	return Array.from({ length: 10 }, (_, dayOffset) => {
		const date = new Date(now);
		date.setUTCDate(date.getUTCDate() + dayOffset);
		return getDatePartsForTimezone(date, pattern.timezone);
	}).flatMap((day) => {
		const dayPattern = pattern.weekly.find(
			(candidate) => candidate.dayOfWeek === day.dayOfWeek,
		);

		if (!dayPattern || dayPattern.stylistIds.length === 0) {
			return [];
		}

		return hourRange(dayPattern.openTime, dayPattern.closeTime).flatMap(
			(hour) => {
				const hourLabel = String(hour).padStart(2, "0");
				const slotStart = `${day.date}T${hourLabel}:00:00${offset}`;

				if (new Date(slotStart) <= now) {
					return [];
				}

				return [
					{
						storeId: pattern.storeId,
						slotStart,
						slotEnd: addOneHour(slotStart),
						date: day.date,
						time: `${hourLabel}:00`,
						availableStylistCount: dayPattern.stylistIds.length,
					},
				];
			},
		);
	});
}

export function findPatternForStore(
	patterns: StoreSchedulePatternList,
	storeId: string,
) {
	return patterns.patterns.find((pattern) => pattern.storeId === storeId);
}

export function scheduledStylistIdsForSlot(
	pattern: StoreSchedulePattern,
	slotStart: string,
) {
	const requested = new Date(slotStart);
	const localDate = getDatePartsForTimezone(requested, pattern.timezone);
	const dayPattern = pattern.weekly.find(
		(candidate) => candidate.dayOfWeek === localDate.dayOfWeek,
	);

	if (!dayPattern) {
		return [];
	}

	const localHour = Number(
		new Intl.DateTimeFormat("en-US", {
			timeZone: pattern.timezone,
			hour: "2-digit",
			hour12: false,
		}).format(requested),
	);

	if (
		!hourRange(dayPattern.openTime, dayPattern.closeTime).includes(localHour)
	) {
		return [];
	}

	return dayPattern.stylistIds;
}

export function mapMuseTag(styleKeywords: string[]): MuseTag {
	const keywordSet = new Set(styleKeywords);
	const mapping: Array<{ tag: MuseTag; keywords: string[] }> = [
		{
			tag: "Clean Muse",
			keywords: ["minimal", "effortless", "timeless essentials"],
		},
		{
			tag: "Romantic Muse",
			keywords: ["feminine", "soft", "subtly dressed-up"],
		},
		{
			tag: "Boyish Muse",
			keywords: ["preppy", "relaxed", "sporty", "menswear-inspired"],
		},
		{
			tag: "Statement Maker",
			keywords: ["trend-forward", "bold", "boundary-pushing"],
		},
	];

	const scores = mapping.map(({ tag, keywords }) => ({
		tag,
		score: keywords.filter((keyword) => keywordSet.has(keyword)).length,
	}));

	return scores.sort((a, b) => b.score - a.score)[0]?.tag ?? "Clean Muse";
}

export function summarizeOrderHistory(orderHistory: OrderHistory) {
	const items = orderHistory.orders.flatMap((order) => order.items);
	const denimItems = items.filter((item) => item.category === "denim");
	const returnedItems = items.filter((item) => !item.kept || item.returnReason);
	const preferredSizes = Array.from(
		new Set(
			denimItems.filter((item) => item.kept).map((item) => item.sizeLabel),
		),
	);

	return {
		totalOrders: orderHistory.orders.length,
		denimItems: denimItems.length,
		returnedItems: returnedItems.length,
		preferredSizes,
	};
}

export function assignStylist(
	scheduledStylistIds: string[],
	stylists: StylistProfile[],
	museTag: MuseTag,
) {
	const museSpecialtyHints: Record<MuseTag, string[]> = {
		"Clean Muse": ["straight-leg-denim", "fit-troubleshooting"],
		"Romantic Muse": ["petite-proportions", "inseam-selection"],
		"Boyish Muse": ["athletic-builds", "relaxed-denim", "mobility-comfort"],
		"Statement Maker": ["trend-styling", "wide-leg-denim", "outfit-building"],
	};

	const scheduledStylists = scheduledStylistIds
		.map((id) => stylists.find((stylist) => stylist.id === id))
		.filter((stylist): stylist is StylistProfile => Boolean(stylist));

	return scheduledStylists
		.map((stylist, index) => ({
			stylist,
			index,
			score: museSpecialtyHints[museTag].filter((hint) =>
				stylist.specialties.includes(hint),
			).length,
		}))
		.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.stylist;
}

export function parseJsonField<T>(value: unknown): T {
	return typeof value === "string" ? JSON.parse(value) : (value as T);
}

export function isoOrNull(value: unknown) {
	return value ? new Date(String(value)).toISOString() : null;
}

export function normalizeSuggestedProducts(
	suggestedProducts: SuggestedProduct[],
): SuggestedProduct[] {
	return suggestedProducts.map((suggestion) => ({
		...suggestion,
		product: {
			...suggestion.product,
			catalogAudiences: normalizeCatalogAudiences(
				suggestion.product.catalogAudiences,
			),
		},
		prepStatus: productPrepStatusEnum.includes(
			suggestion.prepStatus as SuggestedProductPrepStatus,
		)
			? suggestion.prepStatus
			: "suggested",
		associateNote: suggestion.associateNote ?? "",
	}));
}

export function mapStoreSnapshot(row: Record<string, unknown>): Store {
	if (row.store_snapshot) {
		return {
			...defaultStore,
			...parseJsonField<Partial<Store>>(row.store_snapshot),
		};
	}

	const stylist = row.assigned_stylist
		? parseJsonField<StylistProfile>(row.assigned_stylist)
		: null;
	return {
		...defaultStore,
		...stylist?.store,
	};
}

export const outfitEngineValues = ["claude", "sample", "manual"] as const;

export const suggestionsStatusValues = ["pending", "ready", "failed"] as const;

/** Parse a stored outfit_analysis JSONB cell, preserving its original engine. */
export function mapOutfitAnalysis(value: unknown): OutfitAnalysis | null {
	if (!value) return null;
	const parsed = parseJsonField<Partial<OutfitAnalysis>>(value);
	const engine = outfitEngineValues.includes(
		parsed?.engine as OutfitAnalysis["engine"],
	)
		? (parsed.engine as OutfitAnalysis["engine"])
		: "manual";
	return normalizeOutfitAnalysis(parsed, engine);
}

export function mapAppointment(row: Record<string, unknown>): Appointment {
	const suggestedProducts = row.suggested_products
		? normalizeSuggestedProducts(
				parseJsonField<SuggestedProduct[]>(row.suggested_products),
			)
		: [];

	return {
		id: String(row.id),
		customerId: String(row.customer_id),
		loyaltyId: String(row.loyalty_id),
		customerName: String(row.customer_name),
		slotStart: new Date(String(row.slot_start)).toISOString(),
		slotEnd: new Date(String(row.slot_end)).toISOString(),
		store: mapStoreSnapshot(row),
		occasion: String(row.occasion),
		focusColors: String(row.focus_colors),
		avoidColors: String(row.avoid_colors),
		styleKeywords: parseJsonField<string[]>(row.style_keywords),
		catalogAudiences: normalizeCatalogAudiences(row.catalog_audiences),
		guidance: String(row.guidance),
		sessionNotes: String(row.session_notes ?? ""),
		status: String(row.status ?? "scheduled") as Appointment["status"],
		museTag: String(row.muse_tag) as MuseTag,
		assignedStylist: parseJsonField<StylistProfile>(row.assigned_stylist),
		orderHistorySummary: parseJsonField<Appointment["orderHistorySummary"]>(
			row.order_history_summary,
		),
		suggestedProducts,
		suggestionsStatus: suggestionsStatusValues.includes(
			row.suggestions_status as Appointment["suggestionsStatus"],
		)
			? (row.suggestions_status as Appointment["suggestionsStatus"])
			: "ready",
		outfitAnalysis: mapOutfitAnalysis(row.outfit_analysis),
		notificationSummary: {
			count: Number(row.notification_count ?? 0),
			confirmationStatus: row.confirmation_status
				? (String(row.confirmation_status) as "queued" | "sent")
				: null,
			reminderStatus: row.reminder_status
				? (String(row.reminder_status) as "queued" | "sent")
				: null,
		},
		checkedInAt: isoOrNull(row.checked_in_at),
		completedAt: isoOrNull(row.completed_at),
		cancelledAt: isoOrNull(row.cancelled_at),
		noShowAt: isoOrNull(row.no_show_at),
		cancelReason: row.cancel_reason == null ? null : String(row.cancel_reason),
		customerRecap: String(row.customer_recap ?? ""),
		associateFeedback: String(row.associate_feedback ?? ""),
		customerFeedbackRating:
			row.customer_feedback_rating == null
				? null
				: Number(row.customer_feedback_rating),
		customerFeedbackComment: String(row.customer_feedback_comment ?? ""),
		customerFeedbackAt: isoOrNull(row.customer_feedback_at),
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

export function mapAppointmentMessage(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		appointmentId: String(row.appointment_id),
		authorType: String(row.author_type) as "customer" | "associate",
		body: String(row.body),
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

export function mapAppointmentNotification(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		appointmentId: String(row.appointment_id),
		type: String(row.type) as "confirmation" | "reminder",
		status: String(row.status) as "queued" | "sent",
		scheduledFor: new Date(String(row.scheduled_for)).toISOString(),
		sentAt: isoOrNull(row.sent_at),
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

export async function getActiveUser() {
	return normalizeCurrentUser(await fetchThirdPartyUser(activeUserId));
}

export async function getActiveUserProfile() {
	return getCustomerProfile(activeUserId);
}

export function normalizeCatalogAudiences(value: unknown): CatalogAudience[] {
	const rawValues = (() => {
		if (Array.isArray(value)) return value;
		if (typeof value !== "string") return [];
		try {
			const parsed = JSON.parse(value) as unknown;
			return Array.isArray(parsed) ? parsed : [value];
		} catch {
			return [value];
		}
	})();

	const audiences = Array.from(
		new Set(
			rawValues.filter((audience): audience is CatalogAudience =>
				catalogAudienceEnum.includes(audience as CatalogAudience),
			),
		),
	);

	return audiences.length ? audiences : ["womens"];
}

export function normalizeCurrentUser(user: CurrentUser): CurrentUser {
	return {
		...user,
		preferences: {
			...user.preferences,
			catalogAudiences: normalizeCatalogAudiences(
				user.preferences.catalogAudiences,
			),
		},
	};
}

export function applyFitProfileOverride(
	user: CurrentUser,
	overrideRow: Record<string, unknown> | undefined,
): CurrentUser {
	const normalized = normalizeCurrentUser(user);
	if (!overrideRow) return normalized;

	return normalizeCurrentUser({
		...normalized,
		measurements: {
			...normalized.measurements,
			...parseJsonField<Partial<CurrentUser["measurements"]>>(
				overrideRow.measurements,
			),
		},
		preferences: {
			...normalized.preferences,
			...parseJsonField<Partial<CurrentUser["preferences"]>>(
				overrideRow.preferences,
			),
		},
	});
}

export async function getCustomerProfile(customerId: string) {
	const user = await fetchThirdPartyUser(customerId);
	let overrideRows: Record<string, unknown>[] = [];
	try {
		const override =
			await repository.selectCustomerFitProfileOverride(customerId);
		overrideRows = override?.rows ?? [];
	} catch {
		overrideRows = [];
	}

	return applyFitProfileOverride(user, overrideRows[0]);
}

export async function normalizeUserList(users: UserList): Promise<UserList> {
	let overrideRows: Record<string, unknown>[] = [];
	try {
		const overrides = await repository.selectCustomerFitProfileOverrides();
		overrideRows = overrides?.rows ?? [];
	} catch {
		overrideRows = [];
	}
	const byCustomerId = new Map(
		overrideRows.map((row) => [String(row.customer_id), row]),
	);
	return {
		users: users.users.map((user) =>
			applyFitProfileOverride(user, byCustomerId.get(user.customerId)),
		),
	};
}

export function userExists(users: UserList, customerId: string) {
	return users.users.some((user) => user.customerId === customerId);
}

/**
 * Pull the structured waist/length size dimensions out of a catalog row's `raw`
 * payload (the scraper stores `raw.sizes = { waist: [...], length: [...] }`).
 * Returns empty arrays when the structure is missing, so callers can always rely
 * on arrays.
 */
function rawSizeDimensions(raw: unknown): {
	waistSizes: string[];
	lengthSizes: string[];
} {
	const asStrings = (v: unknown): string[] =>
		Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
	try {
		const parsed = parseJsonField<{
			sizes?: { waist?: unknown; length?: unknown };
		}>(raw);
		return {
			waistSizes: asStrings(parsed?.sizes?.waist),
			lengthSizes: asStrings(parsed?.sizes?.length),
		};
	} catch {
		return { waistSizes: [], lengthSizes: [] };
	}
}

export function mapCatalogProduct(
	row: Record<string, unknown>,
): CatalogProduct {
	const { waistSizes, lengthSizes } = rawSizeDimensions(row.raw);
	return {
		productId: String(row.product_id),
		source: String(row.source),
		name: String(row.name),
		category: row.category == null ? null : String(row.category),
		catalogAudiences: normalizeCatalogAudiences(row.catalog_audiences),
		productUrl: String(row.product_url),
		imageUrl: row.image_url == null ? null : String(row.image_url),
		description: row.description == null ? null : String(row.description),
		price: row.price == null ? null : Number(row.price),
		currency: row.currency == null ? null : String(row.currency),
		fit: row.fit == null ? null : String(row.fit),
		rise: row.rise == null ? null : String(row.rise),
		stretch: row.stretch == null ? null : String(row.stretch),
		// sizes/colors are JSONB and arrive already parsed as arrays.
		sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : [],
		waistSizes,
		lengthSizes,
		colors: Array.isArray(row.colors) ? (row.colors as string[]) : [],
		scrapedAt: new Date(String(row.scraped_at)).toISOString(),
	};
}

function productMatchesCatalogAudiences(
	product: CatalogProduct,
	selectedAudiences: CatalogAudience[],
) {
	return product.catalogAudiences.some((audience) =>
		selectedAudiences.includes(audience),
	);
}

/**
 * Hybrid product recommendations for an appointment: rule-based scoring
 * (focus/avoid colors for all products + fit/stretch/size for bottoms) builds a
 * category-diverse shortlist across the whole catalog, then Claude re-ranks it
 * with the appointment's occasion/style/muse context (falling back to the
 * rule-based order when no API key is set). Returned as enriched, ranked items
 * to store on the appointment.
 */
/**
 * Turn the per-garment intents into a single instruction for the re-ranker:
 * "complement" pieces should be completed (a top for a skirt), "similar" pieces
 * should be matched in style, and "ignore" pieces are left out entirely.
 */
export function buildPairingInstruction(
	analysis: OutfitAnalysis | null,
): string | undefined {
	if (!analysis) return undefined;
	const describe = (g: OutfitGarment) =>
		`${g.type}${g.colors.length ? ` (${g.colors.join(", ")})` : ""}`;
	const complement = analysis.garments
		.filter((g) => g.intent === "complement")
		.map(describe);
	const similar = analysis.garments
		.filter((g) => g.intent === "similar")
		.map(describe);

	const parts: string[] = [];
	if (analysis.pairingContext) parts.push(analysis.pairingContext);
	if (complement.length) {
		parts.push(
			`Recommend pieces that complement (complete the look with): ${complement.join("; ")}.`,
		);
	}
	if (similar.length) {
		parts.push(`Recommend pieces similar in style to: ${similar.join("; ")}.`);
	}
	const text = parts.join(" ").trim();
	return text || undefined;
}

/**
 * Resolve the customer when re-running recommendations on an existing
 * appointment. Prefers the live third-party profile, but falls back to the
 * snapshot captured in source_payload at booking time — so a third-party hiccup
 * (or a mock user that no longer exists locally) doesn't hard-fail regenerate the
 * way booking already tolerates. Returns null only if neither is available.
 */
export async function resolveAppointmentCustomer(
	customerId: string,
	sourcePayload: unknown,
): Promise<CurrentUser | null> {
	try {
		return normalizeCurrentUser(await fetchThirdPartyUser(customerId));
	} catch {
		const snapshot = parseJsonField<{ currentUser?: CurrentUser }>(
			sourcePayload,
		);
		return snapshot?.currentUser
			? normalizeCurrentUser(snapshot.currentUser)
			: null;
	}
}

export async function buildSuggestedProducts(
	customer: CurrentUser,
	input: CreateAppointmentInput,
	museTag: MuseTag,
	orderHistorySummary: Appointment["orderHistorySummary"],
): Promise<SuggestedProduct[]> {
	// When the customer signed off on an outfit to build around, let it fill the
	// gaps: use its suggested focus colors if they left that field blank, and merge
	// in its style keywords. The pairing context is passed to the re-ranker so it
	// recommends complementary pieces (e.g. a top for a skirt).
	const analysis = input.outfitAnalysis ?? null;
	const focusColorsText = input.focusColors?.trim()
		? input.focusColors
		: (analysis?.suggestedFocusColors ?? []).join(", ");
	const styleKeywords = analysis?.suggestedStyleKeywords?.length
		? Array.from(
				new Set([...input.styleKeywords, ...analysis.suggestedStyleKeywords]),
			)
		: input.styleKeywords;

	const context: RecommendationContext = {
		waistInches: customer.measurements.waistInches,
		inseamInches: customer.measurements.inseamInches,
		fitPreference: customer.preferences.fitPreference,
		stretchPreference: customer.preferences.stretchPreference,
		focusColors: parseColors(focusColorsText),
		avoidColors: parseColors(input.avoidColors),
	};
	const selectedAudiences = normalizeCatalogAudiences(
		input.catalogAudiences ?? customer.preferences.catalogAudiences,
	);

	// "Similar"-only mode: when the customer marked pieces and NONE are
	// "complement" (ignored pieces don't count at all), restrict suggestions to
	// the coarse categories of those pieces — all tops if every piece is a top,
	// tops+bottoms for a top+bottom mix, etc. Any "complement" piece disables this
	// and we fall back to the full, cross-category pool.
	const activeGarments = (analysis?.garments ?? []).filter(
		(g) => g.intent !== "ignore",
	);
	const similarOnly =
		activeGarments.length > 0 &&
		activeGarments.every((g) => g.intent === "similar");
	const allowedCategories: Set<CoarseCategory> | null = similarOnly
		? new Set(activeGarments.map((g) => coarseCategoryFromText(g.type)))
		: null;

	const catalogResult = await repository.selectAllCatalogProducts();
	const allCandidates = catalogResult.rows
		.map(mapCatalogProduct)
		.filter((product) =>
			productMatchesCatalogAudiences(product, selectedAudiences),
		);

	// Apply the category restriction, but only if it leaves something to suggest.
	const restricted = allowedCategories
		? allCandidates.filter((p) => allowedCategories.has(coarseCategory(p)))
		: [];
	const useRestricted = restricted.length > 0;
	const candidates = useRestricted ? restricted : allCandidates;

	// When restricted to like categories, category diversity is moot — just take
	// the best matches. Otherwise keep the cross-category diverse shortlist.
	const shortlist = useRestricted
		? rankCandidates(context, candidates, 12)
		: shortlistDiverse(context, candidates, 4, 12);

	const style: StyleContext = {
		occasion: input.occasion,
		focusColors: focusColorsText,
		avoidColors: input.avoidColors,
		styleKeywords,
		museTag,
		preferredSizes: orderHistorySummary.preferredSizes,
		pairingContext: buildPairingInstruction(analysis),
		// Hidden body-shape read (only set when the customer used a "this is me"
		// photo). Steers silhouette/fit; never surfaced anywhere.
		bodyType: analysis?.bodyType ?? null,
	};
	const reranked = await rerank(context, style, shortlist, 5);
	const salesFloorByProductId = await loadSalesFloorByProductId(input.storeId);

	const byId = new Map(shortlist.map((c) => [c.product.productId, c]));
	return reranked.rankings.flatMap((r) => {
		const scored = byId.get(r.productId);
		if (!scored) return [];
		return [
			{
				rank: r.rank,
				rationale: r.rationale,
				score: Number(scored.score.toFixed(3)),
				product: scored.product,
				prepStatus: "suggested",
				associateNote: "",
				salesFloor: salesFloorByProductId.get(scored.product.productId),
			},
		];
	});
}

async function loadSalesFloorByProductId(
	storeId: string,
): Promise<Map<string, StoreInventoryItem>> {
	try {
		const inventory = await fetchThirdPartyStoreInventory(storeId);
		return new Map(
			inventory.inventory.map((item) => [
				item.productId,
				{
					...item,
					storeId: item.storeId || storeId,
					lowStock: item.lowStock || item.quantityAvailable <= 1,
				},
			]),
		);
	} catch {
		return new Map();
	}
}

/**
 * Run the recommendation engine for an appointment in the BACKGROUND and store
 * the result, flipping suggestions_status to 'ready' (or 'failed'). Fire-and-
 * forget: callers should have already set the row to 'pending' and returned to
 * the client, so booking/regenerate don't block on the ~slow Claude re-rank.
 *
 * Intentionally not awaited by callers; it swallows its own errors (recording
 * 'failed' so the UI can offer a retry) and never rejects the caller's request.
 */
export function startSuggestionGeneration(args: {
	appointmentId: string;
	customer: CurrentUser;
	input: CreateAppointmentInput;
	museTag: MuseTag;
	orderHistorySummary: Appointment["orderHistorySummary"];
	log?: { error: (...args: unknown[]) => void };
}): void {
	const { appointmentId, customer, input, museTag, orderHistorySummary, log } =
		args;
	void (async () => {
		try {
			const suggestedProducts = await buildSuggestedProducts(
				customer,
				input,
				museTag,
				orderHistorySummary,
			);
			await repository.updateAppointmentSuggestionsResult(
				JSON.stringify(suggestedProducts),
				"ready",
				appointmentId,
			);
		} catch (error) {
			log?.error(
				{ err: error, appointmentId },
				"Background suggestion generation failed",
			);
			// Record the failure so the row doesn't sit on 'pending' forever; the
			// stylist can retry via regenerate-suggestions. Best-effort — never let a
			// failure here escape as an unhandled rejection.
			try {
				await repository.updateAppointmentSuggestionsResult(
					"[]",
					"failed",
					appointmentId,
				);
			} catch {
				// Swallow — nothing more we can do from the background task.
			}
		}
	})();
}

export async function selectAppointmentById(appointmentId: string) {
	const result =
		await repository.selectAppointmentWithNotificationsById(appointmentId);

	return result.rows[0] ? mapAppointment(result.rows[0]) : null;
}

export function reminderScheduledFor(slotStart: string, now = new Date()) {
	const appointmentStart = new Date(slotStart);
	const oneDayBefore = new Date(appointmentStart);
	oneDayBefore.setHours(oneDayBefore.getHours() - 24);

	if (oneDayBefore > now) {
		return oneDayBefore.toISOString();
	}

	const twoHoursBefore = new Date(appointmentStart);
	twoHoursBefore.setHours(twoHoursBefore.getHours() - 2);
	return twoHoursBefore.toISOString();
}

export async function createMockNotifications(
	appointmentId: string,
	slotStart: string,
) {
	await repository.insertAppointmentNotifications(
		randomUUID(),
		randomUUID(),
		appointmentId,
		reminderScheduledFor(slotStart),
	);
}
