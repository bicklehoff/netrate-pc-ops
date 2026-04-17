-- Migration 005: UAD Layer 1 — identity consolidation
-- Date: 2026-04-17
-- Part of FoH April (D9 Layer 1)
--
-- What this migration does:
--   1. Expands `contacts` with auth + legal-name fields absorbed from `borrowers`.
--   2. Merges `borrowers` rows into `contacts` (3 cases: linked pairs,
--      email collisions, orphan borrowers).
--   3. Rewrites all FKs pointing at `borrowers.id` to point at `contacts.id`.
--   4. Renames `loans.borrower_id` → `loans.contact_id` (column + relation name).
--   5. Renames `mlos` → `staff` and adds UAD-spec columns.
--   6. Creates new `loan_participants` table and populates from `loan_contacts`
--      (840 rows, role='borrower' → role='primary_borrower') + 26 `loan_borrowers`.
--   7. Creates empty `service_provider_accounts`, `service_provider_contacts`,
--      `loan_service_providers` tables for future Order-Outs work.
--   8. Backfills `scenarios.contact_id` via email lookup.
--   9. Drops `borrowers`, `loan_borrowers`, `loan_contacts`, `contacts.borrower_id`.
--
-- Design decisions (recorded in Work/Dev/UAD-SPEC.md and UAD-LAYER-1-MIGRATION-PLAN.md):
--   - Loans stays as `loans` (David 2026-04-17 — "Loans = Deals, Loans is more accurate").
--     Sub-tables (loan_events, loan_dates, loan_notes, loan_tasks, conditions,
--     documents) keep their loan_id FKs unchanged.
--   - `loan_borrowers` + `loan_contacts` both fold into `loan_participants`
--     (David 2026-04-17 — "A: build clean, hardly any data").
--   - `status='settled'` semantics preserved (already in production data:
--     761 of 842 loans are settled per dry-run).
--
-- Pre-run checks (verified via scripts/layer-1-dry-run.mjs on 2026-04-17):
--   - 837 borrowers, 773 contacts, 2 mlos, 842 loans
--   - 481 borrower+contact linked pairs (contacts.borrower_id set)
--   - 229 email collisions (borrower+contact with same email, no FK link) — all 1:1
--   - 356 orphan borrowers (no matching contact at all)
--   - 292 CRM-only contacts (borrower_id is null) — stay as-is
--   - 0 borrowers have password_hash set → zero active portal sessions → zero user disruption
--   - loan_contacts: 840 rows, 100% role='borrower'
--   - 1003 sub-tables (loan_employments, loan_incomes, loan_assets, etc.)
--     are declared in Prisma but DO NOT exist in production DB. This migration
--     does not touch them (they remain Prisma-declared, unmigrated).
--
-- Rollback: Neon point-in-time recovery. This migration is NOT reversible in code
-- because it drops source tables.
--
-- Run: node scripts/_run-migration-005.mjs

BEGIN;

-- ============================================================
-- STEP 1: Expand contacts with borrower-origin auth/PII columns
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

-- Add check constraint on role enum (per UAD AD-3/15)
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_role_check,
  ADD CONSTRAINT contacts_role_check
    CHECK (role IN ('borrower', 'co_borrower', 'realtor'));

-- Add check constraint on marketing_stage (per UAD AD-8)
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_marketing_stage_check,
  ADD CONSTRAINT contacts_marketing_stage_check
    CHECK (marketing_stage IN ('lead', 'in_process', 'closed', 'past_client'));

-- ============================================================
-- STEP 2: Build borrower→contact mapping (temp table)
--
-- For each borrower, determine which contact UUID they map to:
--   - Case 1 (linked pair): contacts.borrower_id = borrowers.id → use that contact's id
--   - Case 2 (email collision): borrower.email == contact.email, no FK → use that contact's id
--   - Case 3 (orphan): no match → new contact will be created with borrower's UUID
-- ============================================================

CREATE TEMP TABLE borrower_contact_map AS
SELECT
  b.id AS old_borrower_id,
  COALESCE(
    -- Case 1: existing FK link
    (SELECT c1.id FROM contacts c1 WHERE c1.borrower_id = b.id LIMIT 1),
    -- Case 2: email collision (lower-case match, only where contact has no FK)
    (SELECT c2.id FROM contacts c2
       WHERE c2.borrower_id IS NULL
         AND c2.email IS NOT NULL
         AND lower(c2.email) = lower(b.email)
       LIMIT 1),
    -- Case 3: no match — use borrower's own UUID for the new contact row
    b.id
  ) AS new_contact_id,
  CASE
    WHEN EXISTS(SELECT 1 FROM contacts WHERE borrower_id = b.id) THEN 'linked'
    WHEN EXISTS(SELECT 1 FROM contacts WHERE borrower_id IS NULL AND lower(email) = lower(b.email)) THEN 'collision'
    ELSE 'orphan'
  END AS merge_case
FROM borrowers b;

CREATE INDEX ON borrower_contact_map (old_borrower_id);
CREATE INDEX ON borrower_contact_map (new_contact_id);

-- ============================================================
-- STEP 3: Merge Case 1 — 481 linked pairs
-- UPDATE contact with borrower's auth/PII. Contact's id stays unchanged.
-- ============================================================

UPDATE contacts c
SET
  dob_encrypted    = b.dob_encrypted,
  ssn_encrypted    = b.ssn_encrypted,
  ssn_last_four    = b.ssn_last_four,
  phone_verified   = b.phone_verified,
  password_hash    = b.password_hash,
  magic_token      = b.magic_token,
  magic_expires    = b.magic_expires,
  sms_code         = b.sms_code,
  sms_code_expires = b.sms_code_expires,
  sms_attempts     = b.sms_attempts,
  sms_locked_until = b.sms_locked_until,
  legal_first_name = b.legal_first_name,
  legal_last_name  = b.legal_last_name,
  nickname         = b.nickname,
  -- prefer existing contact.email/phone (CRM-side was more likely curated)
  email            = COALESCE(c.email, b.email),
  phone            = COALESCE(c.phone, b.phone)
FROM borrowers b
WHERE c.borrower_id = b.id;

-- ============================================================
-- STEP 4: Merge Case 2 — 229 email collisions
-- Contact has no FK but matches by email. Merge borrower's auth/PII into contact.
-- Set contacts.borrower_id = borrower.id (temporary, will be dropped in Step 10).
-- ============================================================

UPDATE contacts c
SET
  dob_encrypted    = COALESCE(c.dob_encrypted, b.dob_encrypted),
  ssn_encrypted    = COALESCE(c.ssn_encrypted, b.ssn_encrypted),
  ssn_last_four    = COALESCE(c.ssn_last_four, b.ssn_last_four),
  phone_verified   = b.phone_verified OR c.phone_verified,
  password_hash    = COALESCE(c.password_hash, b.password_hash),
  magic_token      = COALESCE(c.magic_token, b.magic_token),
  magic_expires    = COALESCE(c.magic_expires, b.magic_expires),
  sms_code         = COALESCE(c.sms_code, b.sms_code),
  sms_code_expires = COALESCE(c.sms_code_expires, b.sms_code_expires),
  sms_attempts     = GREATEST(COALESCE(c.sms_attempts, 0), COALESCE(b.sms_attempts, 0)),
  sms_locked_until = COALESCE(c.sms_locked_until, b.sms_locked_until),
  legal_first_name = COALESCE(c.legal_first_name, b.legal_first_name),
  legal_last_name  = COALESCE(c.legal_last_name, b.legal_last_name),
  nickname         = COALESCE(c.nickname, b.nickname),
  phone            = COALESCE(c.phone, b.phone),
  borrower_id      = b.id
FROM borrowers b
WHERE c.borrower_id IS NULL
  AND c.email IS NOT NULL
  AND lower(c.email) = lower(b.email);

-- ============================================================
-- STEP 5: Merge Case 3 — 356 orphan borrowers
-- INSERT new contact rows preserving borrower's UUID (no FK rewrite needed
-- for these; their old borrower_id == new contact_id).
-- ============================================================

INSERT INTO contacts (
  id, organization_id, first_name, last_name, email, phone,
  dob_encrypted, ssn_encrypted, ssn_last_four, phone_verified,
  password_hash, magic_token, magic_expires,
  sms_code, sms_code_expires, sms_attempts, sms_locked_until,
  legal_first_name, legal_last_name, nickname,
  role, marketing_stage, source, created_at, updated_at, borrower_id
)
SELECT
  b.id, b.organization_id, b.first_name, b.last_name, b.email, b.phone,
  b.dob_encrypted, b.ssn_encrypted, b.ssn_last_four, b.phone_verified,
  b.password_hash, b.magic_token, b.magic_expires,
  b.sms_code, b.sms_code_expires, b.sms_attempts, b.sms_locked_until,
  b.legal_first_name, b.legal_last_name, b.nickname,
  'borrower', 'lead', 'borrower-migration', b.created_at, b.updated_at, b.id
FROM borrowers b
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.borrower_id = b.id)
  AND NOT EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.borrower_id IS NULL
      AND c.email IS NOT NULL
      AND lower(c.email) = lower(b.email)
  );

-- ============================================================
-- STEP 6: Rewrite loans.borrower_id → contact.id via mapping
-- ============================================================

UPDATE loans l
SET borrower_id = m.new_contact_id
FROM borrower_contact_map m
WHERE l.borrower_id = m.old_borrower_id
  AND m.old_borrower_id != m.new_contact_id;

-- ============================================================
-- STEP 7: Rename loans.borrower_id → loans.contact_id
-- Drop old FK constraint, rename column, add new FK constraint pointing at contacts.
-- ============================================================

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_borrower_id_fkey;
ALTER TABLE loans RENAME COLUMN borrower_id TO contact_id;
ALTER TABLE loans
  ADD CONSTRAINT loans_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id);

-- Drop the old index on borrower_id if it exists, create new index on contact_id
DROP INDEX IF EXISTS idx_loans_borrower_id;
CREATE INDEX IF NOT EXISTS idx_loans_contact_id ON loans(contact_id);

-- ============================================================
-- STEP 8: Rename mlos → staff and add UAD columns
-- Existing FKs (mlo_id columns in other tables) keep pointing at the same
-- UUIDs — PostgreSQL tracks FK constraints by OID, so table rename is safe.
-- ============================================================

ALTER TABLE mlos RENAME TO staff;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS license_states TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Expand role check to UAD-spec enum (keep backward compat with existing values)
ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check,
  ADD CONSTRAINT staff_role_check
    CHECK (role IN ('broker_owner', 'mlo', 'processor', 'loa', 'admin'));

-- ============================================================
-- STEP 9: Create loan_participants (replaces loan_borrowers + loan_contacts)
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_participants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id              UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  contact_id           UUID REFERENCES contacts(id),
  staff_id             UUID REFERENCES staff(id),
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

-- Enforce that a person appears at most once per loan
CREATE UNIQUE INDEX IF NOT EXISTS loan_participants_loan_contact_uniq
  ON loan_participants(loan_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loan_participants_loan_staff_uniq
  ON loan_participants(loan_id, staff_id) WHERE staff_id IS NOT NULL;

-- ============================================================
-- STEP 10: Populate loan_participants
-- From loan_contacts (840 rows, all role='borrower') — role='primary_borrower'
-- ============================================================

INSERT INTO loan_participants (
  loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
)
SELECT
  lc.loan_id,
  lc.contact_id,
  'primary_borrower',
  COALESCE(CASE WHEN lc.is_primary THEN 0 ELSE 1 END, 0),
  COALESCE(l.organization_id, '00000000-0000-4000-8000-000000000001'),
  COALESCE(lc.created_at, now()),
  COALESCE(lc.updated_at, now())
FROM loan_contacts lc
JOIN loans l ON l.id = lc.loan_id
-- Dedupe: loan_contacts.unique(loanId, contact_id) already enforces this,
-- but we also guard against loan_contacts rows that have a null contact_id
WHERE lc.contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 11: Migrate loan_borrowers (26 rows) into loan_participants
-- loan_borrowers.borrower_id needs remap via the map.
-- ============================================================

INSERT INTO loan_participants (
  loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
)
SELECT
  lb.loan_id,
  m.new_contact_id,
  CASE WHEN lb.ordinal = 0 THEN 'primary_borrower' ELSE 'co_borrower' END,
  lb.ordinal,
  COALESCE(l.organization_id, '00000000-0000-4000-8000-000000000001'),
  COALESCE(lb.created_at, now()),
  COALESCE(lb.updated_at, now())
FROM loan_borrowers lb
JOIN borrower_contact_map m ON m.old_borrower_id = lb.borrower_id
JOIN loans l ON l.id = lb.loan_id
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 12: Service provider tables (empty — populated by future Layer 3 work)
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

-- ============================================================
-- STEP 13: Backfill scenarios.contact_id via email lookup
-- 56 scenarios have borrower_email strings but 0 have contact_id populated.
-- ============================================================

UPDATE scenarios s
SET contact_id = c.id
FROM contacts c
WHERE s.contact_id IS NULL
  AND s.borrower_email IS NOT NULL
  AND s.borrower_email != ''
  AND lower(c.email) = lower(s.borrower_email)
  AND c.organization_id = s.organization_id;

-- ============================================================
-- STEP 14: Drop borrowers table + loan_borrowers + loan_contacts
-- At this point all FKs have been rewritten.
-- ============================================================

-- Drop borrowers FK constraint from contacts first
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_borrower_id_fkey;

-- Drop dependent tables first (they have FKs to borrowers and/or loans)
DROP TABLE IF EXISTS loan_borrowers;
DROP TABLE IF EXISTS loan_contacts;

-- Drop borrowers table
DROP TABLE IF EXISTS borrowers;

-- Drop the now-vestigial borrower_id column on contacts
ALTER TABLE contacts DROP COLUMN IF EXISTS borrower_id;

-- ============================================================
-- STEP 15: Verification anchors (informational — runner script checks these)
-- ============================================================

-- Assert: borrowers table no longer exists
-- Assert: every loan has a contact_id
-- Assert: loan_participants has at least 840 rows (was 840 loan_contacts + up to 26 loan_borrowers dedupe)
-- Assert: contacts row count = (original 773) + (356 orphan inserts) = 1129

COMMIT;
