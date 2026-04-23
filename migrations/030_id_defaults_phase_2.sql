-- Migration 030 — id defaults phase 2 (reconstructed)
--
-- Context:
--   Migration 021 (2026-04-17) added `DEFAULT gen_random_uuid()` to the
--   `id` column on 7 core tables (loans, contacts, loan_events,
--   loan_borrowers, documents, call_logs, staff) after the Zoho corebot
--   ingest webhook surfaced silent-insert bugs.
--
--   Migration 030 was run against prod (referenced in session log
--   cmoak85d8fxk0db1h: "migration 030 (id defaults phase 2, 24 tables)")
--   but the SQL file was never committed to source control.
--
--   This file reconstructs the migration for source-control fidelity.
--   It is idempotent — ALTER COLUMN ... SET DEFAULT to the same value is
--   a no-op in Postgres. Safe to replay on any environment.
--
-- Effect:
--   For every `public` table with a `uuid` column named `id` that does
--   NOT yet have `gen_random_uuid()` as its default, set the default.
--   Excludes the 7 tables already handled by migration 021.
--
-- Post-run state (verified against prod 2026-04-23):
--   53/53 tables with UUID id columns have DEFAULT gen_random_uuid().

DO $mig030$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'id'
      AND c.data_type = 'uuid'
      AND (c.column_default IS NULL
           OR c.column_default NOT LIKE '%gen_random_uuid%')
      AND c.table_name NOT IN (
        'loans', 'contacts', 'loan_events', 'loan_borrowers',
        'documents', 'call_logs', 'staff'
      )
    ORDER BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', tbl);
    RAISE NOTICE 'migration 030: set default on %', tbl;
  END LOOP;
END
$mig030$;
