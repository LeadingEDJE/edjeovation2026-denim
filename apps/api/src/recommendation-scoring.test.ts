import { describe, expect, it } from "vitest";
import {
	type FitProfile,
	rankCandidates,
	scoreProduct,
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
