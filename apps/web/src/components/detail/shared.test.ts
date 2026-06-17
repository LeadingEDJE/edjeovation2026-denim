import { describe, expect, it } from "vitest";
import type { Appointment, CatalogProduct } from "../../api.js";
import { formatPrice, shortRef, specLine } from "./shared.js";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
	return {
		productId: "p1",
		name: "Slim Dark Wash",
		category: "Denim",
		catalogAudiences: ["womens"],
		productUrl: "https://example.com/p1",
		imageUrl: null,
		price: null,
		currency: null,
		fit: "Slim",
		rise: "High",
		stretch: "Comfort",
		...overrides,
	};
}

describe("shortRef", () => {
	it("strips hyphens and uppercases the first six id characters", () => {
		expect(shortRef({ id: "abcdef12-3456-7890" } as Appointment)).toBe(
			"#ABCDEF",
		);
	});

	it("handles ids shorter than six characters", () => {
		expect(shortRef({ id: "a-b" } as Appointment)).toBe("#AB");
	});
});

describe("formatPrice", () => {
	it("returns null when the price is null", () => {
		expect(formatPrice(null, "$")).toBeNull();
	});

	it("formats with two decimals and the given currency", () => {
		expect(formatPrice(49.5, "€")).toBe("€49.50");
		expect(formatPrice(120, "$")).toBe("$120.00");
	});

	it("defaults the currency symbol to '$' when none is provided", () => {
		expect(formatPrice(12.3, null)).toBe("$12.30");
	});

	it("formats a zero price rather than treating it as missing", () => {
		expect(formatPrice(0, "$")).toBe("$0.00");
	});
});

describe("specLine", () => {
	it("joins category, fit, rise, and stretch with a middot", () => {
		expect(specLine(product())).toBe("Denim · Slim · High · Comfort");
	});

	it("omits falsy attributes", () => {
		expect(
			specLine(product({ category: null, rise: null, stretch: null })),
		).toBe("Slim");
	});

	it("returns an empty string when no attributes are present", () => {
		expect(
			specLine(
				product({ category: null, fit: null, rise: null, stretch: null }),
			),
		).toBe("");
	});
});
