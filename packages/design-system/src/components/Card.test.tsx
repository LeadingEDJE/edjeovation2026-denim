import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
	it("renders eyebrow, title, and text", () => {
		render(
			<Card
				eyebrow="New Arrivals"
				title="Summer Linen"
				text="Lightweight & breathable."
			/>,
		);
		expect(screen.getByText("New Arrivals")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Summer Linen" }),
		).toBeInTheDocument();
		expect(screen.getByText("Lightweight & breathable.")).toBeInTheDocument();
	});

	it("renders a CTA that fires onCta", () => {
		const onCta = vi.fn();
		render(<Card title="Shop" ctaLabel="Shop Now" onCta={onCta} />);
		fireEvent.click(screen.getByRole("button", { name: "Shop Now" }));
		expect(onCta).toHaveBeenCalledOnce();
	});

	it("renders an image whose alt matches the title", () => {
		render(<Card title="Denim" imageSrc="https://example.com/denim.jpg" />);
		expect(screen.getByRole("img", { name: "Denim" })).toHaveAttribute(
			"src",
			"https://example.com/denim.jpg",
		);
	});

	it("renders custom children instead of the default body", () => {
		render(
			<Card title="Ignored">
				<p>Custom body</p>
			</Card>,
		);
		expect(screen.getByText("Custom body")).toBeInTheDocument();
		expect(screen.queryByText("Ignored")).not.toBeInTheDocument();
	});

	it("adds a hairline border in the bordered variant", () => {
		const { container } = render(<Card variant="bordered" title="Bordered" />);
		expect(container.firstChild).toHaveClass("border", "border-line-subtle");
	});
});
