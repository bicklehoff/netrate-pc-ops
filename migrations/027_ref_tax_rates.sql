-- Migration 027: D9d · ref_state_tax_rates + ref_county_tax_rates.
--
-- Two related D9d §4.4 tables bundled: state-level effective property
-- tax rate averages (seeded 50 states + DC), and county-level rates
-- (empty schema — populated as real data comes in). Same pattern as
-- migration 023 (va_funding_fee) for county_tax_rates — schema ships
-- now, data lands when sourced from county assessor records.
--
-- State seed sources src/data/county-tax-rates.js (US Census Bureau +
-- Tax Foundation estimates). Note: this file's values differ from
-- src/components/RefinanceCalc/shared.js (which has its own
-- handpicked 4-state rates that diverge from Census Bureau figures).
-- The DB is now canonical; the RefinanceCalc drift is flagged as a
-- follow-up finding — not reconciled in this migration to avoid
-- conflating D9d ref-data work with calculator UX changes.
--
-- Schema follows D9d §3 universal pattern. Both tables use bps
-- (rate × 10000, e.g. 0.0071 → 71 bps = 0.71%) for exact-match
-- storage; NUMERIC scale handles the decimals in display callers.

BEGIN;

-- ─── ref_state_tax_rates ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_state_tax_rates (
  id              SERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  state           TEXT NOT NULL,
  rate            NUMERIC(7, 6) NOT NULL CHECK (rate >= 0 AND rate <= 0.1),
  source          TEXT NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_state_tax_rates_lookup
  ON ref_state_tax_rates (state);

CREATE INDEX IF NOT EXISTS idx_ref_state_tax_rates_effective
  ON ref_state_tax_rates (effective_from, effective_to);

INSERT INTO ref_state_tax_rates (effective_from, state, rate, source, notes) VALUES
  ('2026-01-01', 'AL', 0.004000, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'AK', 0.011900, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'AZ', 0.006200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'AR', 0.006200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'CA', 0.007100, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'CO', 0.005100, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'CT', 0.019800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'DE', 0.005700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'DC', 0.005600, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'FL', 0.008900, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'GA', 0.009200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'HI', 0.002800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'ID', 0.006300, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'IL', 0.019700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'IN', 0.008500, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'IA', 0.015700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'KS', 0.014100, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'KY', 0.008300, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'LA', 0.005500, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'ME', 0.013000, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MD', 0.009900, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MA', 0.011200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MI', 0.015400, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MN', 0.010700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MS', 0.006500, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MO', 0.009700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'MT', 0.007400, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NE', 0.016300, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NV', 0.005300, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NH', 0.018600, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NJ', 0.024000, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NM', 0.006800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NY', 0.014600, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'NC', 0.007700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'ND', 0.009800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'OH', 0.015700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'OK', 0.009000, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'OR', 0.009000, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'PA', 0.015300, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'RI', 0.013600, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'SC', 0.005700, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'SD', 0.012200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'TN', 0.006400, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'TX', 0.016800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'UT', 0.005800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'VT', 0.018200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'VA', 0.008200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'WA', 0.009200, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'WV', 0.005800, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'WI', 0.016100, 'US Census Bureau / Tax Foundation estimate', NULL),
  ('2026-01-01', 'WY', 0.005700, 'US Census Bureau / Tax Foundation estimate', NULL)
ON CONFLICT (state, effective_from) DO NOTHING;

-- ─── ref_county_tax_rates ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_county_tax_rates (
  id              SERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  state           TEXT NOT NULL,
  county_fips     TEXT NOT NULL,
  county_name     TEXT NOT NULL,
  rate            NUMERIC(7, 6) NOT NULL CHECK (rate >= 0 AND rate <= 0.1),
  is_placeholder  BOOLEAN NOT NULL DEFAULT FALSE,
  source          TEXT NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state, county_fips, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_county_tax_rates_lookup
  ON ref_county_tax_rates (state, county_fips);

CREATE INDEX IF NOT EXISTS idx_ref_county_tax_rates_effective
  ON ref_county_tax_rates (effective_from, effective_to);

-- No seed — spec §4.4 notes `is_placeholder` marks state-avg stubs
-- until real county-assessor data lands. DAL falls back to state-avg
-- when no county row exists, so empty-schema ship is safe.

COMMIT;
