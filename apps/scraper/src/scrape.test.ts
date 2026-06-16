import { describe, expect, it } from "vitest";
import {
	audienceFromUrl,
	categoryNameFromUrl,
	categoryTargetFromUrl,
	parseCatalogAudiences,
} from "./scrape.js";

describe("parseCatalogAudiences", () => {
	it("normalizes and dedupes configured audiences", () => {
		expect(parseCatalogAudiences("womens,mens,womens")).toEqual([
			"womens",
			"mens",
		]);
	});

	it("rejects unknown audiences", () => {
		expect(() => parseCatalogAudiences("kids")).toThrow(
			/Invalid CATALOG_AUDIENCES/,
		);
	});
});

describe("category audience helpers", () => {
	it("infers audience from Abercrombie category URLs", () => {
		expect(
			audienceFromUrl("https://www.abercrombie.com/shop/us/mens-jeans-bottoms"),
		).toBe("mens");
		expect(
			audienceFromUrl(
				"https://www.abercrombie.com/shop/us/womens-bottoms-new-arrivals",
			),
		).toBe("womens");
	});

	it("uses a single configured audience for ambiguous manual category URLs", () => {
		expect(categoryTargetFromUrl("/shop/us/sale", ["mens"])).toEqual({
			audience: "mens",
			url: "https://www.abercrombie.com/shop/us/sale",
		});
	});

	it("rejects ambiguous manual category URLs when multiple audiences are configured", () => {
		expect(() =>
			categoryTargetFromUrl("/shop/us/sale", ["womens", "mens"]),
		).toThrow(/Cannot infer catalog audience/);
	});

	it("removes the audience prefix from category names", () => {
		expect(
			categoryNameFromUrl(
				"https://www.abercrombie.com/shop/us/mens-bottoms-new-arrivals",
				"mens",
			),
		).toBe("bottoms new arrivals");
	});
});
