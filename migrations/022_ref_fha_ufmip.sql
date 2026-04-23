-- Migration 022: D9d · ref_fha_ufmip reference table.
--
-- Second D9d reference table (after migration 020 / ref_conforming_baselines
-- + ref_county_loan_limits). Captures HUD's upfront FHA mortgage-insurance-
-- premium rates, which HUD publishes via mortgagee letters. Matches the
-- D9d §3 universal schema pattern: temporal versioning (effective_from /
-- effective_to), source citation, global scope, audit timestamps.
--
-- Keys per spec §4.2: (effective_from, loan_purpose, case_type).
--   loan_purpose: purchase | refinance | cashout (matches scenarios enum)
--   case_type:    standard | streamline
--
-- Seed rows reflect HUD Mortgagee Letter 2015-01 (effective 2015-01-26),
-- which set the current 1.75% upfront for all standard FHA forward
-- mortgages plus the grandfathered 0.01% streamline rate for loans
-- endorsed before 2009-06-01. These rates have been stable for a decade
-- but are encoded here so a future HUD ML ships with a new row + updated
-- effective_to on the superseded rows, no code deploy needed.
--
-- No consumer retirement in this PR — follow-up migrates pricing-v2.js
-- + fee-builder.js off the FHA_UFMIP_RATE constant in src/lib/constants/
-- fha.js. See D9d-REFERENCE-DATA-SPEC.md §7 build order.

BEGIN;

CREATE TABLE IF NOT EXISTS ref_fha_ufmip (
  id              SERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  loan_purpose    TEXT NOT NULL CHECK (loan_purpose IN ('purchase', 'refinance', 'cashout')),
  case_type       TEXT NOT NULL CHECK (case_type IN ('standard', 'streamline')),
  rate            NUMERIC(7, 6) NOT NULL,
  source          TEXT NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_purpose, case_type, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_fha_ufmip_lookup
  ON ref_fha_ufmip (loan_purpose, case_type);

CREATE INDEX IF NOT EXISTS idx_ref_fha_ufmip_effective
  ON ref_fha_ufmip (effective_from, effective_to);

INSERT INTO ref_fha_ufmip (effective_from, loan_purpose, case_type, rate, source, notes) VALUES
  ('2015-01-26', 'purchase',  'standard',   0.017500, 'HUD ML 2015-01', 'Standard FHA forward-mortgage purchase — current HUD upfront MIP'),
  ('2015-01-26', 'refinance', 'standard',   0.017500, 'HUD ML 2015-01', 'Rate-term refinance — same rate as purchase under current HUD policy'),
  ('2015-01-26', 'refinance', 'streamline', 0.000100, 'HUD ML 2015-01', 'Streamline refinance of FHA loans endorsed before 2009-06-01 (rare grandfathered case)'),
  ('2015-01-26', 'cashout',   'standard',   0.017500, 'HUD ML 2015-01', 'FHA cash-out refinance — same rate as purchase under current HUD policy')
ON CONFLICT (loan_purpose, case_type, effective_from) DO NOTHING;

COMMIT;
