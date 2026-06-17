import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpError, registerErrorHandler } from "./errors.js";
import { ThirdPartyHttpError } from "./recommendations.js";

let app: FastifyInstance;

beforeEach(async () => {
	app = Fastify();
	registerErrorHandler(app);
	app.get("/http-400", async () => {
		throw new HttpError(400, "Bad input");
	});
	app.get("/http-502", async () => {
		throw new HttpError(502, "Upstream down");
	});
	app.get("/third-party", async () => {
		throw new ThirdPartyHttpError("origin failed", 503);
	});
	app.get("/boom", async () => {
		throw new Error("unexpected");
	});
	app.post(
		"/validate",
		{
			schema: {
				body: {
					type: "object",
					required: ["name"],
					properties: { name: { type: "string" } },
				},
			},
		},
		async () => ({ ok: true }),
	);
	await app.ready();
});

afterEach(async () => {
	await app.close();
});

describe("registerErrorHandler", () => {
	it("maps a 4xx HttpError to its status and client message", async () => {
		const res = await app.inject({ method: "GET", url: "/http-400" });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toEqual({ message: "Bad input" });
	});

	it("maps a 5xx HttpError to its status and client message", async () => {
		const res = await app.inject({ method: "GET", url: "/http-502" });
		expect(res.statusCode).toBe(502);
		expect(res.json()).toEqual({ message: "Upstream down" });
	});

	it("maps a ThirdPartyHttpError to a generic 502", async () => {
		const res = await app.inject({ method: "GET", url: "/third-party" });
		expect(res.statusCode).toBe(502);
		expect(res.json()).toEqual({ message: "Upstream service unavailable" });
	});

	it("maps an unexpected error to a generic 500", async () => {
		const res = await app.inject({ method: "GET", url: "/boom" });
		expect(res.statusCode).toBe(500);
		expect(res.json()).toEqual({ message: "Internal server error" });
	});

	it("preserves Fastify's schema-validation 400 response", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/validate",
			payload: {},
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().message).toMatch(/name/i);
	});
});

describe("HttpError", () => {
	it("carries the status code and message", () => {
		const error = new HttpError(409, "Conflict");
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("HttpError");
		expect(error.statusCode).toBe(409);
		expect(error.message).toBe("Conflict");
	});
});
