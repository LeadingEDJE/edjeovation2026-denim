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
