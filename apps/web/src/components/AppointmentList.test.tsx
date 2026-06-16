import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Appointment, Store, StylistProfile } from "../api";
import { type AppointmentFilters, AppointmentList } from "./AppointmentList";

function todayNoon(offsetDays = 0): string {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() + offsetDays);
	return d.toISOString();
}

function appt(overrides: {
	id: string;
	customerName?: string;
	stylistName?: string;
	slotStart?: string;
	status?: Appointment["status"];
	storeId?: string;
}): Appointment {
	return {
		id: overrides.id,
		customerName: overrides.customerName ?? "Avery Parker",
		slotStart: overrides.slotStart ?? todayNoon(),
		slotEnd: todayNoon(),
		status: overrides.status ?? "scheduled",
		occasion: "Weekend trip",
		museTag: "Clean Muse",
		assignedStylist: {
			id: "sty-1",
			displayName: overrides.stylistName ?? "Jordan Lee",
		},
		store: {
			storeId: overrides.storeId ?? "store-1",
			name: "Flagship",
			city: "Columbus",
			state: "OH",
		},
	} as unknown as Appointment;
}

const stores = [
	{ storeId: "store-1", name: "Flagship" },
	{ storeId: "store-2", name: "Easton" },
] as Store[];

const stylists = [
	{ id: "sty-1", displayName: "Jordan Lee" },
	{ id: "sty-2", displayName: "Riley Chen" },
] as StylistProfile[];

const emptyFilters: AppointmentFilters = {
	storeId: "",
	date: "",
	dateOrder: "open_priority",
	stylistId: "",
	status: "",
};

function renderList(
	appointments: Appointment[],
	overrides: Partial<Parameters<typeof AppointmentList>[0]> = {},
) {
	const onSelect = vi.fn();
	const onFilterChange = vi.fn();
	render(
		<AppointmentList
			activeTitle="Open"
			appointments={appointments}
			filters={emptyFilters}
			stores={stores}
			stylists={stylists}
			onSelect={onSelect}
			onFilterChange={onFilterChange}
			{...overrides}
		/>,
	);
	return { onSelect, onFilterChange };
}

describe("AppointmentList", () => {
	it("renders one row per appointment", () => {
		renderList([
			appt({ id: "a1", customerName: "Avery Parker" }),
			appt({ id: "a2", customerName: "Morgan Diaz" }),
		]);
		expect(screen.getAllByTestId("appointment-row")).toHaveLength(2);
	});

	it("calls onSelect with the appointment id when a row is clicked", () => {
		const { onSelect } = renderList([appt({ id: "a1" })]);
		fireEvent.click(screen.getAllByTestId("appointment-row")[0]);
		expect(onSelect).toHaveBeenCalledWith("a1");
	});

	it("filters rows by customer name via the search box", () => {
		renderList([
			appt({ id: "a1", customerName: "Avery Parker" }),
			appt({ id: "a2", customerName: "Morgan Diaz" }),
		]);
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "morgan" },
		});
		const rows = screen.getAllByTestId("appointment-row");
		expect(rows).toHaveLength(1);
		expect(screen.getAllByText("Morgan Diaz").length).toBeGreaterThan(0);
	});

	it("filters rows by stylist name via the search box", () => {
		renderList([
			appt({ id: "a1", stylistName: "Jordan Lee" }),
			appt({ id: "a2", stylistName: "Riley Chen" }),
		]);
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "riley" },
		});
		expect(screen.getAllByTestId("appointment-row")).toHaveLength(1);
	});

	it("shows a search-specific empty state when nothing matches", () => {
		renderList([appt({ id: "a1", customerName: "Avery Parker" })]);
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "zzzzz" },
		});
		expect(screen.queryAllByTestId("appointment-row")).toHaveLength(0);
		expect(screen.getByTestId("appointments-empty")).toHaveTextContent(
			/no open appointments match your search/i,
		);
	});

	it("shows a plain empty state when there are no appointments", () => {
		renderList([]);
		expect(screen.getByTestId("appointments-empty")).toHaveTextContent(
			/no open appointments\./i,
		);
	});

	it("buckets appointments into Today, Upcoming, and Earlier", () => {
		renderList([
			appt({ id: "today", slotStart: todayNoon(0) }),
			appt({ id: "future", slotStart: todayNoon(3) }),
			appt({ id: "past", slotStart: todayNoon(-3) }),
		]);
		expect(screen.getByText(/^Today ·/)).toBeInTheDocument();
		expect(screen.getByText("Upcoming")).toBeInTheDocument();
		expect(screen.getByText("Earlier")).toBeInTheDocument();
	});

	it("patches filters when a filter control changes", () => {
		const { onFilterChange } = renderList([appt({ id: "a1" })]);
		// Comboboxes render in order: Store, Stylist, Sort.
		const [storeSelect, , sortSelect] = screen.getAllByRole("combobox");

		fireEvent.change(storeSelect, { target: { value: "store-2" } });
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ storeId: "store-2" }),
		);

		fireEvent.change(sortSelect, { target: { value: "newest" } });
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ dateOrder: "newest" }),
		);
	});
});
