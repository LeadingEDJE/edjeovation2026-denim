import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { config } from "./config.js";
import { closeDb } from "./db.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: true });

await app.register(cors, {
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	origin: true,
});

await app.register(swagger, {
	openapi: {
		info: {
			title: "Personalized Denim Fitting API",
			description:
				"API for guided denim fitting appointment booking and stylist prep data.",
			version: "0.1.0",
		},
		servers: [
			{
				url: "http://localhost:4000",
				description: "Local Docker Compose API",
			},
		],
		tags: [
			{ name: "health", description: "Service health" },
			{ name: "admin", description: "Local mock-user switching controls" },
			{ name: "user", description: "Mocked logged-in customer context" },
			{
				name: "appointments",
				description: "Guided fitting appointment booking and prep data",
			},
			{
				name: "order-history",
				description: "Simulated third-party customer order history",
			},
			{
				name: "stylists",
				description: "Simulated store-associate stylist profiles",
			},
		],
	},
});

await app.register(swaggerUi, {
	routePrefix: "/docs",
	uiConfig: {
		docExpansion: "list",
		deepLinking: true,
	},
});

await registerRoutes(app);

app.get(
	"/openapi.json",
	{
		schema: {
			hide: true,
		},
	},
	async () => app.swagger(),
);

const shutdown = async () => {
	await app.close();
	await closeDb();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: "0.0.0.0" });
