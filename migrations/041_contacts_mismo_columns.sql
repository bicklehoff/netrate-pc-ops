-- Migration 041 — contacts MISMO column additions
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 migration 041.
--   Adds person-level MISMO fields currently missing from contacts so
--   migration 043 (loan_borrowers retirement) has somewhere to land
--   citizenship + suffix, and so person-level dependents data stops
--   living on the per-loan row.
--
--   contacts.mailing_address already exists — skipped.
--   contacts.date_of_birth already exists — MISMO DOB lands there (043).
--
-- Additive, idempotent.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS suffix TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
  ADD COLUMN IF NOT EXISTS language_preference TEXT,
  ADD COLUMN IF NOT EXISTS us_citizenship_indicator TEXT,
  ADD COLUMN IF NOT EXISTS date_citizenship_established DATE,
  ADD COLUMN IF NOT EXISTS num_dependents INTEGER,
  ADD COLUMN IF NOT EXISTS dependent_ages TEXT;

-- CHECK constraints via DO-block so re-runs don't error on duplicate
-- constraint names. Using DO pg_constraint lookup is idempotent and
-- survives replay.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_preferred_contact_method_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_preferred_contact_method_check
      CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('email', 'phone', 'sms'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_us_citizenship_indicator_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_us_citizenship_indicator_check
      CHECK (us_citizenship_indicator IS NULL OR us_citizenship_indicator IN (
        'us_citizen', 'permanent_resident', 'non_permanent_resident'
      ));
  END IF;
END
$$;
