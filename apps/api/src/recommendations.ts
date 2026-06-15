import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type {
	DenimRecommendation,
	FittingInput,
	OrderHistory,
	OrderHistoryScenario,
	StylistAvailabilitySchedule,
	StylistList,
	StylistProfile,
} from "./types.js";

type ThirdPartyRecommendation = {
	styleName: string;
	sizeLabel: string;
	confidence: number;
	rationale: string;
};

export class ThirdPartyHttpError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
	}
}

export async function fetchThirdPartyRecommendation(
	input: FittingInput,
): Promise<ThirdPartyRecommendation> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/fit/recommendation`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input),
		},
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party recommendation failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<ThirdPartyRecommendation>;
}

export function toRecommendation(
	sessionId: string,
	source: ThirdPartyRecommendation,
): DenimRecommendation {
	return {
		id: randomUUID(),
		sessionId,
		styleName: source.styleName,
		sizeLabel: source.sizeLabel,
		confidence: source.confidence,
		rationale: source.rationale,
		createdAt: new Date().toISOString(),
	};
}

export async function fetchThirdPartyOrderHistory(
	customerId: string,
	scenario: OrderHistoryScenario = "standard",
): Promise<OrderHistory> {
	const url = new URL(
		`${config.thirdPartyBaseUrl}/customers/${encodeURIComponent(customerId)}/orders`,
	);
	url.searchParams.set("scenario", scenario);

	const response = await fetch(url);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party order history failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<OrderHistory>;
}

export async function fetchThirdPartyStylists(): Promise<StylistList> {
	const response = await fetch(`${config.thirdPartyBaseUrl}/stylists`);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stylists failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StylistList>;
}

export async function fetchThirdPartyStylistAvailability(): Promise<StylistAvailabilitySchedule> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/stylists/availability`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stylist availability failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StylistAvailabilitySchedule>;
}

export async function fetchThirdPartyStylist(
	stylistId: string,
): Promise<StylistProfile> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/stylists/${encodeURIComponent(stylistId)}`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stylist failed with ${response.status}`,
			response.status,
		);
	}

	const data = (await response.json()) as { stylist: StylistProfile };
	return data.stylist;
}
