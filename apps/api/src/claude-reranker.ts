/**
 * Claude re-ranking — the second stage of the hybrid recommendation pipeline.
 * Takes the rule-based shortlist and asks Claude to order it for this specific
 * customer and write a per-item rationale. Falls back to the rule-based order
 * (with reasons drawn from the scorer) when no API key is configured or the
 * call fails, so the endpoint always returns a usable result.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import {
	coarseCategory,
	type FitProfile,
	type ScoredCandidate,
} from "./recommendation-scoring.js";

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
	// A garment the customer already owns/is wearing and wants to build around
	// (from an outfit photo or manual entry). Recommendations should complement it.
	pairingContext?: string;
};

// Stable across all requests → safe to mark for prompt caching. The volatile
// parts (customer profile, candidate list) go in the user turn.
const SYSTEM_PROMPT = `You are a personal stylist prepping for an Abercrombie women's appointment. You
receive the customer's fit profile, the appointment's style context (occasion,
focus/avoid colors, style keywords, muse tag, and the sizes they've kept before),
and a shortlist of candidate products across categories (jeans, pants, tops,
dresses, outerwear, …) that a rule-based scorer pre-selected. Recommend the best
products for THIS appointment, weighing how well each suits the occasion, requested
colors, and style direction — plus fit/stretch/size match for bottoms, where those
attributes apply.

Rules:
- Only rank products from the provided candidate list; never invent products.
- Use each product's exact productId in your output.
- Aim for a useful, well-rounded set for the occasion (e.g. mix bottoms with tops or
  a dress) rather than near-duplicates, unless one category clearly fits best.
- Write a concise, specific rationale (one or two sentences) per product that ties it
  to the customer's preferences AND the appointment's occasion, colors, or style.
  For bottoms, reference fit/size; for other categories, lean on color and style.
- Favor focus colors and avoid the colors to skip. Lead with the strongest match.`;

// The exact JSON shape we ask the model to emit. We instruct this in the prompt
// rather than using output_config.format because some compatible proxies (e.g.
// LiteLLM → Bedrock) reject structured-output schemas.
const OUTPUT_INSTRUCTION = `Return ONLY a JSON object (no markdown fences, no prose) of the form:
{"summary": string, "rankings": [{"productId": string, "rank": integer, "rationale": string}]}`;

/** Pull a JSON object out of model text, tolerating markdown fences/prose. */
export function extractJson(text: string): string {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const body = fenced ? fenced[1] : text;
	const start = body.indexOf("{");
	const end = body.lastIndexOf("}");
	return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function candidateLine(c: ScoredCandidate): string {
	const p = c.product;
	return [
		`productId: ${p.productId}`,
		`name: ${p.name}`,
		`category: ${p.category ?? "unknown"}`,
		`fit: ${p.fit ?? "n/a"}`,
		`rise: ${p.rise ?? "n/a"}`,
		`stretch: ${p.stretch ?? "n/a"}`,
		`price: ${p.price ?? "?"} ${p.currency ?? ""}`.trim(),
		`colors: ${p.colors.join(", ") || "n/a"}`,
		`sizes: ${p.sizes.join(", ") || "n/a"}`,
		`ruleScore: ${c.score.toFixed(2)}`,
		`description: ${(p.description ?? "").slice(0, 200)}`,
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

	// An owned/worn garment to complement gets its own emphasized line rather than
	// being folded into the comma-joined context, so the model treats it as a
	// primary "complete the look" signal.
	const pairing = style.pairingContext
		? `\n\nOutfit to build around: ${style.pairingContext}\nFavor pieces that complete or complement this look (e.g. a top for a skirt), and reference the pairing in the rationale.`
		: "";

	const candidates = shortlist
		.map((c, i) => `${i + 1}. ${candidateLine(c)}`)
		.join("\n");

	return `Customer profile: ${profile}
Appointment style context: ${styleLines || "none provided"}${pairing}

Candidate products (pre-scored shortlist):
${candidates}

Return the best ${topN} candidates, ranked 1 (best) to ${topN}, with a rationale for each and a one-sentence overall summary.

${OUTPUT_INSTRUCTION}`;
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
		const client = new Anthropic({
			apiKey: config.anthropicApiKey,
			...(config.anthropicBaseUrl ? { baseURL: config.anthropicBaseUrl } : {}),
		});
		const response = await client.messages.create({
			model: config.recommenderModel,
			max_tokens: 2048,
			thinking: { type: "adaptive" },
			output_config: { effort: "low" },
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

		const parsed = JSON.parse(extractJson(text.text)) as {
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
	} catch (err) {
		// Any SDK/parse/validation failure degrades gracefully to the rule-based
		// order — but log why, so a bad key / model can be diagnosed.
		console.warn(
			`Claude re-rank failed, using rule-based fallback: ${(err as Error).message}`,
		);
		return fallback(shortlist, topN);
	}
}

function fallback(shortlist: ScoredCandidate[], topN: number): RerankResult {
	const rankings = diversifyByCategory(shortlist, topN).map((c, i) => ({
		productId: c.product.productId,
		rank: i + 1,
		rationale:
			c.reasons.join("; ") || "Closest available match for the appointment.",
	}));
	return {
		engine: "rule-based",
		summary:
			"Ranked by rule-based scoring across the catalog (Claude re-ranking unavailable).",
		rankings,
	};
}

/**
 * Pick a varied top-N from a score-sorted shortlist by round-robining across
 * garment categories — so the no-LLM fallback returns a mix (jeans, a top, a
 * dress, …) rather than several near-identical jeans. Categories are visited
 * strongest-first.
 */
function diversifyByCategory(
	shortlist: ScoredCandidate[],
	topN: number,
): ScoredCandidate[] {
	const queues = new Map<string, ScoredCandidate[]>();
	for (const candidate of shortlist) {
		const key = coarseCategory(candidate.product);
		const queue = queues.get(key);
		if (queue) queue.push(candidate);
		else queues.set(key, [candidate]);
	}

	// Strongest category (by its best candidate) leads.
	const ordered = [...queues.values()].sort((a, b) => b[0].score - a[0].score);

	const result: ScoredCandidate[] = [];
	let progress = true;
	while (result.length < topN && progress) {
		progress = false;
		for (const queue of ordered) {
			const next = queue.shift();
			if (next) {
				result.push(next);
				progress = true;
				if (result.length >= topN) break;
			}
		}
	}
	return result;
}
