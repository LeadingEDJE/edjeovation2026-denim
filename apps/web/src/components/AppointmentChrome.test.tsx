import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardView } from "../types";
import {
	AppointmentViewNav,
	DashboardHeader,
	dashboardViews,
} from "./AppointmentChrome";

const counts: Record<DashboardView, number> = {
	open: 3,
	in_progress: 1,
	completed: 2,
	cancelled: 0,
	no_show: 5,
};

describe("DashboardHeader", () => {
	it("shows the status text and a 'Synced' state when idle", () => {
		render(
			<DashboardHeader
				status="Appointments loaded"
				isLoading={false}
				onRefresh={() => {}}
			/>,
		);
		expect(screen.getByText("Appointments loaded")).toBeInTheDocument();
		expect(screen.getByText("Synced")).toBeInTheDocument();
	});

	it("shows 'Syncing' and disables refresh while loading", () => {
		render(
			<DashboardHeader
				status="Loading"
				isLoading={true}
				onRefresh={() => {}}
			/>,
		);
		expect(screen.getByText("Syncing")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /refresh appointments/i }),
		).toBeDisabled();
	});

	it("calls onRefresh when the refresh button is clicked", () => {
		const onRefresh = vi.fn();
		render(
			<DashboardHeader
				status="Synced"
				isLoading={false}
				onRefresh={onRefresh}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: /refresh appointments/i }),
		);
		expect(onRefresh).toHaveBeenCalledTimes(1);
	});
});

describe("AppointmentViewNav", () => {
	it("renders every view with its label and count", () => {
		render(
			<AppointmentViewNav
				activeView="open"
				counts={counts}
				onChange={() => {}}
			/>,
		);
		for (const view of dashboardViews) {
			expect(screen.getByText(view.label)).toBeInTheDocument();
		}
		// no_show count
		expect(screen.getByText("5")).toBeInTheDocument();
	});

	it("marks the active view with aria-current", () => {
		render(
			<AppointmentViewNav
				activeView="completed"
				counts={counts}
				onChange={() => {}}
			/>,
		);
		const activeTab = screen.getByRole("button", { name: /completed/i });
		expect(activeTab).toHaveAttribute("aria-current", "page");

		const openTab = screen.getByRole("button", { name: /open/i });
		expect(openTab).not.toHaveAttribute("aria-current");
	});

	it("calls onChange with the view id when a tab is clicked", () => {
		const onChange = vi.fn();
		render(
			<AppointmentViewNav
				activeView="open"
				counts={counts}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /in progress/i }));
		expect(onChange).toHaveBeenCalledWith("in_progress");
	});
});
