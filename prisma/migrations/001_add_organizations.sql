-- Migration: Add Organizations
-- Date: 2026-04-14
-- Purpose: Create organizations table and add organization_id FK to core tables.
-- NetRate Mortgage is seeded as org 1 (deterministic UUID).
-- All existing rows get org_id = NetRate via DEFAULT constraint.
--
-- Run: psql $DATABASE_URL -f prisma/migrations/001_add_organizations.sql
-- Or: copy-paste into Neon SQL Editor

BEGIN;

-- ─── 1. Create organizations table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  nmls TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address JSONB,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Seed NetRate Mortgage as org 1 ──────────────────────────────

INSERT INTO organizations (id, name, slug, nmls, phone, email, website, address, is_active)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'NetRate Mortgage',
  'netrate',
  '1111861',
  '303-444-5251',
  'david@netratemortgage.com',
  'https://www.netratemortgage.com',
  '{"street": "357 S McCaslin Blvd #200", "city": "Louisville", "state": "CO", "zip": "80027"}'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Add organization_id to core tables ──────────────────────────
-- DEFAULT ensures all existing rows get NetRate org_id automatically.
-- NOT NULL enforces every future row must have an org.

-- MLOs (loan officers belong to an org)
ALTER TABLE mlos
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Loans
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Borrowers
ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Contacts (CRM)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Accounts (partner directory)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Call logs
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- SMS messages
ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- HECM scenarios
ALTER TABLE hecm_scenarios
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Tickets (backlog)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Borrower quotes
ALTER TABLE borrower_quotes
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- Saved scenarios (rate alerts)
ALTER TABLE saved_scenarios
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES organizations(id);

-- ─── 4. Create indexes for org-scoped queries ──────────────────────

CREATE INDEX IF NOT EXISTS idx_mlos_org ON mlos(organization_id);
CREATE INDEX IF NOT EXISTS idx_loans_org ON loans(organization_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_org ON borrowers(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org ON call_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_org ON sms_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_hecm_scenarios_org ON hecm_scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_borrower_quotes_org ON borrower_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_org ON saved_scenarios(organization_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_loans_org_status ON loans(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_org_mlo ON loans(organization_id, mlo_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_status ON contacts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(organization_id, status);

COMMIT;
