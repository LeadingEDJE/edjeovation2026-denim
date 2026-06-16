import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkInAppointment,
	completeAppointment,
	listAppointmentMessages,
	listAppointmentNotifications,
	listAppointments,
	listStores,
	listStylists,
	markNoShowAppointment,
	postAppointmentMessage,
	reassignAppointmentStylist,
	regenerateSuggestions,
	updateSessionNotes,
	updateSuggestedProductPrep,
} from "./api.js";

const API_BASE = "http://localhost:4000";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, ok = true): Response {
	return {
		ok,
		status: ok ? 200 : 500,
		json: async () => body,
	} as Response;
}

/** The RequestInit passed to the most recent fetch call. */
function lastInit(): RequestInit {
	const call = fetchMock.mock.calls.at(-1);
	return (call?.[1] as RequestInit) ?? {};
}

/** The parsed JSON body of the most recent fetch call. */
function lastBody(): unknown {
	const { body } = lastInit();
	return body ? JSON.parse(body as string) : undefined;
}

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe("listStores", () => {
	it("unwraps the stores array and hits the right URL", async () => {
		const stores = [{ storeId: "store-1" }];
		fetchMock.mockResolvedValueOnce(jsonResponse({ stores }));

		await expect(listStores()).resolves.toEqual(stores);
		expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/stores`);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(listStores()).rejects.toThrow(/stores/i);
	});
});

describe("listStylists", () => {
	it("unwraps the stylists array", async () => {
		const stylists = [{ id: "sty-1" }];
		fetchMock.mockResolvedValueOnce(jsonResponse({ stylists }));

		await expect(listStylists()).resolves.toEqual(stylists);
		expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/stylists`);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(listStylists()).rejects.toThrow(/stylists/i);
	});
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

describe("updateSessionNotes", () => {
	it("PATCHes the session-notes endpoint with the notes body", async () => {
		const appointment = { id: "appt-1", sessionNotes: "Tried slim" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));

		await expect(updateSessionNotes("appt-1", "Tried slim")).resolves.toEqual(
			appointment,
		);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/session-notes`,
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(lastBody()).toEqual({ sessionNotes: "Tried slim" });
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(updateSessionNotes("appt-1", "x")).rejects.toThrow(
			/session notes/i,
		);
	});
});

describe("completeAppointment", () => {
	it("POSTs the recap payload and returns the appointment", async () => {
		const appointment = { id: "appt-1", status: "completed" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));
		const payload = {
			sessionNotes: "notes",
			customerRecap: "recap",
			associateFeedback: "feedback",
		};

		await expect(completeAppointment("appt-1", payload)).resolves.toEqual(
			appointment,
		);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/complete`,
			expect.objectContaining({ method: "POST" }),
		);
		expect(lastBody()).toEqual(payload);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(
			completeAppointment("appt-1", {
				sessionNotes: "",
				customerRecap: "",
				associateFeedback: "",
			}),
		).rejects.toThrow(/complete/i);
	});
});

describe("checkInAppointment", () => {
	it("POSTs the check-in endpoint and returns the appointment", async () => {
		const appointment = { id: "appt-1", status: "checked_in" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));

		await expect(checkInAppointment("appt-1")).resolves.toEqual(appointment);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/check-in`,
			{ method: "POST" },
		);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(checkInAppointment("appt-1")).rejects.toThrow(/check in/i);
	});
});

describe("markNoShowAppointment", () => {
	it("POSTs the no-show endpoint and returns the appointment", async () => {
		const appointment = { id: "appt-1", status: "no_show" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));

		await expect(markNoShowAppointment("appt-1")).resolves.toEqual(appointment);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/no-show`,
			{ method: "POST" },
		);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(markNoShowAppointment("appt-1")).rejects.toThrow(/no-show/i);
	});
});

describe("reassignAppointmentStylist", () => {
	it("PATCHes the stylist endpoint with the stylist id", async () => {
		const appointment = { id: "appt-1" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));

		await expect(
			reassignAppointmentStylist("appt-1", "sty-2"),
		).resolves.toEqual(appointment);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/stylist`,
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(lastBody()).toEqual({ stylistId: "sty-2" });
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(reassignAppointmentStylist("appt-1", "sty-2")).rejects.toThrow(
			/reassign/i,
		);
	});
});

describe("regenerateSuggestions", () => {
	it("POSTs the regenerate endpoint and returns the appointment", async () => {
		const appointment = { id: "appt-1" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));

		await expect(regenerateSuggestions("appt-1")).resolves.toEqual(appointment);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/regenerate-suggestions`,
			{ method: "POST" },
		);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(regenerateSuggestions("appt-1")).rejects.toThrow(
			/regenerate/i,
		);
	});
});

describe("updateSuggestedProductPrep", () => {
	it("PATCHes with prep status/note and URL-encodes the product id", async () => {
		const appointment = { id: "appt-1" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ appointment }));

		await expect(
			updateSuggestedProductPrep("appt-1", "anf/123 abc", "pulled", "grab 28"),
		).resolves.toEqual(appointment);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/suggested-products/anf%2F123%20abc`,
			expect.objectContaining({ method: "PATCH" }),
		);
		expect(lastBody()).toEqual({
			prepStatus: "pulled",
			associateNote: "grab 28",
		});
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(
			updateSuggestedProductPrep("appt-1", "p1", "skipped", ""),
		).rejects.toThrow(/product prep/i);
	});
});

describe("listAppointmentMessages", () => {
	it("unwraps the messages array", async () => {
		const messages = [{ id: "m1" }];
		fetchMock.mockResolvedValueOnce(jsonResponse({ messages }));

		await expect(listAppointmentMessages("appt-1")).resolves.toEqual(messages);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/messages`,
		);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(listAppointmentMessages("appt-1")).rejects.toThrow(
			/messages/i,
		);
	});
});

describe("postAppointmentMessage", () => {
	it("POSTs an associate message and returns the created record", async () => {
		const message = { id: "m1", body: "Pull black denim" };
		fetchMock.mockResolvedValueOnce(jsonResponse({ message }));

		await expect(
			postAppointmentMessage("appt-1", "Pull black denim"),
		).resolves.toEqual(message);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/messages`,
			expect.objectContaining({ method: "POST" }),
		);
		expect(lastBody()).toEqual({
			authorType: "associate",
			body: "Pull black denim",
		});
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(postAppointmentMessage("appt-1", "hi")).rejects.toThrow(
			/message/i,
		);
	});
});

describe("listAppointmentNotifications", () => {
	it("unwraps the notifications array", async () => {
		const notifications = [{ id: "n1" }];
		fetchMock.mockResolvedValueOnce(jsonResponse({ notifications }));

		await expect(listAppointmentNotifications("appt-1")).resolves.toEqual(
			notifications,
		);
		expect(fetchMock).toHaveBeenCalledWith(
			`${API_BASE}/api/appointments/appt-1/notifications`,
		);
	});

	it("throws when the response is not ok", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(listAppointmentNotifications("appt-1")).rejects.toThrow(
			/notification/i,
		);
	});
});
