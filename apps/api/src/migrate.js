import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://denim:denim@localhost:5432/denim_fit";
const sql = await readFile(new URL("../../../infra/db/init.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  await pool.query(sql);
  console.log("Database migration complete");
} finally {
  await pool.end();
}
