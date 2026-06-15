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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function listAppointments(): Promise<Appointment[]> {
	const response = await fetch(`${apiBaseUrl}/api/appointments`);

	if (!response.ok) {
		throw new Error("Could not load appointments");
	}

	const data = (await response.json()) as { appointments: Appointment[] };
	return data.appointments;
}
