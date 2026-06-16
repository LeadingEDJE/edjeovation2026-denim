import { Badge } from "@denim-fit/design-system";
import { ChevronRight } from "lucide-react";
import type { Appointment } from "../api";
import {
	formatAppointmentTime,
	statusBadgeVariant,
	statusLabel,
} from "../formatters";
import type { DashboardView } from "../types";

type AppointmentListProps = {
	activeTitle: string;
	appointments: Appointment[];
	onSelect: (appointmentId: string) => void;
};

export function AppointmentList({
	activeTitle,
	appointments,
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
				<span className="w-fit">
					<Badge variant={statusBadgeVariant(appointment.status)}>
						{statusLabel(appointment.status)}
					</Badge>
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
