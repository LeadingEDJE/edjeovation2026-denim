import type { AppointmentStatus } from "./api";

export type DashboardView =
	| "open"
	| "in_progress"
	| "completed"
	| "cancelled"
	| "no_show";

export type AppointmentFilters = {
	storeId: string;
	date: string;
	dateOrder: "open_priority" | "oldest" | "newest";
	stylistId: string;
	status: AppointmentStatus | "";
};
