import pg from "pg";

const databaseUrl =
	process.env.DATABASE_URL ?? "postgres://denim:denim@localhost:5432/denim_fit";

export const pool = new pg.Pool({ connectionString: databaseUrl });

export type CatalogProduct = {
	productId: string;
	source: string;
	name: string;
	category: string | null;
	catalogAudiences: string[];
	productUrl: string;
	imageUrl: string | null;
	description: string | null;
	price: number | null;
	currency: string | null;
	fit: string | null;
	rise: string | null;
	stretch: string | null;
	sizes: string[];
	colors: string[];
	raw: unknown;
};

/** Insert or update a product by its stable product_id. */
export async function upsertProduct(p: CatalogProduct): Promise<void> {
	await pool.query(
		`INSERT INTO catalog_products
       (product_id, source, name, category, catalog_audiences, product_url, image_url, description,
        price, currency, fit, rise, stretch, sizes, colors, raw, scraped_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb, now())
     ON CONFLICT (product_id) DO UPDATE SET
       source = EXCLUDED.source,
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       catalog_audiences = (
         SELECT jsonb_agg(value ORDER BY value)
         FROM (
           SELECT DISTINCT value
           FROM jsonb_array_elements_text(catalog_products.catalog_audiences || EXCLUDED.catalog_audiences) AS merged(value)
         ) deduped
       ),
       product_url = EXCLUDED.product_url,
       image_url = EXCLUDED.image_url,
       description = EXCLUDED.description,
       price = EXCLUDED.price,
       currency = EXCLUDED.currency,
       fit = EXCLUDED.fit,
       rise = EXCLUDED.rise,
       stretch = EXCLUDED.stretch,
       sizes = EXCLUDED.sizes,
       colors = EXCLUDED.colors,
       raw = EXCLUDED.raw,
       scraped_at = now()`,
		[
			p.productId,
			p.source,
			p.name,
			p.category,
			JSON.stringify(p.catalogAudiences),
			p.productUrl,
			p.imageUrl,
			p.description,
			p.price,
			p.currency,
			p.fit,
			p.rise,
			p.stretch,
			JSON.stringify(p.sizes),
			JSON.stringify(p.colors),
			JSON.stringify(p.raw),
		],
	);
}

export async function countProducts(): Promise<number> {
	const { rows } = await pool.query<{ count: string }>(
		"SELECT count(*)::text AS count FROM catalog_products",
	);
	return Number(rows[0]?.count ?? 0);
}

export async function productIdsForAudience(
	audience: string,
): Promise<string[]> {
	const { rows } = await pool.query<{ product_id: string }>(
		"SELECT product_id FROM catalog_products WHERE catalog_audiences ? $1",
		[audience],
	);
	return rows.map((row) => row.product_id);
}

export async function closeDb(): Promise<void> {
	await pool.end();
}
