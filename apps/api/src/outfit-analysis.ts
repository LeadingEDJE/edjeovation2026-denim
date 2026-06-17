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
import {
	type OutfitAnalysis,
	type OutfitGarment,
	type OutfitIntent,
	outfitIntents,
} from "./types.js";

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

// Appended only when the customer marked the photo as being of themselves. We do
// the normal outfit read AND a discreet body-shape read in the same call. The
// body-shape value is internal styling context (never shown to anyone), so we ask
// for a single conventional shape term and, crucially, null when the photo doesn't
// support a confident read — a wrong guess is worse than none.
const BODY_TYPE_INSTRUCTION = `This photo is of the customer themselves. In addition to the outfit, discreetly assess their overall body shape to help tailor silhouette and fit. Add a "bodyType" field to the JSON: one of "pear", "apple", "hourglass", "rectangle", or "inverted-triangle" (the closest fit), or null if you cannot make a confident assessment from the evidence available (e.g. the body is not clearly visible and no measurements are provided). Do not guess — prefer null over an uncertain label. You may also be given the customer's self-reported measurements; weigh them together with the photo (the waist-to-hip relationship is a strong shape signal). Never describe, comment on, or restate the customer's body or measurements in any other field.`;

const BODY_TYPE_OUTPUT_INSTRUCTION = `Analyze this photo. Return ONLY a JSON object (no markdown fences, no prose) of the form:
{"garments":[{"type":string,"colors":string[],"material":string|null,"pattern":string|null,"descriptors":string[]}],"styleSummary":string,"suggestedFocusColors":string[],"suggestedStyleKeywords":string[],"pairingContext":string,"bodyType":string|null}`;

// Conventional shape terms we accept from the model; anything else (or an
// uncertain free-text answer) is treated as "not determined" and dropped.
const knownBodyTypes = new Set([
	"pear",
	"apple",
	"hourglass",
	"rectangle",
	"inverted-triangle",
]);

function normalizeBodyType(v: unknown): string | null {
	if (typeof v !== "string") return null;
	const cleaned = v.trim().toLowerCase().replace(/\s+/g, "-");
	return knownBodyTypes.has(cleaned) ? cleaned : null;
}

// Self-reported measurements that sharpen the body-shape read. All optional — we
// only feed through whatever the client actually has. Field names mirror
// CurrentUser.measurements so the client can pass them straight through.
export type BodyMeasurements = {
	heightInches?: number;
	chestInches?: number;
	waistInches?: number;
	hipInches?: number;
	inseamInches?: number;
};

// Render the measurements as a short context line for the user turn (kept OUT of
// the cached system prompt, since the numbers are per-customer). Returns "" when
// nothing usable is present so the prompt is unchanged.
function formatBodyMeasurements(m: BodyMeasurements | undefined): string {
	if (!m) return "";
	const parts = [
		Number.isFinite(m.heightInches) ? `height ${m.heightInches} in` : null,
		Number.isFinite(m.chestInches) ? `chest ${m.chestInches} in` : null,
		Number.isFinite(m.waistInches) ? `waist ${m.waistInches} in` : null,
		Number.isFinite(m.hipInches) ? `hip ${m.hipInches} in` : null,
		Number.isFinite(m.inseamInches) ? `inseam ${m.inseamInches} in` : null,
	].filter(Boolean);
	if (parts.length === 0) return "";
	return `The customer's self-reported measurements: ${parts.join(", ")}. Weigh these together with the photo when assessing body shape.\n\n`;
}

/** Coerce a possibly-partial model/client payload into a safe OutfitAnalysis. */
export function normalizeOutfitAnalysis(
	raw: Partial<OutfitAnalysis> | null | undefined,
	engine: OutfitAnalysis["engine"],
): OutfitAnalysis {
	const asStrings = (v: unknown): string[] =>
		Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

	const asIntent = (v: unknown): OutfitIntent =>
		outfitIntents.includes(v as OutfitIntent)
			? (v as OutfitIntent)
			: "complement";

	const garments: OutfitGarment[] = Array.isArray(raw?.garments)
		? raw.garments.map((g) => ({
				type: String(g?.type ?? "garment"),
				colors: asStrings(g?.colors),
				material: g?.material ? String(g.material) : null,
				pattern: g?.pattern ? String(g.pattern) : null,
				descriptors: asStrings(g?.descriptors),
				intent: asIntent(g?.intent),
			}))
		: [];

	return {
		garments,
		styleSummary: String(raw?.styleSummary ?? ""),
		suggestedFocusColors: asStrings(raw?.suggestedFocusColors),
		suggestedStyleKeywords: asStrings(raw?.suggestedStyleKeywords),
		pairingContext: String(raw?.pairingContext ?? ""),
		engine,
		bodyType: normalizeBodyType(raw?.bodyType),
	};
}

export type AnalyzeOutfitOptions = {
	// Set when the customer marked the photo as being of themselves ("this is
	// me"). Adds a discreet body-shape read to the same vision call, stored as the
	// hidden OutfitAnalysis.bodyType.
	analyzeBodyType?: boolean;
	// The customer's self-reported measurements, used only alongside
	// analyzeBodyType to sharpen the body-shape read. Ignored otherwise.
	measurements?: BodyMeasurements;
};

/** Analyze an outfit photo with Claude, or fall back to a canned sample. */
export async function analyzeOutfit(
	imageBase64: string,
	mediaType: SupportedMediaType,
	options: AnalyzeOutfitOptions = {},
): Promise<OutfitAnalysis> {
	if (!config.anthropicApiKey) return sampleAnalysis();

	// When "this is me" is set we extend BOTH the cached system prompt and the
	// per-request output instruction so the model also returns a bodyType field.
	const withBodyType = Boolean(options.analyzeBodyType);
	const systemPrompt = withBodyType
		? `${SYSTEM_PROMPT}\n\n${BODY_TYPE_INSTRUCTION}`
		: SYSTEM_PROMPT;
	const outputInstruction = withBodyType
		? BODY_TYPE_OUTPUT_INSTRUCTION
		: OUTPUT_INSTRUCTION;
	// Per-customer measurements ride in the user turn (not the cached system
	// prompt) so the cache stays shared across requests. Empty unless body-type
	// analysis was requested with usable numbers.
	const bodyContext = withBodyType
		? formatBodyMeasurements(options.measurements)
		: "";

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
					text: systemPrompt,
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
						{ type: "text", text: `${bodyContext}${outputInstruction}` },
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
					intent: "complement",
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
