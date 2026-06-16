import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Appointment, AppointmentStatus } from "./api.js";
import {
	compareAppointments,
	isOpenAppointment,
	matchesFilters,
	matchesView,
} from "./appointment-filters.js";
import type { AppointmentFilters } from "./components/AppointmentList.js";

function appt(
	p: {
		status?: AppointmentStatus;
		slotStart?: string;
		storeId?: string;
		stylistId?: string;
	} = {},
): Appointment {
	return {
		slotStart: p.slotStart ?? "2026-06-16T12:00:00.000Z",
		status: p.status ?? "scheduled",
		store: { storeId: p.storeId ?? "store-1" },
		assignedStylist: { id: p.stylistId ?? "sty-1" },
	} as unknown as Appointment;
}

const noFilters: AppointmentFilters = {
	storeId: "",
	date: "",
	dateOrder: "open_priority",
	stylistId: "",
	status: "",
};

describe("isOpenAppointment", () => {
	it("is true only for scheduled or checked-in", () => {
		expect(isOpenAppointment(appt({ status: "scheduled" }))).toBe(true);
		expect(isOpenAppointment(appt({ status: "checked_in" }))).toBe(true);
		expect(isOpenAppointment(appt({ status: "completed" }))).toBe(false);
		expect(isOpenAppointment(appt({ status: "cancelled" }))).toBe(false);
		expect(isOpenAppointment(appt({ status: "no_show" }))).toBe(false);
	});
});

describe("matchesView", () => {
	it("treats both scheduled and checked-in as open", () => {
		expect(matchesView(appt({ status: "scheduled" }), "open")).toBe(true);
		expect(matchesView(appt({ status: "checked_in" }), "open")).toBe(true);
		expect(matchesView(appt({ status: "completed" }), "open")).toBe(false);
	});

	it("scopes in_progress to checked-in only", () => {
		expect(matchesView(appt({ status: "checked_in" }), "in_progress")).toBe(
			true,
		);
		expect(matchesView(appt({ status: "scheduled" }), "in_progress")).toBe(
			false,
		);
	});

	it("matches terminal views by exact status", () => {
		expect(matchesView(appt({ status: "completed" }), "completed")).toBe(true);
		expect(matchesView(appt({ status: "cancelled" }), "cancelled")).toBe(true);
		expect(matchesView(appt({ status: "no_show" }), "no_show")).toBe(true);
		expect(matchesView(appt({ status: "completed" }), "cancelled")).toBe(false);
	});
});

describe("matchesFilters", () => {
	it("matches everything when no filters are set", () => {
		expect(matchesFilters(appt(), noFilters)).toBe(true);
	});

	it("filters by store", () => {
		const a = appt({ storeId: "store-2" });
		expect(matchesFilters(a, { ...noFilters, storeId: "store-2" })).toBe(true);
		expect(matchesFilters(a, { ...noFilters, storeId: "store-1" })).toBe(false);
	});

	it("filters by stylist", () => {
		const a = appt({ stylistId: "sty-9" });
		expect(matchesFilters(a, { ...noFilters, stylistId: "sty-9" })).toBe(true);
		expect(matchesFilters(a, { ...noFilters, stylistId: "sty-1" })).toBe(false);
	});

	it("filters by status", () => {
		const a = appt({ status: "completed" });
		expect(matchesFilters(a, { ...noFilters, status: "completed" })).toBe(true);
		expect(matchesFilters(a, { ...noFilters, status: "scheduled" })).toBe(
			false,
		);
	});

	it("filters by calendar date (UTC day of the slot start)", () => {
		const a = appt({ slotStart: "2026-06-16T23:30:00.000Z" });
		expect(matchesFilters(a, { ...noFilters, date: "2026-06-16" })).toBe(true);
		expect(matchesFilters(a, { ...noFilters, date: "2026-06-17" })).toBe(false);
	});

	it("requires all active filters to pass (AND semantics)", () => {
		const a = appt({ storeId: "store-2", stylistId: "sty-9" });
		expect(
			matchesFilters(a, { ...noFilters, storeId: "store-2", stylistId: "x" }),
		).toBe(false);
	});
});

describe("compareAppointments", () => {
	const earlier = appt({ slotStart: "2026-06-16T09:00:00.000Z" });
	const later = appt({ slotStart: "2026-06-16T15:00:00.000Z" });

	it("sorts ascending for 'oldest'", () => {
		expect(compareAppointments(earlier, later, "oldest")).toBeLessThan(0);
		expect(compareAppointments(later, earlier, "oldest")).toBeGreaterThan(0);
	});

	it("sorts descending for 'newest'", () => {
		expect(compareAppointments(earlier, later, "newest")).toBeGreaterThan(0);
		expect(compareAppointments(later, earlier, "newest")).toBeLessThan(0);
	});

	describe("open_priority", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		const future1 = appt({ slotStart: "2026-06-17T10:00:00.000Z" });
		const future2 = appt({ slotStart: "2026-06-18T10:00:00.000Z" });
		const past1 = appt({ slotStart: "2026-06-15T10:00:00.000Z" });
		const past2 = appt({ slotStart: "2026-06-14T10:00:00.000Z" });

		it("ranks future appointments before past ones", () => {
			expect(compareAppointments(future1, past1, "open_priority")).toBeLessThan(
				0,
			);
			expect(
				compareAppointments(past1, future1, "open_priority"),
			).toBeGreaterThan(0);
		});

		it("orders future appointments soonest-first", () => {
			expect(
				compareAppointments(future1, future2, "open_priority"),
			).toBeLessThan(0);
		});

		it("orders past appointments most-recent-first", () => {
			expect(compareAppointments(past1, past2, "open_priority")).toBeLessThan(
				0,
			);
		});

		it("produces a future→past, then chronological ordering when sorted", () => {
			const sorted = [past1, future2, past2, future1].sort((a, b) =>
				compareAppointments(a, b, "open_priority"),
			);
			expect(sorted).toEqual([future1, future2, past1, past2]);
		});
	});
});
