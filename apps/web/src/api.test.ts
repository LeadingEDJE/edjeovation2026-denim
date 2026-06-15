import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type FittingInput, listSessions } from "./api.js";

const API_BASE = "http://localhost:4000";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, ok = true): Response {
	return {
		ok,
		status: ok ? 200 : 500,
		json: async () => body,
	} as Response;
}

const fittingInput: FittingInput = {
	customerName: "Dana Rivera",
	heightInches: 68,
	waistInches: 32,
	hipInches: 40,
	inseamInches: 30,
	fitPreference: "slim",
	stretchPreference: "comfort-stretch",
};

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe("listSessions", () => {
	it("returns the sessions array on success", async () => {
		const sessions = [{ id: "s1" }];
		fetchMock.mockResolvedValueOnce(jsonResponse({ sessions }));

		await expect(listSessions()).resolves.toEqual(sessions);
		expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/fitting-sessions`);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(listSessions()).rejects.toThrow(/fitting sessions/i);
	});
});

describe("createSession", () => {
	it("posts the input and returns the created session", async () => {
		const created = {
			session: { id: "s1" },
			recommendation: { id: "r1" },
		};
		fetchMock.mockResolvedValueOnce(jsonResponse(created));

		await expect(createSession(fittingInput)).resolves.toEqual(created);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/fitting-sessions`,
			expect.objectContaining({
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(fittingInput),
			}),
		);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(createSession(fittingInput)).rejects.toThrow(
			/create fitting session/i,
		);
	});
});
