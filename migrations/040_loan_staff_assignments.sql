-- Migration 040 — loan_staff_assignments junction (NEW)
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 migration 040, decision AD-D9e-11.
--   Internal staff roles on a loan (MLO, processor, admin). Phase 3 LDox
--   import will add more role values (underwriter, closer, funder, etc.)
--   without schema changes.
--
--   loans.mlo_id stays as a denorm shortcut for the hot "primary MLO" read.
--   Backfill this junction from loans.mlo_id with role='mlo', is_primary=true.
--
-- External lender staff (account_exec, broker_processor, underwriter_name
-- on loans today) are out of scope — they belong to a different
-- tracking surface (loan_service_providers or free text).
--
-- Additive, idempotent. Backfill via INSERT ... SELECT ... NOT EXISTS so
-- replays don't duplicate rows.

CREATE TABLE IF NOT EXISTS loan_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  role TEXT NOT NULL CHECK (role IN ('mlo', 'processor', 'admin')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, staff_id, role)
);

CREATE INDEX IF NOT EXISTS idx_loan_staff_assignments_loan_id
  ON loan_staff_assignments (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_staff_assignments_staff_id
  ON loan_staff_assignments (staff_id);

-- Backfill primary MLO role from loans.mlo_id. Idempotent — the UNIQUE
-- constraint prevents duplicates, and NOT EXISTS is a belt-and-suspenders
-- guard in case the statement is partial-applied.
INSERT INTO loan_staff_assignments (loan_id, staff_id, role, is_primary)
SELECT l.id, l.mlo_id, 'mlo', true
FROM loans l
WHERE l.mlo_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM loan_staff_assignments lsa
    WHERE lsa.loan_id = l.id AND lsa.staff_id = l.mlo_id AND lsa.role = 'mlo'
  );
