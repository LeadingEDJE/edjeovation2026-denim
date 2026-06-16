import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rating } from "./Rating";

describe("Rating", () => {
	it("exposes the value in an accessible label", () => {
		render(<Rating value={4} />);
		expect(screen.getByLabelText("4 out of 5 stars")).toBeInTheDocument();
	});

	it("respects a custom max", () => {
		render(<Rating value={6} max={10} />);
		expect(screen.getByLabelText("6 out of 10 stars")).toBeInTheDocument();
	});

	it("shows the review count when provided", () => {
		render(<Rating value={4.5} count={128} />);
		expect(screen.getByText("(128)")).toBeInTheDocument();
	});

	it("omits the count when not provided", () => {
		render(<Rating value={3} />);
		expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
	});
});
