import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright drives the associate Appointment Prep dashboard.
 *
 * Two modes:
 *  - Local (default): `webServer` boots the full stack (web + API + WireMock +
 *    Postgres) via docker-compose and waits for the web app at :5173. With
 *    `reuseExistingServer` it reuses a stack a developer already has running.
 *  - Remote: set `E2E_BASE_URL` (e.g. the deployed dev URL) and `webServer` is
 *    skipped entirely — tests run against that already-running deployment. The
 *    CI post-deploy smoke uses this with `--grep @readonly`.
 *
 * `E2E_API_BASE_URL` points the @readonly API contract checks at the matching
 * API origin (the web and API are different origins, so `use.baseURL` can't
 * cover both).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const targetingRemote = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: [["list"], ["html"]],
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: targetingRemote
		? undefined
		: {
				command: "docker compose up --build",
				url: "http://localhost:5173",
				reuseExistingServer: !process.env.CI,
				timeout: 180_000,
			},
});
