# @denim-fit/scraper

Experimental scraper that builds the candidate product pool the recommendation
engine queries against. It crawls the Abercrombie **womens and/or mens**
catalogs and upserts products into the `catalog_products` table.

Abercrombie sits behind Akamai-style bot protection that `403`s plain HTTP
requests, so this uses **Playwright** (a real headless browser). The scraper is a
host-run dev tool — it talks to the Compose Postgres on `localhost:5432`; it is
not part of the Dockerized app runtime.

## Setup

```sh
npm install                      # from repo root (installs the workspace)
npx playwright install chromium  # one-time: download the browser
```

The `catalog_products` table is created by `infra/db/init.sql`. If the Compose
stack is already running, apply it with `npm run db:migrate` from the repo root.

## Run

```sh
# From apps/scraper. Defaults: womens auto-discovery, 40 products/category.
npm run scrape
```

### Configuration (env vars)

| Var | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://denim:denim@localhost:5432/denim_fit` | Postgres connection |
| `CATALOG_AUDIENCES` | `womens` | Comma-separated catalog audiences to scrape: `womens`, `mens`, or both |
| `CATEGORIES` | _(auto-discover)_ | Comma-separated PLP URLs; overrides discovery |
| `MAX_CATEGORIES` | `25` | Cap number of categories crawled |
| `MAX_PER_CATEGORY` | `40` | Cap PDP visits per category (`0` = no cap → full crawl) |
| `THROTTLE_MS` | `750` | Delay between product-page visits |
| `HEADLESS` | `true` | Set `false` to watch the browser |

```sh
# Examples
CATEGORIES="https://www.abercrombie.com/shop/us/womens-jeans" MAX_PER_CATEGORY=10 npm run scrape
CATALOG_AUDIENCES=mens MAX_PER_CATEGORY=10 npm run scrape
CATALOG_AUDIENCES=womens,mens MAX_PER_CATEGORY=0 npm run scrape
MAX_PER_CATEGORY=0 npm run scrape   # full catalog (slow — potentially hours)
```

## How it works

1. **Discover** category PLP URLs from each configured landing-page navigation.
2. **Phase 1 (PLP):** scroll each category grid and collect product-detail URLs.
3. **Phase 2 (PDP):** read the stable schema.org `ld+json` Product block plus the
   on-page size/swatch markup, **derive** `fit` / `rise` / `stretch` from the name
   and description (see `extract.ts`), and **upsert** by `product_id`.

Derivation is keyword-based, so it is accurate on denim/bottoms and
intentionally leaves attributes `NULL` where they don't apply. Products also
carry `catalog_audiences` (`womens`, `mens`, or both) so recommendation calls can
scope candidates by the customer's per-booking catalog choice. The full
extracted payload is kept in the `raw` JSONB column so fields can be re-derived
later without re-scraping.

## Files

- `src/scrape.ts` — two-phase crawl + DB upsert (the main entrypoint)
- `src/extract.ts` — pure parsing/normalization helpers (`deriveAttributes`, `parseLdProduct`, …)
- `src/db.ts` — Postgres pool and `upsertProduct`
- `src/recon.ts` — `npm run recon` dev tool to inspect a page's structure when the site changes

## Notes

This scrapes a third-party commercial site for an experiment; review Abercrombie's
terms of use before running at scale, and keep `THROTTLE_MS` polite.
