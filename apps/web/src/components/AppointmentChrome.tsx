import { Badge, Button, IconButton } from "@denim-fit/design-system";
import {
	CalendarClock,
	CheckCircle2,
	RefreshCw,
	UserCheck,
	UserX,
	XCircle,
} from "lucide-react";
import type { DashboardView } from "../types";

export const dashboardViews: Array<{
	id: DashboardView;
	label: string;
	icon: typeof CalendarClock;
}> = [
	{ id: "open", label: "Open", icon: CalendarClock },
	{ id: "in_progress", label: "In Progress", icon: UserCheck },
	{ id: "completed", label: "Completed", icon: CheckCircle2 },
	{ id: "cancelled", label: "Cancelled", icon: XCircle },
	{ id: "no_show", label: "No-shows", icon: UserX },
];

type HeaderProps = {
	status: string;
	isLoading: boolean;
	onRefresh: () => void;
};

export function DashboardHeader({ status, isLoading, onRefresh }: HeaderProps) {
	return (
		<header className="mx-auto mb-6 flex max-w-[1180px] flex-col gap-[18px] min-[820px]:flex-row min-[820px]:items-center min-[820px]:justify-between">
			<div>
				<p className="mb-1 font-bold text-[0.78rem] text-clay uppercase">
					AnF denim fitting
				</p>
				<h1 className="font-bold text-[clamp(2rem,4vw,3.25rem)] leading-none">
					Appointment prep dashboard
				</h1>
			</div>
			<div className="flex items-center justify-between gap-3 min-[820px]:justify-start">
				<p className="text-[0.9rem] text-muted">{status}</p>
				<IconButton
					label="Refresh appointments"
					icon={<RefreshCw size={18} strokeWidth={1.5} />}
					onClick={onRefresh}
					disabled={isLoading}
				/>
			</div>
		</header>
	);
}

type NavProps = {
	activeView: DashboardView;
	counts: Record<DashboardView, number>;
	onChange: (view: DashboardView) => void;
};

export function AppointmentViewNav({ activeView, counts, onChange }: NavProps) {
	return (
		<nav
			className="mx-auto mb-4 flex max-w-[1180px] flex-wrap gap-2"
			aria-label="Appointment views"
		>
			{dashboardViews.map((view) => {
				const Icon = view.icon;
				return (
					<Button
						key={view.id}
						variant={activeView === view.id ? "primary" : "secondary"}
						size="sm"
						leadingIcon={<Icon size={17} />}
						onClick={() => onChange(view.id)}
					>
						{view.label}
						<Badge variant="neutral">{counts[view.id]}</Badge>
					</Button>
				);
			})}
		</nav>
	);
}
