import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke tests run against the real full stack (web + API + WireMock
 * + Postgres) orchestrated by docker-compose. `webServer` boots the stack and
 * waits for the web app at http://localhost:5173; with `reuseExistingServer` it
 * reuses a stack a developer already has running locally.
 */
export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: "html",
	use: {
		baseURL: "http://localhost:5173",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "docker compose up --build",
		url: "http://localhost:5173",
		reuseExistingServer: true,
		timeout: 180_000,
	},
});
