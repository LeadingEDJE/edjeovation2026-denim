/**
 * Claude re-ranking — the second stage of the hybrid recommendation pipeline.
 * Takes the rule-based shortlist and asks Claude to order it for this specific
 * customer and write a per-item rationale. Falls back to the rule-based order
 * (with reasons drawn from the scorer) when no API key is configured or the
 * call fails, so the endpoint always returns a usable result.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { FitProfile, ScoredCandidate } from "./recommendation-scoring.js";

export type RankedRecommendation = {
	productId: string;
	rank: number;
	rationale: string;
};

export type RerankResult = {
	engine: "claude" | "rule-based";
	summary: string;
	rankings: RankedRecommendation[];
};

// Appointment-derived style context the re-ranker weighs qualitatively.
export type StyleContext = {
	occasion?: string;
	focusColors?: string;
	avoidColors?: string;
	styleKeywords?: string[];
	museTag?: string;
	preferredSizes?: string[];
};

// Stable across all requests → safe to mark for prompt caching. The volatile
// parts (customer profile, candidate list) go in the user turn.
const SYSTEM_PROMPT = `You are a denim fit specialist prepping a stylist for an Abercrombie women's
appointment. You receive the customer's fit profile, the appointment's style context
(occasion, focus/avoid colors, style keywords, muse tag, and the sizes they've kept
before), and a shortlist of candidate jeans a rule-based scorer pre-selected. Re-rank
the candidates from best to worst for THIS appointment, weighing fit/stretch/size
match together with how well each product suits the occasion, requested colors, and
style direction.

Rules:
- Only rank products from the provided candidate list; never invent products.
- Use each product's exact productId in your output.
- Write a concise, specific rationale (one or two sentences) per product that ties it
  to the customer's measurements/preferences AND the appointment's occasion, colors,
  or style direction.
- Favor focus colors and avoid the colors to skip. Lead with the strongest match.
  Include every candidate you are given.`;

const OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["rankings", "summary"],
	properties: {
		summary: { type: "string" },
		rankings: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["productId", "rank", "rationale"],
				properties: {
					productId: { type: "string" },
					rank: { type: "integer" },
					rationale: { type: "string" },
				},
			},
		},
	},
} as const;

function candidateLine(c: ScoredCandidate): string {
	const p = c.product;
	return [
		`productId: ${p.productId}`,
		`name: ${p.name}`,
		`fit: ${p.fit ?? "unknown"}`,
		`rise: ${p.rise ?? "unknown"}`,
		`stretch: ${p.stretch ?? "unknown"}`,
		`price: ${p.price ?? "?"} ${p.currency ?? ""}`.trim(),
		`sizes: ${p.sizes.join(", ") || "n/a"}`,
		`ruleScore: ${c.score.toFixed(2)}`,
		`description: ${(p.description ?? "").slice(0, 240)}`,
	].join(" | ");
}

function buildUserPrompt(
	input: FitProfile,
	style: StyleContext,
	shortlist: ScoredCandidate[],
	topN: number,
): string {
	const profile = [
		`waist: ${input.waistInches} in`,
		`inseam: ${input.inseamInches} in`,
		`fitPreference: ${input.fitPreference}`,
		`stretchPreference: ${input.stretchPreference}`,
	].join(", ");

	const styleLines = [
		style.occasion ? `occasion: ${style.occasion}` : null,
		style.focusColors ? `focus colors: ${style.focusColors}` : null,
		style.avoidColors ? `avoid colors: ${style.avoidColors}` : null,
		style.styleKeywords?.length
			? `style keywords: ${style.styleKeywords.join(", ")}`
			: null,
		style.museTag ? `muse tag: ${style.museTag}` : null,
		style.preferredSizes?.length
			? `previously kept sizes: ${style.preferredSizes.join(", ")}`
			: null,
	]
		.filter(Boolean)
		.join(", ");

	const candidates = shortlist
		.map((c, i) => `${i + 1}. ${candidateLine(c)}`)
		.join("\n");

	return `Customer profile: ${profile}
Appointment style context: ${styleLines || "none provided"}

Candidate jeans (pre-scored shortlist):
${candidates}

Return the best ${topN} candidates, ranked 1 (best) to ${topN}, with a rationale for each and a one-sentence overall summary.`;
}

/** Re-rank the shortlist with Claude, or fall back to the rule-based order. */
export async function rerank(
	input: FitProfile,
	style: StyleContext,
	shortlist: ScoredCandidate[],
	topN = 5,
): Promise<RerankResult> {
	if (!config.anthropicApiKey || shortlist.length === 0) {
		return fallback(shortlist, topN);
	}

	try {
		const client = new Anthropic({ apiKey: config.anthropicApiKey });
		const response = await client.messages.create({
			model: config.recommenderModel,
			max_tokens: 2048,
			thinking: { type: "adaptive" },
			output_config: {
				effort: "low",
				format: { type: "json_schema", schema: OUTPUT_SCHEMA },
			},
			system: [
				{
					type: "text",
					text: SYSTEM_PROMPT,
					cache_control: { type: "ephemeral" },
				},
			],
			messages: [
				{
					role: "user",
					content: buildUserPrompt(input, style, shortlist, topN),
				},
			],
		});

		const text = response.content.find((b) => b.type === "text");
		if (text?.type !== "text") return fallback(shortlist, topN);

		const parsed = JSON.parse(text.text) as {
			summary: string;
			rankings: RankedRecommendation[];
		};
		const validIds = new Set(shortlist.map((c) => c.product.productId));
		const rankings = parsed.rankings
			.filter((r) => validIds.has(r.productId))
			.sort((a, b) => a.rank - b.rank)
			.slice(0, topN)
			.map((r, i) => ({ ...r, rank: i + 1 }));

		if (rankings.length === 0) return fallback(shortlist, topN);
		return { engine: "claude", summary: parsed.summary, rankings };
	} catch {
		// Any SDK/parse/validation failure degrades gracefully to the rule-based order.
		return fallback(shortlist, topN);
	}
}

function fallback(shortlist: ScoredCandidate[], topN: number): RerankResult {
	const rankings = shortlist.slice(0, topN).map((c, i) => ({
		productId: c.product.productId,
		rank: i + 1,
		rationale:
			c.reasons.join("; ") ||
			"Closest available match for your fitting profile.",
	}));
	return {
		engine: "rule-based",
		summary:
			"Ranked by rule-based fit scoring (Claude re-ranking unavailable).",
		rankings,
	};
}
