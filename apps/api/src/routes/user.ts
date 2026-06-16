import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import { getActiveUser } from "./helpers.js";
import { currentUserJsonSchema, errorJsonSchema } from "./schemas.js";

export async function userRoutes(app: FastifyInstance) {
	app.get(
		"/api/me",
		{
			schema: {
				tags: ["user"],
				summary: "Get the mocked logged-in loyalty customer",
				response: {
					200: currentUserJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (_request, _reply) => {
			try {
				return await getActiveUser();
			} catch (error) {
				throw new HttpError(502, "Unable to load third-party current user", {
					cause: error,
				});
			}
		},
	);
}
