-- Migration 005: UAD Layer 1a — ADDITIVE foundation
-- Date: 2026-04-17
-- Part of FoH April (D9 Layer 1 — phased rollout, part a)
--
-- DESIGN: This migration is STRICTLY ADDITIVE — zero code impact.
--   - Adds columns to `contacts` (nullable / defaulted)
--   - Creates empty `loan_participants` table (FK `staff_id` → `mlos.id` for now;
--     Layer-1b will rename `mlos` → `staff` alongside the 17 raw-SQL call sites)
--   - Creates empty `service_provider_*` tables
--
-- NO data migration, NO drops, NO FK rewrites, NO table renames.
-- The `mlos` → `staff` rename is deferred to Layer-1b (where the 17+ raw-SQL
-- call sites using `FROM mlos` will be updated together).
--
-- All existing `borrowers`, `mlos`, `loan_borrowers`, `loan_contacts` tables
-- stay intact. Zero code changes needed to keep production building + running.
--
-- This lands the new schema safely. Layer-1b (separate PR) does the
-- data merge + code sweep + drops.
--
-- Draft of the full merge migration for Layer-1b lives at:
--   Work/Dev/drafts/layer-1b-full-merge-draft.sql
--
-- Pre-run checks (verified via scripts/layer-1-dry-run.mjs on 2026-04-17):
--   - 837 borrowers, 773 contacts, 2 mlos
--   - 0 borrowers have password_hash set → zero active portal sessions
--   - loan_contacts: 840 rows, 100% role='borrower'
--   - 1003 sub-tables (loan_employments etc.) are Prisma-declared but
--     don't exist in DB — this migration does not touch them.
--
-- Run: node scripts/_run-migration-005.mjs
--
-- Rollback for Layer-1a (additive): Neon point-in-time recovery, OR manually
-- drop added columns/tables. Since nothing is deleted, manual rollback is:
--   DROP TABLE loan_service_providers, service_provider_contacts,
--              service_provider_accounts, loan_participants;
--   ALTER TABLE contacts DROP COLUMN dob_encrypted, ssn_encrypted, ...;

BEGIN;

-- ============================================================
-- STEP 1: Expand contacts with borrower-origin auth/PII columns
-- All nullable or defaulted — zero impact on existing code reads.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS dob_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ssn_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ssn_last_four VARCHAR(4),
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS magic_token TEXT,
  ADD COLUMN IF NOT EXISTS magic_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_code TEXT,
  ADD COLUMN IF NOT EXISTS sms_code_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_first_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_last_name TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'borrower',
  ADD COLUMN IF NOT EXISTS communication_prefs JSONB,
  ADD COLUMN IF NOT EXISTS marketing_stage TEXT NOT NULL DEFAULT 'lead';

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_role_check,
  ADD CONSTRAINT contacts_role_check
    CHECK (role IN ('borrower', 'co_borrower', 'realtor'));

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_marketing_stage_check,
  ADD CONSTRAINT contacts_marketing_stage_check
    CHECK (marketing_stage IN ('lead', 'in_process', 'closed', 'past_client'));

-- ============================================================
-- STEP 2: Create loan_participants (empty — Layer-1b populates)
-- Note: staff_id FK points at mlos.id for now. Layer-1b renames mlos → staff
-- (FK survives via PostgreSQL OID tracking, column name doesn't need update).
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_participants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id              UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id           UUID REFERENCES contacts(id),
  staff_id             UUID REFERENCES mlos(id),
  role                 TEXT NOT NULL,
  has_portal_access    BOOLEAN NOT NULL DEFAULT false,
  private_docs         BOOLEAN NOT NULL DEFAULT false,
  notification_prefs   JSONB,
  ordinal              INTEGER NOT NULL DEFAULT 0,
  organization_id      UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES organizations(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT loan_participants_role_check
    CHECK (role IN ('primary_borrower', 'co_borrower', 'realtor', 'mlo', 'processor', 'loa')),
  CONSTRAINT loan_participants_contact_xor_staff
    CHECK ((contact_id IS NOT NULL) <> (staff_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_loan_participants_loan ON loan_participants(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_participants_contact ON loan_participants(contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_participants_staff ON loan_participants(staff_id);
CREATE INDEX IF NOT EXISTS idx_loan_participants_org ON loan_participants(organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS loan_participants_loan_contact_uniq
  ON loan_participants(loan_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loan_participants_loan_staff_uniq
  ON loan_participants(loan_id, staff_id) WHERE staff_id IS NOT NULL;

-- ============================================================
-- STEP 3: Service provider tables (empty — populated by future Layer 3/4)
-- ============================================================

CREATE TABLE IF NOT EXISTS service_provider_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES organizations(id),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  phone            TEXT,
  fax              TEXT,
  email            TEXT,
  address          JSONB,
  website          TEXT,
  coverage_areas   TEXT[],
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT service_provider_accounts_type_check
    CHECK (type IN ('title', 'appraisal_mgmt', 'insurance', 'attorney', 'surveyor', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_spa_org ON service_provider_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_spa_type ON service_provider_accounts(type);

CREATE TABLE IF NOT EXISTS service_provider_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES service_provider_accounts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  title        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spc_account ON service_provider_contacts(account_id);

CREATE TABLE IF NOT EXISTS loan_service_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id      UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  account_id   UUID NOT NULL REFERENCES service_provider_accounts(id),
  contact_id   UUID REFERENCES service_provider_contacts(id),
  role         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  ordered_at   TIMESTAMPTZ,
  received_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT loan_service_providers_role_check
    CHECK (role IN ('title', 'appraiser', 'hazard_insurance', 'flood_insurance', 'attorney', 'other')),
  CONSTRAINT loan_service_providers_status_check
    CHECK (status IN ('pending', 'ordered', 'received', 'cleared'))
);

CREATE INDEX IF NOT EXISTS idx_lsp_loan ON loan_service_providers(loan_id);
CREATE INDEX IF NOT EXISTS idx_lsp_account ON loan_service_providers(account_id);

COMMIT;
