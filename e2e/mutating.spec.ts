import { expect, test } from "@playwright/test";
import {
	openAppointmentByStatus,
	openFirstAppointment,
	switchView,
	waitForAppointmentsLoaded,
} from "./fixtures";

/**
 * State-changing smoke. These mutate appointment data, so they run ONLY against
 * a throwaway docker-compose stack (locally / `npm run test:e2e`) — never the
 * shared dev environment. Serial so the seeded scheduled/checked-in
 * appointments are consumed in a predictable order.
 *
 * Each action surfaces a confirmation string in the dashboard header (see the
 * status messages in apps/web/src/main.tsx); we assert on those.
 */
test.describe.configure({ mode: "serial" });

test.describe("appointment actions @mutating", { tag: "@mutating" }, () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await waitForAppointmentsLoaded(page);
	});

	test("post a message on a scheduled appointment", async ({ page }) => {
		await switchView(page, "Open");
		await openFirstAppointment(page);

		await page.getByPlaceholder("Message customer…").fill("Prep note from e2e");
		await page.getByRole("button", { name: "Send" }).click();
		await expect(page.getByText("Message sent")).toBeVisible();
	});

	test("update suggested-product prep state", async ({ page }) => {
		await switchView(page, "Open");
		await openFirstAppointment(page);

		await page.getByRole("button", { name: "Pulled" }).first().click();
		await expect(page.getByText("Product prep updated")).toBeVisible();
	});

	test("regenerate suggestions", async ({ page }) => {
		await switchView(page, "Open");
		await openFirstAppointment(page);

		await page.getByRole("button", { name: "Regenerate" }).click();
		await expect(page.getByText("Suggestions regenerated")).toBeVisible({
			timeout: 30_000,
		});
	});

	test("check in a scheduled appointment", async ({ page }) => {
		await switchView(page, "Open");
		await openAppointmentByStatus(page, "Scheduled");

		await page.getByRole("button", { name: "Check In", exact: true }).click();
		await expect(page.getByText("Appointment checked in")).toBeVisible();
	});

	test("save session notes on a checked-in appointment", async ({ page }) => {
		await switchView(page, "In Progress");
		await openFirstAppointment(page);

		await page
			.getByPlaceholder("Fit feedback, products tried, follow-ups…")
			.fill("Tried straight fit; good waist.");
		await page.getByRole("button", { name: "Save Notes" }).click();
		await expect(page.getByText("Session notes saved")).toBeVisible();
	});

	test("complete a checked-in appointment", async ({ page }) => {
		await switchView(page, "In Progress");
		await openFirstAppointment(page);

		await page
			.getByPlaceholder("Customer-visible fit recap…")
			.fill("Pulled two dark washes; customer loved the straight fit.");
		await page.getByRole("button", { name: "Complete", exact: true }).click();
		await expect(page.getByText("Appointment marked complete")).toBeVisible();
	});

	test("mark a scheduled appointment as no-show", async ({ page }) => {
		await switchView(page, "Open");
		await openAppointmentByStatus(page, "Scheduled");

		await page.getByRole("button", { name: "No-Show", exact: true }).click();
		await expect(page.getByText("Appointment marked no-show")).toBeVisible();
	});
});
