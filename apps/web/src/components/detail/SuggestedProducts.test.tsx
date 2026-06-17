import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Appointment, SuggestedProduct } from "../../api.js";
import {
	computeProductsToPull,
	SuggestedProducts,
} from "./SuggestedProducts.js";

function suggestion(overrides: Partial<SuggestedProduct> = {}): SuggestedProduct {
	return {
		rank: 1,
		rationale: "Great match for the occasion",
		score: 0.9,
		prepStatus: "suggested",
		associateNote: "",
		product: {
			productId: "prod-1",
			name: "Slim Dark Wash",
			category: "Denim",
			catalogAudiences: ["womens"],
			productUrl: "https://example.com/prod-1",
			imageUrl: null,
			price: 98,
			currency: "$",
			fit: "Slim",
			rise: "High",
			stretch: "Comfort",
		},
		...overrides,
	};
}

function makeAppointment(suggestedProducts: SuggestedProduct[]): Appointment {
	return { id: "appt-1", suggestedProducts } as Appointment;
}

function renderPanel(
	overrides: Partial<Parameters<typeof SuggestedProducts>[0]> = {},
) {
	const handlers = {
		onRegenerate: vi.fn(),
		onUpdateProductPrep: vi.fn(),
	};
	const appointment =
		overrides.appointment ?? makeAppointment([suggestion()]);
	render(
		<SuggestedProducts
			appointment={appointment}
			canEdit
			{...handlers}
			{...overrides}
		/>,
	);
	return { ...handlers, appointment };
}

describe("computeProductsToPull", () => {
	it("counts every suggestion that is not skipped", () => {
		expect(
			computeProductsToPull([
				suggestion({ prepStatus: "suggested" }),
				suggestion({ prepStatus: "pulled" }),
				suggestion({ prepStatus: "skipped" }),
			]),
		).toBe(2);
	});

	it("returns zero for an empty list", () => {
		expect(computeProductsToPull([])).toBe(0);
	});
});

describe("SuggestedProducts", () => {
	it("renders the empty state when there are no suggestions", () => {
		renderPanel({ appointment: makeAppointment([]) });
		expect(
			screen.getByText(/no suggested products for this appointment/i),
		).toBeInTheDocument();
	});

	it("renders product details and the to-pull badge", () => {
		renderPanel();
		expect(screen.getByText("Slim Dark Wash")).toBeInTheDocument();
		expect(screen.getByText("$98.00")).toBeInTheDocument();
		expect(screen.getByText("Denim · Slim · High · Comfort")).toBeInTheDocument();
		expect(screen.getByText("1 to pull")).toBeInTheDocument();
	});

	it("emits a prep-status change", () => {
		const { onUpdateProductPrep, appointment } = renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Pulled" }));
		expect(onUpdateProductPrep).toHaveBeenCalledWith(
			appointment,
			appointment.suggestedProducts[0],
			"pulled",
			"",
		);
	});

	it("emits the prep note on blur", () => {
		const { onUpdateProductPrep, appointment } = renderPanel();
		const note = screen.getByPlaceholderText("Add a prep note…");
		fireEvent.change(note, { target: { value: "Pull from the back" } });
		fireEvent.blur(note);
		expect(onUpdateProductPrep).toHaveBeenCalledWith(
			appointment,
			appointment.suggestedProducts[0],
			"suggested",
			"Pull from the back",
		);
	});

	it("calls onRegenerate from the regenerate button", () => {
		const { onRegenerate, appointment } = renderPanel();
		fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
		expect(onRegenerate).toHaveBeenCalledWith(appointment);
	});

	it("disables editing controls when canEdit is false", () => {
		renderPanel({ canEdit: false });
		expect(screen.getByRole("button", { name: /regenerate/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Pulled" })).toBeDisabled();
		expect(screen.getByPlaceholderText("Add a prep note…")).toBeDisabled();
	});
});
