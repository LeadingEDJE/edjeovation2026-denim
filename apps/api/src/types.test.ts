import { describe, expect, it } from "vitest";
import { type FittingInput, fittingInputSchema } from "./types.js";

const validInput: FittingInput = {
	customerName: "Dana Rivera",
	heightInches: 68,
	waistInches: 32,
	hipInches: 40,
	inseamInches: 30,
	fitPreference: "slim",
	stretchPreference: "comfort-stretch",
};

describe("fittingInputSchema", () => {
	it("accepts a fully valid fitting input", () => {
		const result = fittingInputSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	it("rejects a missing required field", () => {
		const { customerName, ...rest } = validInput;
		const result = fittingInputSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it("rejects an empty customer name", () => {
		const result = fittingInputSchema.safeParse({
			...validInput,
			customerName: "",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a customer name over 120 characters", () => {
		const result = fittingInputSchema.safeParse({
			...validInput,
			customerName: "x".repeat(121),
		});
		expect(result.success).toBe(false);
	});

	it("rejects a non-integer height", () => {
		const result = fittingInputSchema.safeParse({
			...validInput,
			heightInches: 68.5,
		});
		expect(result.success).toBe(false);
	});

	it.each([
		["waistInches below minimum", { waistInches: 19 }],
		["waistInches above maximum", { waistInches: 71 }],
		["hipInches below minimum", { hipInches: 27 }],
		["inseamInches above maximum", { inseamInches: 41 }],
		["heightInches below minimum", { heightInches: 47 }],
	])("rejects %s", (_label, override) => {
		const result = fittingInputSchema.safeParse({ ...validInput, ...override });
		expect(result.success).toBe(false);
	});

	it("rejects an unknown fit preference", () => {
		const result = fittingInputSchema.safeParse({
			...validInput,
			fitPreference: "bootcut",
		});
		expect(result.success).toBe(false);
	});

	it("rejects an unknown stretch preference", () => {
		const result = fittingInputSchema.safeParse({
			...validInput,
			stretchPreference: "no-stretch",
		});
		expect(result.success).toBe(false);
	});
});
