/**
 * Site-structure reconnaissance utility (dev tool, not part of the scrape).
 *
 * Loads a single Abercrombie page in a real browser and reports where its data
 * lives, so we can keep the scraper's selectors/parsers up to date when the site
 * changes. It prints: JSON network endpoints, the schema.org ld+json blocks, and
 * the size/swatch selector markup. It does NOT write to the database.
 *
 * Usage:
 *   URL="https://www.abercrombie.com/shop/us/womens-jeans" npm run recon   # a PLP
 *   URL="https://www.abercrombie.com/shop/us/p/<slug>-<id>" npm run recon   # a PDP
 *
 * With no URL it loads the jeans PLP and follows its first product to a PDP.
 */
import { chromium, type Page, type Response } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function inspect(page: Page, url: string, jsonResponses: { url: string; bytes: number }[]) {
  console.log(`\n=== ${url} ===`);
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log(`status: ${resp?.status()}  title: ${await page.title()}`);
  await page.waitForTimeout(3500);

  const productAnchors = await page.evaluate(() => document.querySelectorAll('a[href*="/p/"]').length);
  console.log(`product anchors: ${productAnchors}`);

  const ldjson = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => {
      try {
        const o = JSON.parse(s.textContent ?? "");
        return Array.isArray(o) ? o.map((x) => x["@type"]).join(",") : (o["@type"] ?? "?");
      } catch {
        return "(unparseable)";
      }
    })
  );
  console.log(`ld+json blocks: [${ldjson.join(", ")}]`);

  const markup = await page.evaluate(() => {
    const ids = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("[data-testid]"))) {
      const id = el.getAttribute("data-testid") ?? "";
      if (/size|swatch|color|length|waist|price/i.test(id)) ids.add(id);
    }
    return [...ids].sort();
  });
  console.log(`fit-relevant data-testids: ${markup.join(", ") || "(none)"}`);

  if (jsonResponses.length) {
    console.log("largest abercrombie.com/api JSON responses:");
    for (const r of jsonResponses.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
      console.log(`  ${r.bytes.toString().padStart(8)}b  ${r.url.slice(0, 100)}`);
    }
  }
  return productAnchors;
}

async function main() {
  const startUrl = process.env.URL ?? "https://www.abercrombie.com/shop/us/womens-jeans";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();

  const jsonResponses: { url: string; bytes: number }[] = [];
  page.on("response", async (response: Response) => {
    const url = response.url();
    if (!url.includes("abercrombie.com/api/")) return;
    if (!(response.headers()["content-type"] ?? "").includes("json")) return;
    try {
      jsonResponses.push({ url, bytes: (await response.text()).length });
    } catch {
      /* ignore */
    }
  });

  const anchors = await inspect(page, startUrl, jsonResponses);

  // If we landed on a PLP, follow the first product to show PDP structure too.
  if (!startUrl.includes("/p/") && anchors > 0) {
    const href = await page.evaluate(() => document.querySelector('a[href*="/p/"]')?.getAttribute("href") ?? null);
    if (href) {
      jsonResponses.length = 0;
      await inspect(page, new URL(href, "https://www.abercrombie.com").toString(), jsonResponses);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
