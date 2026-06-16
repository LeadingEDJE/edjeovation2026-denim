import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias:
			// In dev, resolve the design system to its source so component edits
			// hot-reload. Production builds keep using the package's built `dist`.
			command === "serve"
				? {
						"@denim-fit/design-system": fileURLToPath(
							new URL(
								"../../packages/design-system/src/index.ts",
								import.meta.url,
							),
						),
					}
				: {},
	},
	server: {
		host: "0.0.0.0",
		port: 5173,
		// Bind-mounted source may not deliver inotify events on some hosts
		// (e.g. WSL2 paths under /mnt/c). Enable polling via the env var as a
		// fallback without slowing native dev.
		watch: process.env.CHOKIDAR_USEPOLLING ? { usePolling: true } : undefined,
	},
}));
