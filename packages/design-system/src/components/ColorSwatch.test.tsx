import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatch, type SwatchOption } from "./ColorSwatch";

const options: SwatchOption[] = [
	{ name: "Indigo", value: "#253746" },
	{ name: "Stone", value: "#c6c6c6" },
	{ name: "Ecru", value: "#efe9dd" },
];

describe("ColorSwatch", () => {
	it("renders one labeled chip per option", () => {
		render(<ColorSwatch options={options} />);
		expect(screen.getByRole("button", { name: "Indigo" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Stone" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Ecru" })).toBeInTheDocument();
	});

	it("marks the selected chip with aria-pressed", () => {
		render(<ColorSwatch options={options} selectedIndex={1} />);
		expect(screen.getByRole("button", { name: "Stone" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "Indigo" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("fires onSelect with the clicked index", () => {
		const onSelect = vi.fn();
		render(<ColorSwatch options={options} onSelect={onSelect} />);
		fireEvent.click(screen.getByRole("button", { name: "Ecru" }));
		expect(onSelect).toHaveBeenCalledWith(2);
	});

	it("collapses overflow beyond maxVisible into a +N count", () => {
		render(<ColorSwatch options={options} maxVisible={2} />);
		expect(
			screen.queryByRole("button", { name: "Ecru" }),
		).not.toBeInTheDocument();
		expect(screen.getByText("+1")).toBeInTheDocument();
	});
});
