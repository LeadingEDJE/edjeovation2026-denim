/**
 * Centralized HTTP error handling.
 *
 * Handlers throw `HttpError` (or let a `ThirdPartyHttpError`/unexpected error
 * propagate) instead of repeating `request.log.error(...)` +
 * `reply.code(...).send(...)` in every catch block. A single error handler maps
 * those to consistent `{ message }` responses and owns server-side logging.
 */
import type { FastifyError, FastifyInstance } from "fastify";
import { ThirdPartyHttpError } from "./recommendations.js";

/** An error carrying an HTTP status code and a client-safe message. */
export class HttpError extends Error {
	readonly statusCode: number;

	constructor(
		statusCode: number,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = "HttpError";
		this.statusCode = statusCode;
	}
}

export function registerErrorHandler(app: FastifyInstance) {
	app.setErrorHandler((error: FastifyError, request, reply) => {
		// Preserve Fastify's built-in schema-validation response (HTTP 400).
		if (error.validation) {
			return reply.status(error.statusCode ?? 400).send(error);
		}

		if (error instanceof HttpError) {
			// Only server-side faults are noise-worthy; 4xx are expected flow.
			if (error.statusCode >= 500) {
				request.log.error(error);
			}
			return reply.code(error.statusCode).send({ message: error.message });
		}

		if (error instanceof ThirdPartyHttpError) {
			request.log.error(error);
			return reply.code(502).send({ message: "Upstream service unavailable" });
		}

		// Unknown/unexpected error (e.g. a database failure): log and return 500.
		request.log.error(error);
		return reply.code(500).send({ message: "Internal server error" });
	});
}
