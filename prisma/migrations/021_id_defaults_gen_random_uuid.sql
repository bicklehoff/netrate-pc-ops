-- Migration 021: set DEFAULT gen_random_uuid() on id columns that lack one.
--
-- Context:
-- Seven tables in the public schema have `id UUID NOT NULL` with NO DEFAULT.
-- This means every INSERT site must manually supply the id via
-- `gen_random_uuid()`; forgetting it fails with
-- `null value in column "id" of relation "<table>" violates not-null
-- constraint` — and does so silently in any path that catches the error
-- and returns a non-throwing response (e.g. the corebot ingest webhook).
--
-- Discovered via a specific borrower lead (Payam Kavousi / loan I-0284)
-- that never made it into loans because the corebot ingest INSERT was
-- missing `gen_random_uuid()`. PR #97 (2026-04-17) fixed three call
-- sites but never patched the table defaults — so any future INSERT
-- on any of the 7 tables is a latent silent-failure.
--
-- This migration patches the root cause at the schema level. Idempotent:
-- setting a DEFAULT on a column that already has one is a no-op.
--
-- Framed as D4 (Data Integrity) follow-up in Work/Dev/audits/README.md.

BEGIN;

ALTER TABLE loans          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE contacts       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_events    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE loan_borrowers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE documents      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_logs      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE staff          ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;
