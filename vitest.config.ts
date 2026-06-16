import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Each workspace owns its own vitest.config.ts (node vs jsdom env).
		projects: ["apps/*", "packages/*"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
			exclude: [
				"apps/*/src/**/*.test.{ts,tsx}",
				"apps/*/src/server.ts",
				"apps/*/src/main.tsx",
				"apps/*/src/vite-env.d.ts",
				"apps/api/src/migrate.js",
				"packages/*/src/**/*.test.{ts,tsx}",
				"packages/*/src/index.ts",
			],
		},
	},
});
