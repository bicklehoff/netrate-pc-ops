-- Migration 038 — rename leftover `mlos_email_key` index to `staff_email_key`
--
-- Context:
--   Migration 007 (2026-04-17, Layer-1b2a) renamed the `mlos` table to
--   `staff` but the UNIQUE index on `email` kept its old name
--   `mlos_email_key` because Postgres doesn't auto-rename the index when
--   you RENAME TABLE. Cosmetic inconsistency that confuses anyone
--   reading \d+ staff.
--
-- Effect:
--   Renames the existing `mlos_email_key` index to `staff_email_key`.
--   Index function, columns, and data are unchanged.
--
-- Idempotence:
--   Guarded — only renames if the old name still exists AND the new
--   name does not. Safe to replay.

DO $mig038$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'staff'
      AND indexname = 'mlos_email_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'staff'
      AND indexname = 'staff_email_key'
  )
  THEN
    ALTER INDEX public.mlos_email_key RENAME TO staff_email_key;
    RAISE NOTICE 'migration 038: renamed mlos_email_key → staff_email_key';
  ELSE
    RAISE NOTICE 'migration 038: no rename needed';
  END IF;
END
$mig038$;
