import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Control what the Anthropic SDK's messages.create returns.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: createMock };
	},
}));

import { extractJson, rerank } from "./claude-reranker.js";
import { config } from "./config.js";
import type { CatalogProduct } from "./types.js";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
	return {
		productId: "p1",
		source: "anf",
		name: "Straight Jean",
		category: "jeans",
		catalogAudiences: ["womens"],
		productUrl: "https://example.test/p1",
		imageUrl: null,
		description: "A classic straight jean",
		price: 89,
		currency: "USD",
		fit: "straight",
		rise: "high",
		stretch: "comfort-stretch",
		sizes: ["28"],
		colors: ["indigo"],
		scrapedAt: "2026-06-01T00:00:00.000Z",
		...overrides,
	};
}

function candidate(
	overrides: Partial<CatalogProduct>,
	score: number,
	reasons: string[] = ["A reason"],
) {
	return { product: product(overrides), score, reasons };
}

const fitProfile = {
	waistInches: 28,
	inseamInches: 30,
	fitPreference: "straight",
	stretchPreference: "comfort-stretch",
} as const;

const style = { occasion: "Weekend trip" };

afterEach(() => {
	createMock.mockReset();
	config.anthropicApiKey = "";
});

describe("extractJson", () => {
	it("returns plain JSON unchanged", () => {
		expect(extractJson('{"a":1}')).toBe('{"a":1}');
	});

	it("pulls JSON out of a ```json fenced block", () => {
		expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
	});

	it("pulls JSON out of an unlabeled fenced block", () => {
		expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
	});

	it("strips prose around the object", () => {
		expect(extractJson('Here you go: {"a":1}. Thanks!')).toBe('{"a":1}');
	});

	it("keeps the outermost braces for nested objects", () => {
		expect(extractJson('{"a":{"b":1}}')).toBe('{"a":{"b":1}}');
	});

	it("returns the body as-is when no JSON object is present", () => {
		expect(extractJson("no json here")).toBe("no json here");
	});
});

describe("rerank — rule-based fallback (no API key)", () => {
	it("diversifies across categories, strongest category first", async () => {
		const shortlist = [
			candidate(
				{ productId: "b1", name: "Straight Jean", category: "jeans" },
				0.9,
			),
			candidate(
				{ productId: "t1", name: "Ribbed Tank", category: "tops" },
				0.8,
			),
			candidate({ productId: "b2", name: "Wide Jean", category: "jeans" }, 0.7),
			candidate(
				{ productId: "d1", name: "Slip Dress", category: "dresses" },
				0.6,
			),
		];

		const result = await rerank(fitProfile, style, shortlist, 3);

		expect(result.engine).toBe("rule-based");
		expect(result.rankings.map((r) => r.productId)).toEqual(["b1", "t1", "d1"]);
		expect(result.rankings.map((r) => r.rank)).toEqual([1, 2, 3]);
	});

	it("uses scorer reasons as the rationale, with a fallback string", async () => {
		const result = await rerank(
			fitProfile,
			style,
			[candidate({ productId: "b1" }, 0.5, [])],
			1,
		);
		expect(result.rankings[0].rationale).toMatch(/closest available match/i);
	});

	it("returns an empty ranking for an empty shortlist", async () => {
		const result = await rerank(fitProfile, style, [], 5);
		expect(result.engine).toBe("rule-based");
		expect(result.rankings).toEqual([]);
	});
});

describe("rerank — Claude path", () => {
	beforeEach(() => {
		config.anthropicApiKey = "test-key";
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	function textResponse(payload: unknown) {
		return { content: [{ type: "text", text: JSON.stringify(payload) }] };
	}

	it("parses, re-sorts by rank, and re-numbers 1..N", async () => {
		createMock.mockResolvedValue(
			textResponse({
				summary: "Great mix",
				rankings: [
					{ productId: "p1", rank: 5, rationale: "r1" },
					{ productId: "p2", rank: 2, rationale: "r2" },
				],
			}),
		);
		const shortlist = [
			candidate({ productId: "p1" }, 0.6),
			candidate({ productId: "p2" }, 0.5),
		];

		const result = await rerank(fitProfile, style, shortlist, 5);

		expect(result.engine).toBe("claude");
		expect(result.summary).toBe("Great mix");
		expect(result.rankings).toEqual([
			{ productId: "p2", rank: 1, rationale: "r2" },
			{ productId: "p1", rank: 2, rationale: "r1" },
		]);
	});

	it("drops product ids that are not in the shortlist", async () => {
		createMock.mockResolvedValue(
			textResponse({
				summary: "s",
				rankings: [{ productId: "ghost", rank: 1, rationale: "x" }],
			}),
		);
		const result = await rerank(
			fitProfile,
			style,
			[candidate({ productId: "p1" }, 0.6)],
			5,
		);
		// All ids filtered out → graceful fallback to rule-based.
		expect(result.engine).toBe("rule-based");
	});

	it("falls back when the response has no text block", async () => {
		createMock.mockResolvedValue({ content: [{ type: "thinking" }] });
		const result = await rerank(
			fitProfile,
			style,
			[candidate({ productId: "p1" }, 0.6)],
			5,
		);
		expect(result.engine).toBe("rule-based");
	});

	it("falls back when the SDK call throws", async () => {
		createMock.mockRejectedValue(new Error("network boom"));
		const result = await rerank(
			fitProfile,
			style,
			[candidate({ productId: "p1" }, 0.6)],
			5,
		);
		expect(result.engine).toBe("rule-based");
		expect(console.warn).toHaveBeenCalled();
	});

	it("falls back when the model returns invalid JSON", async () => {
		createMock.mockResolvedValue({
			content: [{ type: "text", text: "not json at all" }],
		});
		const result = await rerank(
			fitProfile,
			style,
			[candidate({ productId: "p1" }, 0.6)],
			5,
		);
		expect(result.engine).toBe("rule-based");
	});
});
