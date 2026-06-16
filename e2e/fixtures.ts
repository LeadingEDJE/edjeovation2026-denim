import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the e2e specs. Selectors mirror the live DOM in
 * apps/web/src/components/* (view-tab buttons carry their label + count as their
 * accessible name; the queue rows expose `data-testid="appointment-row"`).
 */

/** API origin for @readonly contract checks; defaults to the local stack. */
export const API_BASE = process.env.E2E_API_BASE_URL ?? "http://localhost:4000";

/** The five dashboard view tabs, in render order. */
export const DASHBOARD_VIEWS = [
	"Open",
	"In Progress",
	"Completed",
	"Cancelled",
	"No-shows",
] as const;

/** Wait for the dashboard's initial appointment load to settle. */
export async function waitForAppointmentsLoaded(page: Page) {
	await expect(page.getByText("Appointments loaded")).toBeVisible();
}

/** Switch the active dashboard view by its tab label (anchored to the label). */
export async function switchView(page: Page, label: string) {
	await page
		.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}`) })
		.click();
}

/**
 * Open the first appointment in the current list and wait for the detail view
 * (read-only: this only triggers GET messages/notifications).
 */
export async function openFirstAppointment(page: Page) {
	const firstRow = page.getByTestId("appointment-row").first();
	await expect(firstRow).toBeVisible();
	await firstRow.click();
	await expect(
		page.getByRole("button", { name: "Back to queue" }),
	).toBeVisible();
}

/**
 * Open the first appointment in the current list whose row shows the given
 * status badge label (e.g. "Scheduled", "Checked in"). The Open view mixes
 * scheduled and checked-in appointments, so status-specific actions need this.
 */
export async function openAppointmentByStatus(page: Page, statusLabel: string) {
	const row = page
		.getByTestId("appointment-row")
		.filter({ hasText: statusLabel })
		.first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(
		page.getByRole("button", { name: "Back to queue" }),
	).toBeVisible();
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
