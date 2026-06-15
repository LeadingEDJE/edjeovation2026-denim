import { z } from "zod";

export type FitPreference = "skinny" | "slim" | "straight" | "relaxed" | "wide";
export type StretchPreference = "rigid" | "comfort-stretch" | "high-stretch";

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

export type StylistProfile = {
	id: string;
	displayName: string;
	pronouns: string;
	title: string;
	store: {
		storeId: string;
		name: string;
		city: string;
		state: string;
	};
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
	productUrl: string;
	imageUrl: string | null;
	description: string | null;
	price: number | null;
	currency: string | null;
	fit: string | null;
	rise: string | null;
	stretch: string | null;
	sizes: string[];
	colors: string[];
	scrapedAt: string;
};

export type MuseTag =
	| "Clean Muse"
	| "Romantic Muse"
	| "Boyish Muse"
	| "Statement Maker";

export type AppointmentSlot = {
	slotStart: string;
	slotEnd: string;
	date: string;
	time: string;
	availableStylistCount: number;
};

export type CreateAppointmentInput = {
	slotStart: string;
	occasion: string;
	focusColors: string;
	avoidColors: string;
	styleKeywords: string[];
	guidance?: string;
	orderHistoryScenario?: OrderHistoryScenario;
};

export type Appointment = {
	id: string;
	customerId: string;
	loyaltyId: string;
	customerName: string;
	slotStart: string;
	slotEnd: string;
	occasion: string;
	focusColors: string;
	avoidColors: string;
	styleKeywords: string[];
	guidance: string;
	museTag: MuseTag;
	assignedStylist: StylistProfile;
	orderHistorySummary: {
		totalOrders: number;
		denimItems: number;
		returnedItems: number;
		preferredSizes: string[];
	};
	createdAt: string;
};
