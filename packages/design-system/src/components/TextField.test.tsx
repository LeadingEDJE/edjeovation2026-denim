import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
	it("associates the label with the input", () => {
		render(<TextField label="Email" placeholder="you@example.com" />);
		const input = screen.getByLabelText("Email");
		expect(input).toHaveAttribute("placeholder", "you@example.com");
	});

	it("shows a hint when there is no error", () => {
		render(<TextField label="Email" hint="We'll never share it." />);
		expect(screen.getByText("We'll never share it.")).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toHaveAttribute(
			"aria-invalid",
			"false",
		);
	});

	it("shows the error and marks the field invalid", () => {
		render(
			<TextField label="Email" error="Required" hint="ignored when erroring" />,
		);
		expect(screen.getByText("Required")).toBeInTheDocument();
		expect(screen.queryByText("ignored when erroring")).not.toBeInTheDocument();
		const input = screen.getByLabelText("Email");
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveClass("border-sale");
	});

	it("forwards value and change events", () => {
		const onChange = vi.fn();
		render(<TextField label="Name" value="Wes" onChange={onChange} />);
		const input = screen.getByLabelText("Name");
		expect(input).toHaveValue("Wes");
		fireEvent.change(input, { target: { value: "Wesley" } });
		expect(onChange).toHaveBeenCalled();
	});

	it("respects an explicit id over the generated one", () => {
		render(<TextField label="Zip" id="zip-field" />);
		expect(screen.getByLabelText("Zip")).toHaveAttribute("id", "zip-field");
	});
});
