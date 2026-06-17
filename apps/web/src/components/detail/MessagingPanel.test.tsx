import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppointmentMessage } from "../../api.js";
import { MessagingPanel } from "./MessagingPanel.js";

function message(overrides: Partial<AppointmentMessage> = {}): AppointmentMessage {
	return {
		id: "msg-1",
		appointmentId: "appt-1",
		authorType: "customer",
		body: "Running a few minutes late",
		createdAt: "2026-06-16T15:00:00.000Z",
		...overrides,
	};
}

function renderPanel(
	overrides: Partial<Parameters<typeof MessagingPanel>[0]> = {},
) {
	const handlers = {
		onMessageDraftChange: vi.fn(),
		onPostMessage: vi.fn(),
	};
	render(
		<MessagingPanel
			canEdit
			messages={[]}
			messageDraft=""
			{...handlers}
			{...overrides}
		/>,
	);
	return handlers;
}

describe("MessagingPanel", () => {
	it("shows the empty state when there are no messages", () => {
		renderPanel();
		expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
	});

	it("labels associate and customer messages", () => {
		renderPanel({
			messages: [
				message({ id: "m1", authorType: "customer", body: "Hi there" }),
				message({ id: "m2", authorType: "associate", body: "On my way" }),
			],
		});
		expect(screen.getByText("Customer")).toBeInTheDocument();
		expect(screen.getByText("You")).toBeInTheDocument();
		expect(screen.getByText("Hi there")).toBeInTheDocument();
		expect(screen.getByText("On my way")).toBeInTheDocument();
	});

	it("reports draft edits", () => {
		const { onMessageDraftChange } = renderPanel();
		fireEvent.change(screen.getByPlaceholderText("Message customer…"), {
			target: { value: "Heads up" },
		});
		expect(onMessageDraftChange).toHaveBeenCalledWith("Heads up");
	});

	it("posts on Enter when the draft is non-empty", () => {
		const { onPostMessage } = renderPanel({ messageDraft: "Heads up" });
		fireEvent.keyDown(screen.getByPlaceholderText("Message customer…"), {
			key: "Enter",
		});
		expect(onPostMessage).toHaveBeenCalledTimes(1);
	});

	it("does not post on Enter when the draft is empty", () => {
		const { onPostMessage } = renderPanel({ messageDraft: "   " });
		fireEvent.keyDown(screen.getByPlaceholderText("Message customer…"), {
			key: "Enter",
		});
		expect(onPostMessage).not.toHaveBeenCalled();
	});

	it("posts from the Send button", () => {
		const { onPostMessage } = renderPanel({ messageDraft: "Heads up" });
		fireEvent.click(screen.getByRole("button", { name: "Send" }));
		expect(onPostMessage).toHaveBeenCalledTimes(1);
	});

	it("disables input and send when editing is locked", () => {
		renderPanel({ canEdit: false, messageDraft: "Heads up" });
		expect(screen.getByPlaceholderText("Message customer…")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
	});

	it("disables Send when the draft is empty", () => {
		renderPanel({ messageDraft: "" });
		expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
	});
});
