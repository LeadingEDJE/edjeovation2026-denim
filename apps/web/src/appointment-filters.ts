import type { Appointment } from "./api";
import type { AppointmentFilters, DashboardView } from "./types";

export function isOpenAppointment(appointment: Appointment) {
	return (
		appointment.status === "scheduled" || appointment.status === "checked_in"
	);
}

export function matchesView(appointment: Appointment, view: DashboardView) {
	switch (view) {
		case "open":
			return isOpenAppointment(appointment);
		case "in_progress":
			return appointment.status === "checked_in";
		case "completed":
			return appointment.status === "completed";
		case "cancelled":
			return appointment.status === "cancelled";
		case "no_show":
			return appointment.status === "no_show";
	}
}

export function matchesFilters(
	appointment: Appointment,
	filters: AppointmentFilters,
) {
	if (filters.storeId && appointment.store.storeId !== filters.storeId) {
		return false;
	}
	if (
		filters.date &&
		new Date(appointment.slotStart).toISOString().slice(0, 10) !== filters.date
	) {
		return false;
	}
	if (
		filters.stylistId &&
		appointment.assignedStylist.id !== filters.stylistId
	) {
		return false;
	}
	if (filters.status && appointment.status !== filters.status) {
		return false;
	}
	return true;
}

export function compareAppointments(
	a: Appointment,
	b: Appointment,
	dateOrder: AppointmentFilters["dateOrder"],
) {
	const aTime = new Date(a.slotStart).getTime();
	const bTime = new Date(b.slotStart).getTime();

	if (dateOrder === "oldest") {
		return aTime - bTime;
	}
	if (dateOrder === "newest") {
		return bTime - aTime;
	}

	const now = Date.now();
	const aFuture = aTime >= now;
	const bFuture = bTime >= now;

	if (aFuture !== bFuture) {
		return aFuture ? -1 : 1;
	}

	return aFuture ? aTime - bTime : bTime - aTime;
}
