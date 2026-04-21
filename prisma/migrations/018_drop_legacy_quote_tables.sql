-- Migration 018: drop legacy borrower_quotes + saved_scenarios tables (D6 PR 14).
--
-- Context: D6 unified the three separate quote/scenario stores (borrower_quotes,
-- saved_scenarios, MLO quote storage) into a single `scenarios` table with
-- scoped visibility. PRs #63-#68 shipped the schema, backfill, DAL, and API
-- migrations. PR #64 backfilled 43 borrower_quotes + 13 saved_scenarios into
-- scenarios, preserving UUIDs.
--
-- Soak complete: last write to borrower_quotes was 2026-04-14 (>7 days),
-- last write to saved_scenarios was 2026-04-07 (>14 days). Both tables are
-- cold and every row has a parity copy in scenarios (verified 2026-04-21).
--
-- Blocker before drop: scenario_alert_queue.scenario_id carries an FK
-- pointing to saved_scenarios.id. The constraint is currently satisfied
-- only because the backfill preserved UUIDs (all 13 saved_scenarios.id
-- values also exist in scenarios.id). We redirect the FK to scenarios.id
-- BEFORE dropping the legacy parent table.
--
-- Rollback path: Neon PITR. Re-run requires restoring both tables, the
-- self-FK on borrower_quotes, and the old FK on scenario_alert_queue.

BEGIN;

-- 1. Redirect scenario_alert_queue.scenario_id FK from saved_scenarios → scenarios.
ALTER TABLE scenario_alert_queue
  DROP CONSTRAINT scenario_alert_queue_scenario_id_fkey;

ALTER TABLE scenario_alert_queue
  ADD CONSTRAINT scenario_alert_queue_scenario_id_fkey
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE;

-- 2. Drop legacy tables. borrower_quotes has a self-referential FK
--    (parent_quote_id → borrower_quotes.id) which drops with the table.
DROP TABLE saved_scenarios;
DROP TABLE borrower_quotes;

COMMIT;
