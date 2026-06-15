DROP TABLE IF EXISTS denim_recommendations;
DROP TABLE IF EXISTS fitting_sessions;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  loyalty_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  occasion TEXT NOT NULL,
  focus_colors TEXT NOT NULL,
  avoid_colors TEXT NOT NULL,
  style_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  guidance TEXT NOT NULL DEFAULT '',
  session_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  muse_tag TEXT NOT NULL,
  assigned_stylist JSONB NOT NULL,
  order_history_summary JSONB NOT NULL,
  suggested_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_payload JSONB NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS session_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS suggested_products JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_status_check'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_customer_status_slot
  ON appointments (customer_id, status, slot_start);

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
