import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Appointment, StylistProfile } from "../api";
import { AppointmentDetail } from "./AppointmentDetail";

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
		specialties: ["curvy-fit"],
		stylePointOfView: [],
		supportedFits: [],
		customerSignals: [],
		availability: { status: "available", nextAvailableAt: null },
		avatarUrl: null,
	};
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
	return {
		id: "11111111-1111-4111-8111-111111111111",
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
		guidance: "",
		sessionNotes: "",
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
		customerRecap: "",
		associateFeedback: "",
		customerFeedbackRating: null,
		customerFeedbackComment: "",
		customerFeedbackAt: null,
		createdAt: "2026-06-10T10:00:00.000Z",
		...overrides,
	};
}

const SESSION_NOTE_PLACEHOLDER = "Fit feedback, products tried, follow-ups…";

function renderDetail(
	overrides: Partial<Parameters<typeof AppointmentDetail>[0]> = {},
) {
	const handlers = {
		onBack: vi.fn(),
		onSessionNoteChange: vi.fn(),
		onCustomerRecapChange: vi.fn(),
		onAssociateFeedbackChange: vi.fn(),
		onMessageDraftChange: vi.fn(),
		onSaveNotes: vi.fn(),
		onCompleteSession: vi.fn(),
		onRegenerate: vi.fn(),
		onCheckIn: vi.fn(),
		onNoShow: vi.fn(),
		onReassign: vi.fn(),
		onPostMessage: vi.fn(),
		onSaveOutfitIntents: vi.fn(),
		onUpdateProductPrep: vi.fn(),
	};
	const appointment = overrides.appointment ?? makeAppointment();
	render(
		<AppointmentDetail
			appointment={appointment}
			stylists={[
				stylist("sty-1", "Jordan Lee"),
				stylist("sty-2", "Riley Chen"),
			]}
			messages={[]}
			notifications={[]}
			isLoading={false}
			sessionNote=""
			customerRecap=""
			associateFeedback=""
			messageDraft=""
			{...handlers}
			{...overrides}
		/>,
	);
	return { ...handlers, appointment };
}

describe("AppointmentDetail — interactive (scheduled / checked-in)", () => {
	it("renders the customer name and a Check In action", () => {
		renderDetail();
		expect(screen.getByText("Avery Parker")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Check In" })).toBeEnabled();
	});

	it("calls onBack from the back button", () => {
		const { onBack } = renderDetail();
		fireEvent.click(screen.getByRole("button", { name: /back to queue/i }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("calls onCheckIn and onNoShow for a scheduled appointment", () => {
		const { onCheckIn, onNoShow, appointment } = renderDetail();
		fireEvent.click(screen.getByRole("button", { name: "Check In" }));
		fireEvent.click(screen.getByRole("button", { name: "No-Show" }));
		expect(onCheckIn).toHaveBeenCalledWith(appointment);
		expect(onNoShow).toHaveBeenCalledWith(appointment);
	});

	it("disables Check In once the appointment is checked in", () => {
		renderDetail({ appointment: makeAppointment({ status: "checked_in" }) });
		expect(screen.getByRole("button", { name: "Check In" })).toBeDisabled();
	});

	it("locks session capture until check-in", () => {
		renderDetail();
		expect(
			screen.getByPlaceholderText(SESSION_NOTE_PLACEHOLDER),
		).toBeDisabled();
		expect(screen.getByText(/unlocks at check-in/i)).toBeInTheDocument();
	});

	it("enables session capture and reports edits once checked in", () => {
		const { onSessionNoteChange, appointment } = renderDetail({
			appointment: makeAppointment({ status: "checked_in" }),
		});
		const notes = screen.getByPlaceholderText(SESSION_NOTE_PLACEHOLDER);
		expect(notes).toBeEnabled();
		fireEvent.change(notes, { target: { value: "Tried slim dark wash" } });
		expect(onSessionNoteChange).toHaveBeenCalledWith(
			appointment.id,
			"Tried slim dark wash",
		);
	});

	it("blocks completion until a customer recap exists", () => {
		renderDetail({ appointment: makeAppointment({ status: "checked_in" }) });
		expect(screen.getByRole("button", { name: /^complete/i })).toBeDisabled();
	});

	it("completes the session when checked in with a recap", () => {
		const { onCompleteSession, appointment } = renderDetail({
			appointment: makeAppointment({ status: "checked_in" }),
			customerRecap: "Great fit on the slim dark wash.",
		});
		const complete = screen.getByRole("button", { name: /^complete/i });
		expect(complete).toBeEnabled();
		fireEvent.click(complete);
		expect(onCompleteSession).toHaveBeenCalledWith(appointment);
	});

	it("saves notes via the footer action", () => {
		const { onSaveNotes, appointment } = renderDetail();
		fireEvent.click(screen.getByRole("button", { name: /save notes/i }));
		expect(onSaveNotes).toHaveBeenCalledWith(appointment);
	});

	it("reassigns to another same-store stylist", () => {
		const { onReassign, appointment } = renderDetail();
		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "sty-2" },
		});
		expect(onReassign).toHaveBeenCalledWith(appointment, "sty-2");
	});
});

describe("AppointmentDetail — read-only (terminal)", () => {
	it("renders the read-only recap without action controls", () => {
		renderDetail({ appointment: makeAppointment({ status: "completed" }) });
		expect(screen.getByText(/read-only — session closed/i)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Check In" }),
		).not.toBeInTheDocument();
	});
});
