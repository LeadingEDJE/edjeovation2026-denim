export type CatalogProduct = {
	productId: string;
	name: string;
	category: string | null;
	productUrl: string;
	imageUrl: string | null;
	price: number | null;
	currency: string | null;
	fit: string | null;
	rise: string | null;
	stretch: string | null;
};

export type SuggestedProduct = {
	rank: number;
	rationale: string;
	score: number | null;
	product: CatalogProduct;
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
	sessionNotes: string;
	status: "scheduled" | "completed" | "cancelled";
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
	suggestedProducts: SuggestedProduct[];
	completedAt: string | null;
	createdAt: string;
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

export async function updateSessionNotes(
	appointmentId: string,
	sessionNotes: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/session-notes`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ sessionNotes }),
		},
	);

	if (!response.ok) {
		throw new Error("Could not save session notes");
	}

	const data = (await response.json()) as { appointment: Appointment };
	return data.appointment;
}

export async function completeAppointment(
	appointmentId: string,
	sessionNotes: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/complete`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ sessionNotes }),
		},
	);

	if (!response.ok) {
		throw new Error("Could not complete appointment");
	}

	const data = (await response.json()) as { appointment: Appointment };
	return data.appointment;
}
