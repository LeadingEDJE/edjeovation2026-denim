import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
	app.get(
		"/health",
		{
			schema: {
				tags: ["health"],
				summary: "Check API health",
				response: {
					200: {
						type: "object",
						required: ["ok"],
						properties: {
							ok: { type: "boolean" },
						},
					},
				},
			},
		},
		async () => ({ ok: true }),
	);

	// Browse the scraped catalog with optional fit/rise/stretch/category/text filters.
}
