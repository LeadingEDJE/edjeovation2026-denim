import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
	it("exposes its label as the accessible name and renders the icon", () => {
		render(<IconButton label="Search" icon={<svg data-testid="icon" />} />);
		const btn = screen.getByRole("button", { name: "Search" });
		expect(btn).toHaveAttribute("aria-label", "Search");
		expect(screen.getByTestId("icon")).toBeInTheDocument();
	});

	it("fires onClick", () => {
		const onClick = vi.fn();
		render(<IconButton label="Bag" icon={<svg />} onClick={onClick} />);
		fireEvent.click(screen.getByRole("button", { name: "Bag" }));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
