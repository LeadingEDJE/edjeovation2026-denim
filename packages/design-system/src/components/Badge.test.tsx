import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
	it("renders its label", () => {
		render(<Badge>New</Badge>);
		expect(screen.getByText("New")).toBeInTheDocument();
	});

	it("applies the sale tone", () => {
		render(<Badge variant="sale">Sale</Badge>);
		expect(screen.getByText("Sale")).toHaveClass("bg-sale", "text-white");
	});

	it("defaults to the neutral tone", () => {
		render(<Badge>Quiet</Badge>);
		expect(screen.getByText("Quiet")).toHaveClass("bg-surface-muted");
	});

	it("renders the outline tone with a border", () => {
		render(<Badge variant="outline">Edge</Badge>);
		expect(screen.getByText("Edge")).toHaveClass("border", "border-ink");
	});
});
