-- Migration 044 — soft-delete columns
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 migration 044, decision AD-D9e-8.
--   Adds deleted_at TIMESTAMPTZ to the four top-level tables that users
--   can "delete" from the UI. Satellites cascade from their parent and
--   do not need their own flag (AD-D9e-8 rationale).
--
--   App-layer wiring (flipping DELETE handlers to UPDATE ... SET
--   deleted_at = NOW(), and adding WHERE deleted_at IS NULL to default
--   reads) lands in Phase 1 PR 3 along with loan_borrowers retirement.
--
--   Partial indexes on the not-deleted path — the common query case —
--   keep index size small (matches the live row count, not total including
--   tombstones).
--
-- Additive, idempotent.

ALTER TABLE loans             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE scenarios         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE loan_participants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_loans_live
  ON loans (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_live
  ON contacts (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_live
  ON scenarios (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loan_participants_live
  ON loan_participants (loan_id, contact_id) WHERE deleted_at IS NULL;
