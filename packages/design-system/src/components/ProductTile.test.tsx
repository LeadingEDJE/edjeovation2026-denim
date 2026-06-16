import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductTile } from "./ProductTile";

const base = {
	name: "Curve Love High Rise Jean",
	imageSrc: "https://example.com/jean.jpg",
	price: 89,
};

describe("ProductTile", () => {
	it("renders the name and an image with matching alt text", () => {
		render(<ProductTile {...base} />);
		expect(
			screen.getByRole("heading", { name: base.name }),
		).toBeInTheDocument();
		expect(screen.getByRole("img", { name: base.name })).toHaveAttribute(
			"src",
			base.imageSrc,
		);
	});

	it("renders the price", () => {
		render(<ProductTile {...base} />);
		expect(screen.getByText("$89.00")).toBeInTheDocument();
	});

	it("renders sale pricing when an original price is given", () => {
		render(<ProductTile {...base} price={59} originalPrice={89} />);
		expect(screen.getByText("$59.00")).toHaveClass("text-sale");
		expect(screen.getByText("$89.00")).toHaveClass("line-through");
	});

	it("renders a merchandising badge", () => {
		render(<ProductTile {...base} badge="New" />);
		expect(screen.getByText("New")).toBeInTheDocument();
	});

	it("shows a wishlist control by default and fires onWishlist", () => {
		const onWishlist = vi.fn();
		render(<ProductTile {...base} onWishlist={onWishlist} />);
		fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));
		expect(onWishlist).toHaveBeenCalledOnce();
	});

	it("hides the wishlist control when disabled", () => {
		render(<ProductTile {...base} wishlist={false} />);
		expect(
			screen.queryByRole("button", { name: "Add to wishlist" }),
		).not.toBeInTheDocument();
	});

	it("renders a rating and review count when provided", () => {
		render(<ProductTile {...base} rating={4} reviewCount={42} />);
		expect(screen.getByLabelText("4 out of 5 stars")).toBeInTheDocument();
		expect(screen.getByText("(42)")).toBeInTheDocument();
	});

	it("renders color swatches when provided", () => {
		render(
			<ProductTile
				{...base}
				colors={[
					{ name: "Indigo", value: "#253746" },
					{ name: "Black", value: "#000" },
				]}
			/>,
		);
		expect(screen.getByRole("button", { name: "Indigo" })).toBeInTheDocument();
	});
});
