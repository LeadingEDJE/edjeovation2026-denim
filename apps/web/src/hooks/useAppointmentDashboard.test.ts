import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	Appointment,
	AppointmentMessage,
	OutfitAnalysis,
	StylistProfile,
	SuggestedProduct,
} from "../api.js";
import { useAppointmentDashboard } from "./useAppointmentDashboard.js";

// The hook imports named functions from ../api directly, so mocking the module
// is cleaner than stubbing global fetch (and avoids api.ts touching window).
vi.mock("../api", () => ({
	listAppointments: vi.fn(),
	getAppointment: vi.fn(),
	getCustomerProfile: vi.fn(),
	listStores: vi.fn(),
	listStylists: vi.fn(),
	listEligibleStylists: vi.fn(),
	listAppointmentMessages: vi.fn(),
	listAppointmentNotifications: vi.fn(),
	postAppointmentMessage: vi.fn(),
	checkInAppointment: vi.fn(),
	completeAppointment: vi.fn(),
	markNoShowAppointment: vi.fn(),
	reassignAppointmentStylist: vi.fn(),
	regenerateSuggestions: vi.fn(),
	updateSessionNotes: vi.fn(),
	updateCustomerFitProfile: vi.fn(),
	updateOutfitAnalysis: vi.fn(),
	updateSuggestedProductPrep: vi.fn(),
}));

import * as api from "../api.js";

function stylist(id: string, displayName: string): StylistProfile {
	return {
		id,
		displayName,
		pronouns: "they/them",
		title: "Denim Stylist",
		store: {
			storeId: "store-1",
			name: "Flagship",
			city: "Columbus",
			state: "OH",
		},
		bio: "",
		specialties: [],
		stylePointOfView: [],
		supportedFits: [],
		customerSignals: [],
		availability: { status: "available", nextAvailableAt: null },
		avatarUrl: null,
	};
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
	const id = overrides.id ?? "appt-1";
	return {
		id,
		customerId: "cust_1",
		loyaltyId: "anf-1",
		customerName: "Avery Parker",
		slotStart: "2026-06-16T15:00:00.000Z",
		slotEnd: "2026-06-16T16:00:00.000Z",
		store: {
			storeId: "store-1",
			name: "Flagship",
			city: "Columbus",
			state: "OH",
			address: "160 Easton Town Center",
			phone: "+1 614-555-0100",
			timezone: "America/New_York",
		},
		occasion: "Weekend trip",
		focusColors: "Indigo",
		avoidColors: "White",
		styleKeywords: ["minimal"],
		catalogAudiences: ["womens"],
		guidance: "",
		sessionNotes: `notes-${id}`,
		status: "scheduled",
		museTag: "Clean Muse",
		assignedStylist: stylist("sty-1", "Jordan Lee"),
		orderHistorySummary: {
			totalOrders: 2,
			denimItems: 1,
			returnedItems: 0,
			preferredSizes: ["28"],
		},
		suggestedProducts: [],
		suggestionsStatus: "ready",
		outfitAnalysis: null,
		notificationSummary: {
			count: 0,
			confirmationStatus: null,
			reminderStatus: null,
		},
		checkedInAt: null,
		completedAt: null,
		cancelledAt: null,
		noShowAt: null,
		cancelReason: null,
		customerRecap: `recap-${id}`,
		associateFeedback: `feedback-${id}`,
		customerFeedbackRating: null,
		customerFeedbackComment: "",
		customerFeedbackAt: null,
		createdAt: "2026-06-10T10:00:00.000Z",
		...overrides,
	};
}

const mocked = vi.mocked(api);

beforeEach(() => {
	vi.clearAllMocks();
	mocked.listAppointments.mockResolvedValue([makeAppointment()]);
	mocked.getAppointment.mockResolvedValue(makeAppointment());
	mocked.getCustomerProfile.mockResolvedValue({
		customerId: "cust_1",
		loyaltyId: "anf-1",
		displayName: "Avery Parker",
		measurements: {
			heightInches: 66,
			waistInches: 28,
			hipInches: 38,
			inseamInches: 30,
		},
		preferences: {
			fitPreference: "straight",
			stretchPreference: "comfort-stretch",
			catalogAudiences: ["womens"],
		},
	});
	mocked.listStores.mockResolvedValue([]);
	mocked.listStylists.mockResolvedValue([stylist("sty-1", "Jordan Lee")]);
	mocked.listEligibleStylists.mockResolvedValue([
		stylist("sty-1", "Jordan Lee"),
	]);
	mocked.listAppointmentMessages.mockResolvedValue([]);
	mocked.listAppointmentNotifications.mockResolvedValue([]);
});

/** Mount the hook and wait for the initial refresh() to settle. */
async function renderLoaded(appointments?: Appointment[]) {
	if (appointments) mocked.listAppointments.mockResolvedValue(appointments);
	const view = renderHook(() => useAppointmentDashboard());
	await waitFor(() =>
		expect(view.result.current.status).toBe("Appointments loaded"),
	);
	return view;
}

describe("useAppointmentDashboard — initial load", () => {
	it("loads appointments, stores, and stylists on mount", async () => {
		const stores = [
			{
				storeId: "store-1",
				name: "Flagship",
				city: "Columbus",
				state: "OH",
				address: "x",
				phone: "y",
				timezone: "America/New_York",
			},
		];
		mocked.listStores.mockResolvedValue(stores);
		const { result } = await renderLoaded();

		expect(mocked.listAppointments).toHaveBeenCalledTimes(1);
		expect(result.current.stores).toEqual(stores);
		expect(result.current.stylists).toHaveLength(1);
		expect(result.current.isLoading).toBe(false);
	});

	it("seeds the editable draft maps from each appointment", async () => {
		const { result } = await renderLoaded([makeAppointment({ id: "appt-1" })]);
		expect(result.current.sessionNotes["appt-1"]).toBe("notes-appt-1");
		expect(result.current.customerRecaps["appt-1"]).toBe("recap-appt-1");
		expect(result.current.associateFeedbacks["appt-1"]).toBe("feedback-appt-1");
	});

	it("surfaces the error message when loading fails", async () => {
		mocked.listAppointments.mockRejectedValue(new Error("Network down"));
		const { result } = renderHook(() => useAppointmentDashboard());
		await waitFor(() => expect(result.current.status).toBe("Network down"));
		expect(result.current.isLoading).toBe(false);
	});
});

describe("useAppointmentDashboard — derived state", () => {
	it("tallies counts by status", async () => {
		const { result } = await renderLoaded([
			makeAppointment({ id: "a", status: "scheduled" }),
			makeAppointment({ id: "b", status: "checked_in" }),
			makeAppointment({ id: "c", status: "completed" }),
			makeAppointment({ id: "d", status: "cancelled" }),
			makeAppointment({ id: "e", status: "no_show" }),
		]);
		expect(result.current.counts).toEqual({
			open: 2, // scheduled + checked_in are both "open"
			in_progress: 1,
			completed: 1,
			cancelled: 1,
			no_show: 1,
		});
	});

	it("filters appointments by the active view", async () => {
		const { result } = await renderLoaded([
			makeAppointment({ id: "a", status: "scheduled" }),
			makeAppointment({ id: "c", status: "completed" }),
		]);
		// Default view is "open".
		expect(result.current.filteredAppointments.map((a) => a.id)).toEqual(["a"]);

		act(() => result.current.changeView("completed"));
		expect(result.current.filteredAppointments.map((a) => a.id)).toEqual(["c"]);
	});

	it("clears the selection when switching views", async () => {
		const { result } = await renderLoaded();
		act(() => result.current.setSelectedAppointmentId("appt-1"));
		act(() => result.current.changeView("completed"));
		expect(result.current.selectedAppointmentId).toBeNull();
	});
});

describe("useAppointmentDashboard — appointment actions", () => {
	it("checks in an appointment and advances to in_progress", async () => {
		const checkedIn = makeAppointment({ id: "appt-1", status: "checked_in" });
		mocked.checkInAppointment.mockResolvedValue(checkedIn);
		const { result } = await renderLoaded();

		await act(async () => {
			await result.current.checkIn(makeAppointment({ id: "appt-1" }));
		});

		expect(mocked.checkInAppointment).toHaveBeenCalledWith("appt-1");
		expect(result.current.activeView).toBe("in_progress");
		expect(result.current.status).toBe("Appointment checked in");
		expect(result.current.counts.in_progress).toBe(1);
	});

	it("completes a session with the captured notes, recap, and feedback", async () => {
		const completed = makeAppointment({ id: "appt-1", status: "completed" });
		mocked.completeAppointment.mockResolvedValue(completed);
		const { result } = await renderLoaded();

		act(() => result.current.onCustomerRecapChange("appt-1", "Loved the fit"));
		await act(async () => {
			await result.current.completeSession(makeAppointment({ id: "appt-1" }));
		});

		expect(mocked.completeAppointment).toHaveBeenCalledWith("appt-1", {
			sessionNotes: "notes-appt-1",
			customerRecap: "Loved the fit",
			associateFeedback: "feedback-appt-1",
		});
		expect(result.current.activeView).toBe("completed");
	});

	it("marks an appointment as a no-show", async () => {
		mocked.markNoShowAppointment.mockResolvedValue(
			makeAppointment({ id: "appt-1", status: "no_show" }),
		);
		const { result } = await renderLoaded();
		await act(async () => {
			await result.current.noShow(makeAppointment({ id: "appt-1" }));
		});
		expect(mocked.markNoShowAppointment).toHaveBeenCalledWith("appt-1");
		expect(result.current.activeView).toBe("no_show");
	});

	it("reassigns to a different stylist", async () => {
		mocked.reassignAppointmentStylist.mockResolvedValue(makeAppointment());
		const { result } = await renderLoaded();
		await act(async () => {
			await result.current.reassign(makeAppointment(), "sty-2");
		});
		expect(mocked.reassignAppointmentStylist).toHaveBeenCalledWith(
			"appt-1",
			"sty-2",
		);
	});

	it("skips reassignment when the stylist is unchanged", async () => {
		const { result } = await renderLoaded();
		await act(async () => {
			// assignedStylist.id on the fixture is "sty-1".
			await result.current.reassign(makeAppointment(), "sty-1");
		});
		expect(mocked.reassignAppointmentStylist).not.toHaveBeenCalled();
	});

	it("saves edited session notes", async () => {
		mocked.updateSessionNotes.mockResolvedValue(makeAppointment());
		const { result } = await renderLoaded();
		act(() => result.current.onSessionNoteChange("appt-1", "Tried slim wash"));
		await act(async () => {
			await result.current.saveNotes(makeAppointment({ id: "appt-1" }));
		});
		expect(mocked.updateSessionNotes).toHaveBeenCalledWith(
			"appt-1",
			"Tried slim wash",
		);
		expect(result.current.status).toBe("Session notes saved");
	});

	it("regenerates suggestions", async () => {
		mocked.regenerateSuggestions.mockResolvedValue(makeAppointment());
		const { result } = await renderLoaded();
		await act(async () => {
			await result.current.regenerate(makeAppointment({ id: "appt-1" }));
		});
		expect(mocked.regenerateSuggestions).toHaveBeenCalledWith("appt-1");
		expect(result.current.status).toBe("Suggestions regenerated");
	});

	it("saves outfit intents without regenerating", async () => {
		const analysis = {
			engine: "manual",
			garments: [],
		} as unknown as OutfitAnalysis;
		mocked.updateOutfitAnalysis.mockResolvedValue(makeAppointment());
		const { result } = await renderLoaded();
		await act(async () => {
			await result.current.saveOutfitIntents(
				makeAppointment({ id: "appt-1" }),
				analysis,
			);
		});
		expect(mocked.updateOutfitAnalysis).toHaveBeenCalledWith(
			"appt-1",
			analysis,
			false,
		);
	});

	it("updates a suggested product's prep status", async () => {
		const suggestion = {
			product: { productId: "prod-9" },
		} as unknown as SuggestedProduct;
		mocked.updateSuggestedProductPrep.mockResolvedValue(makeAppointment());
		const { result } = await renderLoaded();
		await act(async () => {
			await result.current.updateProductPrep(
				makeAppointment({ id: "appt-1" }),
				suggestion,
				"pulled",
				"on the rack",
			);
		});
		expect(mocked.updateSuggestedProductPrep).toHaveBeenCalledWith(
			"appt-1",
			"prod-9",
			"pulled",
			"on the rack",
		);
	});

	it("reports the failure status when an action rejects", async () => {
		mocked.checkInAppointment.mockRejectedValue(new Error("Server error"));
		const { result } = await renderLoaded();
		await act(async () => {
			await result.current.checkIn(makeAppointment({ id: "appt-1" }));
		});
		expect(result.current.status).toBe("Server error");
		expect(result.current.isLoading).toBe(false);
	});
});

describe("useAppointmentDashboard — messaging", () => {
	it("ignores a blank message draft", async () => {
		const { result } = await renderLoaded();
		act(() => result.current.onMessageDraftChange("appt-1", "   "));
		await act(async () => {
			await result.current.postMessage(makeAppointment({ id: "appt-1" }));
		});
		expect(mocked.postAppointmentMessage).not.toHaveBeenCalled();
	});

	it("posts a message, appends it, and clears the draft", async () => {
		const message: AppointmentMessage = {
			id: "msg-1",
			appointmentId: "appt-1",
			authorType: "associate",
			body: "On my way over",
			createdAt: "2026-06-16T15:05:00.000Z",
		};
		mocked.postAppointmentMessage.mockResolvedValue(message);
		const { result } = await renderLoaded();

		act(() => result.current.onMessageDraftChange("appt-1", "On my way over"));
		await act(async () => {
			await result.current.postMessage(makeAppointment({ id: "appt-1" }));
		});

		expect(mocked.postAppointmentMessage).toHaveBeenCalledWith(
			"appt-1",
			"On my way over",
		);
		expect(result.current.messages["appt-1"]).toEqual([message]);
		expect(result.current.messageDrafts["appt-1"]).toBe("");
	});
});

describe("useAppointmentDashboard — draft setters", () => {
	it("routes each draft setter to its own keyed map", async () => {
		const { result } = await renderLoaded();
		act(() => {
			result.current.onSessionNoteChange("appt-1", "s");
			result.current.onCustomerRecapChange("appt-1", "c");
			result.current.onAssociateFeedbackChange("appt-1", "f");
			result.current.onMessageDraftChange("appt-1", "m");
		});
		expect(result.current.sessionNotes["appt-1"]).toBe("s");
		expect(result.current.customerRecaps["appt-1"]).toBe("c");
		expect(result.current.associateFeedbacks["appt-1"]).toBe("f");
		expect(result.current.messageDrafts["appt-1"]).toBe("m");
	});
});

describe("useAppointmentDashboard — selection effects", () => {
	it("loads messages and notifications for the selected appointment", async () => {
		const message: AppointmentMessage = {
			id: "msg-1",
			appointmentId: "appt-1",
			authorType: "customer",
			body: "Running late",
			createdAt: "2026-06-16T15:00:00.000Z",
		};
		mocked.listAppointmentMessages.mockResolvedValue([message]);
		const { result } = await renderLoaded();

		act(() => result.current.setSelectedAppointmentId("appt-1"));
		await waitFor(() =>
			expect(result.current.messages["appt-1"]).toEqual([message]),
		);
		expect(mocked.listAppointmentNotifications).toHaveBeenCalledWith("appt-1");
	});

	it("resets a selection that no longer exists", async () => {
		const { result } = await renderLoaded();
		act(() => result.current.setSelectedAppointmentId("ghost"));
		await waitFor(() =>
			expect(result.current.selectedAppointmentId).toBeNull(),
		);
		expect(result.current.selectedAppointment).toBeNull();
	});
});
