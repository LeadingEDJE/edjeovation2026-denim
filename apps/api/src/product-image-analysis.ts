/**
 * Product image analysis — turns a catalog product's photo into structured,
 * text-only visual style cues (silhouette, pattern, wash, details, formality,
 * style keywords) that the recommendation engine weighs alongside the scraped
 * fit/color/size attributes. Unlike outfit-analysis.ts (per-request, ephemeral),
 * this runs as a one-time backfill and the result IS persisted, on
 * catalog_products.image_analysis (see analyze-product-images.ts).
 *
 * Mirrors claude-reranker.ts / outfit-analysis.ts: cached system prompt, a
 * JSON-shape instruction in the user turn (not output_config.format, which some
 * compatible proxies reject), and tolerant parsing/normalization.
 */
import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "./claude-reranker.js";
import { config } from "./config.js";
import type { ProductImageAnalysis } from "./types.js";

export type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp";

export const supportedMediaTypes: SupportedMediaType[] = [
	"image/jpeg",
	"image/png",
	"image/webp",
];

// Stable across all requests → safe to mark for prompt caching. The volatile
// part (the image + the product's name/category) goes in the user turn.
const SYSTEM_PROMPT = `You are a fashion stylist cataloguing an Abercrombie product from its photo so
another stylist can later match it to a customer. Read ONLY what the image shows and capture the
visual style cues that plain product text misses: the garment's silhouette/cut, any pattern,
the wash or finish (for denim and similar), notable construction details, how formal it reads,
and a few words for its overall styling vibe.

Rules:
- Describe only what is actually visible; never invent details or infer from the product name.
- Focus on the primary garment being sold; ignore background, props, and any unrelated items.
- Use short, common terms (e.g. silhouette "relaxed straight-leg"; wash "medium indigo wash";
  pattern "floral" / "striped" / "solid"; formality one of casual, smart-casual, dressy, formal,
  athletic, loungewear).
- summary: one concise, concrete sentence a stylist would find useful.
- Use null for pattern/wash/silhouette/formality when not applicable or not discernible; never guess.`;

// We instruct the JSON shape in the prompt rather than using output_config.format
// because some compatible proxies reject structured-output schemas (same reason as
// claude-reranker.ts / outfit-analysis.ts).
const OUTPUT_INSTRUCTION = `Analyze this product photo. Return ONLY a JSON object (no markdown fences, no prose) of the form:
{"summary":string,"silhouette":string|null,"pattern":string|null,"wash":string|null,"details":string[],"formality":string|null,"styleKeywords":string[]}`;

/** Coerce a possibly-partial model payload into a safe ProductImageAnalysis. */
export function normalizeProductImageAnalysis(
	raw: Partial<ProductImageAnalysis> | null | undefined,
): ProductImageAnalysis {
	const asStrings = (v: unknown): string[] =>
		Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
	const asStringOrNull = (v: unknown): string | null => {
		if (typeof v !== "string") return null;
		const t = v.trim();
		return t && t.toLowerCase() !== "n/a" && t.toLowerCase() !== "null"
			? t
			: null;
	};

	return {
		summary: String(raw?.summary ?? "").trim(),
		silhouette: asStringOrNull(raw?.silhouette),
		pattern: asStringOrNull(raw?.pattern),
		wash: asStringOrNull(raw?.wash),
		details: asStrings(raw?.details),
		formality: asStringOrNull(raw?.formality),
		styleKeywords: asStrings(raw?.styleKeywords),
	};
}

/** True when the analysis carries no usable signal (so callers can skip storing it). */
export function isEmptyProductImageAnalysis(a: ProductImageAnalysis): boolean {
	return (
		!a.summary &&
		!a.silhouette &&
		!a.pattern &&
		!a.wash &&
		!a.formality &&
		a.details.length === 0 &&
		a.styleKeywords.length === 0
	);
}

export type AnalyzeProductImageInput = {
	imageBase64: string;
	mediaType: SupportedMediaType;
	// Optional light context to disambiguate the photo; never used to invent
	// details (the system prompt forbids that), only to focus on the right item.
	name?: string;
	category?: string | null;
};

/**
 * Analyze a product image with Claude and return structured style cues, or null
 * when no API key is configured or the call/parse fails. Callers (the backfill
 * script) decide how to handle null — typically skip and retry later — so unlike
 * outfit-analysis there is no canned fallback to silently persist.
 */
export async function analyzeProductImage(
	input: AnalyzeProductImageInput,
): Promise<ProductImageAnalysis | null> {
	if (!config.anthropicApiKey) return null;

	const productContext = [
		input.name ? `Product name: ${input.name}` : null,
		input.category ? `Category: ${input.category}` : null,
	]
		.filter(Boolean)
		.join("\n");
	const userText = productContext
		? `${productContext}\n\n${OUTPUT_INSTRUCTION}`
		: OUTPUT_INSTRUCTION;

	try {
		const client = new Anthropic({
			apiKey: config.anthropicApiKey,
			...(config.anthropicBaseUrl ? { baseURL: config.anthropicBaseUrl } : {}),
		});
		const response = await client.messages.create({
			model: config.recommenderModel,
			max_tokens: 1024,
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
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								media_type: input.mediaType,
								data: input.imageBase64,
							},
						},
						{ type: "text", text: userText },
					],
				},
			],
		});

		const text = response.content.find((b) => b.type === "text");
		if (text?.type !== "text") return null;

		const parsed = JSON.parse(
			extractJson(text.text),
		) as Partial<ProductImageAnalysis>;
		const analysis = normalizeProductImageAnalysis(parsed);
		return isEmptyProductImageAnalysis(analysis) ? null : analysis;
	} catch (err) {
		// Log WHY (bad key/model/proxy is diagnosable) but never the image bytes.
		console.warn(`Product image analysis failed: ${(err as Error).message}`);
		return null;
	}
}
