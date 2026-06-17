import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AppointmentNotification } from "../../api.js";
import { NotificationPanel } from "./NotificationPanel.js";

function notification(
	overrides: Partial<AppointmentNotification> = {},
): AppointmentNotification {
	return {
		id: "note-1",
		appointmentId: "appt-1",
		type: "confirmation",
		status: "sent",
		scheduledFor: "2026-06-16T12:00:00.000Z",
		sentAt: "2026-06-16T12:00:00.000Z",
		createdAt: "2026-06-15T12:00:00.000Z",
		...overrides,
	};
}

describe("NotificationPanel", () => {
	it("shows the empty state when there are no records", () => {
		render(<NotificationPanel notifications={[]} />);
		expect(screen.getByText(/no notification records/i)).toBeInTheDocument();
	});

	it("renders each notification's type and status", () => {
		render(
			<NotificationPanel
				notifications={[
					notification({ id: "n1", type: "confirmation", status: "sent" }),
					notification({ id: "n2", type: "reminder", status: "queued" }),
				]}
			/>,
		);
		expect(
			screen.getByText((_, el) => el?.textContent === "confirmation sent"),
		).toBeInTheDocument();
		expect(
			screen.getByText((_, el) => el?.textContent === "reminder queued"),
		).toBeInTheDocument();
	});
});
