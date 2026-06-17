export type Store = {
	storeId: string;
	name: string;
	city: string;
	state: string;
	address: string;
	phone: string;
	timezone: string;
};

export type CatalogProduct = {
	productId: string;
	name: string;
	category: string | null;
	catalogAudiences: string[];
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
	prepStatus: "suggested" | "pulled" | "skipped";
	associateNote: string;
	product: CatalogProduct;
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
		status: "available" | "busy" | "offline";
		nextAvailableAt: string | null;
	};
	avatarUrl: string | null;
};

// How a garment steers recommendations: complement it, find similar, or ignore.
export type OutfitIntent = "complement" | "similar" | "ignore";

export type OutfitGarment = {
	type: string;
	colors: string[];
	material?: string | null;
	pattern?: string | null;
	descriptors: string[];
	intent: OutfitIntent;
};

// Text-only analysis of an outfit the customer wants to build around (from a
// photo or typed manually). The photo itself is never stored or shown.
export type OutfitAnalysis = {
	garments: OutfitGarment[];
	styleSummary: string;
	suggestedFocusColors: string[];
	suggestedStyleKeywords: string[];
	pairingContext: string;
	engine: "claude" | "sample" | "manual";
	// Hidden, internal-only body-shape read used to steer recommendations. Never
	// rendered in the stylist view; carried here only so edits round-trip it intact.
	bodyType?: string | null;
};

export type AppointmentStatus =
	| "scheduled"
	| "checked_in"
	| "completed"
	| "cancelled"
	| "no_show";

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
	catalogAudiences: string[];
	guidance: string;
	sessionNotes: string;
	status: AppointmentStatus;
	museTag: string;
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
		confirmationStatus: "queued" | "sent" | null;
		reminderStatus: "queued" | "sent" | null;
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

export type AppointmentMessage = {
	id: string;
	appointmentId: string;
	authorType: "customer" | "associate";
	body: string;
	createdAt: string;
};

export type AppointmentNotification = {
	id: string;
	appointmentId: string;
	type: "confirmation" | "reminder";
	status: "queued" | "sent";
	scheduledFor: string;
	sentAt: string | null;
	createdAt: string;
};

const apiBaseUrl =
	window.__DENIM_FIT_CONFIG__?.apiBaseUrl ||
	import.meta.env.VITE_API_BASE_URL ||
	"http://localhost:4000";

async function parseAppointment(response: Response, fallbackMessage: string) {
	if (!response.ok) {
		throw new Error(fallbackMessage);
	}

	const data = (await response.json()) as { appointment: Appointment };
	return data.appointment;
}

export async function listStores(): Promise<Store[]> {
	const response = await fetch(`${apiBaseUrl}/api/stores`);

	if (!response.ok) {
		throw new Error("Could not load stores");
	}

	const data = (await response.json()) as { stores: Store[] };
	return data.stores;
}

export async function listStylists(): Promise<StylistProfile[]> {
	const response = await fetch(`${apiBaseUrl}/api/stylists`);

	if (!response.ok) {
		throw new Error("Could not load stylists");
	}

	const data = (await response.json()) as { stylists: StylistProfile[] };
	return data.stylists;
}

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

	return parseAppointment(response, "Could not save session notes");
}

export async function completeAppointment(
	appointmentId: string,
	payload: {
		sessionNotes: string;
		customerRecap: string;
		associateFeedback: string;
	},
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/complete`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		},
	);

	return parseAppointment(response, "Could not complete appointment");
}

export async function checkInAppointment(
	appointmentId: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/check-in`,
		{ method: "POST" },
	);

	return parseAppointment(response, "Could not check in appointment");
}

export async function markNoShowAppointment(
	appointmentId: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/no-show`,
		{ method: "POST" },
	);

	return parseAppointment(response, "Could not mark no-show");
}

export async function reassignAppointmentStylist(
	appointmentId: string,
	stylistId: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/stylist`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ stylistId }),
		},
	);

	return parseAppointment(response, "Could not reassign stylist");
}

export async function regenerateSuggestions(
	appointmentId: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/regenerate-suggestions`,
		{ method: "POST" },
	);

	return parseAppointment(response, "Could not regenerate suggestions");
}

// Persist edited outfit intents. `regenerate` defaults to false so the stylist's
// edits are saved without an LLM re-run; they apply them with the Regenerate
// suggestions action.
export async function updateOutfitAnalysis(
	appointmentId: string,
	outfitAnalysis: OutfitAnalysis | null,
	regenerate = false,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/outfit-analysis`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ outfitAnalysis, regenerate }),
		},
	);

	return parseAppointment(response, "Could not update outfit intents");
}

export async function updateSuggestedProductPrep(
	appointmentId: string,
	productId: string,
	prepStatus: SuggestedProduct["prepStatus"],
	associateNote: string,
): Promise<Appointment> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/suggested-products/${encodeURIComponent(productId)}`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ prepStatus, associateNote }),
		},
	);

	return parseAppointment(response, "Could not update product prep");
}

export async function listAppointmentMessages(
	appointmentId: string,
): Promise<AppointmentMessage[]> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/messages`,
	);

	if (!response.ok) {
		throw new Error("Could not load appointment messages");
	}

	const data = (await response.json()) as { messages: AppointmentMessage[] };
	return data.messages;
}

export async function postAppointmentMessage(
	appointmentId: string,
	body: string,
): Promise<AppointmentMessage> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/messages`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ authorType: "associate", body }),
		},
	);

	if (!response.ok) {
		throw new Error("Could not post appointment message");
	}

	const data = (await response.json()) as { message: AppointmentMessage };
	return data.message;
}

export async function listAppointmentNotifications(
	appointmentId: string,
): Promise<AppointmentNotification[]> {
	const response = await fetch(
		`${apiBaseUrl}/api/appointments/${appointmentId}/notifications`,
	);

	if (!response.ok) {
		throw new Error("Could not load notification records");
	}

	const data = (await response.json()) as {
		notifications: AppointmentNotification[];
	};
	return data.notifications;
}
