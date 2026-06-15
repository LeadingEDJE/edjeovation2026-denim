import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchThirdPartyOrderHistory,
	fetchThirdPartyStylist,
	fetchThirdPartyStylistAvailability,
	fetchThirdPartyStylists,
	fetchThirdPartyUser,
	fetchThirdPartyUsers,
	ThirdPartyHttpError,
} from "./recommendations.js";

const BASE_URL = "http://localhost:8080";

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

describe("ThirdPartyHttpError", () => {
	it("carries the upstream status code", () => {
		const error = new ThirdPartyHttpError("nope", 503);
		expect(error).toBeInstanceOf(Error);
		expect(error.status).toBe(503);
		expect(error.message).toBe("nope");
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

describe("fetchThirdPartyUsers", () => {
	it("returns the user list", async () => {
		const users = { users: [] };
		fetchMock.mockResolvedValueOnce(jsonResponse(users));
		await expect(fetchThirdPartyUsers()).resolves.toEqual(users);
		expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/users`);
	});
});

describe("fetchThirdPartyUser", () => {
	it("unwraps the user field and encodes the id", async () => {
		const user = { customerId: "cust 1", displayName: "Avery" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ user }));

		await expect(fetchThirdPartyUser("cust 1")).resolves.toEqual(user);
		expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/users/cust%201`);
	});

	it("throws ThirdPartyHttpError with status 404 when not found", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, 404));
		await expect(fetchThirdPartyUser("missing")).rejects.toMatchObject({
			status: 404,
		});
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
