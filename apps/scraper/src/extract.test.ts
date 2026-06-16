import { describe, expect, it } from "vitest";
import { deriveFit } from "./extract.js";

describe("deriveFit", () => {
	it("maps mens athletic denim copy into the relaxed preference bucket", () => {
		expect(deriveFit("Athletic Slim Jean")).toBe("relaxed");
	});

	it("keeps explicit straight and baggy fits on their existing buckets", () => {
		expect(deriveFit("90s Straight Jean")).toBe("straight");
		expect(deriveFit("Baggy Jean")).toBe("wide");
	});
});
