import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	openAppointmentByStatus,
	switchView,
	waitForAppointmentsLoaded,
} from "./fixtures";

const demoSearch = process.env.DEMO_APPOINTMENT_SEARCH?.trim() ?? "";
const associateMessage =
	process.env.DEMO_ASSOCIATE_MESSAGE ??
	"We pulled a few dark wash options and one cream layer for comparison.";
const prepNote =
	process.env.DEMO_PREP_NOTE ?? "Ready in fitting room 2 for comparison.";
const sessionNotes =
	process.env.DEMO_SESSION_NOTES ??
	"High-rise straight fit was strongest; customer preferred dark wash with clean hems.";
const customerRecap =
	process.env.DEMO_CUSTOMER_RECAP ??
	"Your best fit today was the high-rise straight jean in a dark wash, styled with a cream layer for a polished everyday look.";
const internalFeedback =
	process.env.DEMO_INTERNAL_FEEDBACK ??
	"Prepared shortlist matched the customer goals; keep straight and clean dark washes for follow-up.";

test.use({
	viewport: { width: 1440, height: 900 },
	video: { mode: "on", size: { width: 1440, height: 900 } },
	launchOptions: { slowMo: 250 },
});

test.describe.configure({ mode: "serial" });

test.describe("associate demo recording @demo", () => {
	test("records the associate appointment workflow", async ({ page }) => {
		test.setTimeout(240_000);

		await page.goto("/");
		await readablePause(page);
		await waitForAppointmentsLoaded(page);
		await readablePause(page);

		await switchView(page, "Open");
		if (demoSearch) {
			await page
				.getByPlaceholder("Search customer or stylist")
				.fill(demoSearch);
			await readablePause(page);
		}

		await openDemoAppointment(page);
		await readablePause(page);

		await expect(page.getByText("Suggested Products")).toBeVisible();
		await page.getByText("Suggested Products").scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "Pulled" }).first(),
		).toBeVisible({
			timeout: 30_000,
		});
		await readablePause(page, 1800);

		await page.getByRole("button", { name: "Pulled" }).first().click();
		await expect(page.getByText("Product prep updated")).toBeVisible({
			timeout: 15_000,
		});
		await readablePause(page);

		const firstPrepNote = page.getByPlaceholder(/Add a prep note/).first();
		await firstPrepNote.fill(prepNote);
		await firstPrepNote.blur();
		await readablePause(page);

		await page.getByText("Messages", { exact: true }).scrollIntoViewIfNeeded();
		await page.getByPlaceholder(/Message customer/).fill(associateMessage);
		await readablePause(page);
		await page.getByRole("button", { name: "Send" }).click();
		await expect(page.getByText("Message sent")).toBeVisible({
			timeout: 15_000,
		});
		await readablePause(page);

		await page.getByRole("button", { name: "Check In", exact: true }).click();
		await expect(page.getByText("Appointment checked in")).toBeVisible({
			timeout: 15_000,
		});
		await readablePause(page);

		await page
			.getByPlaceholder(/Fit feedback, products tried, follow-ups/)
			.fill(sessionNotes);
		await page
			.getByPlaceholder(/Customer-visible fit recap/)
			.fill(customerRecap);
		await page
			.getByPlaceholder(/Internal notes on prep quality, fit confidence, gaps/)
			.fill(internalFeedback);
		await readablePause(page);

		await page.getByRole("button", { name: "Save Notes" }).click();
		await expect(page.getByText("Session notes saved")).toBeVisible({
			timeout: 15_000,
		});
		await readablePause(page);

		await page
			.getByPlaceholder(/Customer-visible fit recap/)
			.fill(customerRecap);
		await page
			.getByPlaceholder(/Internal notes on prep quality, fit confidence, gaps/)
			.fill(internalFeedback);
		await readablePause(page, 500);

		await page.getByRole("button", { name: "Complete", exact: true }).click();
		await expect(page.getByText("Appointment marked complete")).toBeVisible({
			timeout: 15_000,
		});
		await readablePause(page);

		await expect(page.getByText("What Was Pulled")).toBeVisible();
		await expect(page.getByText("Session Recap")).toBeVisible();
		await page.getByText("Session Recap").scrollIntoViewIfNeeded();
		await readablePause(page, 2200);
	});
});

async function openDemoAppointment(page: Page) {
	const row = demoSearch
		? page
				.getByTestId("appointment-row")
				.filter({ hasText: "Scheduled" })
				.filter({ hasText: demoSearch })
				.first()
		: scheduledRow(page);

	if (await row.count()) {
		await expect(row).toBeVisible();
		await row.click();
		await expect(
			page.getByRole("button", { name: "Back to queue" }),
		).toBeVisible();
		return;
	}

	if (demoSearch) {
		await page.getByPlaceholder("Search customer or stylist").clear();
		await readablePause(page, 500);
	}
	await openAppointmentByStatus(page, "Scheduled");
}

function scheduledRow(page: Page): Locator {
	return page
		.getByTestId("appointment-row")
		.filter({ hasText: "Scheduled" })
		.first();
}

async function readablePause(page: Page, ms = 1000) {
	await page.waitForTimeout(Number(process.env.DEMO_STEP_PAUSE_MS ?? ms));
}
