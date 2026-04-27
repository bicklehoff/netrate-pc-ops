-- Migration 052 — D9c PR-1 / Phase 0 — retire legacy rate_alerts table
-- Date: 2026-04-27
-- Spec: Work/Dev/audits/D9C-PR1-PHASE0-NAMESPACE-INVENTORY-2026-04-27.md
--
-- Drops the legacy rate_alerts table. The table was a write-only artifact:
--   - One writer (POST /api/rate-alert) — being deleted in this PR
--   - Zero readers — no cron, no API, no UI surface ever queried it
--   - All current rows are bot signups (sub-5-second auto-confirms,
--     last_notified_at NULL across all rows, notify_count=0 across all rows)
--
-- The new rate_alerts table (different schema, AD-10a-shaped) is created
-- in migration 053 (Phase 1).
--
-- Row archive: the runner _run-migration-052.mjs dumps all rows to
-- Work/Dev/audits/legacy-rate-alerts-snapshot-<timestamp>.json before drop.
-- That file is committed alongside the migration for audit purposes.
--
-- Idempotent: DROP TABLE IF EXISTS.

BEGIN;

DROP TABLE IF EXISTS rate_alerts CASCADE;

COMMIT;
