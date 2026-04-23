-- Migration 048 — drop loan_borrowers (PR 3c, final D9e Phase 1 step)
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.4
--
--   After PR #189 (3b-code), the app no longer reads or writes loan_borrowers.
--   Migration 047 already transformed all populated data into satellites.
--   This migration is the final retirement of the table + its FK stubs on
--   three satellites.
--
-- Pre-flight expectations (verified by runner before apply):
--   1. loan_borrowers has 28 rows of dead backup data (count may vary if
--      something leaked through; runner will abort if source code still
--      references the table via grep).
--   2. Satellite FK columns (loan_employments.loan_borrower_id,
--      loan_incomes.loan_borrower_id, loan_declarations.loan_borrower_id)
--      are NULLABLE (set in migration 047 A3).
--   3. No FKs from any other table reference loan_borrowers. Verified:
--      only the 3 satellite self-references exist.
--
-- Idempotence: IF EXISTS on both column and table drops. Safe to replay.

BEGIN;

-- Drop FK columns on satellites first. CASCADE not required — the FKs
-- themselves are dropped automatically when the referenced table goes
-- below, but we drop the columns outright since they're no longer used.
ALTER TABLE loan_employments  DROP COLUMN IF EXISTS loan_borrower_id;
ALTER TABLE loan_declarations DROP COLUMN IF EXISTS loan_borrower_id;
ALTER TABLE loan_incomes      DROP COLUMN IF EXISTS loan_borrower_id;

-- Drop the table itself. CASCADE not needed — no remaining FKs reference
-- loan_borrowers (verified pre-flight). Any residual views/functions
-- referencing it would fail at DROP, which is the correct behavior.
DROP TABLE IF EXISTS loan_borrowers;

COMMIT;
