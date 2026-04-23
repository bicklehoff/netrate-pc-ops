-- Migration 042 — satellite FK rewire to contact_id (+ loan_id where missing)
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 migration 042.
--   Per AD-D9e-3 satellites key on (loan_id, contact_id) directly instead
--   of routing through loan_borrowers. This migration adds the new columns
--   + indexes so PR 3 (loan_borrowers retirement) can drop the old
--   loan_borrower_id column cleanly.
--
-- Scope (all 5 tables are empty in prod — no backfill required):
--   loan_employments   — add loan_id + contact_id (both NOT NULL)
--                        Currently has only loan_borrower_id; needs loan_id
--                        too so 043 drop of loan_borrower_id doesn't orphan
--   loan_declarations  — add loan_id + contact_id (both NOT NULL)
--                        Same shape as loan_employments
--   loan_assets        — add contact_id NULLABLE
--                        NULLABLE because MISMO allows loan-level assets
--                        (shared/joint) with contact_id optional
--   loan_liabilities   — add contact_id NULLABLE
--                        NULLABLE because MISMO allows joint liabilities
--   loan_reos          — add contact_id NULLABLE
--                        NULLABLE because REO ownership can be joint
--
-- Old per-person columns (loan_borrower_id, borrower_type) are retained
-- for soak; dropped in migration 043 along with the loan_borrowers table.
--
-- NOT NULL on loan_employments/loan_declarations is safe because both
-- tables have zero rows today. Any future insert must provide the
-- new columns, which aligns with the PR 3 app-layer rewire.
--
-- Additive + idempotent. DO-blocks guard the NOT NULL promotion so
-- replays don't throw if the column is already constrained.

BEGIN;

-- ─── loan_employments ──────────────────────────────────────────────
ALTER TABLE loan_employments
  ADD COLUMN IF NOT EXISTS loan_id    UUID REFERENCES loans(id)    ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_employments'
      AND column_name='loan_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE loan_employments ALTER COLUMN loan_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_employments'
      AND column_name='contact_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE loan_employments ALTER COLUMN contact_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_loan_employments_loan_id
  ON loan_employments (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_employments_contact_id
  ON loan_employments (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_employments_loan_contact
  ON loan_employments (loan_id, contact_id);

-- ─── loan_declarations ─────────────────────────────────────────────
ALTER TABLE loan_declarations
  ADD COLUMN IF NOT EXISTS loan_id    UUID REFERENCES loans(id)    ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_declarations'
      AND column_name='loan_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE loan_declarations ALTER COLUMN loan_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='loan_declarations'
      AND column_name='contact_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE loan_declarations ALTER COLUMN contact_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_loan_declarations_loan_id
  ON loan_declarations (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_declarations_contact_id
  ON loan_declarations (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_declarations_loan_contact
  ON loan_declarations (loan_id, contact_id);

-- ─── loan_assets ───────────────────────────────────────────────────
-- Already has loan_id; add nullable contact_id.
ALTER TABLE loan_assets
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

CREATE INDEX IF NOT EXISTS idx_loan_assets_contact_id
  ON loan_assets (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_assets_loan_contact
  ON loan_assets (loan_id, contact_id);

-- ─── loan_liabilities ──────────────────────────────────────────────
ALTER TABLE loan_liabilities
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

CREATE INDEX IF NOT EXISTS idx_loan_liabilities_contact_id
  ON loan_liabilities (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_liabilities_loan_contact
  ON loan_liabilities (loan_id, contact_id);

-- ─── loan_reos ─────────────────────────────────────────────────────
ALTER TABLE loan_reos
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

CREATE INDEX IF NOT EXISTS idx_loan_reos_contact_id
  ON loan_reos (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_reos_loan_contact
  ON loan_reos (loan_id, contact_id);

COMMIT;
