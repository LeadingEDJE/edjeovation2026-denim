import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Appointment, OutfitAnalysis } from "../../api.js";
import { CustomerSnapshot, catalogAudienceLabel } from "./CustomerSnapshot.js";

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
	return {
		id: "appt-1",
		focusColors: "Indigo",
		avoidColors: "White",
		styleKeywords: ["minimal", "tailored"],
		catalogAudiences: ["womens"],
		guidance: "Looking for something sharp",
		orderHistorySummary: {
			totalOrders: 5,
			denimItems: 3,
			returnedItems: 1,
			preferredSizes: ["28"],
		},
		outfitAnalysis: null,
		...overrides,
	} as Appointment;
}

const analysis: OutfitAnalysis = {
	garments: [
		{
			type: "Blazer",
			colors: ["Navy"],
			material: "wool",
			pattern: null,
			descriptors: [],
			intent: "complement",
		},
	],
	styleSummary: "Sharp tailoring",
	suggestedFocusColors: ["Indigo"],
	suggestedStyleKeywords: ["tailored"],
	pairingContext: "Pair with a dark wash",
	engine: "manual",
};

describe("catalogAudienceLabel", () => {
	it("labels combined audiences", () => {
		expect(catalogAudienceLabel(["womens", "mens"])).toBe("Womens + Mens");
	});

	it("labels a mens-only catalog", () => {
		expect(catalogAudienceLabel(["mens"])).toBe("Mens");
	});

	it("defaults to womens", () => {
		expect(catalogAudienceLabel(["womens"])).toBe("Womens");
		expect(catalogAudienceLabel([])).toBe("Womens");
	});
});

describe("CustomerSnapshot", () => {
	it("renders preferences, catalog label, guidance, and order stats", () => {
		render(<CustomerSnapshot appointment={makeAppointment()} />);
		expect(screen.getByText("Womens")).toBeInTheDocument();
		expect(screen.getByText("minimal")).toBeInTheDocument();
		expect(
			screen.getByText(/looking for something sharp/i),
		).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument(); // total orders
		expect(screen.getByText("Total orders")).toBeInTheDocument();
	});

	it("falls back when no customer note is provided", () => {
		render(
			<CustomerSnapshot appointment={makeAppointment({ guidance: "" })} />,
		);
		expect(screen.getByText(/none provided/i)).toBeInTheDocument();
	});

	it("enables and saves edited outfit intents", () => {
		const onSaveOutfitIntents = vi.fn();
		render(
			<CustomerSnapshot
				appointment={makeAppointment({ outfitAnalysis: analysis })}
				onSaveOutfitIntents={onSaveOutfitIntents}
			/>,
		);

		const save = screen.getByRole("button", { name: /save intents/i });
		expect(save).toBeDisabled(); // not dirty yet

		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "ignore" },
		});
		expect(save).toBeEnabled();

		fireEvent.click(save);
		expect(onSaveOutfitIntents).toHaveBeenCalledTimes(1);
		const saved = onSaveOutfitIntents.mock.calls[0][0] as OutfitAnalysis;
		expect(saved.garments[0].intent).toBe("ignore");
	});

	it("renders the outfit block read-only without a save handler", () => {
		render(
			<CustomerSnapshot
				appointment={makeAppointment({ outfitAnalysis: analysis })}
			/>,
		);
		expect(
			screen.queryByRole("button", { name: /save intents/i }),
		).not.toBeInTheDocument();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		expect(screen.getByText("Complement")).toBeInTheDocument();
	});
});
