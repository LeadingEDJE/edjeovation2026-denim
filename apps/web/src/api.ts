export type FitPreference = "skinny" | "slim" | "straight" | "relaxed" | "wide";
export type StretchPreference = "rigid" | "comfort-stretch" | "high-stretch";

export type FittingInput = {
	customerName: string;
	heightInches: number;
	waistInches: number;
	hipInches: number;
	inseamInches: number;
	fitPreference: FitPreference;
	stretchPreference: StretchPreference;
};

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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function listSessions(): Promise<FittingSession[]> {
	const response = await fetch(`${apiBaseUrl}/api/fitting-sessions`);

	if (!response.ok) {
		throw new Error("Could not load fitting sessions");
	}

	const data = (await response.json()) as { sessions: FittingSession[] };
	return data.sessions;
}

export async function createSession(input: FittingInput): Promise<{
	session: FittingSession;
	recommendation: DenimRecommendation;
}> {
	const response = await fetch(`${apiBaseUrl}/api/fitting-sessions`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		throw new Error("Could not create fitting session");
	}

	return response.json();
}
