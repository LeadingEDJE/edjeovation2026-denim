import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Appointment } from "./api.js";
import {
	colorNameToHex,
	formatAppointmentDateTime,
	formatAppointmentTime,
	initials,
	relativeSlotLabel,
	splitColorList,
	statusBadgeVariant,
	statusLabel,
} from "./formatters.js";

// The formatters only read slotStart/slotEnd/status; build a minimal fixture.
function appt(overrides: Partial<Appointment> = {}): Appointment {
	return {
		slotStart: "2026-06-16T12:00:00.000Z",
		slotEnd: "2026-06-16T13:00:00.000Z",
		status: "scheduled",
		...overrides,
	} as Appointment;
}

describe("statusLabel", () => {
	it("maps every status to a human label", () => {
		expect(statusLabel("scheduled")).toBe("Scheduled");
		expect(statusLabel("checked_in")).toBe("Checked in");
		expect(statusLabel("completed")).toBe("Completed");
		expect(statusLabel("cancelled")).toBe("Cancelled");
		expect(statusLabel("no_show")).toBe("No-show");
	});
});

describe("statusBadgeVariant", () => {
	it("maps statuses onto badge tones", () => {
		expect(statusBadgeVariant("scheduled")).toBe("neutral");
		expect(statusBadgeVariant("checked_in")).toBe("new");
		expect(statusBadgeVariant("completed")).toBe("outline");
		expect(statusBadgeVariant("cancelled")).toBe("sale");
		expect(statusBadgeVariant("no_show")).toBe("sale");
	});
});

describe("initials", () => {
	it("takes first + last initial for multi-word names", () => {
		expect(initials("Jordan Lee")).toBe("JL");
		expect(initials("Avery Quinn Parker")).toBe("AP");
	});

	it("takes up to two letters for a single name", () => {
		expect(initials("Cher")).toBe("CH");
		expect(initials("A")).toBe("A");
	});

	it("collapses extra whitespace", () => {
		expect(initials("  Jordan   Lee  ")).toBe("JL");
	});

	it("falls back to '?' for empty input", () => {
		expect(initials("")).toBe("?");
		expect(initials("   ")).toBe("?");
	});
});

describe("splitColorList", () => {
	it("splits on commas, slashes, and the word 'and'", () => {
		expect(splitColorList("Indigo, Ecru")).toEqual(["Indigo", "Ecru"]);
		expect(splitColorList("Black / White")).toEqual(["Black", "White"]);
		expect(splitColorList("Navy and Stone")).toEqual(["Navy", "Stone"]);
		expect(splitColorList("Indigo, Black / Navy and Ecru")).toEqual([
			"Indigo",
			"Black",
			"Navy",
			"Ecru",
		]);
	});

	it("drops empty fragments and trims whitespace", () => {
		expect(splitColorList("Indigo, , Ecru")).toEqual(["Indigo", "Ecru"]);
		expect(splitColorList("")).toEqual([]);
	});
});

describe("colorNameToHex", () => {
	it("resolves known color names case- and whitespace-insensitively", () => {
		expect(colorNameToHex("indigo")).toBe("#2f3b66");
		expect(colorNameToHex("  BLACK ")).toBe("#1c1c1c");
		expect(colorNameToHex("Deep Blue")).toBe("#1f3a5f");
	});

	it("falls back to a neutral line color for unknown names", () => {
		expect(colorNameToHex("chartreuse")).toBe("#c6c6c6");
	});
});

describe("formatAppointmentTime", () => {
	it("formats the slot start into a non-empty localized string", () => {
		const result = formatAppointmentTime(appt());
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("formatAppointmentDateTime", () => {
	it("renders a start-to-end range including the end time", () => {
		const fixture = appt();
		const expectedEnd = new Date(fixture.slotEnd).toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
		});
		const result = formatAppointmentDateTime(fixture);
		expect(result).toContain(" - ");
		expect(result.endsWith(expectedEnd)).toBe(true);
	});
});

describe("relativeSlotLabel", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("counts down for an imminent scheduled appointment", () => {
		const result = relativeSlotLabel(
			appt({ slotStart: "2026-06-16T12:12:00.000Z" }),
		);
		expect(result.imminent).toBe(true);
		expect(result.big).toBe("In 12 min");
		expect(result.eyebrow.startsWith("Now · ")).toBe(true);
	});

	it("shows 'Now' for a scheduled appointment starting this instant", () => {
		const result = relativeSlotLabel(
			appt({ slotStart: "2026-06-16T12:00:00.000Z" }),
		);
		expect(result.imminent).toBe(true);
		expect(result.big).toBe("Now");
	});

	it("treats exactly 60 minutes out as imminent, 61 as not", () => {
		expect(
			relativeSlotLabel(appt({ slotStart: "2026-06-16T13:00:00.000Z" }))
				.imminent,
		).toBe(true);
		expect(
			relativeSlotLabel(appt({ slotStart: "2026-06-16T13:01:00.000Z" }))
				.imminent,
		).toBe(false);
	});

	it("shows 'Checked in' for a checked-in appointment at/after its slot", () => {
		const result = relativeSlotLabel(
			appt({ slotStart: "2026-06-16T11:55:00.000Z", status: "checked_in" }),
		);
		expect(result.imminent).toBe(true);
		expect(result.big).toBe("Checked in");
	});

	it("counts down for a checked-in appointment still in the future", () => {
		const result = relativeSlotLabel(
			appt({ slotStart: "2026-06-16T12:10:00.000Z", status: "checked_in" }),
		);
		expect(result.big).toBe("In 10 min");
	});

	it("shows the day and time for a non-imminent future appointment", () => {
		const fixture = appt({ slotStart: "2026-06-20T17:00:00.000Z" });
		const expectedTime = new Date(fixture.slotStart).toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
		});
		const result = relativeSlotLabel(fixture);
		expect(result.imminent).toBe(false);
		expect(result.big).toBe(expectedTime);
		expect(result.eyebrow).toContain(" · ");
	});
});
