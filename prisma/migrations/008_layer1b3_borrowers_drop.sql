-- Migration 008: UAD Layer-1b3 — borrowers table drop + column rename cutover
-- Date: 2026-04-17
-- Part of FoH April (D9 Layer 1 — phased rollout, part b3)
--
-- DESIGN: Atomic cutover.
--   Code must be deployed with the matching changes simultaneously.
--
-- This migration:
--   1. Backfills any loans.contact_id that is still NULL (2 rows) from the
--      borrowers bridge.
--   2. Remaps loan_borrowers.borrower_id values from borrowers.id to
--      contacts.id via the contacts.borrower_id bridge, then renames the
--      column to contact_id.
--   3. Drops loans.borrower_id column (data already in loans.contact_id).
--   4. Drops loan_contacts table (data migrated to loan_participants in 006).
--   5. Drops contacts.borrower_id bridge column + FK.
--   6. Drops the mlos compat view (no code reads it post-1b2a code sweep).
--   7. Drops the borrowers table.
--   8. Sets loans.contact_id NOT NULL (every loan now has a contact).
--
-- SCOPE CHOICE: We KEEP the loan_borrowers table. Its app-module columns
-- (marital_status, employment_status, employer_name, current_address,
-- declarations, etc.) are still actively written by apply + MLO flows and
-- read by BorrowerSection.js for co-borrower display. The UAD sub-tables
-- (loan_employments, loan_incomes, loan_declarations) exist but have 0 rows
-- in production — migrating to them is a separate Layer-2 effort.
--
-- Pre-flight verification (must pass before running):
--   node scripts/layer-1b3-preflight.mjs
--
-- Pre-run expected state:
--   - borrowers: 837 rows
--   - contacts: 900 rows, 837 with borrower_id bridge
--   - loans: 842, with 840 contact_id populated, 842 borrower_id populated
--   - loan_borrowers: 26 rows, all borrower_id values map through the bridge
--   - loan_contacts: 840 rows (all represented in loan_participants already)
--   - loan_participants: 848 rows
--   - mlos: VIEW
--
-- Run: node scripts/_run-migration-008.mjs

BEGIN;

-- ============================================================
-- STEP 1: Fill 2 remaining NULL loans.contact_id rows via bridge
-- ============================================================

UPDATE loans l
SET contact_id = c.id,
    updated_at = NOW()
FROM contacts c
WHERE l.contact_id IS NULL
  AND c.borrower_id = l.borrower_id;

-- ============================================================
-- STEP 2: Remap loan_borrowers.borrower_id -> contact id, then rename
--   - For Case-3 orphan borrowers: contact.id === borrower.id already, so
--     the value stays the same (the c.id != lb.borrower_id guard skips them).
--   - For Case 1/2 borrowers: borrower.id gets rewritten to contact.id.
--   - No risk of duplicate (loan_id, borrower_id) unique violation because
--     every borrower maps to exactly one contact (verified by pre-flight).
-- ============================================================

UPDATE loan_borrowers lb
SET borrower_id = c.id,
    updated_at = NOW()
FROM contacts c
WHERE c.borrower_id = lb.borrower_id
  AND c.id != lb.borrower_id;

ALTER TABLE loan_borrowers
  DROP CONSTRAINT IF EXISTS loan_borrowers_borrower_id_fkey;

-- Drop the old unique index before renaming so we can recreate it cleanly.
DROP INDEX IF EXISTS loan_borrowers_loan_id_borrower_id_key;

ALTER TABLE loan_borrowers
  RENAME COLUMN borrower_id TO contact_id;

ALTER TABLE loan_borrowers
  ADD CONSTRAINT loan_borrowers_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id);

CREATE UNIQUE INDEX IF NOT EXISTS loan_borrowers_loan_id_contact_id_key
  ON loan_borrowers (loan_id, contact_id);

-- ============================================================
-- STEP 3: Drop loans.borrower_id column (values already in contact_id)
-- ============================================================

ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS loans_borrower_id_fkey;

ALTER TABLE loans
  DROP COLUMN IF EXISTS borrower_id;

-- ============================================================
-- STEP 4: Drop loan_contacts table (data in loan_participants already)
-- ============================================================

DROP TABLE IF EXISTS loan_contacts CASCADE;

-- ============================================================
-- STEP 5: Drop contacts.borrower_id bridge (no longer needed)
-- ============================================================

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_borrower_id_fkey;

ALTER TABLE contacts
  DROP COLUMN IF EXISTS borrower_id;

-- ============================================================
-- STEP 6: Drop the mlos compat view (code reads staff directly post-1b2a)
-- ============================================================

DROP VIEW IF EXISTS mlos;

-- ============================================================
-- STEP 7: Drop the borrowers table
-- ============================================================

DROP TABLE IF EXISTS borrowers CASCADE;

-- ============================================================
-- STEP 8: Enforce loans.contact_id NOT NULL (integrity going forward)
-- ============================================================

ALTER TABLE loans
  ALTER COLUMN contact_id SET NOT NULL;

COMMIT;
