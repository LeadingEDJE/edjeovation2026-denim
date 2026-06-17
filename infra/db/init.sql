DROP TABLE IF EXISTS denim_recommendations;
DROP TABLE IF EXISTS fitting_sessions;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  loyalty_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  store_snapshot JSONB NOT NULL DEFAULT '{"storeId":"anf_soho_001","name":"Abercrombie & Fitch SoHo","city":"New York","state":"NY","address":"547 Broadway, New York, NY 10012","phone":"+1 212-625-0868","timezone":"America/New_York"}'::jsonb,
  occasion TEXT NOT NULL,
  focus_colors TEXT NOT NULL,
  avoid_colors TEXT NOT NULL,
  style_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  catalog_audiences JSONB NOT NULL DEFAULT '["womens"]'::jsonb,
  guidance TEXT NOT NULL DEFAULT '',
  session_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show')),
  muse_tag TEXT NOT NULL,
  assigned_stylist JSONB NOT NULL,
  order_history_summary JSONB NOT NULL,
  suggested_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Tracks async suggestion generation: 'pending' while the recommender runs in
  -- the background after booking, 'ready' once stored, 'failed' on error.
  suggestions_status TEXT NOT NULL DEFAULT 'ready' CHECK (suggestions_status IN ('pending', 'ready', 'failed')),
  source_payload JSONB NOT NULL,
  -- Text-only analysis of an outfit the customer wants to build around (from a
  -- photo or typed manually). Nullable; the photo itself is never stored.
  outfit_analysis JSONB,
  checked_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  cancel_reason TEXT,
  customer_recap TEXT NOT NULL DEFAULT '',
  associate_feedback TEXT NOT NULL DEFAULT '',
  customer_feedback_rating INTEGER CHECK (customer_feedback_rating BETWEEN 1 AND 5),
  customer_feedback_comment TEXT NOT NULL DEFAULT '',
  customer_feedback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS store_snapshot JSONB NOT NULL DEFAULT '{"storeId":"anf_soho_001","name":"Abercrombie & Fitch SoHo","city":"New York","state":"NY","address":"547 Broadway, New York, NY 10012","phone":"+1 212-625-0868","timezone":"America/New_York"}'::jsonb;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS session_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_recap TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS associate_feedback TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_feedback_rating INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_feedback_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_feedback_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS suggested_products JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS suggestions_status TEXT NOT NULL DEFAULT 'ready' CHECK (suggestions_status IN ('pending', 'ready', 'failed'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS outfit_analysis JSONB;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS catalog_audiences JSONB NOT NULL DEFAULT '["womens"]'::jsonb;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_customer_feedback_rating_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_status_check'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_status_check CHECK (status IN ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_customer_feedback_rating_check'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_customer_feedback_rating_check
      CHECK (customer_feedback_rating IS NULL OR customer_feedback_rating BETWEEN 1 AND 5);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_customer_status_slot
  ON appointments (customer_id, status, slot_start);
CREATE INDEX IF NOT EXISTS idx_appointments_store_slot
  ON appointments ((store_snapshot->>'storeId'), slot_start);

CREATE TABLE IF NOT EXISTS appointment_messages (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'associate')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_messages_appointment_created
  ON appointment_messages (appointment_id, created_at);

CREATE TABLE IF NOT EXISTS appointment_notifications (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('confirmation', 'reminder')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_notifications_appointment
  ON appointment_notifications (appointment_id, type);

CREATE TABLE IF NOT EXISTS customer_fit_profile_overrides (
  customer_id TEXT PRIMARY KEY,
  measurements JSONB NOT NULL,
  preferences JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scraped third-party catalog (e.g. Abercrombie womens/mens) used as the candidate
-- pool the recommendation engine queries against. Structured columns hold the
-- fit-relevant attributes; `raw` keeps the full extracted payload so we can pull
-- more fields later without re-scraping.
CREATE TABLE IF NOT EXISTS catalog_products (
  product_id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'abercrombie',
  name TEXT NOT NULL,
  category TEXT,
  catalog_audiences JSONB NOT NULL DEFAULT '["womens"]'::jsonb,
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
  -- Structured visual style cues read from the product image by a vision model
  -- (summary + silhouette/pattern/wash/details/formality/styleKeywords). NULL
  -- until the image-analysis backfill (apps/api: npm run analyze:images) runs.
  -- Fed to the recommender so selections weigh how a garment actually looks.
  image_analysis JSONB,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS catalog_audiences JSONB NOT NULL DEFAULT '["womens"]'::jsonb;
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS image_analysis JSONB;

CREATE INDEX IF NOT EXISTS idx_catalog_products_fit ON catalog_products (fit);
CREATE INDEX IF NOT EXISTS idx_catalog_products_rise ON catalog_products (rise);
CREATE INDEX IF NOT EXISTS idx_catalog_products_stretch ON catalog_products (stretch);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products (category);
CREATE INDEX IF NOT EXISTS idx_catalog_products_catalog_audiences ON catalog_products USING GIN (catalog_audiences);
