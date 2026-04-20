-- Migration 010: site_scenarios + surface_pricing_config (D9b.5 + D9b.6)
-- Date: 2026-04-20
-- Part of FoH April (D9b pricing unification — migration path §7 PR 5 + 6)
--
-- DESIGN: Two additive tables that replace hardcoded constants in code.
--
--   site_scenarios         — named default scenarios per surface (replaces
--                            the DEFAULT_SCENARIO constant in
--                            src/lib/rates/defaults.js). One row per surface
--                            that has a canonical default; initial seed
--                            matches the DEFAULT_SCENARIO values exactly
--                            so homepage output is unchanged at rollout.
--
--   surface_pricing_config — per-surface filter flags (replaces the
--                            hardcoded exclude* kwargs passed inline in
--                            src/lib/rates/homepage.js). Initial seed
--                            matches homepage.js's current kwargs exactly.
--
-- Code changes (separate PR, shipping alongside):
--   - DAL: src/lib/rates/site-scenario-config.js
--   - homepage.js reads from DB instead of DEFAULT_SCENARIO + kwargs
--   - DAL gracefully falls back to DEFAULT_SCENARIO + hardcoded config
--     if the DB read fails, so code is deploy-safe BEFORE this migration
--     runs (no runtime dependency on the migration being applied first)
--
-- ROLLBACK:
--   DROP TABLE surface_pricing_config;
--   DROP TABLE site_scenarios;
--
-- Run: node scripts/_run-migration-010.mjs

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- site_scenarios — named default scenarios
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_scenarios (
  slug            TEXT PRIMARY KEY,
  description     TEXT,
  loan_amount     NUMERIC NOT NULL,
  property_value  NUMERIC NOT NULL,
  fico            INT NOT NULL,
  loan_purpose    TEXT NOT NULL,     -- 'purchase' | 'refinance' | 'cashout'
  property_type   TEXT NOT NULL DEFAULT 'sfr',
  state           TEXT NOT NULL,
  lock_days       INT NOT NULL DEFAULT 30,
  term            INT NOT NULL DEFAULT 30,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: homepage_default matches src/lib/rates/defaults.js DEFAULT_SCENARIO
INSERT INTO site_scenarios (
  slug, description, loan_amount, property_value, fico,
  loan_purpose, property_type, state, lock_days, term
) VALUES (
  'homepage_default',
  'Homepage hero default — matches MND baseline (780 FICO, 75 LTV, purchase, CO)',
  400000, 533334, 780, 'purchase', 'sfr', 'CO', 30, 30
) ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- surface_pricing_config — per-surface filter flags
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surface_pricing_config (
  surface               TEXT PRIMARY KEY,
  borrower_paid         BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_streamline    BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_interest_only BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_high_balance  BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_buydowns      BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_jumbo         BOOLEAN NOT NULL DEFAULT FALSE,
  product_types         TEXT[] NOT NULL DEFAULT ARRAY['fixed'],
  occupancies           TEXT[] NOT NULL DEFAULT ARRAY['primary'],
  tiers_allowed         TEXT[],    -- NULL = all tiers
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: homepage matches the kwargs passed in src/lib/rates/homepage.js today.
-- borrower_paid=FALSE because priceScenario reads per-lender LPC comp from
-- rate_lenders and deducts it — NOT setting borrowerPaid=true — that is
-- already the public-display behavior per PR #107.
INSERT INTO surface_pricing_config (
  surface, borrower_paid,
  exclude_streamline, exclude_interest_only, exclude_high_balance, exclude_buydowns, exclude_jumbo,
  product_types, occupancies
) VALUES (
  'homepage',
  FALSE,
  TRUE, TRUE, TRUE, FALSE, TRUE,
  ARRAY['fixed'],
  ARRAY['primary']
) ON CONFLICT (surface) DO NOTHING;

-- Reserve a default config row for future rate-watch hero strip, mlo pricer,
-- and tool surfaces — these surfaces currently run with no exclusions but
-- having the row means they can be tuned without a deploy when they move
-- onto the DAL.
INSERT INTO surface_pricing_config (surface, borrower_paid)
VALUES ('rate_watch', FALSE)
ON CONFLICT (surface) DO NOTHING;

INSERT INTO surface_pricing_config (surface, borrower_paid)
VALUES ('mlo_pricer', FALSE)
ON CONFLICT (surface) DO NOTHING;

COMMIT;
