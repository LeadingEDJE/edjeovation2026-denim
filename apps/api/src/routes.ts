import type { FastifyInstance } from "fastify";
import { registerErrorHandler } from "./errors.js";
import { adminRoutes } from "./routes/admin.js";
import { appointmentRoutes } from "./routes/appointments.js";
import { catalogRoutes } from "./routes/catalog.js";
import { healthRoutes } from "./routes/health.js";
import { orderHistoryRoutes } from "./routes/order-history.js";
import { storeRoutes } from "./routes/stores.js";
import { stylistRoutes } from "./routes/stylists.js";
import { userRoutes } from "./routes/user.js";

/**
 * Registers the shared error handler and every domain route plugin. Each plugin
 * owns one area of the API (see ./routes/*); shared schemas and helpers live in
 * ./routes/schemas.ts and ./routes/helpers.ts.
 */
export async function registerRoutes(app: FastifyInstance) {
	registerErrorHandler(app);

	await app.register(healthRoutes);
	await app.register(catalogRoutes);
	await app.register(adminRoutes);
	await app.register(userRoutes);
	await app.register(storeRoutes);
	await app.register(appointmentRoutes);
	await app.register(orderHistoryRoutes);
	await app.register(stylistRoutes);
}
