import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAppointments } from "./api.js";

const API_BASE = "http://localhost:4000";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, ok = true): Response {
	return {
		ok,
		status: ok ? 200 : 500,
		json: async () => body,
	} as Response;
}

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe("listAppointments", () => {
	it("returns the appointments array on success", async () => {
		const appointments = [{ id: "appt-1" }];
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointments }));

		await expect(listAppointments()).resolves.toEqual(appointments);
		expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/appointments`);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(listAppointments()).rejects.toThrow(/appointments/i);
	});
});
