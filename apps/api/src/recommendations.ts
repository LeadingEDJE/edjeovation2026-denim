import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { DenimRecommendation, FittingInput, OrderHistory, OrderHistoryScenario } from "./types.js";

type ThirdPartyRecommendation = {
  styleName: string;
  sizeLabel: string;
  confidence: number;
  rationale: string;
};

export async function fetchThirdPartyRecommendation(input: FittingInput): Promise<ThirdPartyRecommendation> {
  const response = await fetch(`${config.thirdPartyBaseUrl}/fit/recommendation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Third-party recommendation failed with ${response.status}`);
  }

  return response.json() as Promise<ThirdPartyRecommendation>;
}

export function toRecommendation(sessionId: string, source: ThirdPartyRecommendation): DenimRecommendation {
  return {
    id: randomUUID(),
    sessionId,
    styleName: source.styleName,
    sizeLabel: source.sizeLabel,
    confidence: source.confidence,
    rationale: source.rationale,
    createdAt: new Date().toISOString()
  };
}

export async function fetchThirdPartyOrderHistory(
  customerId: string,
  scenario: OrderHistoryScenario = "standard"
): Promise<OrderHistory> {
  const url = new URL(`${config.thirdPartyBaseUrl}/customers/${encodeURIComponent(customerId)}/orders`);
  url.searchParams.set("scenario", scenario);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Third-party order history failed with ${response.status}`);
  }

  return response.json() as Promise<OrderHistory>;
}
