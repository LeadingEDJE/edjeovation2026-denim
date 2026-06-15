import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { closeDb } from "./db.js";
import { registerRoutes } from "./routes.js";
import { config } from "./config.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

await app.register(swagger, {
  openapi: {
    info: {
      title: "Personalized Denim Fitting API",
      description: "API for creating denim fitting sessions and retrieving fit recommendations.",
      version: "0.1.0"
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local Docker Compose API"
      }
    ],
    tags: [
      { name: "health", description: "Service health" },
      { name: "fitting-sessions", description: "Customer measurements and denim recommendations" },
      { name: "order-history", description: "Simulated third-party customer order history" },
      { name: "stylists", description: "Simulated store-associate stylist profiles" }
    ]
  }
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true
  }
});

await registerRoutes(app);

app.get(
  "/openapi.json",
  {
    schema: {
      hide: true
    }
  },
  async () => app.swagger()
);

const shutdown = async () => {
  await app.close();
  await closeDb();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: "0.0.0.0" });
