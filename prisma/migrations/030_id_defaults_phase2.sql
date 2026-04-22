-- Migration 030: complete migration 021 — id defaults on remaining 22 tables.
--
-- Context:
-- Migration 021 (2026-04-21) patched `DEFAULT gen_random_uuid()` on 7 core
-- tables (loans, contacts, loan_events, loan_borrowers, documents, call_logs,
-- staff) after the Payam Kavousi corebot-ingest silent-drop bug surfaced. That
-- fix was correct but scoped — it only patched the tables involved in that
-- incident, not the whole class of bug across the schema.
--
-- 22 public-schema tables still have `id UUID NOT NULL` with NO DEFAULT, so
-- any INSERT that forgets to supply an explicit `gen_random_uuid()` fails with
-- "null value in column id of relation … violates not-null constraint" —
-- silently, in any path that catches the error.
--
-- Surfaced via /api/dialer/sms/send during live phone-app testing (2026-04-22).
-- Twilio delivered the SMS successfully; our DB INSERT failed; the route
-- returned 500 to the browser while the message was already on the wire. Bad
-- UX, worse data-integrity (sms_messages row never persisted).
--
-- Verified via live replication on prod:
--   INSERT INTO sms_messages (organization_id, direction, from_number,
--     to_number, body) VALUES (…, 'outbound', '+1', '+1', 'test');
--   → "null value in column id … violates not-null constraint"
--
-- This migration closes the class. Metadata-only (no data rewrite), fully
-- idempotent (SET DEFAULT on a column that already has one is a no-op).
-- Same pattern as migration 021; same rationale; this is 021 part 2.
--
-- Framed as D4 (Data Integrity) follow-up in Work/Dev/audits/README.md.

BEGIN;

-- Messaging & activity log
ALTER TABLE sms_messages       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_notes         ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Loan-related operational tables
ALTER TABLE loan_notes         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_tasks         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_dates         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE conditions         ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Loan modules (application segments)
ALTER TABLE loan_assets        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_conv          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_declarations  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_dscr          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_employments   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_fha           ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_hecm          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_incomes       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_liabilities   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_reos          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_transactions  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_va            ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Rate pipeline
ALTER TABLE adjustment_rules   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE rate_lenders       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE rate_prices        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE rate_products      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE rate_sheets        ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Fee catalog
ALTER TABLE fee_templates      ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;
