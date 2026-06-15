import { expect, test } from "@playwright/test";

// Smoke tests for the denim fitting console. They drive the real full stack, so
// assertions check for presence/structure of live (WireMock-backed) data rather
// than exact recommendation values.

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test("app loads with the fitting console and sessions settle", async ({
	page,
}) => {
	await expect(
		page.getByRole("heading", { name: "Fit experience console" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "New fitting" }),
	).toBeVisible();
	await expect(page.getByLabel("Customer")).toHaveValue("Avery");

	// The initial fetch of sessions resolves to "Sessions loaded".
	await expect(page.getByText("Sessions loaded")).toBeVisible();
});

test("creating a fitting produces a recommendation and a new session", async ({
	page,
}) => {
	await page.getByLabel("Customer").fill("Avery");
	await page.getByLabel("Fit").selectOption("slim");
	await page.getByLabel("Stretch").selectOption("comfort-stretch");

	await page.getByRole("button", { name: "Create recommendation" }).click();

	await expect(page.getByText("Recommendation created")).toBeVisible();

	// Recommendation panel populated: empty state gone, a style name shown.
	const resultPanel = page.locator("section.resultPanel");
	await expect(resultPanel.locator("p.empty")).toHaveCount(0);
	await expect(resultPanel.locator(".recommendation strong")).toBeVisible();
	await expect(resultPanel.locator("meter")).toBeVisible();

	// The new session appears at the top of Recent sessions for "Avery".
	await expect(
		page.locator("article.sessionRow").first().getByText("Avery"),
	).toBeVisible();
});

test("refresh reloads the sessions list", async ({ page }) => {
	await expect(page.getByText("Sessions loaded")).toBeVisible();

	await page.getByRole("button", { name: "Refresh sessions" }).click();

	await expect(page.getByText("Sessions loaded")).toBeVisible();
	await expect(page.locator(".sessionList")).toBeVisible();
});
