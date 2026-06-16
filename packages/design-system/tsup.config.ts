import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: false,
	treeshake: true,
	// React + icon lib stay external; the design-sync converter bundles them
	// from the package's own node_modules when it builds the preview bundle.
	external: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
});
