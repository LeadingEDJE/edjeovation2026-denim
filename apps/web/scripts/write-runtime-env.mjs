import { mkdir, writeFile } from "node:fs/promises";

const distDir = new URL("../dist/", import.meta.url);
const config = {
	apiBaseUrl: process.env.VITE_API_BASE_URL || "",
};

await mkdir(distDir, { recursive: true });
await writeFile(
	new URL("env.js", distDir),
	`window.__DENIM_FIT_CONFIG__ = ${JSON.stringify(config)};\n`,
	"utf8",
);
