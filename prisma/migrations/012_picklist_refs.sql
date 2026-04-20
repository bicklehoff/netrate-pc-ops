-- Migration 012: ref_licensed_states + ref_loan_types (D7-3).
--
-- DB-driven picklists for values that change independently of code deploy.
-- Per D7 audit (Work/Dev/audits/D7-MLO-PORTAL-AUDIT-2026-04-20.md §8 PR D7-3):
-- STATES and LOAN_TYPES go to DB; PURPOSES / PROPERTY_TYPES / OCCUPANCY /
-- TERMS / LOCK_DAYS stay in constants (see src/lib/constants/picklists.js).
--
-- Additive — no existing table modified, no FK added. Existing data (832
-- loans with mixed-case loan_type, 9 property_type variants, etc.) is left
-- as-is; data cleanup is a separate migration. No FK until cleanup lands.
-- Idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING).
--
-- Seed canon resolved by DB audit 2026-04-20:
--   loan_purpose: cashout (no underscore; 0 rows persist cash-out today)
--   loan_type:    bankstatement (no underscore; 5 rows in rate_products)

BEGIN;

-- ref_licensed_states: 50 US states + DC. is_active gates which appear in
-- licensed-state dropdowns (NMLS-licensed) vs property-state dropdowns
-- (all 51, for out-of-state property lookups).
CREATE TABLE IF NOT EXISTS ref_licensed_states (
  code          CHAR(2)     PRIMARY KEY,
  name          TEXT        NOT NULL,
  display_order INT         NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_licensed_states_active
  ON ref_licensed_states (is_active, display_order);

-- ref_loan_types: canonical loan type codes + display labels. sort_order
-- controls dropdown order; category groups non-QM / agency / reverse etc.
-- is_active hides legacy codes (e.g. nonqm, superseded by dscr+bankstatement).
CREATE TABLE IF NOT EXISTS ref_loan_types (
  code          TEXT        PRIMARY KEY,
  display_label TEXT        NOT NULL,
  sort_order    INT         NOT NULL,
  category      TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_loan_types_active
  ON ref_loan_types (is_active, sort_order);

-- Seed: licensed states first (CO/CA/OR/TX), then remaining 46 + DC alpha.
-- display_order 1-4 = licensed preferred, 10+ = alpha for the rest.
INSERT INTO ref_licensed_states (code, name, display_order, is_active) VALUES
  ('CO', 'Colorado',     1,  true),
  ('CA', 'California',   2,  true),
  ('OR', 'Oregon',       3,  true),
  ('TX', 'Texas',        4,  true),
  ('AL', 'Alabama',      10, false),
  ('AK', 'Alaska',       11, false),
  ('AZ', 'Arizona',      12, false),
  ('AR', 'Arkansas',     13, false),
  ('CT', 'Connecticut',  14, false),
  ('DE', 'Delaware',     15, false),
  ('DC', 'District of Columbia', 16, false),
  ('FL', 'Florida',      17, false),
  ('GA', 'Georgia',      18, false),
  ('HI', 'Hawaii',       19, false),
  ('ID', 'Idaho',        20, false),
  ('IL', 'Illinois',     21, false),
  ('IN', 'Indiana',      22, false),
  ('IA', 'Iowa',         23, false),
  ('KS', 'Kansas',       24, false),
  ('KY', 'Kentucky',     25, false),
  ('LA', 'Louisiana',    26, false),
  ('ME', 'Maine',        27, false),
  ('MD', 'Maryland',     28, false),
  ('MA', 'Massachusetts',29, false),
  ('MI', 'Michigan',     30, false),
  ('MN', 'Minnesota',    31, false),
  ('MS', 'Mississippi',  32, false),
  ('MO', 'Missouri',     33, false),
  ('MT', 'Montana',      34, false),
  ('NE', 'Nebraska',     35, false),
  ('NV', 'Nevada',       36, false),
  ('NH', 'New Hampshire',37, false),
  ('NJ', 'New Jersey',   38, false),
  ('NM', 'New Mexico',   39, false),
  ('NY', 'New York',     40, false),
  ('NC', 'North Carolina',41,false),
  ('ND', 'North Dakota', 42, false),
  ('OH', 'Ohio',         43, false),
  ('OK', 'Oklahoma',     44, false),
  ('PA', 'Pennsylvania', 45, false),
  ('RI', 'Rhode Island', 46, false),
  ('SC', 'South Carolina',47,false),
  ('SD', 'South Dakota', 48, false),
  ('TN', 'Tennessee',    49, false),
  ('UT', 'Utah',         50, false),
  ('VT', 'Vermont',      51, false),
  ('VA', 'Virginia',     52, false),
  ('WA', 'Washington',   53, false),
  ('WV', 'West Virginia',54, false),
  ('WI', 'Wisconsin',    55, false),
  ('WY', 'Wyoming',      56, false)
ON CONFLICT (code) DO NOTHING;

-- Seed loan types. Active set matches what the portal + public UI render
-- today. nonqm is a legacy category bucket (3 rows in rate_products);
-- retained as inactive for back-compat reads but hidden from dropdowns.
INSERT INTO ref_loan_types (code, display_label, sort_order, category, is_active) VALUES
  ('conventional',  'Conventional',     10,  'agency',      true),
  ('fha',           'FHA',              20,  'agency',      true),
  ('va',            'VA',               30,  'agency',      true),
  ('usda',          'USDA',             40,  'agency',      true),
  ('jumbo',         'Jumbo',            50,  'high-balance',true),
  ('dscr',          'DSCR',             60,  'non-qm',      true),
  ('bankstatement', 'Bank Statement',   70,  'non-qm',      true),
  ('heloc',         'HELOC',            80,  'second-lien', true),
  ('hecm',          'HECM (Reverse)',   90,  'reverse',     true),
  ('other',         'Other',            100, 'other',       true),
  ('nonqm',         'Non-QM (Generic)', 110, 'non-qm',      false)
ON CONFLICT (code) DO NOTHING;

COMMIT;
