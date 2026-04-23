-- Migration 033 — indexes on unindexed FK columns
--
-- Context:
--   DB structure audit (Work/Dev/audits/DB-STRUCTURE-2026-04-23.md §7.1)
--   surfaced 24 FK columns without a covering index. Missing indexes on
--   FK columns cause slow parent→child JOINs and slow ON DELETE/UPDATE
--   cascade checks.
--
--   All 24 were verified against prod via pre-flight on 2026-04-23.
--
-- Effect:
--   Adds a non-partial btree index on each FK column. IF NOT EXISTS on
--   every index, so the migration is idempotent and safe to replay.
--
-- Naming convention:
--   idx_<table>_<column>
--   (consistent with existing indexes in the schema.)
--
-- No locking concerns:
--   CREATE INDEX IF NOT EXISTS acquires a SHARE UPDATE EXCLUSIVE lock —
--   concurrent reads and writes are unaffected. Total size added is
--   small (low row counts on all affected tables).

CREATE INDEX IF NOT EXISTS idx_adjustment_rules_lender_id            ON adjustment_rules (lender_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_call_log_id                ON call_notes (call_log_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_mlo_id                     ON call_notes (mlo_id);
CREATE INDEX IF NOT EXISTS idx_conditions_depends_on_id              ON conditions (depends_on_id);
CREATE INDEX IF NOT EXISTS idx_conditions_document_id                ON conditions (document_id);
CREATE INDEX IF NOT EXISTS idx_documents_loan_id                     ON documents (loan_id);
CREATE INDEX IF NOT EXISTS idx_documents_requested_by                ON documents (requested_by);
CREATE INDEX IF NOT EXISTS idx_hecm_scenarios_mlo_id                 ON hecm_scenarios (mlo_id);
CREATE INDEX IF NOT EXISTS idx_homepage_rate_cache_scenario_slug     ON homepage_rate_cache (scenario_slug);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id                      ON leads (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_borrowers_contact_id             ON loan_borrowers (contact_id);
CREATE INDEX IF NOT EXISTS idx_loan_borrowers_loan_id                ON loan_borrowers (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_events_loan_id                   ON loan_events (loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_service_providers_contact_id     ON loan_service_providers (contact_id);
CREATE INDEX IF NOT EXISTS idx_loans_mlo_id                          ON loans (mlo_id);
CREATE INDEX IF NOT EXISTS idx_nonqm_adjustment_rules_rate_sheet_id  ON nonqm_adjustment_rules (rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_nonqm_rate_products_rate_sheet_id     ON nonqm_rate_products (rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_prices_product_id                ON rate_prices (product_id);
CREATE INDEX IF NOT EXISTS idx_rate_products_lender_id               ON rate_products (lender_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_lender_id                 ON rate_sheets (lender_id);
CREATE INDEX IF NOT EXISTS idx_scenario_alert_queue_scenario_id      ON scenario_alert_queue (scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_parent_scenario_id          ON scenarios (parent_scenario_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_mlo_id                   ON sms_messages (mlo_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_ticket_id              ON ticket_entries (ticket_id);
