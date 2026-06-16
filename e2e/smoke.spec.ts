import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test("dashboard shell loads appointment workflow", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Appointment prep dashboard" }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: /Open/ })).toBeVisible();
	await expect(page.getByRole("button", { name: /In Progress/ })).toBeVisible();
	await expect(page.getByRole("button", { name: /No-shows/ })).toBeVisible();
	await expect(page.getByLabel("Store")).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Date" })).toBeVisible();
	await expect(page.getByLabel("Date order")).toBeVisible();
	await expect(page.getByLabel("Stylist")).toBeVisible();
	await expect(page.getByLabel("Status")).toBeVisible();
});

test("refresh reloads appointment dashboard data", async ({ page }) => {
	await expect(page.getByText("Appointments loaded")).toBeVisible();

	await page.getByRole("button", { name: "Refresh appointments" }).click();

	await expect(page.getByText("Appointments loaded")).toBeVisible();
	await expect(page.getByTestId("appointments-panel")).toBeVisible();
});
