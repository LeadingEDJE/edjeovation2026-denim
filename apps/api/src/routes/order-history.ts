import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import { fetchThirdPartyOrderHistory } from "../recommendations.js";
import type { OrderHistoryScenario } from "../types.js";
import {
	errorJsonSchema,
	orderHistoryJsonSchema,
	orderHistoryScenarioEnum,
} from "./schemas.js";

export async function orderHistoryRoutes(app: FastifyInstance) {
	app.get(
		"/api/customers/:customerId/order-history",
		{
			schema: {
				tags: ["order-history"],
				summary:
					"Get customer order history from the simulated third-party service",
				params: {
					type: "object",
					required: ["customerId"],
					properties: {
						customerId: { type: "string", minLength: 1 },
					},
				},
				querystring: {
					type: "object",
					properties: {
						scenario: {
							type: "string",
							enum: orderHistoryScenarioEnum,
							default: "standard",
						},
					},
				},
				response: {
					200: orderHistoryJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, _reply) => {
			const { customerId } = request.params as { customerId: string };
			const { scenario = "standard" } = request.query as {
				scenario?: OrderHistoryScenario;
			};

			try {
				return await fetchThirdPartyOrderHistory(customerId, scenario);
			} catch (error) {
				throw new HttpError(502, "Unable to load third-party order history", {
					cause: error,
				});
			}
		},
	);
}
