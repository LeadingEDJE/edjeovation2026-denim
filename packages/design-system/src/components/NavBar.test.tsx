import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavBar, type NavLink } from "./NavBar";

const links: NavLink[] = [
	{ label: "Women", href: "/women", active: true },
	{ label: "Men", href: "/men" },
	{ label: "Clearance", href: "/sale", sale: true },
];

describe("NavBar", () => {
	it("renders the brand wordmark", () => {
		render(<NavBar brand="DENIM & CO." />);
		expect(screen.getByText("DENIM & CO.")).toBeInTheDocument();
	});

	it("renders each nav link with its href", () => {
		render(<NavBar links={links} />);
		expect(screen.getByRole("link", { name: "Women" })).toHaveAttribute(
			"href",
			"/women",
		);
		expect(screen.getByRole("link", { name: "Men" })).toHaveAttribute(
			"href",
			"/men",
		);
	});

	it("marks the active link and styles the sale link", () => {
		render(<NavBar links={links} />);
		expect(screen.getByRole("link", { name: "Women" })).toHaveClass(
			"border-ink",
		);
		expect(screen.getByRole("link", { name: "Clearance" })).toHaveClass(
			"text-sale",
		);
	});

	it("renders the standard utility icon buttons", () => {
		render(<NavBar />);
		expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Wishlist" }),
		).toBeInTheDocument();
	});

	it("reflects the bag count in the bag button label", () => {
		render(<NavBar bagCount={3} />);
		expect(
			screen.getByRole("button", { name: "Bag, 3 items" }),
		).toBeInTheDocument();
	});
});
