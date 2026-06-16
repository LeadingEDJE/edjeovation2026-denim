import { expect, test } from "@playwright/test";
import {
	API_BASE,
	DASHBOARD_VIEWS,
	openFirstAppointment,
	switchView,
	waitForAppointmentsLoaded,
} from "./fixtures";

/**
 * Non-destructive smoke. Safe to run against the shared dev environment after
 * deploy — these tests only read (page loads, navigation, client-side
 * filtering, opening detail, GET API contracts). No state is mutated.
 */
test.describe("dashboard @readonly", { tag: "@readonly" }, () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("dashboard shell renders the appointment workflow", async ({ page }) => {
		await expect(
			page.getByRole("heading", { level: 1, name: "Appointment Prep" }),
		).toBeVisible();

		for (const view of DASHBOARD_VIEWS) {
			await expect(
				page.getByRole("button", { name: new RegExp(`^${view}`) }),
			).toBeVisible();
		}

		await expect(page.getByLabel("Store")).toBeVisible();
		await expect(page.getByLabel("Stylist")).toBeVisible();
		await expect(page.getByLabel("Sort")).toBeVisible();
		await expect(
			page.getByPlaceholder("Search customer or stylist"),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Refresh appointments" }),
		).toBeVisible();
	});

	test("appointments load with seeded data", async ({ page }) => {
		await waitForAppointmentsLoaded(page);
		await expect(page.getByTestId("appointments-panel")).toBeVisible();
		await expect(page.getByTestId("appointment-row").first()).toBeVisible();
	});

	test("refresh reloads the appointment queue", async ({ page }) => {
		await waitForAppointmentsLoaded(page);
		await page.getByRole("button", { name: "Refresh appointments" }).click();
		await waitForAppointmentsLoaded(page);
		await expect(page.getByTestId("appointments-panel")).toBeVisible();
	});

	test("each view tab is navigable", async ({ page }) => {
		await waitForAppointmentsLoaded(page);
		for (const view of DASHBOARD_VIEWS) {
			await switchView(page, view);
			await expect(
				page.getByRole("button", { name: new RegExp(`^${view}`) }),
			).toHaveAttribute("aria-current", "page");
			await expect(page.getByTestId("appointments-panel")).toBeVisible();
		}
	});

	test("search narrows the queue to a known customer", async ({ page }) => {
		await waitForAppointmentsLoaded(page);
		await page.getByPlaceholder("Search customer or stylist").fill("Avery");
		const firstRow = page.getByTestId("appointment-row").first();
		await expect(firstRow).toBeVisible();
		await expect(firstRow).toContainText("Avery");
	});

	test("an unmatched search shows the empty state", async ({ page }) => {
		await waitForAppointmentsLoaded(page);
		await page
			.getByPlaceholder("Search customer or stylist")
			.fill("zzzzzznomatch");
		await expect(page.getByTestId("appointments-empty")).toBeVisible();
	});

	test("opening an appointment shows its detail then returns", async ({
		page,
	}) => {
		await waitForAppointmentsLoaded(page);
		await openFirstAppointment(page);

		// Detail renders the customer hero (h2) and the suggested-products panel.
		await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
		await expect(page.getByText("Suggested Products")).toBeVisible();
		await expect(page.getByText("Messages", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Notifications", { exact: true }),
		).toBeVisible();

		await page.getByRole("button", { name: "Back to queue" }).click();
		await expect(page.getByTestId("appointments-panel")).toBeVisible();
	});
});

test.describe("api contracts @readonly", { tag: "@readonly" }, () => {
	test("GET /health reports ok", async ({ request }) => {
		const response = await request.get(`${API_BASE}/health`);
		expect(response.ok()).toBeTruthy();
		expect(await response.json()).toEqual({ ok: true });
	});

	const collections: Array<{ path: string; key: string }> = [
		{ path: "/api/appointments", key: "appointments" },
		{ path: "/api/stores", key: "stores" },
		{ path: "/api/stylists", key: "stylists" },
		{ path: "/api/admin/users", key: "users" },
	];

	for (const { path, key } of collections) {
		test(`GET ${path} returns a ${key} array`, async ({ request }) => {
			const response = await request.get(`${API_BASE}${path}`);
			expect(response.ok()).toBeTruthy();
			const body = await response.json();
			expect(Array.isArray(body[key])).toBe(true);
		});
	}
});
