-- Migration 050 — add nonqm_rate_sheets.has_dscr boolean
--
-- Per Work/Dev/PRICING-ARCHITECTURE.md §10 AD-1 + AD-5: the multi-lender
-- DSCR loader (loadActiveDscrSheets, planned for D9c.2) needs to skip
-- non-DSCR sheets cheaply. The semantic is "this sheet contains at
-- least one DSCR product."
--
-- Today's only nonqm_rate_sheets row (Everstream) has both 'dscr' and
-- 'bankstatement' product loan_types, so the column initializes TRUE
-- and stays TRUE after the refinement UPDATE. Future sheets without
-- DSCR products (e.g. a Core Non-QM-only sheet) will have has_dscr
-- set to FALSE either by ingest paths setting it explicitly, or by a
-- future replay of the refinement UPDATE in this migration.
--
-- Default TRUE chosen because every nonqm_rate_sheets row in production
-- today has DSCR products. Ingest paths that load DSCR-free sheets are
-- responsible for setting has_dscr = FALSE explicitly at insert time.
--
-- Purely additive (ADD COLUMN with DEFAULT, then idempotent refinement
-- UPDATE). No rehearsal required per DEV-PLAYBOOK.md.

ALTER TABLE nonqm_rate_sheets
  ADD COLUMN IF NOT EXISTS has_dscr BOOLEAN NOT NULL DEFAULT TRUE;

-- Refine: any sheet without a DSCR product gets FALSE. Idempotent —
-- only changes rows whose state doesn't match the actual product
-- distribution. On replay this is a no-op for correctly-set rows.
UPDATE nonqm_rate_sheets s
   SET has_dscr = FALSE
 WHERE has_dscr = TRUE
   AND NOT EXISTS (
     SELECT 1 FROM nonqm_rate_products p
      WHERE p.rate_sheet_id = s.id AND p.loan_type = 'dscr'
   );
