import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchThirdPartyOrderHistory,
	fetchThirdPartyRecommendation,
	fetchThirdPartyStylist,
	fetchThirdPartyStylistAvailability,
	fetchThirdPartyStylists,
	ThirdPartyHttpError,
	toRecommendation,
} from "./recommendations.js";
import type { FittingInput } from "./types.js";

const BASE_URL = "http://localhost:8080";

const fittingInput: FittingInput = {
	customerName: "Dana Rivera",
	heightInches: 68,
	waistInches: 32,
	hipInches: 40,
	inseamInches: 30,
	fitPreference: "slim",
	stretchPreference: "comfort-stretch",
};

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe("toRecommendation", () => {
	it("maps a third-party payload into a stored recommendation", () => {
		const result = toRecommendation("session-1", {
			styleName: "Curve Love High Rise",
			sizeLabel: "29",
			confidence: 0.82,
			rationale: "Matches stated hip-to-waist ratio.",
		});

		expect(result).toMatchObject({
			sessionId: "session-1",
			styleName: "Curve Love High Rise",
			sizeLabel: "29",
			confidence: 0.82,
			rationale: "Matches stated hip-to-waist ratio.",
		});
		expect(result.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
		expect(() => new Date(result.createdAt).toISOString()).not.toThrow();
	});

	it("generates a unique id per call", () => {
		const source = {
			styleName: "A",
			sizeLabel: "30",
			confidence: 0.5,
			rationale: "x",
		};
		const a = toRecommendation("s", source);
		const b = toRecommendation("s", source);
		expect(a.id).not.toBe(b.id);
	});
});

describe("ThirdPartyHttpError", () => {
	it("carries the upstream status code", () => {
		const error = new ThirdPartyHttpError("nope", 503);
		expect(error).toBeInstanceOf(Error);
		expect(error.status).toBe(503);
		expect(error.message).toBe("nope");
	});
});

describe("fetchThirdPartyRecommendation", () => {
	it("posts the fitting input and returns the recommendation", async () => {
		const payload = {
			styleName: "S",
			sizeLabel: "30",
			confidence: 0.9,
			rationale: "ok",
		};
		fetchMock.mockResolvedValueOnce(jsonResponse(payload));

		const result = await fetchThirdPartyRecommendation(fittingInput);

		expect(result).toEqual(payload);
		expect(fetchMock).toHaveBeenCalledWith(
			`${BASE_URL}/fit/recommendation`,
			expect.objectContaining({
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(fittingInput),
			}),
		);
	});

	it("throws ThirdPartyHttpError carrying the status on failure", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

		await expect(
			fetchThirdPartyRecommendation(fittingInput),
		).rejects.toMatchObject({ status: 500 });
	});
});

describe("fetchThirdPartyOrderHistory", () => {
	it("defaults the scenario to standard and encodes the customer id", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ customerId: "a b", scenario: "standard", orders: [] }),
		);

		await fetchThirdPartyOrderHistory("a b");

		const url = fetchMock.mock.calls[0][0] as URL;
		expect(url.pathname).toBe("/customers/a%20b/orders");
		expect(url.searchParams.get("scenario")).toBe("standard");
	});

	it("passes through a non-standard scenario", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ customerId: "c1", scenario: "returns", orders: [] }),
		);

		await fetchThirdPartyOrderHistory("c1", "returns");

		const url = fetchMock.mock.calls[0][0] as URL;
		expect(url.searchParams.get("scenario")).toBe("returns");
	});

	it("throws on a non-ok response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 502));
		await expect(fetchThirdPartyOrderHistory("c1")).rejects.toBeInstanceOf(
			ThirdPartyHttpError,
		);
	});
});

describe("fetchThirdPartyStylists", () => {
	it("returns the stylist list", async () => {
		const list = { stylists: [] };
		fetchMock.mockResolvedValueOnce(jsonResponse(list));
		await expect(fetchThirdPartyStylists()).resolves.toEqual(list);
		expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/stylists`);
	});

	it("throws on a non-ok response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		await expect(fetchThirdPartyStylists()).rejects.toBeInstanceOf(
			ThirdPartyHttpError,
		);
	});
});

describe("fetchThirdPartyStylistAvailability", () => {
	it("returns the availability schedule", async () => {
		const schedule = { days: [] };
		fetchMock.mockResolvedValueOnce(jsonResponse(schedule));
		await expect(fetchThirdPartyStylistAvailability()).resolves.toEqual(
			schedule,
		);
		expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/stylists/availability`);
	});

	it("throws on a non-ok response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		await expect(fetchThirdPartyStylistAvailability()).rejects.toBeInstanceOf(
			ThirdPartyHttpError,
		);
	});
});

describe("fetchThirdPartyStylist", () => {
	it("unwraps the stylist field and encodes the id", async () => {
		const stylist = { id: "st 1", displayName: "Jo" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ stylist }));

		await expect(fetchThirdPartyStylist("st 1")).resolves.toEqual(stylist);
		expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/stylists/st%201`);
	});

	it("throws ThirdPartyHttpError with status 404 when not found", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 404));
		await expect(fetchThirdPartyStylist("missing")).rejects.toMatchObject({
			status: 404,
		});
	});
});
