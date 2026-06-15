import { z } from "zod";

export const fittingInputSchema = z.object({
	customerName: z.string().min(1).max(120),
	heightInches: z.number().int().min(48).max(90),
	waistInches: z.number().min(20).max(70),
	hipInches: z.number().min(28).max(80),
	inseamInches: z.number().min(20).max(40),
	fitPreference: z.enum(["skinny", "slim", "straight", "relaxed", "wide"]),
	stretchPreference: z.enum(["rigid", "comfort-stretch", "high-stretch"]),
});

export type FittingInput = z.infer<typeof fittingInputSchema>;

export type FittingSession = FittingInput & {
	id: string;
	createdAt: string;
};

export type DenimRecommendation = {
	id: string;
	sessionId: string;
	styleName: string;
	sizeLabel: string;
	confidence: number;
	rationale: string;
	createdAt: string;
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
