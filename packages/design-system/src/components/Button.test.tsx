import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
	it("renders its children and defaults to a type=button primary/md button", () => {
		render(<Button>Add to Bag</Button>);
		const btn = screen.getByRole("button", { name: "Add to Bag" });
		expect(btn).toHaveAttribute("type", "button");
		expect(btn).toHaveClass("bg-ink", "inline-flex", "uppercase");
	});

	it("maps variant and size to utility classes", () => {
		render(
			<Button variant="secondary" size="lg">
				Shop
			</Button>,
		);
		const btn = screen.getByRole("button", { name: "Shop" });
		expect(btn).toHaveClass("border-ink", "bg-transparent");
		expect(btn).toHaveClass("min-h-[52px]");
	});

	it("stretches full width when requested", () => {
		render(<Button fullWidth>Wide</Button>);
		const btn = screen.getByRole("button", { name: "Wide" });
		expect(btn).toHaveClass("flex", "w-full");
		expect(btn).not.toHaveClass("inline-flex");
	});

	it("fires onClick when enabled", () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Go</Button>);
		fireEvent.click(screen.getByRole("button", { name: "Go" }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("does not fire onClick when disabled", () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Nope
			</Button>,
		);
		const btn = screen.getByRole("button", { name: "Nope" });
		expect(btn).toBeDisabled();
		fireEvent.click(btn);
		expect(onClick).not.toHaveBeenCalled();
	});

	it("renders leading and trailing icons alongside the label", () => {
		render(
			<Button
				leadingIcon={<span data-testid="lead" />}
				trailingIcon={<span data-testid="trail" />}
			>
				Label
			</Button>,
		);
		expect(screen.getByTestId("lead")).toBeInTheDocument();
		expect(screen.getByTestId("trail")).toBeInTheDocument();
	});

	it("merges a custom className and forwards arbitrary props", () => {
		render(
			<Button className="custom" aria-pressed="true">
				X
			</Button>,
		);
		const btn = screen.getByRole("button", { name: "X" });
		expect(btn).toHaveClass("custom");
		expect(btn).toHaveAttribute("aria-pressed", "true");
	});
});
