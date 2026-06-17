import { z } from "zod";

export type FitPreference = "skinny" | "slim" | "straight" | "relaxed" | "wide";
export type StretchPreference = "rigid" | "comfort-stretch" | "high-stretch";
export type CatalogAudience = "womens" | "mens";

export type CurrentUser = {
	customerId: string;
	loyaltyId: string;
	displayName: string;
	measurements: {
		heightInches: number;
		waistInches: number;
		hipInches: number;
		inseamInches: number;
	};
	preferences: {
		fitPreference: FitPreference;
		stretchPreference: StretchPreference;
		catalogAudiences?: CatalogAudience[];
	};
};

export type UserList = {
	users: CurrentUser[];
};

export type OrderHistoryScenario =
	| "standard"
	| "denim-heavy"
	| "returns"
	| "empty"
	| "error";

export type OrderHistoryItem = {
	sku: string;
	productName: string;
	category: string;
	sizeLabel: string;
	fit: string;
	wash: string;
	quantity: number;
	unitPrice: number;
	kept: boolean;
	returnReason: string | null;
};

export type OrderHistoryOrder = {
	orderId: string;
	orderedAt: string;
	channel: "web" | "store" | "mobile";
	status: "processing" | "delivered" | "returned" | "exchanged";
	items: OrderHistoryItem[];
};

export type OrderHistory = {
	customerId: string;
	scenario: OrderHistoryScenario;
	orders: OrderHistoryOrder[];
};

export type StylistAvailabilityStatus = "available" | "busy" | "offline";

export type Store = {
	storeId: string;
	name: string;
	city: string;
	state: string;
	address: string;
	phone: string;
	timezone: string;
};

export type StoreList = {
	stores: Store[];
};

export type StylistProfile = {
	id: string;
	displayName: string;
	pronouns: string;
	title: string;
	store: Pick<Store, "storeId" | "name" | "city" | "state">;
	bio: string;
	specialties: string[];
	stylePointOfView: string[];
	supportedFits: string[];
	customerSignals: string[];
	availability: {
		status: StylistAvailabilityStatus;
		nextAvailableAt: string | null;
	};
	avatarUrl: string | null;
};

export type StylistList = {
	stylists: StylistProfile[];
};

export type StoreScheduleDayPattern = {
	dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday";
	openTime: string;
	closeTime: string;
	stylistIds: string[];
};

export type StoreSchedulePattern = {
	storeId: string;
	timezone: string;
	weekly: StoreScheduleDayPattern[];
};

export type StoreSchedulePatternList = {
	patterns: StoreSchedulePattern[];
};

export type StylistShift = {
	stylistId: string;
	displayName: string;
	role: string;
	shiftStart: string;
	shiftEnd: string;
};

export type StylistAvailabilityDay = {
	date: string;
	dayOfWeek: string;
	storeOpen: boolean;
	openTime: string | null;
	closeTime: string | null;
	scheduledStylists: StylistShift[];
};

export type StylistAvailabilitySchedule = {
	store: StylistProfile["store"];
	timezone: string;
	startDate: string;
	endDate: string;
	days: StylistAvailabilityDay[];
};

// Query params for browsing the scraped catalog. Coerced from strings since
// they arrive on the query string.
export const catalogQuerySchema = z.object({
	fit: z.enum(["skinny", "slim", "straight", "relaxed", "wide"]).optional(),
	rise: z.enum(["ultra-high", "high", "mid", "low"]).optional(),
	stretch: z.enum(["rigid", "comfort-stretch", "high-stretch"]).optional(),
	category: z.string().min(1).max(120).optional(),
	catalogAudience: z.enum(["womens", "mens"]).optional(),
	q: z.string().min(1).max(120).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export type CatalogProduct = {
	productId: string;
	source: string;
	name: string;
	category: string | null;
	catalogAudiences: CatalogAudience[];
	productUrl: string;
	imageUrl: string | null;
	description: string | null;
	price: number | null;
	currency: string | null;
	fit: string | null;
	rise: string | null;
	stretch: string | null;
	// Flat, display-oriented list of every size token (mixes waist + length).
	sizes: string[];
	// Structured size dimensions split out from the scraped `raw` payload. For
	// bottoms, waistSizes are the numeric waist labels and lengthSizes are the
	// Short/Regular/Long options. Both are empty for products without that
	// dimension (e.g. alpha-sized tops). Used to match the customer's inseam to an
	// actually-available length.
	waistSizes: string[];
	lengthSizes: string[];
	colors: string[];
	scrapedAt: string;
};

export type MuseTag =
	| "Clean Muse"
	| "Romantic Muse"
	| "Boyish Muse"
	| "Statement Maker";
export type AppointmentStatus =
	| "scheduled"
	| "checked_in"
	| "completed"
	| "cancelled"
	| "no_show";

export type SuggestedProductPrepStatus = "suggested" | "pulled" | "skipped";

// A catalog product the recommendation engine suggested for an appointment,
// with the engine's ranking and rationale. Stored on the appointment.
export type SuggestedProduct = {
	rank: number;
	rationale: string;
	score: number | null;
	product: CatalogProduct;
	prepStatus: SuggestedProductPrepStatus;
	associateNote: string;
};

export type AppointmentSlot = {
	storeId: string;
	slotStart: string;
	slotEnd: string;
	date: string;
	time: string;
	availableStylistCount: number;
};

// How a garment should steer recommendations:
// - complement: recommend pieces that pair with it (e.g. a top for a skirt)
// - similar: recommend pieces that look like it
// - ignore: disregard it entirely
export type OutfitIntent = "complement" | "similar" | "ignore";

export const outfitIntents: OutfitIntent[] = [
	"complement",
	"similar",
	"ignore",
];

// One garment or accessory the customer is building around, as identified from a
// photo (by Claude) or typed in by the customer. Material/pattern are optional
// because not every look has them and manual entry may omit them. `intent` is the
// customer/stylist choice for how it influences recommendations.
export type OutfitGarment = {
	type: string;
	colors: string[];
	material?: string | null;
	pattern?: string | null;
	descriptors: string[];
	intent: OutfitIntent;
};

// The "outfit to match" the customer signed off on. The SAME shape regardless of
// origin — a photo analyzed by Claude, the canned no-key fallback, or text the
// customer typed manually — so persistence, the reranker, and the stylist view
// treat them identically. Images are never stored; only this text survives.
export type OutfitAnalysis = {
	garments: OutfitGarment[];
	styleSummary: string;
	suggestedFocusColors: string[];
	suggestedStyleKeywords: string[];
	pairingContext: string;
	engine: "claude" | "sample" | "manual";
	// Hidden, internal-only read of the customer's body shape (e.g. "pear",
	// "apple", "hourglass"), inferred ONLY when the customer marks a photo as being
	// of themselves. Null when not requested or not confidently determined. Never
	// shown to the customer or stylist — it exists solely to steer the recommender's
	// silhouette/fit choices. See claude-reranker.ts for how it's applied.
	bodyType?: string | null;
};

export type CreateAppointmentInput = {
	storeId: string;
	slotStart: string;
	occasion: string;
	focusColors: string;
	avoidColors: string;
	styleKeywords: string[];
	catalogAudiences?: CatalogAudience[];
	guidance?: string;
	orderHistoryScenario?: OrderHistoryScenario;
	outfitAnalysis?: OutfitAnalysis | null;
};

export type AppointmentMessage = {
	id: string;
	appointmentId: string;
	authorType: "customer" | "associate";
	body: string;
	createdAt: string;
};

export type AppointmentNotificationType = "confirmation" | "reminder";
export type AppointmentNotificationStatus = "queued" | "sent";

export type AppointmentNotification = {
	id: string;
	appointmentId: string;
	type: AppointmentNotificationType;
	status: AppointmentNotificationStatus;
	scheduledFor: string;
	sentAt: string | null;
	createdAt: string;
};

export type Appointment = {
	id: string;
	customerId: string;
	loyaltyId: string;
	customerName: string;
	slotStart: string;
	slotEnd: string;
	store: Store;
	occasion: string;
	focusColors: string;
	avoidColors: string;
	styleKeywords: string[];
	catalogAudiences: CatalogAudience[];
	guidance: string;
	sessionNotes: string;
	status: AppointmentStatus;
	museTag: MuseTag;
	assignedStylist: StylistProfile;
	orderHistorySummary: {
		totalOrders: number;
		denimItems: number;
		returnedItems: number;
		preferredSizes: string[];
	};
	suggestedProducts: SuggestedProduct[];
	outfitAnalysis: OutfitAnalysis | null;
	notificationSummary: {
		count: number;
		confirmationStatus: AppointmentNotificationStatus | null;
		reminderStatus: AppointmentNotificationStatus | null;
	};
	checkedInAt: string | null;
	completedAt: string | null;
	cancelledAt: string | null;
	noShowAt: string | null;
	cancelReason: string | null;
	customerRecap: string;
	associateFeedback: string;
	customerFeedbackRating: number | null;
	customerFeedbackComment: string;
	customerFeedbackAt: string | null;
	createdAt: string;
};
