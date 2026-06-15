/**
 * Two-phase Abercrombie women's catalog scraper.
 *
 *   Phase 1 (PLP): for each women's category grid, scroll to load the products
 *                  and collect their product-detail URLs.
 *   Phase 2 (PDP): visit each product page, read the stable schema.org ld+json
 *                  plus on-page sizes/colors, derive fit/rise/stretch, and
 *                  upsert into the catalog_products table.
 *
 * Playwright is required because the site is behind Akamai-style bot protection
 * that blocks plain HTTP requests.
 *
 * Configuration (env):
 *   DATABASE_URL       Postgres connection (default: local Compose db)
 *   CATEGORIES         comma-separated PLP URLs; overrides auto-discovery
 *   MAX_CATEGORIES     cap number of categories crawled (default: 25)
 *   MAX_PER_CATEGORY   cap PDP visits per category (default: 40; 0 = no cap)
 *   THROTTLE_MS        delay between PDP visits (default: 750)
 *   HEADLESS           "false" to watch the browser (default: true)
 */
import { chromium, type Browser, type Page } from "playwright";
import { closeDb, countProducts, upsertProduct, type CatalogProduct } from "./db.js";
import { deriveAttributes, parseLdProduct, productIdFromUrl } from "./extract.js";

const ORIGIN = "https://www.abercrombie.com";
const WOMENS_URL = `${ORIGIN}/shop/us/womens`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const config = {
  categories: (process.env.CATEGORIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  maxCategories: intEnv("MAX_CATEGORIES", 25),
  maxPerCategory: intEnv("MAX_PER_CATEGORY", 40),
  throttleMs: intEnv("THROTTLE_MS", 750),
  headless: process.env.HEADLESS !== "false"
};

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Catalog scraper starting with config:", config);
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();
  // Skip images/fonts/media to speed up and reduce load.
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  let categories = config.categories;
  if (categories.length === 0) {
    categories = await discoverCategories(page);
    console.log(`Discovered ${categories.length} women's categories.`);
  }
  categories = categories.slice(0, config.maxCategories);

  let totalUpserted = 0;
  const seen = new Set<string>();

  for (const [i, categoryUrl] of categories.entries()) {
    const categoryName = categoryNameFromUrl(categoryUrl);
    console.log(`\n[category ${i + 1}/${categories.length}] ${categoryName} — ${categoryUrl}`);
    let productUrls: string[];
    try {
      productUrls = await collectProductUrls(page, categoryUrl);
    } catch (err) {
      console.warn(`  ! failed to load PLP: ${(err as Error).message}`);
      continue;
    }
    if (config.maxPerCategory > 0) productUrls = productUrls.slice(0, config.maxPerCategory);
    console.log(`  ${productUrls.length} products to enrich (capped at ${config.maxPerCategory || "∞"})`);

    for (const url of productUrls) {
      const id = productIdFromUrl(url);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      try {
        const product = await scrapeProduct(page, url, categoryName);
        if (product) {
          await upsertProduct(product);
          totalUpserted++;
          process.stdout.write(`  ✓ ${product.name} [${product.fit ?? "?"}/${product.rise ?? "?"}/${product.stretch ?? "?"}]\n`);
        }
      } catch (err) {
        console.warn(`  ! ${url}: ${(err as Error).message}`);
      }
      await sleep(config.throttleMs);
    }
  }

  await browser.close();
  const total = await countProducts();
  await closeDb();
  console.log(`\nDone. Upserted ${totalUpserted} products this run. catalog_products now holds ${total} rows.`);
}

/** Pull women's category PLP URLs from the landing page navigation. */
async function discoverCategories(page: Page): Promise<string[]> {
  await page.goto(WOMENS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const hrefs = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/shop/us/womens"]')) as HTMLAnchorElement[];
    return anchors.map((a) => a.getAttribute("href") ?? "");
  });
  const cats = new Set<string>();
  for (const href of hrefs) {
    if (!href) continue;
    const path = href.split("?")[0];
    // Category PLPs look like /shop/us/womens-<slug>; exclude product pages and the bare landing page.
    if (/\/shop\/us\/womens-[a-z0-9-]+$/i.test(path) && !path.includes("/p/")) {
      cats.add(new URL(path, "https://www.abercrombie.com").toString());
    }
  }
  return [...cats];
}

/** Phase 1: scroll a category page and collect unique product-detail URLs. */
async function collectProductUrls(page: Page, categoryUrl: string): Promise<string[]> {
  await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  let lastCount = 0;
  for (let i = 0; i < 12; i++) {
    const count = await page.evaluate(() => document.querySelectorAll('a[href*="/p/"]').length);
    if (count === lastCount && i > 1) break;
    lastCount = count;
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(1200);
  }
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/p/"]')).map((a) => a.getAttribute("href") ?? "")
  );
  const urls = new Set<string>();
  for (const href of hrefs) {
    if (!href) continue;
    urls.add(new URL(href.split("?")[0], "https://www.abercrombie.com").toString());
  }
  return [...urls];
}

/** Phase 2: read one PDP into a CatalogProduct. */
async function scrapeProduct(page: Page, url: string, categoryName: string): Promise<CatalogProduct | null> {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!resp || resp.status() >= 400) return null;
  await page.waitForTimeout(1200);

  const onPage = await page.evaluate(() => {
    const ldjson = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
      (s) => s.textContent ?? ""
    );

    // Sizes: A&F renders size tiles under primary (Waist) and secondary (Length)
    // groups. Tile labels are short tokens like "26", "S", "Regular". (Inline-only
    // callbacks below — named functions inside evaluate break under tsx/esbuild.)
    const sizeRe = /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,2}|short|regular|long|x-?short|x-?long|petite|tall)$/i;
    const [waist, length] = ['[data-testid="primary-size-tiles"]', '[data-testid="secondary-size-tiles"]'].map(
      (sel) => {
        const group = document.querySelector(sel) as HTMLElement | null;
        if (!group) return [] as string[];
        const tokens = group.innerText.split(/[\n\s]+/).map((s) => s.trim());
        return Array.from(new Set(tokens.filter((t) => sizeRe.test(t))));
      }
    );
    const sizes = [...waist, ...length];

    // Colors: each swatch tile carries an <img alt="<wash/color name>">.
    const colors = Array.from(
      new Set(
        Array.from(document.querySelectorAll('[data-testid="swatch-tile-group"] img[alt]'))
          .map((img) => img.getAttribute("alt") ?? "")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    return { ldjson, sizes, colors, waist, length };
  });

  const ld = parseLdProduct(onPage.ldjson);
  const name = ld?.name ?? null;
  if (!name) return null;
  const productId = productIdFromUrl(url) ?? ld?.sku ?? url;
  const description = ld?.description ?? "";
  const { fit, rise, stretch } = deriveAttributes(name, description);

  return {
    productId,
    source: "abercrombie",
    name,
    category: categoryName,
    productUrl: ld?.url ?? url,
    imageUrl: ld?.image ?? null,
    description: ld?.description ?? null,
    price: ld?.price ?? null,
    currency: ld?.currency ?? null,
    fit,
    rise,
    stretch,
    sizes: onPage.sizes,
    colors: onPage.colors,
    raw: {
      ld,
      derived: { fit, rise, stretch },
      sizes: { waist: onPage.waist, length: onPage.length },
      colors: onPage.colors,
      sourceUrl: url
    }
  };
}

function categoryNameFromUrl(url: string): string {
  const slug = url.split("?")[0].replace(/\/$/, "").split("/").pop() ?? "";
  return slug.replace(/^womens-?/, "").replace(/-/g, " ").trim() || "womens";
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => {});
  process.exit(1);
});
