import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { rerank, type StyleContext } from "./claude-reranker.js";
import { pool } from "./db.js";
import {
	parseColors,
	type RecommendationContext,
	shortlistDiverse,
} from "./recommendation-scoring.js";
import {
	fetchThirdPartyOrderHistory,
	fetchThirdPartyStylist,
	fetchThirdPartyStylistAvailability,
	fetchThirdPartyStylists,
	fetchThirdPartyUser,
	fetchThirdPartyUsers,
	ThirdPartyHttpError,
} from "./recommendations.js";
import {
	type Appointment,
	type AppointmentSlot,
	type CatalogProduct,
	type CreateAppointmentInput,
	type CurrentUser,
	catalogQuerySchema,
	type MuseTag,
	type OrderHistory,
	type OrderHistoryScenario,
	type StylistAvailabilitySchedule,
	type StylistAvailabilityStatus,
	type StylistProfile,
	type SuggestedProduct,
	type UserList,
} from "./types.js";

let activeUserId = "cust_avery_001";

const fitPreferenceEnum = [
	"skinny",
	"slim",
	"straight",
	"relaxed",
	"wide",
] as const;
const stretchPreferenceEnum = [
	"rigid",
	"comfort-stretch",
	"high-stretch",
] as const;
const orderHistoryScenarioEnum = [
	"standard",
	"denim-heavy",
	"returns",
	"empty",
	"error",
] as const;
const stylistAvailabilityEnum = ["available", "busy", "offline"] as const;
const museTagEnum = [
	"Clean Muse",
	"Romantic Muse",
	"Boyish Muse",
	"Statement Maker",
] as const;
const appointmentStatusEnum = ["scheduled", "completed"] as const;
const styleKeywordEnum = [
	"minimal",
	"effortless",
	"timeless essentials",
	"feminine",
	"soft",
	"subtly dressed-up",
	"preppy",
	"relaxed",
	"sporty",
	"menswear-inspired",
	"trend-forward",
	"bold",
	"boundary-pushing",
] as const;

const currentUserJsonSchema = {
	type: "object",
	required: [
		"customerId",
		"loyaltyId",
		"displayName",
		"measurements",
		"preferences",
	],
	properties: {
		customerId: { type: "string" },
		loyaltyId: { type: "string" },
		displayName: { type: "string" },
		measurements: {
			type: "object",
			required: ["heightInches", "waistInches", "hipInches", "inseamInches"],
			properties: {
				heightInches: { type: "integer" },
				waistInches: { type: "number" },
				hipInches: { type: "number" },
				inseamInches: { type: "number" },
			},
		},
		preferences: {
			type: "object",
			required: ["fitPreference", "stretchPreference"],
			properties: {
				fitPreference: { type: "string", enum: fitPreferenceEnum },
				stretchPreference: { type: "string", enum: stretchPreferenceEnum },
			},
		},
	},
} as const;

const userListJsonSchema = {
	type: "object",
	required: ["users"],
	properties: {
		users: {
			type: "array",
			items: currentUserJsonSchema,
		},
	},
} as const;

const activeUserJsonSchema = {
	type: "object",
	required: ["activeUserId", "user"],
	properties: {
		activeUserId: { type: "string" },
		user: currentUserJsonSchema,
	},
} as const;

const setActiveUserJsonSchema = {
	type: "object",
	required: ["customerId"],
	properties: {
		customerId: { type: "string", minLength: 1 },
	},
} as const;

const errorJsonSchema = {
	type: "object",
	properties: {
		message: { type: "string" },
	},
} as const;

const orderHistoryItemJsonSchema = {
	type: "object",
	required: [
		"sku",
		"productName",
		"category",
		"sizeLabel",
		"fit",
		"wash",
		"quantity",
		"unitPrice",
		"kept",
		"returnReason",
	],
	properties: {
		sku: { type: "string" },
		productName: { type: "string" },
		category: { type: "string" },
		sizeLabel: { type: "string" },
		fit: { type: "string" },
		wash: { type: "string" },
		quantity: { type: "integer", minimum: 1 },
		unitPrice: { type: "number", minimum: 0 },
		kept: { type: "boolean" },
		returnReason: { anyOf: [{ type: "string" }, { type: "null" }] },
	},
} as const;

const orderHistoryJsonSchema = {
	type: "object",
	required: ["customerId", "scenario", "orders"],
	properties: {
		customerId: { type: "string" },
		scenario: { type: "string", enum: orderHistoryScenarioEnum },
		orders: {
			type: "array",
			items: {
				type: "object",
				required: ["orderId", "orderedAt", "channel", "status", "items"],
				properties: {
					orderId: { type: "string" },
					orderedAt: { type: "string", format: "date-time" },
					channel: { type: "string", enum: ["web", "store", "mobile"] },
					status: {
						type: "string",
						enum: ["processing", "delivered", "returned", "exchanged"],
					},
					items: {
						type: "array",
						items: orderHistoryItemJsonSchema,
					},
				},
			},
		},
	},
} as const;

const stylistJsonSchema = {
	type: "object",
	required: [
		"id",
		"displayName",
		"pronouns",
		"title",
		"store",
		"bio",
		"specialties",
		"stylePointOfView",
		"supportedFits",
		"customerSignals",
		"availability",
		"avatarUrl",
	],
	properties: {
		id: { type: "string" },
		displayName: { type: "string" },
		pronouns: { type: "string" },
		title: { type: "string" },
		store: {
			type: "object",
			required: ["storeId", "name", "city", "state"],
			properties: {
				storeId: { type: "string" },
				name: { type: "string" },
				city: { type: "string" },
				state: { type: "string" },
			},
		},
		bio: { type: "string" },
		specialties: { type: "array", items: { type: "string" } },
		stylePointOfView: { type: "array", items: { type: "string" } },
		supportedFits: { type: "array", items: { type: "string" } },
		customerSignals: { type: "array", items: { type: "string" } },
		availability: {
			type: "object",
			required: ["status", "nextAvailableAt"],
			properties: {
				status: { type: "string", enum: stylistAvailabilityEnum },
				nextAvailableAt: {
					anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
				},
			},
		},
		avatarUrl: { anyOf: [{ type: "string", format: "uri" }, { type: "null" }] },
	},
} as const;

const stylistListJsonSchema = {
	type: "object",
	required: ["stylists"],
	properties: {
		stylists: {
			type: "array",
			items: stylistJsonSchema,
		},
	},
} as const;

const stylistAvailabilityJsonSchema = {
	type: "object",
	required: ["store", "timezone", "startDate", "endDate", "days"],
	properties: {
		store: stylistJsonSchema.properties.store,
		timezone: { type: "string" },
		startDate: { type: "string", format: "date" },
		endDate: { type: "string", format: "date" },
		days: {
			type: "array",
			items: {
				type: "object",
				required: [
					"date",
					"dayOfWeek",
					"storeOpen",
					"openTime",
					"closeTime",
					"scheduledStylists",
				],
				properties: {
					date: { type: "string", format: "date" },
					dayOfWeek: { type: "string" },
					storeOpen: { type: "boolean" },
					openTime: { anyOf: [{ type: "string" }, { type: "null" }] },
					closeTime: { anyOf: [{ type: "string" }, { type: "null" }] },
					scheduledStylists: {
						type: "array",
						items: {
							type: "object",
							required: [
								"stylistId",
								"displayName",
								"role",
								"shiftStart",
								"shiftEnd",
							],
							properties: {
								stylistId: { type: "string" },
								displayName: { type: "string" },
								role: { type: "string" },
								shiftStart: { type: "string", format: "date-time" },
								shiftEnd: { type: "string", format: "date-time" },
							},
						},
					},
				},
			},
		},
	},
} as const;

const appointmentSlotJsonSchema = {
	type: "object",
	required: ["slotStart", "slotEnd", "date", "time", "availableStylistCount"],
	properties: {
		slotStart: { type: "string", format: "date-time" },
		slotEnd: { type: "string", format: "date-time" },
		date: { type: "string", format: "date" },
		time: { type: "string" },
		availableStylistCount: { type: "integer", minimum: 1 },
	},
} as const;

const createAppointmentJsonSchema = {
	type: "object",
	required: [
		"slotStart",
		"occasion",
		"focusColors",
		"avoidColors",
		"styleKeywords",
	],
	properties: {
		slotStart: { type: "string", format: "date-time" },
		occasion: { type: "string", minLength: 1 },
		focusColors: { type: "string" },
		avoidColors: { type: "string" },
		styleKeywords: {
			type: "array",
			minItems: 1,
			items: { type: "string", enum: styleKeywordEnum },
		},
		guidance: { type: "string" },
		orderHistoryScenario: {
			type: "string",
			enum: orderHistoryScenarioEnum,
			default: "standard",
		},
	},
} as const;

const updateAppointmentJsonSchema = {
	type: "object",
	required: ["guidance"],
	properties: {
		guidance: { type: "string", maxLength: 1000 },
	},
} as const;

const updateSessionNotesJsonSchema = {
	type: "object",
	required: ["sessionNotes"],
	properties: {
		sessionNotes: { type: "string", maxLength: 3000 },
	},
} as const;

const appointmentIdParamsJsonSchema = {
	type: "object",
	required: ["appointmentId"],
	properties: {
		appointmentId: { type: "string", format: "uuid" },
	},
} as const;

const appointmentSummaryJsonSchema = {
	type: "object",
	required: [
		"id",
		"customerId",
		"loyaltyId",
		"customerName",
		"slotStart",
		"slotEnd",
		"occasion",
		"focusColors",
		"avoidColors",
		"styleKeywords",
		"guidance",
		"sessionNotes",
		"status",
		"museTag",
		"assignedStylist",
		"orderHistorySummary",
		"suggestedProducts",
		"completedAt",
		"createdAt",
	],
	properties: {
		id: { type: "string", format: "uuid" },
		customerId: { type: "string" },
		loyaltyId: { type: "string" },
		customerName: { type: "string" },
		slotStart: { type: "string", format: "date-time" },
		slotEnd: { type: "string", format: "date-time" },
		occasion: { type: "string" },
		focusColors: { type: "string" },
		avoidColors: { type: "string" },
		styleKeywords: { type: "array", items: { type: "string" } },
		guidance: { type: "string" },
		sessionNotes: { type: "string" },
		status: { type: "string", enum: appointmentStatusEnum },
		museTag: { type: "string", enum: museTagEnum },
		assignedStylist: stylistJsonSchema,
		orderHistorySummary: {
			type: "object",
			required: [
				"totalOrders",
				"denimItems",
				"returnedItems",
				"preferredSizes",
			],
			properties: {
				totalOrders: { type: "integer" },
				denimItems: { type: "integer" },
				returnedItems: { type: "integer" },
				preferredSizes: { type: "array", items: { type: "string" } },
			},
		},
		suggestedProducts: {
			type: "array",
			items: {
				type: "object",
				required: ["rank", "rationale", "score", "product"],
				properties: {
					rank: { type: "integer" },
					rationale: { type: "string" },
					score: { anyOf: [{ type: "number" }, { type: "null" }] },
					product: {
						type: "object",
						additionalProperties: true,
					},
				},
			},
		},
		completedAt: {
			anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
		},
		createdAt: { type: "string", format: "date-time" },
	},
} as const;

function filterStylists(
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

function addOneHour(isoDateTime: string) {
	const date = new Date(isoDateTime);
	date.setHours(date.getHours() + 1);
	return date.toISOString();
}

function normalizeSlotKey(value: string) {
	return new Date(value).toISOString();
}

function createAppointmentSlots(
	availability: StylistAvailabilitySchedule,
): AppointmentSlot[] {
	const now = new Date();

	return availability.days.flatMap((day) => {
		if (!day.storeOpen || day.scheduledStylists.length === 0) {
			return [];
		}

		return [11, 12, 13, 14, 15, 16, 17, 18].flatMap((hour) => {
			const hourLabel = String(hour).padStart(2, "0");
			const slotStart = `${day.date}T${hourLabel}:00:00-04:00`;

			if (new Date(slotStart) <= now) {
				return [];
			}

			return [
				{
					slotStart,
					slotEnd: addOneHour(slotStart),
					date: day.date,
					time: `${hourLabel}:00`,
					availableStylistCount: day.scheduledStylists.length,
				},
			];
		});
	});
}

function findAvailabilityDayForSlot(
	availability: StylistAvailabilitySchedule,
	slotStart: string,
) {
	const requested = new Date(slotStart);
	return availability.days.find((day) =>
		day.scheduledStylists.some((shift) => {
			const shiftStart = new Date(shift.shiftStart);
			const shiftEnd = new Date(shift.shiftEnd);
			return requested >= shiftStart && requested < shiftEnd;
		}),
	);
}

function mapMuseTag(styleKeywords: string[]): MuseTag {
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

function summarizeOrderHistory(orderHistory: OrderHistory) {
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

function assignStylist(
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

function parseJsonField<T>(value: unknown): T {
	return typeof value === "string" ? JSON.parse(value) : (value as T);
}

function mapAppointment(row: Record<string, unknown>): Appointment {
	return {
		id: String(row.id),
		customerId: String(row.customer_id),
		loyaltyId: String(row.loyalty_id),
		customerName: String(row.customer_name),
		slotStart: new Date(String(row.slot_start)).toISOString(),
		slotEnd: new Date(String(row.slot_end)).toISOString(),
		occasion: String(row.occasion),
		focusColors: String(row.focus_colors),
		avoidColors: String(row.avoid_colors),
		styleKeywords: parseJsonField<string[]>(row.style_keywords),
		guidance: String(row.guidance),
		sessionNotes: String(row.session_notes ?? ""),
		status: String(row.status ?? "scheduled") as Appointment["status"],
		museTag: String(row.muse_tag) as MuseTag,
		assignedStylist: parseJsonField<StylistProfile>(row.assigned_stylist),
		orderHistorySummary: parseJsonField<Appointment["orderHistorySummary"]>(
			row.order_history_summary,
		),
		suggestedProducts: row.suggested_products
			? parseJsonField<SuggestedProduct[]>(row.suggested_products)
			: [],
		completedAt: row.completed_at
			? new Date(String(row.completed_at)).toISOString()
			: null,
		createdAt: new Date(String(row.created_at)).toISOString(),
	};
}

async function getActiveUser() {
	return fetchThirdPartyUser(activeUserId);
}

function userExists(users: UserList, customerId: string) {
	return users.users.some((user) => user.customerId === customerId);
}

function mapCatalogProduct(row: Record<string, unknown>): CatalogProduct {
	return {
		productId: String(row.product_id),
		source: String(row.source),
		name: String(row.name),
		category: row.category == null ? null : String(row.category),
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
		colors: Array.isArray(row.colors) ? (row.colors as string[]) : [],
		scrapedAt: new Date(String(row.scraped_at)).toISOString(),
	};
}

/**
 * Hybrid product recommendations for an appointment: rule-based scoring
 * (focus/avoid colors for all products + fit/stretch/size for bottoms) builds a
 * category-diverse shortlist across the whole catalog, then Claude re-ranks it
 * with the appointment's occasion/style/muse context (falling back to the
 * rule-based order when no API key is set). Returned as enriched, ranked items
 * to store on the appointment.
 */
async function buildSuggestedProducts(
	customer: CurrentUser,
	input: CreateAppointmentInput,
	museTag: MuseTag,
	orderHistorySummary: Appointment["orderHistorySummary"],
): Promise<SuggestedProduct[]> {
	const context: RecommendationContext = {
		waistInches: customer.measurements.waistInches,
		inseamInches: customer.measurements.inseamInches,
		fitPreference: customer.preferences.fitPreference,
		stretchPreference: customer.preferences.stretchPreference,
		focusColors: parseColors(input.focusColors),
		avoidColors: parseColors(input.avoidColors),
	};

	const catalogResult = await pool.query("SELECT * FROM catalog_products");
	const candidates = catalogResult.rows.map(mapCatalogProduct);
	const shortlist = shortlistDiverse(context, candidates, 4, 12);

	const style: StyleContext = {
		occasion: input.occasion,
		focusColors: input.focusColors,
		avoidColors: input.avoidColors,
		styleKeywords: input.styleKeywords,
		museTag,
		preferredSizes: orderHistorySummary.preferredSizes,
	};
	const reranked = await rerank(context, style, shortlist, 5);

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
			},
		];
	});
}

export async function registerRoutes(app: FastifyInstance) {
	app.get(
		"/health",
		{
			schema: {
				tags: ["health"],
				summary: "Check API health",
				response: {
					200: {
						type: "object",
						required: ["ok"],
						properties: {
							ok: { type: "boolean" },
						},
					},
				},
			},
		},
		async () => ({ ok: true }),
	);

	// Browse the scraped catalog with optional fit/rise/stretch/category/text filters.
	app.get("/api/catalog", async (request, reply) => {
		const parsed = catalogQuerySchema.safeParse(request.query);

		if (!parsed.success) {
			return reply.code(400).send({
				message: "Invalid catalog query",
				issues: parsed.error.issues,
			});
		}

		const { fit, rise, stretch, category, q, limit, offset } = parsed.data;
		const conditions: string[] = [];
		const params: unknown[] = [];

		const eq = (column: string, value: unknown) => {
			params.push(value);
			conditions.push(`${column} = $${params.length}`);
		};
		const like = (column: string, value: string) => {
			params.push(`%${value}%`);
			conditions.push(`${column} ILIKE $${params.length}`);
		};

		if (fit) eq("fit", fit);
		if (rise) eq("rise", rise);
		if (stretch) eq("stretch", stretch);
		if (category) like("category", category);
		if (q) {
			params.push(`%${q}%`);
			const i = params.length;
			conditions.push(`(name ILIKE $${i} OR description ILIKE $${i})`);
		}

		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

		const totalResult = await pool.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM catalog_products ${where}`,
			params,
		);

		const rowsResult = await pool.query(
			`SELECT * FROM catalog_products ${where} ORDER BY scraped_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
			[...params, limit, offset],
		);

		return {
			total: Number(totalResult.rows[0]?.count ?? 0),
			limit,
			offset,
			products: rowsResult.rows.map(mapCatalogProduct),
		};
	});

	app.get("/api/catalog/:productId", async (request, reply) => {
		const { productId } = request.params as { productId: string };
		const result = await pool.query(
			"SELECT * FROM catalog_products WHERE product_id = $1",
			[productId],
		);

		if (result.rowCount === 0) {
			return reply.code(404).send({ message: "Catalog product not found" });
		}

		return { product: mapCatalogProduct(result.rows[0]) };
	});

	app.get(
		"/api/admin/users",
		{
			schema: {
				tags: ["admin"],
				summary: "List mock customers available for local testing",
				response: {
					200: userListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await fetchThirdPartyUsers();
			} catch (error) {
				request.log.error(error);
				return reply.code(502).send({ message: "Unable to load mock users" });
			}
		},
	);

	app.get(
		"/api/admin/active-user",
		{
			schema: {
				tags: ["admin"],
				summary: "Get the active mock customer",
				response: {
					200: activeUserJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const user = await getActiveUser();
				return { activeUserId, user };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load active mock user" });
			}
		},
	);

	app.put(
		"/api/admin/active-user",
		{
			schema: {
				tags: ["admin"],
				summary: "Set the active mock customer",
				body: setActiveUserJsonSchema,
				response: {
					200: activeUserJsonSchema,
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const input = request.body as { customerId: string };

			try {
				const users = await fetchThirdPartyUsers();
				if (!userExists(users, input.customerId)) {
					return reply.code(404).send({ message: "Mock user not found" });
				}

				activeUserId = input.customerId;
				const user = await getActiveUser();
				return { activeUserId, user };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to set active mock user" });
			}
		},
	);

	app.get(
		"/api/me",
		{
			schema: {
				tags: ["user"],
				summary: "Get the mocked logged-in loyalty customer",
				response: {
					200: currentUserJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await getActiveUser();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party current user" });
			}
		},
	);

	app.get(
		"/api/appointments/slots",
		{
			schema: {
				tags: ["appointments"],
				summary: "List bookable guided fitting appointment slots",
				response: {
					200: {
						type: "object",
						required: ["slots"],
						properties: {
							slots: { type: "array", items: appointmentSlotJsonSchema },
						},
					},
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const availability = await fetchThirdPartyStylistAvailability();
				return { slots: createAppointmentSlots(availability) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party appointment slots" });
			}
		},
	);

	app.get(
		"/api/appointments",
		{
			schema: {
				tags: ["appointments"],
				summary: "List booked guided fitting appointments",
				response: {
					200: {
						type: "object",
						required: ["appointments"],
						properties: {
							appointments: {
								type: "array",
								items: appointmentSummaryJsonSchema,
							},
						},
					},
				},
			},
		},
		async () => {
			const result = await pool.query(`
				SELECT *
				FROM appointments
				ORDER BY slot_start ASC, created_at DESC
				LIMIT 100
			`);

			return { appointments: result.rows.map(mapAppointment) };
		},
	);

	app.get(
		"/api/appointments/me/upcoming",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Get the mocked customer's upcoming guided fitting appointment",
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: {
								anyOf: [appointmentSummaryJsonSchema, { type: "null" }],
							},
						},
					},
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						SELECT *
						FROM appointments
						WHERE customer_id = $1
							AND slot_start >= now()
							AND status = 'scheduled'
						ORDER BY slot_start ASC
						LIMIT 1
					`,
					[currentUser.customerId],
				);

				return {
					appointment: result.rows[0] ? mapAppointment(result.rows[0]) : null,
				};
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load upcoming appointment" });
			}
		},
	);

	app.get(
		"/api/appointments/me/past",
		{
			schema: {
				tags: ["appointments"],
				summary: "List the mocked customer's past guided fitting appointments",
				response: {
					200: {
						type: "object",
						required: ["appointments"],
						properties: {
							appointments: {
								type: "array",
								items: appointmentSummaryJsonSchema,
							},
						},
					},
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						SELECT *
						FROM appointments
						WHERE customer_id = $1
							AND (slot_start < now() OR status = 'completed')
						ORDER BY slot_start DESC
						LIMIT 25
					`,
					[currentUser.customerId],
				);

				return { appointments: result.rows.map(mapAppointment) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load past appointments" });
			}
		},
	);

	app.post(
		"/api/appointments",
		{
			schema: {
				tags: ["appointments"],
				summary: "Book a guided fitting appointment",
				body: createAppointmentJsonSchema,
				response: {
					201: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const input = request.body as CreateAppointmentInput;
			const appointmentId = randomUUID();

			try {
				const [currentUser, availability, stylistList] = await Promise.all([
					getActiveUser(),
					fetchThirdPartyStylistAvailability(),
					fetchThirdPartyStylists(),
				]);

				const existingAppointment = await pool.query(
					`
						SELECT id
						FROM appointments
						WHERE customer_id = $1
							AND slot_start >= now()
							AND status = 'scheduled'
						ORDER BY slot_start ASC
						LIMIT 1
					`,
					[currentUser.customerId],
				);

				if (existingAppointment.rowCount && existingAppointment.rowCount > 0) {
					return reply
						.code(409)
						.send({ message: "Customer already has an upcoming appointment" });
				}

				const slots = createAppointmentSlots(availability);
				const selectedSlot = slots.find(
					(slot) =>
						normalizeSlotKey(slot.slotStart) ===
						normalizeSlotKey(input.slotStart),
				);

				if (!selectedSlot) {
					return reply
						.code(409)
						.send({ message: "Appointment slot is no longer available" });
				}

				const availabilityDay = findAvailabilityDayForSlot(
					availability,
					selectedSlot.slotStart,
				);
				if (!availabilityDay) {
					return reply
						.code(409)
						.send({ message: "Appointment slot is no longer available" });
				}

				const museTag = mapMuseTag(input.styleKeywords);
				const assignedStylist = assignStylist(
					availabilityDay.scheduledStylists.map((stylist) => stylist.stylistId),
					stylistList.stylists,
					museTag,
				);

				if (!assignedStylist) {
					return reply
						.code(409)
						.send({ message: "No stylist is available for the selected slot" });
				}

				const orderHistory = await fetchThirdPartyOrderHistory(
					currentUser.customerId,
					input.orderHistoryScenario ?? "standard",
				);
				const orderHistorySummary = summarizeOrderHistory(orderHistory);
				const suggestedProducts = await buildSuggestedProducts(
					currentUser,
					input,
					museTag,
					orderHistorySummary,
				);

				const insertResult = await pool.query(
					`
						INSERT INTO appointments (
							id, customer_id, loyalty_id, customer_name, slot_start, slot_end,
							occasion, focus_colors, avoid_colors, style_keywords, guidance,
							session_notes, status, muse_tag, assigned_stylist,
							order_history_summary, suggested_products, source_payload
						)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '', 'scheduled', $12, $13, $14, $15, $16)
						RETURNING *
					`,
					[
						appointmentId,
						currentUser.customerId,
						currentUser.loyaltyId,
						currentUser.displayName,
						new Date(selectedSlot.slotStart).toISOString(),
						new Date(selectedSlot.slotEnd).toISOString(),
						input.occasion,
						input.focusColors,
						input.avoidColors,
						JSON.stringify(input.styleKeywords),
						input.guidance ?? "",
						museTag,
						JSON.stringify(assignedStylist),
						JSON.stringify(orderHistorySummary),
						JSON.stringify(suggestedProducts),
						JSON.stringify({ input, currentUser, orderHistory }),
					],
				);

				return reply.code(201).send({
					appointment: mapAppointment(insertResult.rows[0]),
				});
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to book guided fitting appointment" });
			}
		},
	);

	app.patch(
		"/api/appointments/:appointmentId",
		{
			schema: {
				tags: ["appointments"],
				summary: "Update the mocked customer's appointment guidance",
				params: appointmentIdParamsJsonSchema,
				body: updateAppointmentJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { guidance: string };

			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						UPDATE appointments
						SET guidance = $1
						WHERE id = $2
							AND customer_id = $3
							AND slot_start >= now()
							AND status = 'scheduled'
						RETURNING *
					`,
					[input.guidance, appointmentId, currentUser.customerId],
				);

				if (!result.rows[0]) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to update appointment" });
			}
		},
	);

	app.patch(
		"/api/appointments/:appointmentId/session-notes",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"Update associate session notes while an appointment is not completed",
				params: appointmentIdParamsJsonSchema,
				body: updateSessionNotesJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { sessionNotes: string };

			try {
				const result = await pool.query(
					`
						UPDATE appointments
						SET session_notes = $1
						WHERE id = $2
							AND status <> 'completed'
						RETURNING *
					`,
					[input.sessionNotes, appointmentId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						"SELECT status FROM appointments WHERE id = $1",
						[appointmentId],
					);
					if (existing.rows[0]?.status === "completed") {
						return reply
							.code(409)
							.send({ message: "Completed appointments cannot be edited" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to update session notes" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/complete",
		{
			schema: {
				tags: ["appointments"],
				summary: "Mark an appointment session as completed",
				params: appointmentIdParamsJsonSchema,
				body: updateSessionNotesJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };
			const input = request.body as { sessionNotes: string };

			try {
				const result = await pool.query(
					`
						UPDATE appointments
						SET session_notes = $1,
							status = 'completed',
							completed_at = now()
						WHERE id = $2
							AND status <> 'completed'
						RETURNING *
					`,
					[input.sessionNotes, appointmentId],
				);

				if (!result.rows[0]) {
					const existing = await pool.query(
						"SELECT status FROM appointments WHERE id = $1",
						[appointmentId],
					);
					if (existing.rows[0]?.status === "completed") {
						return reply
							.code(409)
							.send({ message: "Appointment is already completed" });
					}
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to complete appointment" });
			}
		},
	);

	app.post(
		"/api/appointments/:appointmentId/regenerate-suggestions",
		{
			schema: {
				tags: ["appointments"],
				summary: "Re-run the recommendation engine for an appointment",
				params: appointmentIdParamsJsonSchema,
				response: {
					200: {
						type: "object",
						required: ["appointment"],
						properties: {
							appointment: appointmentSummaryJsonSchema,
						},
					},
					404: errorJsonSchema,
					409: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			const existing = await pool.query(
				"SELECT * FROM appointments WHERE id = $1",
				[appointmentId],
			);
			if (!existing.rows[0]) {
				return reply.code(404).send({ message: "Appointment not found" });
			}
			const appointment = mapAppointment(existing.rows[0]);
			if (appointment.status === "completed") {
				return reply
					.code(409)
					.send({ message: "Completed appointments cannot be edited" });
			}

			try {
				const customer = await fetchThirdPartyUser(appointment.customerId);
				const suggestedProducts = await buildSuggestedProducts(
					customer,
					{
						slotStart: appointment.slotStart,
						occasion: appointment.occasion,
						focusColors: appointment.focusColors,
						avoidColors: appointment.avoidColors,
						styleKeywords: appointment.styleKeywords,
						guidance: appointment.guidance,
					},
					appointment.museTag,
					appointment.orderHistorySummary,
				);

				const result = await pool.query(
					"UPDATE appointments SET suggested_products = $1 WHERE id = $2 RETURNING *",
					[JSON.stringify(suggestedProducts), appointmentId],
				);

				return { appointment: mapAppointment(result.rows[0]) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to regenerate suggestions" });
			}
		},
	);

	app.delete(
		"/api/appointments/:appointmentId",
		{
			schema: {
				tags: ["appointments"],
				summary: "Cancel the mocked customer's upcoming appointment",
				params: appointmentIdParamsJsonSchema,
				response: {
					204: {
						type: "null",
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { appointmentId } = request.params as { appointmentId: string };

			try {
				const currentUser = await getActiveUser();
				const result = await pool.query(
					`
						DELETE FROM appointments
						WHERE id = $1
							AND customer_id = $2
							AND slot_start >= now()
							AND status = 'scheduled'
					`,
					[appointmentId, currentUser.customerId],
				);

				if (!result.rowCount) {
					return reply.code(404).send({ message: "Appointment not found" });
				}

				return reply.code(204).send();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to cancel appointment" });
			}
		},
	);

	app.get(
		"/api/customers/:customerId/order-history",
		{
			schema: {
				tags: ["order-history"],
				summary:
					"Get customer order history from the simulated third-party service",
				params: {
					type: "object",
					required: ["customerId"],
					properties: {
						customerId: { type: "string", minLength: 1 },
					},
				},
				querystring: {
					type: "object",
					properties: {
						scenario: {
							type: "string",
							enum: orderHistoryScenarioEnum,
							default: "standard",
						},
					},
				},
				response: {
					200: orderHistoryJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { customerId } = request.params as { customerId: string };
			const { scenario = "standard" } = request.query as {
				scenario?: OrderHistoryScenario;
			};

			try {
				return await fetchThirdPartyOrderHistory(customerId, scenario);
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party order history" });
			}
		},
	);

	app.get(
		"/api/stylists",
		{
			schema: {
				tags: ["stylists"],
				summary: "List simulated store-associate stylist profiles",
				querystring: {
					type: "object",
					properties: {
						specialty: { type: "string" },
						fit: { type: "string" },
						availability: { type: "string", enum: stylistAvailabilityEnum },
					},
				},
				response: {
					200: stylistListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const filters = request.query as {
				specialty?: string;
				fit?: string;
				availability?: StylistAvailabilityStatus;
			};

			try {
				const data = await fetchThirdPartyStylists();
				return { stylists: filterStylists(data.stylists, filters) };
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party stylist profiles" });
			}
		},
	);

	app.get(
		"/api/stylists/availability",
		{
			schema: {
				tags: ["stylists"],
				summary:
					"Get the next 10 days of simulated store-associate stylist availability",
				response: {
					200: stylistAvailabilityJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			try {
				return await fetchThirdPartyStylistAvailability();
			} catch (error) {
				request.log.error(error);
				return reply
					.code(502)
					.send({ message: "Unable to load third-party stylist availability" });
			}
		},
	);

	app.get(
		"/api/stylists/:stylistId",
		{
			schema: {
				tags: ["stylists"],
				summary: "Get a simulated store-associate stylist profile",
				params: {
					type: "object",
					required: ["stylistId"],
					properties: {
						stylistId: { type: "string", minLength: 1 },
					},
				},
				response: {
					200: {
						type: "object",
						required: ["stylist"],
						properties: {
							stylist: stylistJsonSchema,
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { stylistId } = request.params as { stylistId: string };

			try {
				const stylist = await fetchThirdPartyStylist(stylistId);
				return { stylist };
			} catch (error) {
				request.log.error(error);

				if (error instanceof ThirdPartyHttpError && error.status === 404) {
					return reply.code(404).send({ message: "Stylist not found" });
				}

				return reply
					.code(502)
					.send({ message: "Unable to load third-party stylist profile" });
			}
		},
	);
}
