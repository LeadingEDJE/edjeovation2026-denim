/**
 * Side-effect module: load the repo-root .env into process.env for standalone
 * CLI scripts (the Fastify server gets its env from docker-compose instead, so
 * nothing here runs in that path). Import this FIRST — before any module that
 * reads process.env at evaluation time (db.ts builds its pool, config.ts reads
 * keys), since ESM evaluates imports in source order.
 *
 * No-op when the file is absent or process.loadEnvFile is unavailable, and it
 * does not clobber variables already present in the environment.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// apps/api/src/ -> repo root.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

if (typeof process.loadEnvFile === "function") {
	for (const name of [".env.local", ".env"]) {
		const file = resolve(root, name);
		if (existsSync(file)) {
			try {
				// loadEnvFile does not overwrite vars already set in the environment.
				process.loadEnvFile(file);
			} catch {
				// Ignore parse errors — a malformed .env shouldn't block the script;
				// missing config surfaces clearly downstream (e.g. no API key).
			}
		}
	}
}
