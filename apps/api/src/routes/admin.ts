import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import { fetchThirdPartyUsers } from "../recommendations.js";
import {
	getActiveUser,
	getActiveUserId,
	setActiveUserId,
	userExists,
} from "./helpers.js";
import {
	activeUserJsonSchema,
	errorJsonSchema,
	setActiveUserJsonSchema,
	userListJsonSchema,
} from "./schemas.js";

export async function adminRoutes(app: FastifyInstance) {
	app.get(
		"/api/admin/users",
		{
			schema: {
				tags: ["admin"],
				summary: "List mock customers available for local testing",
				response: {
					200: userListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (_request, _reply) => {
			try {
				return await fetchThirdPartyUsers();
			} catch (error) {
				throw new HttpError(502, "Unable to load mock users", { cause: error });
			}
		},
	);

	app.get(
		"/api/admin/active-user",
		{
			schema: {
				tags: ["admin"],
				summary: "Get the active mock customer",
				response: {
					200: activeUserJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (_request, _reply) => {
			try {
				const user = await getActiveUser();
				return { activeUserId: getActiveUserId(), user };
			} catch (error) {
				throw new HttpError(502, "Unable to load active mock user", {
					cause: error,
				});
			}
		},
	);

	app.put(
		"/api/admin/active-user",
		{
			schema: {
				tags: ["admin"],
				summary: "Set the active mock customer",
				body: setActiveUserJsonSchema,
				response: {
					200: activeUserJsonSchema,
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const input = request.body as { customerId: string };

			try {
				const users = await fetchThirdPartyUsers();
				if (!userExists(users, input.customerId)) {
					return reply.code(404).send({ message: "Mock user not found" });
				}

				setActiveUserId(input.customerId);
				const user = await getActiveUser();
				return { activeUserId: getActiveUserId(), user };
			} catch (error) {
				throw new HttpError(502, "Unable to set active mock user", {
					cause: error,
				});
			}
		},
	);
}
