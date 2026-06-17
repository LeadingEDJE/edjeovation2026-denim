import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture the PoolConfig handed to pg.Pool without opening a real connection.
const { pools } = vi.hoisted(() => ({
	pools: [] as Array<{ config: unknown; end: ReturnType<typeof vi.fn> }>,
}));

vi.mock("pg", () => ({
	default: {
		Pool: class {
			config: unknown;
			end = vi.fn(async () => {});
			constructor(config: unknown) {
				this.config = config;
				pools.push(this);
			}
		},
	},
}));

const ENV_KEYS = [
	"DATABASE_URL",
	"PGHOST",
	"PGPORT",
	"PGDATABASE",
	"PGUSER",
	"PGPASSWORD",
	"PGSSLMODE",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
	saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
	for (const k of ENV_KEYS) delete process.env[k];
	pools.length = 0;
	vi.resetModules();
});

afterEach(() => {
	for (const k of ENV_KEYS) {
		if (saved[k] === undefined) delete process.env[k];
		else process.env[k] = saved[k];
	}
});

async function loadConfig() {
	await import("./db.js");
	return pools.at(-1)?.config as Record<string, unknown>;
}

describe("db pool configuration", () => {
	it("defaults to the local connection string when no env is set", async () => {
		const config = await loadConfig();
		expect(config.connectionString).toContain("localhost:5432/denim_fit");
	});

	it("uses DATABASE_URL without SSL by default", async () => {
		process.env.DATABASE_URL = "postgres://user:pass@db.example/app";
		const config = await loadConfig();
		expect(config.connectionString).toBe("postgres://user:pass@db.example/app");
		expect(config.ssl).toBeUndefined();
	});

	it("enables relaxed SSL when DATABASE_URL requests sslmode=require", async () => {
		process.env.DATABASE_URL = "postgres://db.example/app?sslmode=require";
		const config = await loadConfig();
		expect(config.ssl).toEqual({ rejectUnauthorized: false });
	});

	it("enables relaxed SSL via PGSSLMODE with a DATABASE_URL", async () => {
		process.env.DATABASE_URL = "postgres://db.example/app";
		process.env.PGSSLMODE = "require";
		const config = await loadConfig();
		expect(config.ssl).toEqual({ rejectUnauthorized: false });
	});

	it("builds discrete PG* connection fields when DATABASE_URL is absent", async () => {
		process.env.PGHOST = "db.internal";
		process.env.PGPORT = "6543";
		process.env.PGDATABASE = "denim";
		process.env.PGUSER = "denim";
		process.env.PGPASSWORD = "secret";
		const config = await loadConfig();
		expect(config).toMatchObject({
			host: "db.internal",
			port: 6543,
			database: "denim",
			user: "denim",
			password: "secret",
			ssl: undefined,
		});
	});

	it("enables relaxed SSL for PG* config when PGSSLMODE is require", async () => {
		process.env.PGHOST = "db.internal";
		process.env.PGSSLMODE = "require";
		const config = await loadConfig();
		expect(config.ssl).toEqual({ rejectUnauthorized: false });
	});

	it("closeDb ends the pool", async () => {
		const mod = await import("./db.js");
		await mod.closeDb();
		expect(pools.at(-1)?.end).toHaveBeenCalledTimes(1);
	});
});
