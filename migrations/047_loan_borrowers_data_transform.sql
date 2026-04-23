-- Migration 047 — loan_borrowers data transform (PR 3b)
--
-- Context:
--   Work/Dev/D9E-PR3B-SCOPE.md
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1
--
--   Moves every populated field out of loan_borrowers into the satellite
--   tables that are now schema-ready (post PRs 1/2/4/3a). loan_borrowers
--   itself is NOT touched — stays as a read-only backup through 3c.
--
-- Data scope (prod 2026-04-23):
--   22 loans · 28 loan_borrowers rows · populated fields:
--     marital_status       11
--     current_address      17
--     declarations JSONB   11
--     monthly_base_income  9
--     employer_name        2
--     employment_status    2
--   0 rows: citizenship, suffix, cell_phone, dob_encrypted, housing_type,
--   monthly_rent, previous_address* (fields exist but never populated)
--
-- This migration has two parts:
--   Part A — Pre-data DDL (fills gaps PR 3a couldn't fix):
--     A1. loan_incomes gets loan_id + contact_id NOT NULL (PR 2 missed it)
--     A2. loan_participants gets marital_status TEXT (MISMO per-application)
--     A3. loan_borrower_id promoted to NULLABLE on 3 satellites so post-3b
--         the app can write satellites directly without routing through
--         loan_borrowers. 3c drops the column entirely.
--
--   Part B — Data transform (8 ordered, idempotent steps).
--
-- Idempotence: every INSERT uses NOT EXISTS. UPDATE includes "WHERE
-- destination IS NULL" guards. DDL uses IF NOT EXISTS / DO-block
-- constraint checks. Safe to replay against any state.

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- PART A — Pre-data DDL
-- ══════════════════════════════════════════════════════════════════

-- A1. loan_incomes — add loan_id + contact_id (PR 2 gap fix)
-- Table is empty (0 rows) so NOT NULL is safe without backfill.
ALTER TABLE loan_incomes
  ADD COLUMN IF NOT EXISTS loan_id    UUID REFERENCES loans(id)    ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_incomes'
      AND column_name='loan_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE loan_incomes ALTER COLUMN loan_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_incomes'
      AND column_name='contact_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE loan_incomes ALTER COLUMN contact_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_loan_incomes_loan_id       ON loan_incomes (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_incomes_contact_id    ON loan_incomes (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_incomes_loan_contact  ON loan_incomes (loan_id, contact_id);

-- A2. loan_participants — add marital_status (MISMO per-application snapshot)
ALTER TABLE loan_participants
  ADD COLUMN IF NOT EXISTS marital_status TEXT;

-- A3. Promote loan_borrower_id to NULLABLE on 3 satellites.
-- Rows inserted by this migration still populate loan_borrower_id for
-- traceability. Post-merge, the rewired app code writes satellites
-- directly and omits loan_borrower_id. 3c drops the column entirely.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_employments'
      AND column_name='loan_borrower_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE loan_employments ALTER COLUMN loan_borrower_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_declarations'
      AND column_name='loan_borrower_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE loan_declarations ALTER COLUMN loan_borrower_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_incomes'
      AND column_name='loan_borrower_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE loan_incomes ALTER COLUMN loan_borrower_id DROP NOT NULL;
  END IF;
END
$$;

-- ══════════════════════════════════════════════════════════════════
-- PART B — Data transform
-- ══════════════════════════════════════════════════════════════════

-- B1. marital_status → loan_participants
-- 11 loan_borrowers rows have marital_status. Copy onto matching
-- participant row. "IS NULL" guard makes this safe to replay.
UPDATE loan_participants lp
SET marital_status = lb.marital_status, updated_at = NOW()
FROM loan_borrowers lb
WHERE lp.loan_id    = lb.loan_id
  AND lp.contact_id = lb.contact_id
  AND lb.marital_status IS NOT NULL
  AND lp.marital_status IS NULL;

-- B2. current_address + tenure + monthly_rent → loan_housing_history
-- 17 loan_borrowers rows have current_address. NOT EXISTS keyed on
-- (loan_id, contact_id, housing_type='current') for idempotence.
INSERT INTO loan_housing_history (
  loan_id, contact_id, housing_type, address,
  residency_type, years, months, monthly_rent, ordinal
)
SELECT
  lb.loan_id, lb.contact_id, 'current', lb.current_address,
  lb.housing_type,
  lb.address_years,
  lb.address_months,
  lb.monthly_rent,
  0
FROM loan_borrowers lb
WHERE lb.current_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM loan_housing_history hh
    WHERE hh.loan_id = lb.loan_id
      AND hh.contact_id = lb.contact_id
      AND hh.housing_type = 'current'
  );

-- B3. previous_address → loan_housing_history (housing_type='previous')
-- 0 rows in prod but defensively included for completeness + idempotence.
INSERT INTO loan_housing_history (
  loan_id, contact_id, housing_type, address,
  residency_type, years, months, ordinal
)
SELECT
  lb.loan_id, lb.contact_id, 'previous', lb.previous_address,
  NULL,
  lb.previous_address_years,
  lb.previous_address_months,
  0
FROM loan_borrowers lb
WHERE lb.previous_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM loan_housing_history hh
    WHERE hh.loan_id = lb.loan_id
      AND hh.contact_id = lb.contact_id
      AND hh.housing_type = 'previous'
  );

-- B4. employer_name + position + years_in_position → loan_employments
-- 2 loan_borrowers rows have employer_name. is_primary=true (only
-- 1 employment per loan_borrower in source). self_employed=false default.
INSERT INTO loan_employments (
  loan_borrower_id, loan_id, contact_id, is_primary,
  employer_name, position, years_on_job, months_on_job,
  self_employed, updated_at
)
SELECT
  lb.id, lb.loan_id, lb.contact_id, true,
  lb.employer_name,
  lb.position_title,
  lb.years_in_position,
  0,
  false,
  NOW()
FROM loan_borrowers lb
WHERE lb.employer_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM loan_employments le
    WHERE le.loan_id = lb.loan_id
      AND le.contact_id = lb.contact_id
      AND le.is_primary = true
  );

-- B5. monthly_base_income + other_monthly_income → loan_incomes
-- 9 loan_borrowers rows have monthly_base_income. Other income may or
-- may not be set; NULL is fine on loan_incomes (columns are nullable).
INSERT INTO loan_incomes (
  loan_borrower_id, loan_id, contact_id,
  base_monthly, other_monthly, other_income_source,
  updated_at
)
SELECT
  lb.id, lb.loan_id, lb.contact_id,
  lb.monthly_base_income,
  lb.other_monthly_income,
  lb.other_income_source,
  NOW()
FROM loan_borrowers lb
WHERE (lb.monthly_base_income IS NOT NULL OR lb.other_monthly_income IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM loan_incomes li
    WHERE li.loan_id = lb.loan_id
      AND li.contact_id = lb.contact_id
  );

-- B6. declarations JSONB → loan_declarations (non-HMDA structured fields)
-- 11 loan_borrowers rows have declarations. Parse each key; NULL out
-- missing keys. HMDA keys handled separately in step B7.
INSERT INTO loan_declarations (
  loan_borrower_id, loan_id, contact_id,
  -- boolean declarations (new in 046)
  applying_for_new_credit,
  applying_for_other_mortgage,
  authorize_credit_pull,
  authorize_verification,
  deed_in_lieu,
  family_relationship_seller,
  pre_foreclosure_sale,
  priority_lien,
  undisclosed_borrowing,
  -- numeric (new in 046)
  undisclosed_borrowing_amount,
  -- text (new in 046)
  prior_property_title_held,
  -- existing boolean columns
  bankruptcy,
  co_signer_on_other_loan,
  delinquent_federal_debt,
  foreclosure,
  intent_to_occupy,
  outstanding_judgments,
  ownership_interest_last_three_years,
  party_to_lawsuit,
  -- existing text columns
  bankruptcy_type,
  property_type_of_ownership,
  -- audit (no DB default on updated_at)
  updated_at
)
SELECT
  lb.id, lb.loan_id, lb.contact_id,
  NULLIF(lb.declarations->>'applyingForNewCredit',     '')::BOOLEAN,
  NULLIF(lb.declarations->>'applyingForOtherMortgage', '')::BOOLEAN,
  NULLIF(lb.declarations->>'authorizeCreditPull',      '')::BOOLEAN,
  NULLIF(lb.declarations->>'authorizeVerification',    '')::BOOLEAN,
  NULLIF(lb.declarations->>'deedInLieu',               '')::BOOLEAN,
  NULLIF(lb.declarations->>'familyRelationshipSeller', '')::BOOLEAN,
  NULLIF(lb.declarations->>'preForeclosureSale',       '')::BOOLEAN,
  NULLIF(lb.declarations->>'priorityLien',             '')::BOOLEAN,
  NULLIF(lb.declarations->>'undisclosedBorrowing',     '')::BOOLEAN,
  NULLIF(lb.declarations->>'undisclosedBorrowingAmount','')::NUMERIC(12,2),
  NULLIF(lb.declarations->>'priorPropertyTitleHeld',   ''),
  NULLIF(lb.declarations->>'bankruptcy',               '')::BOOLEAN,
  NULLIF(lb.declarations->>'coSignerOnDebt',           '')::BOOLEAN,
  NULLIF(lb.declarations->>'delinquentFederalDebt',    '')::BOOLEAN,
  NULLIF(lb.declarations->>'foreclosure',              '')::BOOLEAN,
  NULLIF(lb.declarations->>'primaryResidence',         '')::BOOLEAN,
  NULLIF(lb.declarations->>'outstandingJudgments',     '')::BOOLEAN,
  NULLIF(lb.declarations->>'priorOwnership3Years',     '')::BOOLEAN,
  NULLIF(lb.declarations->>'lawsuitParty',             '')::BOOLEAN,
  NULLIF(lb.declarations->>'bankruptcyChapter',        ''),
  NULLIF(lb.declarations->>'priorPropertyType',        ''),
  NOW()
FROM loan_borrowers lb
WHERE lb.declarations IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM loan_declarations ld
    WHERE ld.loan_id = lb.loan_id
      AND ld.contact_id = lb.contact_id
  );

-- B7. HMDA JSONB keys → loan_demographics
-- Insert when any of hmdaEthnicity / hmdaRace / hmdaSex is present.
-- ethnicity + race stay as JSONB (flexible for MISMO nested categories).
-- sex is text (matches schema CHECK constraint values).
INSERT INTO loan_demographics (
  loan_id, contact_id, ethnicity, race, sex
)
SELECT
  lb.loan_id, lb.contact_id,
  lb.declarations->'hmdaEthnicity',
  lb.declarations->'hmdaRace',
  lb.declarations->>'hmdaSex'
FROM loan_borrowers lb
WHERE lb.declarations IS NOT NULL
  AND (
    lb.declarations ? 'hmdaEthnicity' OR
    lb.declarations ? 'hmdaRace' OR
    lb.declarations ? 'hmdaSex'
  )
  AND NOT EXISTS (
    SELECT 1 FROM loan_demographics ld
    WHERE ld.loan_id = lb.loan_id
      AND ld.contact_id = lb.contact_id
  );

-- B8. citizenshipStatus → contacts.us_citizenship_indicator
-- Contact-level identity field, not per-loan. Guard against overwriting.
-- Map legacy values to the CHECK-constraint vocabulary set in mig 041:
--   'citizen'              → 'us_citizen'      (legacy shorthand, 2 prod rows)
--   'us_citizen'           → 'us_citizen'
--   'permanent_resident'   → 'permanent_resident'
--   'non_permanent_resident' → 'non_permanent_resident'
-- Any value outside this set is skipped (WHERE ... IN guard) so we
-- don't trip the CHECK constraint.
UPDATE contacts c
SET us_citizenship_indicator = CASE (lb.declarations->>'citizenshipStatus')
      WHEN 'citizen'                  THEN 'us_citizen'
      WHEN 'us_citizen'               THEN 'us_citizen'
      WHEN 'permanent_resident'       THEN 'permanent_resident'
      WHEN 'non_permanent_resident'   THEN 'non_permanent_resident'
    END,
    updated_at = NOW()
FROM loan_borrowers lb
WHERE c.id = lb.contact_id
  AND lb.declarations IS NOT NULL
  AND lb.declarations ? 'citizenshipStatus'
  AND (lb.declarations->>'citizenshipStatus') IN (
    'citizen', 'us_citizen', 'permanent_resident', 'non_permanent_resident'
  )
  AND c.us_citizenship_indicator IS NULL;

COMMIT;
