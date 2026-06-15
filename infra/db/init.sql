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
