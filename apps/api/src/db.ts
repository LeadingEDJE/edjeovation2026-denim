import pg from "pg";

function sslConfig() {
	return process.env.PGSSLMODE === "require"
		? { rejectUnauthorized: false }
		: undefined;
}

function poolConfig(): pg.PoolConfig {
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

export const pool = new pg.Pool(poolConfig());

export async function closeDb() {
	await pool.end();
}
