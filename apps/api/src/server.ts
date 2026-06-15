import cors from "@fastify/cors";
import Fastify from "fastify";
import { closeDb } from "./db.js";
import { registerRoutes } from "./routes.js";
import { config } from "./config.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

await registerRoutes(app);

const shutdown = async () => {
  await app.close();
  await closeDb();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: "0.0.0.0" });
