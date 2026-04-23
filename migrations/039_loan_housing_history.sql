-- Migration 039 — loan_housing_history satellite (NEW)
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 migration 039.
--   Per-person housing residency + tenure (current and previous addresses).
--   Needed for Phase 1 PR 3 (loan_borrowers retirement, migration 043),
--   which moves current_address/address_years/address_months/
--   previous_address/monthly_rent off loan_borrowers into this satellite.
--
-- Shape:
--   Keyed on (loan_id, contact_id). `housing_type` distinguishes current vs
--   previous. `ordinal` supports >1 previous address per person per deal.
--
-- Additive, idempotent.

CREATE TABLE IF NOT EXISTS loan_housing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  housing_type TEXT NOT NULL CHECK (housing_type IN ('current', 'previous')),
  address JSONB NOT NULL,
  residency_type TEXT CHECK (residency_type IS NULL OR residency_type IN (
    'own', 'rent', 'live_with_family', 'military_housing'
  )),
  years INTEGER,
  months INTEGER,
  monthly_rent NUMERIC(10,2),
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_housing_history_loan_id
  ON loan_housing_history (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_housing_history_contact_id
  ON loan_housing_history (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_housing_history_loan_contact
  ON loan_housing_history (loan_id, contact_id);
