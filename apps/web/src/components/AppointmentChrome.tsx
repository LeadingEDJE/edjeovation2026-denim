import { IconButton } from "@denim-fit/design-system";
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
		<header className="mx-auto mb-7 flex max-w-[1180px] flex-col gap-[18px] min-[820px]:flex-row min-[820px]:items-start min-[820px]:justify-between">
			<div>
				<p className="mb-1.5 font-bold text-2xs text-muted uppercase tracking-label">
					Denim Fit · Guided Fitting
				</p>
				<h1 className="font-display font-semibold text-[clamp(2rem,4vw,2.5rem)] text-ink leading-none tracking-tight">
					Appointment Prep
				</h1>
			</div>
			<div className="flex items-center justify-between gap-4 min-[820px]:justify-start">
				<div className="text-right">
					<p className="font-bold text-2xs text-muted uppercase tracking-label">
						{isLoading ? "Syncing" : "Synced"}
					</p>
					<p className="mt-0.5 text-[0.8rem] text-body">{status}</p>
				</div>
				<IconButton
					label="Refresh appointments"
					icon={<RefreshCw size={18} strokeWidth={1.5} />}
					onClick={onRefresh}
					disabled={isLoading}
				/>
				<div className="flex h-9 w-9 items-center justify-center bg-ink font-display font-semibold text-[13px] text-white tracking-wide">
					ME
				</div>
			</div>
		</header>
	);
}

type NavProps = {
	activeView: DashboardView;
	counts: Record<DashboardView, number>;
	onChange: (view: DashboardView) => void;
};

/** Status-dot tint per view, mirroring the queue's colored markers. */
const viewDotClass: Record<DashboardView, string> = {
	open: "bg-steel",
	in_progress: "bg-navy",
	completed: "bg-success",
	cancelled: "bg-sale",
	no_show: "bg-sale-soft",
};

export function AppointmentViewNav({ activeView, counts, onChange }: NavProps) {
	return (
		<div className="relative mx-auto mb-5 max-w-[1180px]">
			<nav
				className="flex flex-nowrap items-end overflow-x-auto border-line-subtle border-b [-ms-overflow-style:none] [scrollbar-width:none] min-[820px]:flex-wrap min-[820px]:overflow-visible [&::-webkit-scrollbar]:hidden"
				aria-label="Appointment views"
			>
				{dashboardViews.map((view) => {
					const active = activeView === view.id;
					return (
						<button
							key={view.id}
							type="button"
							aria-current={active ? "page" : undefined}
							className={`-mb-px flex flex-none cursor-pointer items-center gap-2.5 whitespace-nowrap border border-b-0 px-5 py-3 transition-colors ${
								active
									? "border-ink bg-ink text-white"
									: "border-transparent text-body hover:text-ink"
							}`}
							onClick={() => onChange(view.id)}
						>
							<span
								className={`block h-[7px] w-[7px] ${active ? "bg-steel" : viewDotClass[view.id]}`}
							/>
							<span className="font-bold text-xs uppercase tracking-label">
								{view.label}
							</span>
							<span
								className={`px-1.5 py-0.5 font-bold text-2xs leading-none ${
									active ? "bg-white text-ink" : "bg-surface-muted text-body"
								}`}
							>
								{counts[view.id]}
							</span>
						</button>
					);
				})}
			</nav>
			<span className="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-canvas min-[820px]:hidden" />
		</div>
	);
}
