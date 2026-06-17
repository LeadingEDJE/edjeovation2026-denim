import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import { fetchThirdPartyUser } from "../recommendations.js";
import * as repository from "../repository.js";
import type { CurrentUser } from "../types.js";
import { getActiveUserProfile, getCustomerProfile } from "./helpers.js";
import {
	currentUserJsonSchema,
	errorJsonSchema,
	updateFitProfileJsonSchema,
} from "./schemas.js";

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
				return await getActiveUserProfile();
			} catch (error) {
				throw new HttpError(502, "Unable to load third-party current user", {
					cause: error,
				});
			}
		},
	);

	app.get(
		"/api/customers/:customerId/profile",
		{
			schema: {
				tags: ["user"],
				summary: "Get a mocked customer's current fit profile",
				params: {
					type: "object",
					required: ["customerId"],
					properties: { customerId: { type: "string", minLength: 1 } },
				},
				response: {
					200: currentUserJsonSchema,
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { customerId } = request.params as { customerId: string };
			try {
				return await getCustomerProfile(customerId);
			} catch (error) {
				if (error instanceof Error && error.message.includes("404")) {
					return reply.code(404).send({ message: "Customer not found" });
				}
				throw new HttpError(502, "Unable to load customer profile", {
					cause: error,
				});
			}
		},
	);

	app.patch(
		"/api/customers/:customerId/fit-profile",
		{
			schema: {
				tags: ["user"],
				summary: "Persist a mock customer fit profile override",
				params: {
					type: "object",
					required: ["customerId"],
					properties: { customerId: { type: "string", minLength: 1 } },
				},
				body: updateFitProfileJsonSchema,
				response: {
					200: currentUserJsonSchema,
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, reply) => {
			const { customerId } = request.params as { customerId: string };
			const input = request.body as Pick<
				CurrentUser,
				"measurements" | "preferences"
			>;

			try {
				await fetchThirdPartyUser(customerId);
				await repository.upsertCustomerFitProfileOverride(
					customerId,
					JSON.stringify(input.measurements),
					JSON.stringify(input.preferences),
				);
				return await getCustomerProfile(customerId);
			} catch (error) {
				if (error instanceof Error && error.message.includes("404")) {
					return reply.code(404).send({ message: "Customer not found" });
				}
				throw new HttpError(502, "Unable to save fit profile", {
					cause: error,
				});
			}
		},
	);
}
