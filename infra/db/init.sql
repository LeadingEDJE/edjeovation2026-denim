CREATE TABLE IF NOT EXISTS fitting_sessions (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  height_inches INTEGER NOT NULL,
  waist_inches NUMERIC(5,2) NOT NULL,
  hip_inches NUMERIC(5,2) NOT NULL,
  inseam_inches NUMERIC(5,2) NOT NULL,
  fit_preference TEXT NOT NULL,
  stretch_preference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS denim_recommendations (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES fitting_sessions(id) ON DELETE CASCADE,
  style_name TEXT NOT NULL,
  size_label TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  rationale TEXT NOT NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scraped third-party catalog (e.g. Abercrombie women's) used as the candidate
-- pool the recommendation engine queries against. Structured columns hold the
-- fit-relevant attributes; `raw` keeps the full extracted payload so we can pull
-- more fields later without re-scraping.
CREATE TABLE IF NOT EXISTS catalog_products (
  product_id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'abercrombie',
  name TEXT NOT NULL,
  category TEXT,
  product_url TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT,
  fit TEXT,            -- normalized to fitPreference enum where derivable
  rise TEXT,           -- ultra-high | high | mid | low
  stretch TEXT,        -- normalized to stretchPreference enum where derivable
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_fit ON catalog_products (fit);
CREATE INDEX IF NOT EXISTS idx_catalog_products_rise ON catalog_products (rise);
CREATE INDEX IF NOT EXISTS idx_catalog_products_stretch ON catalog_products (stretch);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products (category);
