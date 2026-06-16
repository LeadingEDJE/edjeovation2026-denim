import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			// Resolve the workspace design-system to its TS source so component
			// tests don't depend on a prior `dist` build (CI runs tests without one).
			"@denim-fit/design-system": fileURLToPath(
				new URL("../../packages/design-system/src/index.ts", import.meta.url),
			),
		},
	},
	test: {
		name: "web",
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
