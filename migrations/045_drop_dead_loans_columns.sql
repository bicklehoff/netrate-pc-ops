-- Migration 045 — drop dead duplicate columns on loans
--
-- Context:
--   Work/Dev/UAD-LAYER-D9E-PLAN.md §4.1 migration 045 (scoped down from
--   the plan's candidate list to only the 2 columns verified safe via
--   src/ audit 2026-04-23).
--
--   Both columns are 0 rows in prod AND have zero readers/writers in
--   src/. Each is a duplicate of a better-placed column:
--
--   loans.dscr_ratio → superseded by loan_dscr.dscr_ratio (satellite)
--                      and scenarios.dscr_ratio (quote-time). Added in
--                      migration 004 before the satellite pattern matured.
--
--   loans.unit_count → duplicate of loans.num_units (the MISMO field,
--                      89% populated). Added in migration 004 for DSCR.
--
--   The other candidates the plan flagged (cd_file_name, account_exec,
--   broker_processor) have active src/ references that need refactor
--   before their columns can drop — deferred to separate cleanup PRs.
--   num_borrowers is NOT dead (846/846 populated, 2 distinct values) —
--   removed from drop list entirely.
--
-- Destructive DDL but idempotent via IF EXISTS. Zero data loss risk
-- (columns are 0 rows).

ALTER TABLE loans DROP COLUMN IF EXISTS dscr_ratio;
ALTER TABLE loans DROP COLUMN IF EXISTS unit_count;
