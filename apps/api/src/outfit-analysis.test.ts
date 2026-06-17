import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: createMock };
	},
}));

import { config } from "./config.js";
import { analyzeOutfit, normalizeOutfitAnalysis } from "./outfit-analysis.js";

afterEach(() => {
	createMock.mockReset();
	config.anthropicApiKey = "";
});

describe("normalizeOutfitAnalysis", () => {
	it("preserves a full, valid payload", () => {
		const result = normalizeOutfitAnalysis(
			{
				garments: [
					{
						type: "midi skirt",
						colors: ["indigo"],
						material: "denim",
						pattern: null,
						descriptors: ["a-line"],
						intent: "similar",
					},
				],
				styleSummary: "Relaxed denim",
				suggestedFocusColors: ["cream"],
				suggestedStyleKeywords: ["chic"],
				pairingContext: "Build around the skirt",
			},
			"claude",
		);
		expect(result).toEqual({
			garments: [
				{
					type: "midi skirt",
					colors: ["indigo"],
					material: "denim",
					pattern: null,
					descriptors: ["a-line"],
					intent: "similar",
				},
			],
			styleSummary: "Relaxed denim",
			suggestedFocusColors: ["cream"],
			suggestedStyleKeywords: ["chic"],
			pairingContext: "Build around the skirt",
			engine: "claude",
		});
	});

	it("fills safe defaults for a sparse payload", () => {
		const result = normalizeOutfitAnalysis({}, "manual");
		expect(result).toEqual({
			garments: [],
			styleSummary: "",
			suggestedFocusColors: [],
			suggestedStyleKeywords: [],
			pairingContext: "",
			engine: "manual",
		});
	});

	it("coerces an unknown garment intent to 'complement'", () => {
		const result = normalizeOutfitAnalysis(
			{ garments: [{ type: "top", intent: "wear-it" } as never] },
			"manual",
		);
		expect(result.garments[0].intent).toBe("complement");
	});

	it("treats a non-array garments field as empty", () => {
		const result = normalizeOutfitAnalysis(
			{ garments: "nope" as never },
			"manual",
		);
		expect(result.garments).toEqual([]);
	});

	it("drops non-string colors and defaults missing garment fields", () => {
		const result = normalizeOutfitAnalysis(
			{ garments: [{ colors: ["red", ""], descriptors: undefined } as never] },
			"sample",
		);
		expect(result.garments[0]).toMatchObject({
			type: "garment",
			colors: ["red"],
			material: null,
			pattern: null,
			descriptors: [],
			intent: "complement",
		});
	});
});

describe("analyzeOutfit", () => {
	it("returns the canned sample when no API key is configured", async () => {
		const result = await analyzeOutfit("base64data", "image/jpeg");
		expect(result.engine).toBe("sample");
		expect(result.garments[0].type).toBe("midi skirt");
	});

	describe("with an API key", () => {
		beforeEach(() => {
			config.anthropicApiKey = "test-key";
			vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		it("returns a normalized analysis on success", async () => {
			createMock.mockResolvedValue({
				content: [
					{
						type: "text",
						text: JSON.stringify({
							garments: [
								{
									type: "blazer",
									colors: ["navy"],
									material: "wool",
									pattern: null,
									descriptors: ["tailored"],
								},
							],
							styleSummary: "Sharp tailoring",
							suggestedFocusColors: ["cream"],
							suggestedStyleKeywords: ["tailored"],
							pairingContext: "Complement the blazer",
						}),
					},
				],
			});

			const result = await analyzeOutfit("base64data", "image/png");

			expect(result.engine).toBe("claude");
			expect(result.styleSummary).toBe("Sharp tailoring");
			expect(result.garments[0].type).toBe("blazer");
		});

		it("falls back to the sample when the model returns nothing usable", async () => {
			createMock.mockResolvedValue({
				content: [
					{
						type: "text",
						text: JSON.stringify({ garments: [], styleSummary: "" }),
					},
				],
			});
			const result = await analyzeOutfit("base64data", "image/webp");
			expect(result.engine).toBe("sample");
		});

		it("falls back when the response has no text block", async () => {
			createMock.mockResolvedValue({ content: [{ type: "thinking" }] });
			const result = await analyzeOutfit("base64data", "image/jpeg");
			expect(result.engine).toBe("sample");
		});

		it("falls back when the model returns invalid JSON", async () => {
			createMock.mockResolvedValue({
				content: [{ type: "text", text: "definitely not json" }],
			});
			const result = await analyzeOutfit("base64data", "image/jpeg");
			expect(result.engine).toBe("sample");
		});

		it("falls back when the SDK throws", async () => {
			createMock.mockRejectedValue(new Error("vision boom"));
			const result = await analyzeOutfit("base64data", "image/jpeg");
			expect(result.engine).toBe("sample");
			expect(console.warn).toHaveBeenCalled();
		});
	});
});
