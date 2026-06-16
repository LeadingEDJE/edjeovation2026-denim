import { readFile } from "node:fs/promises";
import pg from "pg";

function sslConfig() {
	return process.env.PGSSLMODE === "require"
		? { rejectUnauthorized: false }
		: undefined;
}

function poolConfig() {
	if (process.env.DATABASE_URL) {
		return {
			connectionString: process.env.DATABASE_URL,
			ssl: process.env.DATABASE_URL.includes("sslmode=require")
				? { rejectUnauthorized: false }
				: sslConfig(),
		};
	}

	if (process.env.PGHOST) {
		return {
			host: process.env.PGHOST,
			port: Number(process.env.PGPORT ?? 5432),
			database: process.env.PGDATABASE,
			user: process.env.PGUSER,
			password: process.env.PGPASSWORD,
			ssl: sslConfig(),
		};
	}

	return {
		connectionString: "postgres://denim:denim@localhost:5432/denim_fit",
	};
}

const pool = new pg.Pool(poolConfig());

// Schema first, then replace catalog seed data. The catalog is generated data,
// so startup should make the table match infra/db/seed-catalog.sql even when an
// existing Docker volume has an older catalog.
const steps = [
	{
		name: "schema",
		file: new URL("../../../infra/db/init.sql", import.meta.url),
	},
	{
		name: "catalog seed",
		file: new URL("../../../infra/db/seed-catalog.sql", import.meta.url),
	},
];

try {
	const schema = await readFile(steps[0].file, "utf8");
	await pool.query(schema);
	console.log(`Applied ${steps[0].name}`);

	const catalogSeed = await readFile(steps[1].file, "utf8");

	await pool.query("BEGIN");
	try {
		await pool.query("TRUNCATE TABLE public.catalog_products");
		await pool.query(catalogSeed);
		await pool.query("COMMIT");
	} catch (error) {
		await pool.query("ROLLBACK");
		throw error;
	}
	console.log("Refreshed catalog products");
	console.log(`Applied ${steps[1].name}`);

	// Schema-qualified: the seed (pg_dump output) resets search_path on this
	// connection, so an unqualified name would not resolve here.
	const { rows } = await pool.query(
		"SELECT count(*)::int AS count FROM public.catalog_products",
	);
	console.log(
		`Database migration complete (catalog_products: ${rows[0].count} rows)`,
	);
} finally {
	await pool.end();
}
