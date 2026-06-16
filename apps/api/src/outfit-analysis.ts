/**
 * Outfit photo analysis — turns a customer's photo into a structured, text-only
 * description of the garment they want to build around, which then feeds the
 * recommendation engine as "pairing context" (e.g. recommend a top for a skirt).
 *
 * EPHEMERAL BY DESIGN: the image bytes live only in the request body and the
 * base64 string handed to the Anthropic SDK here. They are never written to disk,
 * the database, or logs — only the returned text analysis is persisted.
 *
 * Mirrors claude-reranker.ts: cached system prompt, JSON-shape instruction, and a
 * graceful fallback so the endpoint always returns something usable. When no API
 * key is configured (or the call fails) we return a canned `sample` analysis so the
 * full UX is demoable offline, matching the rest of this mock-friendly codebase.
 */
import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "./claude-reranker.js";
import { config } from "./config.js";
import type { OutfitAnalysis, OutfitGarment } from "./types.js";

export type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp";

export const supportedMediaTypes: SupportedMediaType[] = [
	"image/jpeg",
	"image/png",
	"image/webp",
];

// Stable across all requests → safe to mark for prompt caching. The volatile part
// (the image) goes in the user turn.
const SYSTEM_PROMPT = `You are a personal stylist analyzing a photo of an outfit a customer
wants to build around for an Abercrombie women's styling appointment. Identify each distinct
garment and accessory you can see, its colors, material/fabric, any pattern, and a few style
descriptors. Then summarize the overall look and propose focus colors and style keywords a
stylist could use to recommend complementary pieces (for example, a top to pair with a skirt).

Rules:
- Only describe what is actually visible; never invent details.
- Use short, common color names (e.g. "indigo", "cream", "olive").
- styleSummary: one or two warm, customer-facing sentences.
- pairingContext: one actionable sentence framed as what to complement
  (e.g. "Customer is wearing a dark indigo midi skirt; recommend tops that complement it.").`;

// We instruct the JSON shape in the prompt rather than using output_config.format
// because some compatible proxies reject structured-output schemas (same reason as
// claude-reranker.ts).
const OUTPUT_INSTRUCTION = `Analyze this outfit photo. Return ONLY a JSON object (no markdown fences, no prose) of the form:
{"garments":[{"type":string,"colors":string[],"material":string|null,"pattern":string|null,"descriptors":string[]}],"styleSummary":string,"suggestedFocusColors":string[],"suggestedStyleKeywords":string[],"pairingContext":string}`;

/** Coerce a possibly-partial model/client payload into a safe OutfitAnalysis. */
export function normalizeOutfitAnalysis(
	raw: Partial<OutfitAnalysis> | null | undefined,
	engine: OutfitAnalysis["engine"],
): OutfitAnalysis {
	const asStrings = (v: unknown): string[] =>
		Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

	const garments: OutfitGarment[] = Array.isArray(raw?.garments)
		? raw.garments.map((g) => ({
				type: String(g?.type ?? "garment"),
				colors: asStrings(g?.colors),
				material: g?.material ? String(g.material) : null,
				pattern: g?.pattern ? String(g.pattern) : null,
				descriptors: asStrings(g?.descriptors),
			}))
		: [];

	return {
		garments,
		styleSummary: String(raw?.styleSummary ?? ""),
		suggestedFocusColors: asStrings(raw?.suggestedFocusColors),
		suggestedStyleKeywords: asStrings(raw?.suggestedStyleKeywords),
		pairingContext: String(raw?.pairingContext ?? ""),
		engine,
	};
}

/** Analyze an outfit photo with Claude, or fall back to a canned sample. */
export async function analyzeOutfit(
	imageBase64: string,
	mediaType: SupportedMediaType,
): Promise<OutfitAnalysis> {
	if (!config.anthropicApiKey) return sampleAnalysis();

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
								media_type: mediaType,
								data: imageBase64,
							},
						},
						{ type: "text", text: OUTPUT_INSTRUCTION },
					],
				},
			],
		});

		const text = response.content.find((b) => b.type === "text");
		if (text?.type !== "text") return sampleAnalysis();

		const parsed = JSON.parse(
			extractJson(text.text),
		) as Partial<OutfitAnalysis>;
		const analysis = normalizeOutfitAnalysis(parsed, "claude");
		// A response with nothing usable is no better than the fallback.
		if (!analysis.styleSummary && analysis.garments.length === 0) {
			return sampleAnalysis();
		}
		return analysis;
	} catch (err) {
		// Degrade gracefully to the sample — but log WHY so a bad key/model is
		// diagnosable. Never log the image itself.
		console.warn(
			`Outfit analysis failed, using sample fallback: ${(err as Error).message}`,
		);
		return sampleAnalysis();
	}
}

/**
 * Canned analysis used when no API key is configured or the call fails, so the
 * end-to-end flow is demoable offline. `engine: "sample"` lets clients flag it.
 */
function sampleAnalysis(): OutfitAnalysis {
	return normalizeOutfitAnalysis(
		{
			garments: [
				{
					type: "midi skirt",
					colors: ["indigo"],
					material: "denim",
					pattern: null,
					descriptors: ["a-line", "casual-chic"],
				},
			],
			styleSummary:
				"A relaxed denim midi skirt with a versatile, everyday-chic feel — easy to dress up or down.",
			suggestedFocusColors: ["cream", "white", "indigo"],
			suggestedStyleKeywords: ["casual-chic", "everyday"],
			pairingContext:
				"Customer is building around a denim midi skirt; recommend tops that complement it.",
		},
		"sample",
	);
}
