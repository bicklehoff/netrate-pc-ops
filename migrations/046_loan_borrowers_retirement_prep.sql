-- Migration 046 — prep for loan_borrowers retirement (PR 3a of 3)
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 originally specified one
--   migration 043 that would both data-transform and drop loan_borrowers.
--   We've split that work into three sub-PRs because settled loans carry
--   live CRM/rate-alert data that can't tolerate a bug in the data move:
--
--     3a (this migration 046) — additive prep only, zero risk
--     3b (migration 047, next PR) — data transform + app-layer rewire
--     3c (migration 048, after 3b soak) — drop loan_borrowers table
--
-- This migration lands the pieces that don't move data out of
-- loan_borrowers, but set the stage for 3b to do so cleanly:
--
--   1. Normalize `loan_borrowers.borrower_type` spelling drift:
--      'coborrower' → 'co_borrower' (1 prod row affected, the orphan's
--      co-borrower on loan 5088c8b2).
--
--   2. Backfill the 1 orphan loan's `loan_participants` rows. Loan
--      5088c8b2 has 2 loan_borrowers rows (primary + co-borrower) but
--      zero loan_participants entries. If we dropped loan_borrowers in
--      3c without backfilling participants here, those 2 borrower
--      identity rows disappear from the system entirely.
--
--      Mapping: borrower_type 'primary' → role 'primary_borrower';
--               borrower_type 'co_borrower' → role 'co_borrower'.
--
--   3. Extend loan_declarations with 11 new columns for the JSONB
--      declaration keys that don't have structured homes yet
--      (identified from sample of 11 populated loan_borrowers rows).
--      3b will parse the JSONB into these columns.
--
--   4. Create loan_demographics satellite for HMDA ethnicity/race/sex.
--      Originally a Phase 2 table per plan §5.1, pulled forward to
--      Phase 1 because the HMDA keys in loan_borrowers.declarations
--      need a destination before 3c can drop the JSONB blob.
--      Matches plan §5.1 schema exactly (JSONB ethnicity + race to
--      support MISMO sub-category nesting; prod data today is flat
--      strings but the shape is forward-compat).
--
-- Additive + idempotent. The UPDATE is safe to replay (no-op after
-- first run). INSERT uses NOT EXISTS guard. DDL uses IF NOT EXISTS.

BEGIN;

-- ─── 1. Normalize borrower_type values ────────────────────────────
UPDATE loan_borrowers
SET borrower_type = 'co_borrower', updated_at = NOW()
WHERE borrower_type = 'coborrower';

-- ─── 2. Backfill loan_participants for orphan loans ───────────────
-- Covers the 1 prod loan (5088c8b2...) that has loan_borrowers rows
-- but no loan_participants. Uses NOT EXISTS to ensure idempotence.
INSERT INTO loan_participants (
  id, loan_id, contact_id, staff_id, role, ordinal, organization_id,
  has_portal_access, private_docs, notification_prefs, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  lb.loan_id,
  lb.contact_id,
  NULL,
  CASE
    WHEN lb.borrower_type = 'primary'     THEN 'primary_borrower'
    WHEN lb.borrower_type = 'co_borrower' THEN 'co_borrower'
  END,
  lb.ordinal,
  '00000000-0000-4000-8000-000000000001'::uuid,
  false,
  false,
  '{}'::jsonb,
  NOW(),
  NOW()
FROM loan_borrowers lb
WHERE lb.borrower_type IN ('primary', 'co_borrower')
  AND NOT EXISTS (
    SELECT 1 FROM loan_participants lp
    WHERE lp.loan_id = lb.loan_id AND lp.contact_id = lb.contact_id
  );

-- ─── 3. loan_declarations MISMO column additions ──────────────────
-- Keys identified from the 11 populated declarations JSONB blobs in
-- prod loan_borrowers. HMDA keys (hmdaEthnicity/Race/Sex) are NOT
-- added here — those land on loan_demographics (step 4).
ALTER TABLE loan_declarations
  ADD COLUMN IF NOT EXISTS applying_for_new_credit      BOOLEAN,
  ADD COLUMN IF NOT EXISTS applying_for_other_mortgage  BOOLEAN,
  ADD COLUMN IF NOT EXISTS authorize_credit_pull        BOOLEAN,
  ADD COLUMN IF NOT EXISTS authorize_verification       BOOLEAN,
  ADD COLUMN IF NOT EXISTS deed_in_lieu                 BOOLEAN,
  ADD COLUMN IF NOT EXISTS family_relationship_seller   BOOLEAN,
  ADD COLUMN IF NOT EXISTS pre_foreclosure_sale         BOOLEAN,
  ADD COLUMN IF NOT EXISTS prior_property_title_held    TEXT,
  ADD COLUMN IF NOT EXISTS priority_lien                BOOLEAN,
  ADD COLUMN IF NOT EXISTS undisclosed_borrowing        BOOLEAN,
  ADD COLUMN IF NOT EXISTS undisclosed_borrowing_amount NUMERIC(12,2);

-- ─── 4. loan_demographics satellite (NEW) ─────────────────────────
-- HMDA ethnicity + race + sex. Per-person-per-loan. JSONB for
-- ethnicity + race to support MISMO sub-category nesting; prod data
-- today is flat-string/simple-array which JSONB stores fine.
CREATE TABLE IF NOT EXISTS loan_demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  ethnicity JSONB,
  race JSONB,
  sex TEXT CHECK (sex IS NULL OR sex IN (
    'male', 'female', 'neither', 'refused', 'not_applicable'
  )),
  refused_to_provide BOOLEAN NOT NULL DEFAULT false,
  collected_via TEXT CHECK (collected_via IS NULL OR collected_via IN (
    'visual_observation', 'borrower_provided', 'both'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_loan_demographics_loan_id
  ON loan_demographics (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_demographics_contact_id
  ON loan_demographics (contact_id);

COMMIT;
