import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import {
	fetchThirdPartyStoreSchedulePatterns,
	fetchThirdPartyStores,
} from "../recommendations.js";
import {
	errorJsonSchema,
	storeListJsonSchema,
	storeSchedulePatternJsonSchema,
} from "./schemas.js";

export async function storeRoutes(app: FastifyInstance) {
	app.get(
		"/api/stores",
		{
			schema: {
				tags: ["appointments"],
				summary: "List stores available for guided denim fitting appointments",
				response: {
					200: storeListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (_request, _reply) => {
			try {
				return await fetchThirdPartyStores();
			} catch (error) {
				throw new HttpError(502, "Unable to load stores", { cause: error });
			}
		},
	);

	app.get(
		"/api/stores/schedule-patterns",
		{
			schema: {
				tags: ["appointments"],
				summary:
					"List weekly store and stylist schedule patterns used to generate bookable slots",
				response: {
					200: storeSchedulePatternJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (_request, _reply) => {
			try {
				return await fetchThirdPartyStoreSchedulePatterns();
			} catch (error) {
				throw new HttpError(502, "Unable to load store schedule patterns", {
					cause: error,
				});
			}
		},
	);
}
