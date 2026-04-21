-- Migration 025: D9d · HECM scalar reference tables.
--
-- Three tables from D9d spec §4.2 / §4.3, each of which holds a single
-- scalar value (or single row per effective period). Grouped into one
-- migration because they share a cadence (HUD mortgagee letters + FHA
-- annual MCA announcement) and follow identical schema shape —
-- effective_from / effective_to + rate/amount + source. Separate
-- tables per spec to preserve the natural one-table-per-concept
-- granularity; one PR to avoid 3 rounds of migration deploy ceremony
-- for truly trivial additions.
--
-- Tables:
--   ref_hecm_limits       — HUD HECM Maximum Claim Amount (MCA, national)
--   ref_hecm_ufmip        — HECM upfront MIP rate (2% of MCA under current policy)
--   ref_hecm_annual_mip   — HECM annual MIP rate (0.50% under current policy)
--
-- Seed values mirror src/lib/hecm/constants.js exactly — no silent
-- behavior change on ship. A follow-up PR migrates HECM pricing
-- consumers (rate-sheet.js, plf-table.js, etc.) off the constants
-- onto the DAL. Out of scope here: ref_hecm_plf (~4,800 rows —
-- own PR), ref_hecm_pricing (rate-sheet pipeline — own PR),
-- ref_lender_corrections (FOA correction — deferred per spec §4.3).

BEGIN;

-- ─── ref_hecm_limits ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_hecm_limits (
  id                 SERIAL PRIMARY KEY,
  effective_from     DATE NOT NULL,
  effective_to       DATE NULL,
  max_claim_amount   INT NOT NULL,
  source             TEXT NOT NULL,
  notes              TEXT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_hecm_limits_effective
  ON ref_hecm_limits (effective_from, effective_to);

INSERT INTO ref_hecm_limits (effective_from, max_claim_amount, source, notes) VALUES
  ('2025-01-01', 1209750, 'HUD HECM MCA 2025', 'Mirrors DEFAULT_FHA_LIMIT in src/lib/hecm/constants.js. Flag: verify against latest HUD HECM ML — value may need 2026 refresh.')
ON CONFLICT (effective_from) DO NOTHING;

-- ─── ref_hecm_ufmip ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_hecm_ufmip (
  id              SERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  rate            NUMERIC(7, 6) NOT NULL,
  source          TEXT NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_hecm_ufmip_effective
  ON ref_hecm_ufmip (effective_from, effective_to);

INSERT INTO ref_hecm_ufmip (effective_from, rate, source, notes) VALUES
  ('2017-10-02', 0.020000, 'HUD ML 2017-12', 'HECM upfront MIP set at 2% of MCA per HUD Mortgagee Letter 2017-12 (effective 2017-10-02). Supersedes the former tiered 0.5% / 2.5% schedule.')
ON CONFLICT (effective_from) DO NOTHING;

-- ─── ref_hecm_annual_mip ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_hecm_annual_mip (
  id              SERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  rate            NUMERIC(7, 6) NOT NULL,
  source          TEXT NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_hecm_annual_mip_effective
  ON ref_hecm_annual_mip (effective_from, effective_to);

INSERT INTO ref_hecm_annual_mip (effective_from, rate, source, notes) VALUES
  ('2017-10-02', 0.005000, 'HUD ML 2017-12', 'HECM annual MIP set at 0.50% of outstanding balance per HUD Mortgagee Letter 2017-12 (effective 2017-10-02). Supersedes the former 1.25% schedule.')
ON CONFLICT (effective_from) DO NOTHING;

COMMIT;
