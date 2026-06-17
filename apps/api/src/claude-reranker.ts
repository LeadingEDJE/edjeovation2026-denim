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
	targetLength,
} from "./recommendation-scoring.js";
import type { ProductImageAnalysis } from "./types.js";

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
	// Confidential body-shape read (e.g. "pear", "hourglass"), present only when the
	// customer opted in via a "this is me" photo. Used purely to steer silhouette/fit
	// choices — NEVER mentioned in any rationale, summary, or customer/stylist view.
	bodyType?: string | null;
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
- Each candidate includes a "visual" field: style cues read from the product's photo
  (silhouette/cut, pattern, wash, notable details, formality, and styling vibe). Weigh
  it alongside the text attributes when judging how well a piece suits the occasion,
  colors, and style direction, and let it inform the rationale (e.g. a flowy floral
  midi for a garden party, a clean dark-wash straight-leg for smart-casual). When a
  candidate's visual is "n/a", just rely on its other attributes.
- Favor focus colors and avoid the colors to skip. Lead with the strongest match.
- Inseam/length: for bottoms sized by length (a "lengths" list of Short/Regular/Long),
  strongly prefer ones that offer the customer's target length and rank down any that
  do not — only fall back to an off-length pant when there's no better option in that
  category. Bottoms with "lengths: n/a" come in a single length; judge them on fit/size.

Completing a look — when the appointment context lists pieces to "complement" (an
item the customer already owns and wants to build around), treat that piece as worn
and recommend things that go WITH it, never an alternative to it:
- Complementing a bottom (skirt, pants, jeans, or shorts): do NOT recommend another
  bottom — including a different skirt — or a dress. Suggest tops, outerwear, and
  accessories instead.
- Complementing a one-piece (dress, jumpsuit, or romper): do NOT recommend a bottom
  or another one-piece. Suggest outerwear, layering pieces, and accessories. Only
  recommend a top if it clearly works as a layering piece (e.g. a tee under a slip
  dress, a turtleneck under a pinafore) — never as a standalone top.
- Never pair pants or jeans with a maxi-length skirt or maxi-length dress.
- Exception: a skirt explicitly described as a layering piece (e.g. a sheer overlay)
  may be layered over a dress or pants.
These no-second-bottom rules apply ONLY to "complement" pieces. For pieces listed as
"find similar," recommend items of the same kind and style as the named piece (a
skirt for a skirt is correct there).

Body shape (confidential) — the context may include the customer's body shape (e.g.
pear, apple, hourglass, rectangle, inverted-triangle). When present, use it silently
to favor genuinely flattering silhouettes, rises, and proportions for that shape
(e.g. for pear, balance the lower half with structured or detailed tops and bootcut/
straight bottoms; for apple, favor definition near the waist and clean vertical lines).
This is private styling intelligence: NEVER mention, hint at, or describe the
customer's body or shape in any rationale or in the summary — speak only about the
garments and how they suit the occasion, colors, and style.

Occasion appropriateness — only recommend specialized categories when the occasion
or style context clearly calls for them:
- Swimwear (swimsuits, bikinis, cover-ups): only when the occasion implies swimming
  or water/sun, e.g. a pool party, beach day, resort or vacation, or similar. For any
  other occasion, do not recommend swimwear even if it is in the candidate list.
- Sleepwear, loungewear, pajamas, and intimates: only when the event context
  explicitly asks for them. Do not recommend them for ordinary occasions.
When in doubt for these categories, leave them out and pick a more occasion-
appropriate candidate instead.`;

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

/**
 * Compact, single-line render of the vision-read style cues for the prompt.
 * "n/a" when the product hasn't been image-analyzed yet, so the model simply
 * leans on the text attributes as before.
 */
function formatImageAnalysis(a: ProductImageAnalysis | null): string {
	if (!a) return "n/a";
	const parts = [
		a.summary || null,
		a.silhouette ? `silhouette: ${a.silhouette}` : null,
		a.pattern ? `pattern: ${a.pattern}` : null,
		a.wash ? `wash: ${a.wash}` : null,
		a.details.length ? `details: ${a.details.join(", ")}` : null,
		a.formality ? `formality: ${a.formality}` : null,
		a.styleKeywords.length ? `style: ${a.styleKeywords.join(", ")}` : null,
	].filter(Boolean);
	return parts.length ? parts.join("; ") : "n/a";
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
		// Explicit length availability so the model never has to guess which size
		// tokens are lengths. "n/a" means the product isn't sized by length.
		`lengths: ${p.lengthSizes.join(", ") || "n/a"}`,
		`ruleScore: ${c.score.toFixed(2)}`,
		`description: ${(p.description ?? "").slice(0, 200)}`,
		// Visual read from the product photo (silhouette/pattern/wash/vibe) — adds
		// styling signal the text fields miss. "n/a" until image analysis has run.
		`visual: ${formatImageAnalysis(p.imageAnalysis)}`,
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
		`inseam: ${input.inseamInches} in (target length: ${targetLength(input.inseamInches)})`,
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

	// Confidential — drives silhouette/fit choices but must never appear in output.
	const bodyShape = style.bodyType
		? `\n\nConfidential body shape: ${style.bodyType}. Favor silhouettes and proportions that flatter this shape, but do NOT mention the body or shape anywhere in your rationale or summary.`
		: "";

	const candidates = shortlist
		.map((c, i) => `${i + 1}. ${candidateLine(c)}`)
		.join("\n");

	return `Customer profile: ${profile}
Appointment style context: ${styleLines || "none provided"}${pairing}${bodyShape}

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
