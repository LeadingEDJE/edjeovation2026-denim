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
	museTag: string;
	assignedStylist: {
		id: string;
		displayName: string;
		title: string;
	};
	orderHistorySummary: {
		totalOrders: number;
		denimItems: number;
		returnedItems: number;
		preferredSizes: string[];
	};
	createdAt: string;
};

export type CatalogProduct = {
	productId: string;
	name: string;
	productUrl: string;
	imageUrl: string | null;
	price: number | null;
	currency: string | null;
	fit: string | null;
	rise: string | null;
	stretch: string | null;
};

export type RankedRecommendation = {
	rank: number;
	rationale: string;
	score: number | null;
	product: CatalogProduct | null;
};

export type AppointmentRecommendations = {
	appointmentId: string;
	engine: "claude" | "rule-based";
	summary: string;
	candidatesConsidered: number;
	recommendations: RankedRecommendation[];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function listAppointments(): Promise<Appointment[]> {
	const response = await fetch(`${apiBaseUrl}/api/appointments`);

	if (!response.ok) {
		throw new Error("Could not load appointments");
	}

	const data = (await response.json()) as { appointments: Appointment[] };
	return data.appointments;
}

export async function getAppointmentRecommendations(
	appointmentId: string,
): Promise<AppointmentRecommendations> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/recommendations`,
	);

	if (!response.ok) {
		throw new Error("Could not load denim suggestions");
	}

	return response.json();
}
