import { ChevronRight } from "lucide-react";
import type {
	Appointment,
	AppointmentStatus,
	Store,
	StylistProfile,
} from "../api";
import { formatAppointmentTime, statusLabel } from "../formatters";
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
	return (
		<section
			className="min-h-[360px] rounded-lg border border-line bg-surface p-[18px]"
			data-testid="appointments-panel"
		>
			<div className="mb-3 flex items-center justify-between gap-2">
				<h2 className="font-semibold text-base">{activeTitle} appointments</h2>
				<span className="text-[0.9rem] text-muted">{appointments.length}</span>
			</div>
			<AppointmentFilterBar
				filters={filters}
				stores={stores}
				stylists={stylists}
				onFilterChange={onFilterChange}
			/>
			<div className="grid gap-3" data-testid="appointment-list">
				{appointments.map((appointment) => (
					<AppointmentListRow
						key={appointment.id}
						appointment={appointment}
						onSelect={onSelect}
					/>
				))}
				{appointments.length === 0 ? (
					<p
						className="text-[0.9rem] text-muted"
						data-testid="appointments-empty"
					>
						No {activeTitle.toLowerCase()} appointments.
					</p>
				) : null}
			</div>
		</section>
	);
}

function AppointmentFilterBar({
	filters,
	stores,
	stylists,
	onFilterChange,
}: {
	filters: AppointmentFilters;
	stores: Store[];
	stylists: StylistProfile[];
	onFilterChange: (filters: AppointmentFilters) => void;
}) {
	const update = (patch: Partial<AppointmentFilters>) =>
		onFilterChange({ ...filters, ...patch });

	return (
		<div className="mb-4 grid gap-2 min-[760px]:grid-cols-5">
			<FilterSelect
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
			</FilterSelect>
			<label className="grid gap-1">
				<span className="font-bold text-[0.72rem] text-muted uppercase">
					Date
				</span>
				<input
					type="date"
					className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
					value={filters.date}
					onChange={(event) => update({ date: event.target.value })}
				/>
			</label>
			<FilterSelect
				label="Date order"
				value={filters.dateOrder}
				onChange={(value) =>
					update({ dateOrder: value as AppointmentFilters["dateOrder"] })
				}
			>
				<option value="open_priority">Open priority</option>
				<option value="oldest">Oldest first</option>
				<option value="newest">Newest first</option>
			</FilterSelect>
			<FilterSelect
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
			</FilterSelect>
			<FilterSelect
				label="Status"
				value={filters.status}
				onChange={(value) =>
					update({ status: value as AppointmentFilters["status"] })
				}
			>
				<option value="">All statuses</option>
				<option value="scheduled">Scheduled</option>
				<option value="checked_in">Checked in</option>
				<option value="completed">Completed</option>
				<option value="cancelled">Cancelled</option>
				<option value="no_show">No-show</option>
			</FilterSelect>
		</div>
	);
}

function FilterSelect({
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
		<label className="grid gap-1">
			<span className="font-bold text-[0.72rem] text-muted uppercase">
				{label}
			</span>
			<select
				className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				{children}
			</select>
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
	return (
		<button
			type="button"
			className="grid cursor-pointer gap-3 rounded-lg border border-rowline bg-surface p-3 text-left transition-colors hover:bg-canvas focus:border-accent focus:outline-none"
			onClick={() => onSelect(appointment.id)}
			data-testid="appointment-row"
		>
			<div className="grid gap-3 min-[720px]:grid-cols-[1.3fr_1fr_1.2fr_auto_auto] min-[720px]:items-center">
				<RowField label="Customer" value={appointment.customerName} />
				<RowField
					label="Stylist"
					value={appointment.assignedStylist.displayName}
				/>
				<RowField label="Time" value={formatAppointmentTime(appointment)} />
				<span className="w-fit rounded-full bg-tag px-2.5 py-1 font-extrabold text-[0.8rem] text-accent">
					{statusLabel(appointment.status)}
				</span>
				<ChevronRight
					className="hidden justify-self-end text-muted min-[720px]:block"
					size={18}
				/>
			</div>
		</button>
	);
}

function RowField({ label, value }: { label: string; value: string }) {
	return (
		<span className="grid gap-0.5">
			<span className="font-bold text-[0.72rem] text-muted uppercase">
				{label}
			</span>
			<strong className="text-ink">{value}</strong>
		</span>
	);
}

export function getActiveTitle(
	activeView: DashboardView,
	labels: Record<DashboardView, string>,
) {
	return labels[activeView];
}
