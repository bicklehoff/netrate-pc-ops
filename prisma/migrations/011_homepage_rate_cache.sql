-- Migration 011: homepage_rate_cache (D9b.7)
-- Date: 2026-04-20
-- Part of FoH April (D9b pricing unification — migration path §7 PR 7)
--
-- DESIGN: Last-known-good cache for homepage rate card. Each row is one
-- (scenario × loan_type × term) combo; homepage writes on every
-- successful live compute and reads only when the live compute fails.
--
-- Replaces the hardcoded '5.875% / 5.94% / $2,366 / Mar 24, 2026 / ...'
-- fallback literals in src/app/page.js:57-67. Those strings were ~3
-- weeks stale the moment the homepage was last deployed; if the DB or
-- pricer ever went down for more than 30 minutes (ISR TTL), borrowers
-- would silently see rates from the deploy date with no warning. The
-- cache table fixes that by persisting the most recent successful
-- output, so fallback is yesterday's par rate, not a hardcoded string.
--
-- Fallback chain going forward:
--   1. Live priceScenario → write cache + return results
--   2. Live fails → read cache → return last-known-good
--   3. Cache also empty → page.js null state ("rates temporarily
--      unavailable") — no more stale hardcoded strings
--
-- Rollback: DROP TABLE homepage_rate_cache;
--
-- Run: node scripts/_run-migration-011.mjs

BEGIN;

CREATE TABLE IF NOT EXISTS homepage_rate_cache (
  scenario_slug   TEXT NOT NULL,
  loan_type       TEXT NOT NULL,
  term            INT  NOT NULL,
  rate            NUMERIC NOT NULL,
  apr             NUMERIC,
  monthly_pi      INT,
  final_price     NUMERIC,
  lender          TEXT,
  effective_date  DATE NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scenario_slug, loan_type, term),
  FOREIGN KEY (scenario_slug) REFERENCES site_scenarios(slug) ON DELETE CASCADE
);

-- Note: avoid semicolons inside string literals — the migration runner's
-- statement splitter cuts on top-level `;` and would misparse a COMMENT
-- ON TABLE string containing one. Describe the table in this comment
-- block instead of adding a COMMENT ON TABLE statement.
--
-- homepage_rate_cache: last-known-good homepage rate rows. Written by
-- the homepage DAL on every successful live compute — read on failure.
-- Retires the hardcoded fallback literals in src/app/page.js. See D9b.7.

COMMIT;
