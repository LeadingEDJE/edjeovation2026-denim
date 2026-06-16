import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "scraper",
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
