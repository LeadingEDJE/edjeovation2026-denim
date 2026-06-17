import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Appointment } from "../api.js";
import { groupByDay } from "./AppointmentList.js";

// groupByDay only reads `id` (row key) and `slotStart`; keep the fixture minimal.
function appt(id: string, slotStart: string): Appointment {
	return { id, slotStart } as Appointment;
}

describe("groupByDay", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// Offsets from "now" stay in the right calendar bucket regardless of the
	// runner's timezone, since now always sits inside [startOfToday, startOfTomorrow).
	const now = () => Date.now();
	const iso = (ms: number) => new Date(ms).toISOString();

	it("returns the three buckets in Today / Upcoming / Earlier order", () => {
		const groups = groupByDay([]);
		expect(groups.map((group) => group.label)).toEqual([
			expect.stringMatching(/^Today · /),
			"Upcoming",
			"Earlier",
		]);
		expect(groups.every((group) => group.appointments.length === 0)).toBe(true);
	});

	it("places an appointment starting today in the Today bucket", () => {
		const [today, upcoming, earlier] = groupByDay([appt("a", iso(now()))]);
		expect(today.appointments.map((a) => a.id)).toEqual(["a"]);
		expect(upcoming.appointments).toEqual([]);
		expect(earlier.appointments).toEqual([]);
	});

	it("splits future, today, and past appointments into the right buckets", () => {
		const [today, upcoming, earlier] = groupByDay([
			appt("today", iso(now())),
			appt("tomorrow", iso(now() + 86_400_000)),
			appt("yesterday", iso(now() - 86_400_000)),
		]);
		expect(today.appointments.map((a) => a.id)).toEqual(["today"]);
		expect(upcoming.appointments.map((a) => a.id)).toEqual(["tomorrow"]);
		expect(earlier.appointments.map((a) => a.id)).toEqual(["yesterday"]);
	});

	it("preserves the incoming order within a bucket", () => {
		const [today] = groupByDay([
			appt("first", iso(now() + 1_000)),
			appt("second", iso(now() + 2_000)),
			appt("third", iso(now() + 3_000)),
		]);
		expect(today.appointments.map((a) => a.id)).toEqual([
			"first",
			"second",
			"third",
		]);
	});

	it("labels the Today bucket with the current month and day", () => {
		const [today] = groupByDay([]);
		const expected = `Today · ${new Date().toLocaleDateString([], {
			month: "short",
			day: "numeric",
		})}`;
		expect(today.label).toBe(expected);
	});
});
