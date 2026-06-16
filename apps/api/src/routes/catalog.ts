import type { FastifyInstance } from "fastify";
import * as repository from "../repository.js";
import { catalogQuerySchema } from "../types.js";
import { mapCatalogProduct } from "./helpers.js";

export async function catalogRoutes(app: FastifyInstance) {
	app.get("/api/catalog", async (request, reply) => {
		const parsed = catalogQuerySchema.safeParse(request.query);

		if (!parsed.success) {
			return reply.code(400).send({
				message: "Invalid catalog query",
				issues: parsed.error.issues,
			});
		}

		const { fit, rise, stretch, category, catalogAudience, q, limit, offset } =
			parsed.data;
		const conditions: string[] = [];
		const params: unknown[] = [];

		const eq = (column: string, value: unknown) => {
			params.push(value);
			conditions.push(`${column} = $${params.length}`);
		};
		const like = (column: string, value: string) => {
			params.push(`%${value}%`);
			conditions.push(`${column} ILIKE $${params.length}`);
		};

		if (fit) eq("fit", fit);
		if (rise) eq("rise", rise);
		if (stretch) eq("stretch", stretch);
		if (category) like("category", category);
		if (catalogAudience) {
			params.push(catalogAudience);
			conditions.push(`catalog_audiences ? $${params.length}`);
		}
		if (q) {
			params.push(`%${q}%`);
			const i = params.length;
			conditions.push(`(name ILIKE $${i} OR description ILIKE $${i})`);
		}

		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

		const totalResult = await repository.countCatalogProducts(where, params);

		const rowsResult = await repository.selectCatalogProductsPage(
			where,
			params,
			limit,
			offset,
		);

		return {
			total: Number(totalResult.rows[0]?.count ?? 0),
			limit,
			offset,
			products: rowsResult.rows.map(mapCatalogProduct),
		};
	});

	app.get("/api/catalog/:productId", async (request, reply) => {
		const { productId } = request.params as { productId: string };
		const result = await repository.selectCatalogProductById(productId);

		if (result.rowCount === 0) {
			return reply.code(404).send({ message: "Catalog product not found" });
		}

		return { product: mapCatalogProduct(result.rows[0]) };
	});
}
