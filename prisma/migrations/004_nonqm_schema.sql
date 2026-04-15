-- Migration: Non-QM Pricing Schema
-- Date: 2026-04-15
-- Purpose: Foundation for DSCR / Bank Statement / ITIN / Asset Depletion / Foreign National
--          pricing. Completely separate from the forward (conventional/FHA/VA/USDA) engine
--          because Non-QM products have their own rate sheets, LLPA structures, MCR
--          classification, update cadence (weekly vs daily), and UI flows.
--
-- This migration is ADDITIVE ONLY — no behavior change until the parser (PR 15b) and
-- pricer (PR 15c) land. Safe to roll back by dropping the new tables.
--
-- Run: node scripts/_run-migration-004.mjs

BEGIN;

-- ─── 1. nonqm_rate_sheets — one row per lender sheet upload ─────────
-- Gives us history, rollback, and "which sheet is live right now?" queries.
-- A single logical sheet may span multiple source files (e.g. Everstream ships
-- rates in CSV and LLPAs in XLSX — both belong to the same effective_at).

CREATE TABLE IF NOT EXISTS nonqm_rate_sheets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_code     TEXT NOT NULL,                  -- 'everstream', 'swmc', 'tls', ...
  effective_at    TIMESTAMPTZ NOT NULL,           -- parsed from source file release time
  source_files    TEXT[] NOT NULL DEFAULT '{}',   -- ['96573_...csv', '96596_...xlsx']
  product_count   INTEGER DEFAULT 0,
  llpa_count      INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE, -- only one active sheet per lender at a time
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (lender_code, effective_at)
);

CREATE INDEX IF NOT EXISTS idx_nonqm_rate_sheets_active
  ON nonqm_rate_sheets (lender_code) WHERE is_active = TRUE;

-- ─── 2. nonqm_rate_products — flat (product × lock × rate) → price ──
-- One row per pricing tuple. The rate sheet CSV explodes into this table 1:1.
-- No FICO, LTV, property type, etc. here — those are LLPAs (next table).

CREATE TABLE IF NOT EXISTS nonqm_rate_products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id       UUID NOT NULL REFERENCES nonqm_rate_sheets(id) ON DELETE CASCADE,
  lender_code         TEXT NOT NULL,
  loan_type           TEXT NOT NULL CHECK (loan_type IN (
                        'dscr', 'bankstatement', 'pnl', '1099',
                        'full_doc_nonqm', 'asset_depletion', 'itin', 'foreign_national'
                      )),
  tier                TEXT NOT NULL,                  -- 'core' | 'elite_1' | 'elite_2' | 'elite_5' | etc.
  product_type        TEXT NOT NULL CHECK (product_type IN ('fixed', 'arm')),
  term                INTEGER NOT NULL,               -- 15, 30, 40
  arm_fixed_period    INTEGER,                        -- 3, 5, 7, 10 (NULL for fixed)
  arm_adj_period      INTEGER,                        -- 6 months (Everstream standard)
  lock_days           INTEGER NOT NULL,               -- 15, 30, 45, 60, 75
  note_rate           NUMERIC(6,3) NOT NULL,          -- 7.250
  final_base_price    NUMERIC(9,6) NOT NULL,          -- 103.800740 (preserve 6dp from source)
  raw_product_name    TEXT,                           -- audit: "DSCR Rate Sheet1 30 Yr. Fixed Elite"
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast pricing lookup: given a tier + type + term + ARM period + lock, get rate ladder
CREATE INDEX IF NOT EXISTS idx_nonqm_products_lookup
  ON nonqm_rate_products (rate_sheet_id, lender_code, loan_type, tier, product_type,
                          term, arm_fixed_period, lock_days, note_rate);

-- ─── 3. nonqm_adjustment_rules — LLPAs + price caps ─────────────────
-- One row per LLPA entry. Wide-but-sparse: each rule_type populates only the
-- condition columns it cares about. NULL = "don't care / applies to any".
--
-- rule_type values:
--   'fico_cltv_grid' — stacked FICO x CLTV grid (fixed/arm, occupancy, purpose)
--   'property_type'  — SFR/PUD/Condo/Non-Warr Condo/2-4 unit/Coop/Townhome
--   'loan_size'      — $ bands
--   'dscr_ratio'     — DSCR ratio bands
--   'prepay'         — 0..5 year prepay options (may adjust llpa AND price_cap)
--   'state_srp'      — Service Release Premium by state
--   'feature'        — IO, 40yr term, short-term rental, escrow waiver, etc.
--   'doc_type'       — bank stmt 12m/24m, 1099, P&L, full doc, alt doc
--   'credit_event'   — 1x30x12, etc.

CREATE TABLE IF NOT EXISTS nonqm_adjustment_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id       UUID NOT NULL REFERENCES nonqm_rate_sheets(id) ON DELETE CASCADE,
  lender_code         TEXT NOT NULL,
  tier                TEXT NOT NULL,                  -- matches nonqm_rate_products.tier
  product_type        TEXT CHECK (product_type IN ('fixed', 'arm')),   -- NULL = applies to both
  rule_type           TEXT NOT NULL,

  -- Match conditions (any column NULL = "don't care")
  occupancy           TEXT,                           -- 'primary' | 'second' | 'noo'
  loan_purpose        TEXT,                           -- 'purchase' | 'nco_refi' | 'co_refi'
  fico_min            INTEGER,
  fico_max            INTEGER,
  cltv_min            NUMERIC(5,2),
  cltv_max            NUMERIC(5,2),
  property_type       TEXT,                           -- 'sfr'|'pud'|'condo'|'nonwarr_condo'|'2unit'|...
  loan_size_min       NUMERIC(12,2),
  loan_size_max       NUMERIC(12,2),
  dscr_ratio_min      NUMERIC(5,3),
  dscr_ratio_max      NUMERIC(5,3),
  prepay_years        INTEGER CHECK (prepay_years BETWEEN 0 AND 5),
  state               CHAR(2),
  doc_type            TEXT,
  feature             TEXT,                           -- 'io'|'40yr_term'|'short_term_rental'|...

  -- Payload
  llpa_points         NUMERIC(6,3),                   -- signed; added to base price
  price_cap           NUMERIC(6,3),                   -- max allowed final price (if set)
  not_offered         BOOLEAN NOT NULL DEFAULT FALSE, -- "na" in source → product gated off

  raw_label           TEXT,                           -- audit: source cell label
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary pricer query: rules for a given sheet/tier/product
CREATE INDEX IF NOT EXISTS idx_nonqm_rules_lookup
  ON nonqm_adjustment_rules (rate_sheet_id, tier, product_type, rule_type);

-- Fast FICO×CLTV grid lookup (the hottest path)
CREATE INDEX IF NOT EXISTS idx_nonqm_rules_grid
  ON nonqm_adjustment_rules (rate_sheet_id, tier, product_type, occupancy, loan_purpose,
                             fico_min, cltv_min)
  WHERE rule_type = 'fico_cltv_grid';

-- ─── 4. New columns on scenarios ────────────────────────────────────
-- Non-QM inputs that the forward engine doesn't need. Most are already present
-- (dscr_ratio, monthly_rent, unit_count) — add only the missing ones.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS product_family TEXT
    CHECK (product_family IN ('forward', 'nonqm', 'reverse')),
  ADD COLUMN IF NOT EXISTS nonqm_tier TEXT,              -- 'core' | 'elite_1' | ...
  ADD COLUMN IF NOT EXISTS nonqm_subcategory TEXT,       -- 'dscr' | 'bankstatement' | ...
  ADD COLUMN IF NOT EXISTS prepay_years INTEGER
    CHECK (prepay_years BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS bank_statement_months INTEGER
    CHECK (bank_statement_months IN (12, 24)),
  ADD COLUMN IF NOT EXISTS doc_type TEXT;

-- Backfill product_family for existing rows (all current scenarios are forward).
UPDATE scenarios
   SET product_family = 'forward'
 WHERE product_family IS NULL;

-- Index for cheap filters in pipeline / alerts UIs
CREATE INDEX IF NOT EXISTS idx_scenarios_product_family
  ON scenarios (product_family, owner_type, status);

-- ─── 5. New columns on loans ────────────────────────────────────────
-- Same Non-QM fields — populated when a scenario converts into a 1003.

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS product_family TEXT
    CHECK (product_family IN ('forward', 'nonqm', 'reverse')),
  ADD COLUMN IF NOT EXISTS nonqm_tier TEXT,
  ADD COLUMN IF NOT EXISTS nonqm_subcategory TEXT,
  ADD COLUMN IF NOT EXISTS dscr_ratio NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS unit_count INTEGER,
  ADD COLUMN IF NOT EXISTS prepay_years INTEGER
    CHECK (prepay_years BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS bank_statement_months INTEGER
    CHECK (bank_statement_months IN (12, 24)),
  ADD COLUMN IF NOT EXISTS doc_type TEXT;

UPDATE loans
   SET product_family = 'forward'
 WHERE product_family IS NULL;

CREATE INDEX IF NOT EXISTS idx_loans_product_family
  ON loans (product_family, organization_id);

COMMIT;
