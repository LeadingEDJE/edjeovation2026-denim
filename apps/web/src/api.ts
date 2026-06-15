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

export type RankedRecommendation = {
	rank: number;
	rationale: string;
	score: number | null;
	product: CatalogProduct | null;
};

export type CatalogRecommendations = {
	engine: "claude" | "rule-based";
	summary: string;
	candidatesConsidered: number;
	recommendations: RankedRecommendation[];
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

export async function getCatalogRecommendations(
	input: FittingInput,
): Promise<CatalogRecommendations> {
	const response = await fetch(`${apiBaseUrl}/api/recommendations`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		throw new Error("Could not load catalog recommendations");
	}

	return response.json();
}
