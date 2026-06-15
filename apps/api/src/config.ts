export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://denim:denim@localhost:5432/denim_fit",
  thirdPartyBaseUrl: process.env.THIRD_PARTY_BASE_URL ?? "http://localhost:8080"
};
