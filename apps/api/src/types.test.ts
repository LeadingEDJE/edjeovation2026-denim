import { describe, expect, it } from "vitest";
import { catalogQuerySchema } from "./types.js";

describe("catalogQuerySchema", () => {
	it("accepts valid catalog filters and coerces pagination", () => {
		const result = catalogQuerySchema.safeParse({
			fit: "straight",
			rise: "high",
			stretch: "comfort-stretch",
			category: "jeans",
			q: "denim",
			limit: "25",
			offset: "10",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(25);
			expect(result.data.offset).toBe(10);
		}
	});

	it("rejects unknown enum values", () => {
		const result = catalogQuerySchema.safeParse({ fit: "bootcut" });
		expect(result.success).toBe(false);
	});

	it("caps overly large page sizes", () => {
		const result = catalogQuerySchema.safeParse({ limit: "201" });
		expect(result.success).toBe(false);
	});
});
