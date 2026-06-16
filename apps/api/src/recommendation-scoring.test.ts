import { describe, expect, it } from "vitest";
import {
	coarseCategory,
	coarseCategoryFromText,
	type FitProfile,
	parseColors,
	rankCandidates,
	scoreProduct,
	shortlistDiverse,
	targetLength,
	targetWaistSize,
} from "./recommendation-scoring.js";
import type { CatalogProduct } from "./types.js";

const input: FitProfile = {
	waistInches: 29,
	inseamInches: 30,
	fitPreference: "straight",
	stretchPreference: "comfort-stretch",
};

function product(overrides: Partial<CatalogProduct>): CatalogProduct {
	return {
		productId: "p1",
		source: "abercrombie",
		name: "Test Jean",
		category: "jeans",
		productUrl: "https://example.com/p1",
		imageUrl: null,
		description: null,
		price: 90,
		currency: "USD",
		fit: null,
		rise: null,
		stretch: null,
		sizes: [],
		colors: [],
		scrapedAt: new Date().toISOString(),
		...overrides,
	};
}

describe("size targeting", () => {
	it("rounds waist measurement to a size label", () => {
		expect(targetWaistSize(29)).toBe("29");
		expect(targetWaistSize(29.4)).toBe("29");
		expect(targetWaistSize(29.6)).toBe("30");
	});

	it("maps inseam to length labels", () => {
		expect(targetLength(28)).toBe("Short");
		expect(targetLength(30)).toBe("Regular");
		expect(targetLength(32)).toBe("Regular");
		expect(targetLength(34)).toBe("Long");
	});
});

describe("scoreProduct", () => {
	it("scores an exact fit/stretch/size match near the top", () => {
		const { score, reasons } = scoreProduct(
			input,
			product({
				fit: "straight",
				stretch: "comfort-stretch",
				sizes: ["28", "29", "30", "Short", "Regular", "Long"],
			}),
		);
		// 0.4 fit + 0.25 stretch + 0.2 waist + 0.1 length = 0.95
		expect(score).toBeCloseTo(0.95, 5);
		expect(reasons.some((r) => r.includes("Fit matches"))).toBe(true);
		expect(reasons.some((r) => r.includes("waist size"))).toBe(true);
	});

	it("gives partial credit to an adjacent fit", () => {
		const exact = scoreProduct(input, product({ fit: "straight" })).score;
		const adjacent = scoreProduct(input, product({ fit: "slim" })).score;
		const unrelated = scoreProduct(input, product({ fit: "skinny" })).score;
		expect(exact).toBeGreaterThan(adjacent);
		expect(adjacent).toBeGreaterThan(unrelated);
	});

	it("does not credit a waist size that is not stocked", () => {
		const withSize = scoreProduct(
			input,
			product({ fit: "straight", sizes: ["29"] }),
		).score;
		const withoutSize = scoreProduct(
			input,
			product({ fit: "straight", sizes: ["40"] }),
		).score;
		expect(withSize).toBeGreaterThan(withoutSize);
	});
});

describe("parseColors", () => {
	it("splits free-text color strings into normalized tokens", () => {
		expect(parseColors("indigo, black")).toEqual(["indigo", "black"]);
		expect(parseColors("light wash and ecru")).toEqual([
			"light",
			"wash",
			"ecru",
		]);
		expect(parseColors("")).toEqual([]);
	});
});

describe("color scoring", () => {
	const base = product({
		fit: "straight",
		stretch: "comfort-stretch",
		colors: ["indigo", "medium wash", "no fade black"],
	});

	it("rewards a focus-color match and penalizes an avoid-color match", () => {
		const neutral = scoreProduct(input, base).score;
		const focus = scoreProduct(
			{ ...input, focusColors: ["indigo"] },
			base,
		).score;
		const avoid = scoreProduct(
			{ ...input, avoidColors: ["black"] },
			base,
		).score;
		expect(focus).toBeGreaterThan(neutral);
		expect(avoid).toBeLessThan(neutral);
	});

	it("ignores colors that are neither focus nor avoid", () => {
		const neutral = scoreProduct(input, base).score;
		const unrelated = scoreProduct(
			{ ...input, focusColors: ["lavender"], avoidColors: ["olive"] },
			base,
		).score;
		expect(unrelated).toBeCloseTo(neutral, 5);
	});
});

describe("coarseCategory", () => {
	it("buckets products by name across garment types", () => {
		expect(
			coarseCategory(product({ name: "High Rise 90s Straight Jean" })),
		).toBe("bottoms");
		expect(coarseCategory(product({ name: "Linen-Blend Mini Dress" }))).toBe(
			"dresses",
		);
		expect(coarseCategory(product({ name: "Cropped Rib Tank Top" }))).toBe(
			"tops",
		);
		expect(coarseCategory(product({ name: "Cropped Denim Jacket" }))).toBe(
			"outerwear",
		);
		expect(coarseCategory(product({ name: "Leather Crossbody Bag" }))).toBe(
			"other",
		);
	});
});

describe("coarseCategoryFromText", () => {
	it("buckets free-text garment wording (used by the similar-only rule)", () => {
		expect(coarseCategoryFromText("denim midi skirt")).toBe("bottoms");
		expect(coarseCategoryFromText("pair of wide-leg pants")).toBe("bottoms");
		expect(coarseCategoryFromText("white button-down shirt")).toBe("tops");
		expect(coarseCategoryFromText("slip dress")).toBe("dresses");
		expect(coarseCategoryFromText("cropped denim jacket")).toBe("outerwear");
	});

	it("checks outerwear/dresses before the denim→bottoms keyword", () => {
		expect(coarseCategoryFromText("denim trucker jacket")).toBe("outerwear");
		expect(coarseCategoryFromText("denim shirt dress")).toBe("dresses");
	});
});

describe("shortlistDiverse", () => {
	it("includes multiple categories rather than only top-scoring bottoms", () => {
		const products = [
			product({ name: "Straight Jean A", fit: "straight", sizes: ["29"] }),
			product({ name: "Straight Jean B", fit: "straight", sizes: ["29"] }),
			product({ name: "Straight Jean C", fit: "straight", sizes: ["29"] }),
			product({ name: "Straight Jean D", fit: "straight", sizes: ["29"] }),
			product({ name: "Straight Jean E", fit: "straight", sizes: ["29"] }),
			product({ name: "Silk Cami Top", colors: ["indigo"] }),
			product({ name: "Midi Dress", colors: ["indigo"] }),
		];
		const shortlist = shortlistDiverse(
			{ ...input, focusColors: ["indigo"] },
			products,
			4,
			12,
		);
		const buckets = new Set(shortlist.map((c) => coarseCategory(c.product)));
		expect(buckets.has("tops")).toBe(true);
		expect(buckets.has("dresses")).toBe(true);
		// At most `perCategory` bottoms even though they out-score everything.
		const bottoms = shortlist.filter(
			(c) => coarseCategory(c.product) === "bottoms",
		);
		expect(bottoms.length).toBeLessThanOrEqual(4);
	});
});

describe("rankCandidates", () => {
	it("orders by descending score and respects the limit", () => {
		const products = [
			product({
				productId: "best",
				fit: "straight",
				stretch: "comfort-stretch",
				sizes: ["29", "Regular"],
			}),
			product({ productId: "mid", fit: "slim" }),
			product({ productId: "worst", fit: "skinny" }),
		];
		const ranked = rankCandidates(input, products, 2);
		expect(ranked).toHaveLength(2);
		expect(ranked[0].product.productId).toBe("best");
		expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
	});
});
