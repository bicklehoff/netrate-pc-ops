-- Migration 020: D9d · reference-data schema + first tables.
--
-- Creates two reference tables per the D9d umbrella spec:
--   ref_conforming_baselines  — national FHFA baselines + high-balance
--                               ceilings (1 row per year).
--   ref_county_loan_limits    — per-county loan limits (3,235 rows per year
--                               at current FHFA coverage).
--
-- Seeding of the 2026 dataset happens in the companion runner script
-- (_run-migration-020.mjs) which reads the existing src/data/county-loan-
-- limits.js file and writes each county + baseline row. The JS data file
-- stays in place for now; a follow-up PR migrates runtime consumers off
-- the file and then deletes it.
--
-- Per D9d §3 universal schema pattern: every row carries effective_from /
-- effective_to for temporal versioning, a source citation, and audit
-- timestamps. UNIQUE constraint is (scope keys, effective_from) so we can
-- supersede by inserting a new row + updating the old effective_to.
--
-- See Work/Dev/audits/D9d-REFERENCE-DATA-SPEC.md for the full umbrella.

BEGIN;

CREATE TABLE IF NOT EXISTS ref_conforming_baselines (
  id                          SERIAL PRIMARY KEY,
  effective_from              DATE NOT NULL,
  effective_to                DATE NULL,
  baseline_1unit              INT NOT NULL,
  baseline_2unit              INT NOT NULL,
  baseline_3unit              INT NOT NULL,
  baseline_4unit              INT NOT NULL,
  high_balance_ceiling_1unit  INT NOT NULL,
  high_balance_ceiling_2unit  INT NOT NULL,
  high_balance_ceiling_3unit  INT NOT NULL,
  high_balance_ceiling_4unit  INT NOT NULL,
  source                      TEXT NOT NULL,
  notes                       TEXT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_conforming_baselines_effective
  ON ref_conforming_baselines (effective_from, effective_to);

CREATE TABLE IF NOT EXISTS ref_county_loan_limits (
  id                SERIAL PRIMARY KEY,
  effective_from    DATE NOT NULL,
  effective_to      DATE NULL,
  state             TEXT NOT NULL,
  county_fips       TEXT NOT NULL,
  county_name       TEXT NOT NULL,
  county_name_norm  TEXT NOT NULL,
  limit_1unit       INT NOT NULL,
  limit_2unit       INT NOT NULL,
  limit_3unit       INT NOT NULL,
  limit_4unit       INT NOT NULL,
  is_high_cost      BOOLEAN NOT NULL,
  source            TEXT NOT NULL,
  notes             TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state, county_fips, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_county_loan_limits_state_norm
  ON ref_county_loan_limits (state, county_name_norm);
CREATE INDEX IF NOT EXISTS idx_ref_county_loan_limits_fips
  ON ref_county_loan_limits (county_fips);
CREATE INDEX IF NOT EXISTS idx_ref_county_loan_limits_effective
  ON ref_county_loan_limits (effective_from, effective_to);

COMMIT;
