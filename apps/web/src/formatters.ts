import type { BadgeVariant } from "@denim-fit/design-system";
import type { Appointment } from "./api";

export function statusLabel(status: Appointment["status"]) {
	switch (status) {
		case "scheduled":
			return "Scheduled";
		case "checked_in":
			return "Checked in";
		case "completed":
			return "Completed";
		case "cancelled":
			return "Cancelled";
		case "no_show":
			return "No-show";
	}
}

/** Maps an appointment status onto a design-system Badge tone. */
export function statusBadgeVariant(
	status: Appointment["status"],
): BadgeVariant {
	switch (status) {
		case "scheduled":
			return "neutral";
		case "checked_in":
			return "new";
		case "completed":
			return "outline";
		case "cancelled":
		case "no_show":
			return "sale";
	}
}

export function formatAppointmentTime(appointment: Appointment) {
	return new Date(appointment.slotStart).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function formatAppointmentDateTime(appointment: Appointment) {
	const start = new Date(appointment.slotStart);
	const end = new Date(appointment.slotEnd);
	return `${start.toLocaleString([], {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	})} - ${end.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	})}`;
}

/** Initials from a name — up to two leading letters, uppercased ("Jordan Lee" → "JL"). */
export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return "?";
	}
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Time treatment for a queue row. Checked-in or imminent (within ~60 min)
 * appointments get a countdown ("Now · 9:45 AM" / "In 12 min"); everything else
 * shows the day and start time ("Fri · Jun 19" / "1:00 PM").
 */
export function relativeSlotLabel(appointment: Appointment): {
	eyebrow: string;
	big: string;
	imminent: boolean;
} {
	const start = new Date(appointment.slotStart);
	const diffMin = Math.round((start.getTime() - Date.now()) / 60000);
	const timeStr = start.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});

	if (appointment.status === "checked_in" || (diffMin >= 0 && diffMin <= 60)) {
		let big: string;
		if (appointment.status === "checked_in") {
			big = diffMin <= 0 ? "Checked in" : `In ${diffMin} min`;
		} else {
			big = diffMin <= 0 ? "Now" : `In ${diffMin} min`;
		}
		return { eyebrow: `Now · ${timeStr}`, big, imminent: true };
	}

	const weekday = start.toLocaleDateString([], { weekday: "short" });
	const monthDay = start.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});
	return { eyebrow: `${weekday} · ${monthDay}`, big: timeStr, imminent: false };
}

const MOBILE_SWATCH_HEX: Record<string, string> = {
	black: "#1c1c1c",
	white: "#ffffff",
	cream: "#dcd3bd",
	"light wash": "#b9c2d4",
	"medium wash": "#7d92b8",
	"dark wash": "#2f3b66",
	grey: "#9a9a9a",
	navy: "#27455c",
	green: "#5b7050",
	pink: "#e8a0b8",
	red: "#a32d2d",
};

const COLOR_NAME_HEX: Record<string, string> = {
	...MOBILE_SWATCH_HEX,
	gray: MOBILE_SWATCH_HEX.grey,
	"washed black": MOBILE_SWATCH_HEX.black,
	"black wash": MOBILE_SWATCH_HEX.black,
	"bright white": MOBILE_SWATCH_HEX.white,
	"washed white": MOBILE_SWATCH_HEX.white,
	ecru: MOBILE_SWATCH_HEX.cream,
	ivory: MOBILE_SWATCH_HEX.cream,
	lightwash: MOBILE_SWATCH_HEX["light wash"],
	"light denim": MOBILE_SWATCH_HEX["light wash"],
	mediumwash: MOBILE_SWATCH_HEX["medium wash"],
	denim: MOBILE_SWATCH_HEX["medium wash"],
	"medium denim": MOBILE_SWATCH_HEX["medium wash"],
	darkwash: MOBILE_SWATCH_HEX["dark wash"],
	indigo: MOBILE_SWATCH_HEX["dark wash"],
	blue: MOBILE_SWATCH_HEX["dark wash"],
	"dark denim": MOBILE_SWATCH_HEX["dark wash"],
	"deep blue": "#1f3a5f",
	olive: MOBILE_SWATCH_HEX.green,
	pastels: MOBILE_SWATCH_HEX.pink,
	pastel: MOBILE_SWATCH_HEX.pink,
	stone: "#d8cfc0",
	khaki: "#b3a380",
	charcoal: "#36393d",
	rust: "#9c4a2b",
	burgundy: "#5e1f2a",
};

/** Best-effort swatch hex for a free-text color name; neutral line color as fallback. */
export function colorNameToHex(name: string): string {
	const key = name
		.trim()
		.toLowerCase()
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ");
	return COLOR_NAME_HEX[key] ?? "#c6c6c6";
}

/** Split a free-text color field ("Indigo, Ecru") into trimmed labels. */
export function splitColorList(value: string): string[] {
	return value
		.split(/[,/]|\band\b/i)
		.map((part) => part.trim())
		.filter(Boolean);
}
