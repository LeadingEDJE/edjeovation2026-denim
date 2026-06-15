export const config = {
	port: Number(process.env.API_PORT ?? 4000),
	databaseUrl:
		process.env.DATABASE_URL ??
		"postgres://denim:denim@localhost:5432/denim_fit",
	thirdPartyBaseUrl:
		process.env.THIRD_PARTY_BASE_URL ?? "http://localhost:8080",
	// Catalog-backed recommendation engine. When ANTHROPIC_API_KEY is unset the
	// engine falls back to the rule-based ranking, so the endpoint works offline.
	anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
	// Optional: point the Anthropic SDK at a compatible proxy (e.g. a LiteLLM
	// gateway). Empty string → the SDK's default api.anthropic.com.
	anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL ?? "",
	recommenderModel: process.env.RECOMMENDER_MODEL || "claude-opus-4-8",
};
