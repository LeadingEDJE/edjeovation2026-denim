import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Price } from "./Price";

describe("Price", () => {
	it("formats a numeric price with the default currency", () => {
		render(<Price price={49} />);
		expect(screen.getByText("$49.00")).toBeInTheDocument();
	});

	it("honors a custom currency symbol", () => {
		render(<Price price={20} currency="£" />);
		expect(screen.getByText("£20.00")).toBeInTheDocument();
	});

	it("passes a pre-formatted string straight through", () => {
		render(<Price price="From $19.50" />);
		expect(screen.getByText("From $19.50")).toBeInTheDocument();
	});

	it("renders the original price struck through and flips to sale styling", () => {
		render(<Price price={29.99} originalPrice={59} />);
		const current = screen.getByText("$29.99");
		const original = screen.getByText("$59.00");
		expect(current).toHaveClass("text-sale");
		expect(original).toHaveClass("line-through");
	});

	it("uses the regular ink color when not on sale", () => {
		render(<Price price={10} />);
		expect(screen.getByText("$10.00")).toHaveClass("text-ink");
		expect(screen.queryByText(/line-through/)).not.toBeInTheDocument();
	});
});
