import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.js";
import {
	fetchThirdPartyStylist,
	fetchThirdPartyStylistAvailability,
	fetchThirdPartyStylists,
	ThirdPartyHttpError,
} from "../recommendations.js";
import type { StylistAvailabilityStatus } from "../types.js";
import { filterStylists } from "./helpers.js";
import {
	errorJsonSchema,
	stylistAvailabilityEnum,
	stylistAvailabilityJsonSchema,
	stylistJsonSchema,
	stylistListJsonSchema,
} from "./schemas.js";

export async function stylistRoutes(app: FastifyInstance) {
	app.get(
		"/api/stylists",
		{
			schema: {
				tags: ["stylists"],
				summary: "List simulated store-associate stylist profiles",
				querystring: {
					type: "object",
					properties: {
						specialty: { type: "string" },
						fit: { type: "string" },
						availability: { type: "string", enum: stylistAvailabilityEnum },
					},
				},
				response: {
					200: stylistListJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, _reply) => {
			const filters = request.query as {
				specialty?: string;
				fit?: string;
				availability?: StylistAvailabilityStatus;
			};

			try {
				const data = await fetchThirdPartyStylists();
				return { stylists: filterStylists(data.stylists, filters) };
			} catch (error) {
				throw new HttpError(
					502,
					"Unable to load third-party stylist profiles",
					{
						cause: error,
					},
				);
			}
		},
	);

	app.get(
		"/api/stylists/availability",
		{
			schema: {
				tags: ["stylists"],
				summary:
					"Get the next 10 days of simulated store-associate stylist availability",
				response: {
					200: stylistAvailabilityJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (_request, _reply) => {
			try {
				return await fetchThirdPartyStylistAvailability();
			} catch (error) {
				throw new HttpError(
					502,
					"Unable to load third-party stylist availability",
					{ cause: error },
				);
			}
		},
	);

	app.get(
		"/api/stylists/:stylistId",
		{
			schema: {
				tags: ["stylists"],
				summary: "Get a simulated store-associate stylist profile",
				params: {
					type: "object",
					required: ["stylistId"],
					properties: {
						stylistId: { type: "string", minLength: 1 },
					},
				},
				response: {
					200: {
						type: "object",
						required: ["stylist"],
						properties: {
							stylist: stylistJsonSchema,
						},
					},
					404: errorJsonSchema,
					502: errorJsonSchema,
				},
			},
		},
		async (request, _reply) => {
			const { stylistId } = request.params as { stylistId: string };

			try {
				const stylist = await fetchThirdPartyStylist(stylistId);
				return { stylist };
			} catch (error) {
				if (error instanceof ThirdPartyHttpError && error.status === 404) {
					throw new HttpError(404, "Stylist not found", { cause: error });
				}

				throw new HttpError(502, "Unable to load third-party stylist profile", {
					cause: error,
				});
			}
		},
	);
}
