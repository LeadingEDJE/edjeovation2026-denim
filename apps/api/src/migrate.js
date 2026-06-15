import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://denim:denim@localhost:5432/denim_fit";
const pool = new pg.Pool({ connectionString: databaseUrl });

// Schema first, then seed data. The seed is idempotent (ON CONFLICT DO NOTHING),
// so it is safe to run on every startup and only fills an empty/partial catalog.
const steps = [
  { name: "schema", file: new URL("../../../infra/db/init.sql", import.meta.url) },
  { name: "catalog seed", file: new URL("../../../infra/db/seed-catalog.sql", import.meta.url) }
];

try {
  for (const step of steps) {
    const sql = await readFile(step.file, "utf8");
    await pool.query(sql);
    console.log(`Applied ${step.name}`);
  }
  // Schema-qualified: the seed (pg_dump output) resets search_path on this
  // connection, so an unqualified name would not resolve here.
  const { rows } = await pool.query("SELECT count(*)::int AS count FROM public.catalog_products");
  console.log(`Database migration complete (catalog_products: ${rows[0].count} rows)`);
} finally {
  await pool.end();
}
