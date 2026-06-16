import { Badge } from "@denim-fit/design-system";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import type {
	Appointment,
	AppointmentStatus,
	Store,
	StylistProfile,
} from "../api";
import {
	initials,
	relativeSlotLabel,
	statusBadgeVariant,
	statusLabel,
} from "../formatters";
import type { DashboardView } from "../types";

export type AppointmentFilters = {
	storeId: string;
	date: string;
	dateOrder: "open_priority" | "oldest" | "newest";
	stylistId: string;
	status: AppointmentStatus | "";
};

type AppointmentListProps = {
	activeTitle: string;
	appointments: Appointment[];
	filters: AppointmentFilters;
	stores: Store[];
	stylists: StylistProfile[];
	onFilterChange: (filters: AppointmentFilters) => void;
	onSelect: (appointmentId: string) => void;
};

export function AppointmentList({
	activeTitle,
	appointments,
	filters,
	stores,
	stylists,
	onFilterChange,
	onSelect,
}: AppointmentListProps) {
	const [query, setQuery] = useState("");

	const needle = query.trim().toLowerCase();
	const visible = needle
		? appointments.filter((appointment) =>
				`${appointment.customerName} ${appointment.assignedStylist.displayName}`
					.toLowerCase()
					.includes(needle),
			)
		: appointments;

	const groups = groupByDay(visible);

	return (
		<section
			className="rounded-none border border-line bg-surface"
			data-testid="appointments-panel"
		>
			<AppointmentFilterBar
				filters={filters}
				stores={stores}
				stylists={stylists}
				query={query}
				onQueryChange={setQuery}
				onFilterChange={onFilterChange}
			/>
			<div
				className="px-5 pt-1 pb-7 min-[760px]:px-8"
				data-testid="appointment-list"
			>
				{groups.map((group) =>
					group.appointments.length > 0 ? (
						<div key={group.label}>
							<GroupHeader
								label={group.label}
								count={group.appointments.length}
							/>
							<div className="grid gap-3">
								{group.appointments.map((appointment) => (
									<AppointmentListRow
										key={appointment.id}
										appointment={appointment}
										onSelect={onSelect}
									/>
								))}
							</div>
						</div>
					) : null,
				)}
				{visible.length === 0 ? (
					<p
						className="pt-6 text-[0.9rem] text-muted"
						data-testid="appointments-empty"
					>
						No {activeTitle.toLowerCase()} appointments
						{needle ? " match your search" : ""}.
					</p>
				) : null}
			</div>
		</section>
	);
}

type DayGroup = { label: string; appointments: Appointment[] };

/** Bucket appointments into Today / Upcoming / Earlier, preserving incoming order. */
function groupByDay(appointments: Appointment[]): DayGroup[] {
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const startOfTomorrow = startOfToday + 86_400_000;
	const todayLabel = `Today · ${now.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	})}`;

	const today: Appointment[] = [];
	const upcoming: Appointment[] = [];
	const earlier: Appointment[] = [];

	for (const appointment of appointments) {
		const slot = new Date(appointment.slotStart).getTime();
		if (slot >= startOfToday && slot < startOfTomorrow) {
			today.push(appointment);
		} else if (slot >= startOfTomorrow) {
			upcoming.push(appointment);
		} else {
			earlier.push(appointment);
		}
	}

	return [
		{ label: todayLabel, appointments: today },
		{ label: "Upcoming", appointments: upcoming },
		{ label: "Earlier", appointments: earlier },
	];
}

function GroupHeader({ label, count }: { label: string; count: number }) {
	return (
		<div className="flex items-center gap-3 pt-5 pb-3">
			<span className="font-display font-semibold text-[13px] text-ink uppercase tracking-label">
				{label}
			</span>
			<span className="h-px flex-1 bg-line-subtle" />
			<span className="font-bold text-2xs text-muted uppercase tracking-label">
				{count} {count === 1 ? "appointment" : "appointments"}
			</span>
		</div>
	);
}

function AppointmentFilterBar({
	filters,
	stores,
	stylists,
	query,
	onQueryChange,
	onFilterChange,
}: {
	filters: AppointmentFilters;
	stores: Store[];
	stylists: StylistProfile[];
	query: string;
	onQueryChange: (value: string) => void;
	onFilterChange: (filters: AppointmentFilters) => void;
}) {
	const update = (patch: Partial<AppointmentFilters>) =>
		onFilterChange({ ...filters, ...patch });

	return (
		<div className="flex flex-col gap-3 border-line-subtle border-b bg-surface-subtle px-5 py-4 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between min-[760px]:px-8">
			<div className="flex flex-wrap items-center gap-2.5">
				<FilterPill
					label="Store"
					value={filters.storeId}
					onChange={(value) => update({ storeId: value })}
				>
					<option value="">All stores</option>
					{stores.map((store) => (
						<option key={store.storeId} value={store.storeId}>
							{store.name}
						</option>
					))}
				</FilterPill>
				<FilterPill
					label="Stylist"
					value={filters.stylistId}
					onChange={(value) => update({ stylistId: value })}
				>
					<option value="">All stylists</option>
					{stylists.map((stylist) => (
						<option key={stylist.id} value={stylist.id}>
							{stylist.displayName}
						</option>
					))}
				</FilterPill>
				<FilterPill
					label="Sort"
					value={filters.dateOrder}
					onChange={(value) =>
						update({ dateOrder: value as AppointmentFilters["dateOrder"] })
					}
				>
					<option value="open_priority">Soonest first</option>
					<option value="oldest">Oldest first</option>
					<option value="newest">Newest first</option>
				</FilterPill>
			</div>
			<label className="flex items-center gap-2 border border-line bg-surface px-3.5 py-2 min-[760px]:w-60">
				<Search size={14} className="shrink-0 text-muted" />
				<input
					type="search"
					className="w-full bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
					placeholder="Search customer or stylist"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</label>
		</div>
	);
}

function FilterPill({
	label,
	value,
	onChange,
	children,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	children: React.ReactNode;
}) {
	return (
		<label className="flex items-center gap-2 border border-line bg-surface px-3.5 py-2">
			<span className="font-bold text-2xs text-muted uppercase tracking-label">
				{label}
			</span>
			<span className="relative flex items-center">
				<select
					className="cursor-pointer appearance-none bg-transparent pr-4 font-semibold text-[13px] text-ink focus:outline-none"
					value={value}
					onChange={(event) => onChange(event.target.value)}
				>
					{children}
				</select>
				<span className="pointer-events-none absolute right-0 text-[10px] text-muted">
					▾
				</span>
			</span>
		</label>
	);
}

type AppointmentListRowProps = {
	appointment: Appointment;
	onSelect: (appointmentId: string) => void;
};

function AppointmentListRow({
	appointment,
	onSelect,
}: AppointmentListRowProps) {
	const slot = relativeSlotLabel(appointment);
	const priority = slot.imminent;

	return (
		<button
			type="button"
			className={`flex w-full items-stretch border bg-surface text-left transition-colors hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
				priority ? "border-ink" : "border-line-subtle"
			}`}
			onClick={() => onSelect(appointment.id)}
			data-testid="appointment-row"
		>
			<span
				className={`w-1 shrink-0 ${priority ? "bg-ink" : "bg-line-subtle"}`}
			/>

			{/* mobile card (phone) — stacked time/badge, avatar+name, muse+stylist footer */}
			<div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-4 min-[1040px]:hidden">
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-baseline gap-2">
						<span className="font-display font-semibold text-[19px] text-ink leading-none">
							{slot.big}
						</span>
						<span className="truncate text-[11px] text-muted">
							{slot.eyebrow}
						</span>
					</div>
					<Badge variant={statusBadgeVariant(appointment.status)}>
						{statusLabel(appointment.status)}
					</Badge>
				</div>

				<div className="flex items-center gap-3">
					<span
						className={`flex h-10 w-10 shrink-0 items-center justify-center font-display font-semibold text-[14px] text-white ${priority ? "bg-ink" : "bg-navy"}`}
					>
						{initials(appointment.customerName)}
					</span>
					<div className="min-w-0">
						<p className="truncate font-bold text-[17px] text-ink leading-snug">
							{appointment.customerName}
						</p>
						<p className="truncate text-[12px] text-muted">
							{appointment.occasion}
						</p>
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 border-line-subtle border-t pt-3">
					<div className="flex min-w-0 items-center gap-2">
						<span className="shrink-0 border border-navy/30 px-2 py-0.5 font-bold text-2xs text-navy uppercase tracking-label">
							{appointment.museTag}
						</span>
						<span className="truncate text-[12px] text-muted">
							{appointment.assignedStylist.displayName}
						</span>
					</div>
					<ChevronRight className="shrink-0 text-ink" size={18} />
				</div>
			</div>

			{/* desktop data-row (>=1040px) */}
			<div className="hidden flex-1 flex-col gap-4 px-5 py-4 min-[1040px]:flex min-[1040px]:flex-row min-[1040px]:items-center min-[1040px]:gap-6 min-[1040px]:px-6">
				<div className="min-[1040px]:w-[104px] min-[1040px]:shrink-0">
					<p
						className={`font-bold text-2xs uppercase tracking-label ${priority ? "text-navy" : "text-muted"}`}
					>
						{slot.eyebrow}
					</p>
					<p className="mt-0.5 font-display font-medium text-[22px] text-ink leading-tight">
						{slot.big}
					</p>
				</div>

				<span className="hidden h-[46px] w-px bg-line-subtle min-[1040px]:block" />

				<div
					className={`hidden h-[46px] w-[46px] shrink-0 items-center justify-center font-display font-semibold text-[15px] text-white min-[1040px]:flex ${priority ? "bg-ink" : "bg-navy"}`}
				>
					{initials(appointment.customerName)}
				</div>

				<div className="min-w-0 flex-1">
					<p className="font-bold text-2xs text-muted uppercase tracking-label">
						Customer
					</p>
					<p className="mt-0.5 font-bold text-[17px] text-ink leading-snug">
						{appointment.customerName}
					</p>
					<div className="mt-1.5 flex flex-wrap items-center gap-2">
						<span className="border border-navy/30 px-2 py-0.5 font-bold text-2xs text-navy uppercase tracking-label">
							{appointment.museTag}
						</span>
						<span className="text-[13px] text-body">
							{appointment.occasion}
						</span>
					</div>
				</div>

				<div className="min-[1040px]:w-[172px] min-[1040px]:shrink-0">
					<p className="mb-1.5 font-bold text-2xs text-muted uppercase tracking-label">
						Stylist
					</p>
					<div className="flex items-center gap-2">
						<span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center bg-navy font-display font-semibold text-[10px] text-white">
							{initials(appointment.assignedStylist.displayName)}
						</span>
						<span className="text-[14px] text-ink">
							{appointment.assignedStylist.displayName}
						</span>
					</div>
				</div>

				<div className="min-[1040px]:w-[150px] min-[1040px]:shrink-0">
					<p className="mb-1.5 font-bold text-2xs text-muted uppercase tracking-label">
						Store
					</p>
					<span className="text-[14px] text-ink">
						{appointment.store.city}, {appointment.store.state}
					</span>
				</div>

				<div className="flex items-center justify-between gap-3 min-[1040px]:w-auto min-[1040px]:justify-end">
					<Badge variant={statusBadgeVariant(appointment.status)}>
						{statusLabel(appointment.status)}
					</Badge>
					<ChevronRight className="shrink-0 text-ink" size={18} />
				</div>
			</div>
		</button>
	);
}

export function getActiveTitle(
	activeView: DashboardView,
	labels: Record<DashboardView, string>,
) {
	return labels[activeView];
}
