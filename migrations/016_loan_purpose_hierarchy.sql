-- Migration 016: loan purpose URLA hierarchy (D7 / Scenario Vocab Audit PR 2).
--
-- Adds 3-level URLA hierarchy for loan purpose:
--   Level 1  loans.purpose          = purchase | refinance
--   Level 2  loans.refi_purpose     = rate_term | limited | cashout | streamline  (only if refinance)
--   Level 3  loans.cashout_reason   = debt_consolidation | home_improvement | other  (only if cashout)
--
-- Schema: ADD COLUMN loans.cashout_reason TEXT (new).
--
-- Data normalization — 95 loans have legacy LDOX-style refi_purpose strings
-- (from corebot/ingest). Mapping:
--   'Rate and Term Change'  (35) → refi_purpose = 'rate_term'
--   'Debt Consolidation'    (21) → refi_purpose = 'cashout', cashout_reason = 'debt_consolidation'
--   'Home Improvement'      (12) → refi_purpose = 'cashout', cashout_reason = 'home_improvement'
--   'Other'                 (27) → refi_purpose = NULL (per David 2026-04-20:
--                                  "never could figure out what Other was, not helpful, ignore")
--
-- Idempotent — WHERE clauses target only legacy values.
-- Does not touch loans.purpose column (top-level purchase/refinance unchanged).

BEGIN;

-- Schema addition — additive, no backfill value required (NULL fine)
ALTER TABLE loans ADD COLUMN IF NOT EXISTS cashout_reason TEXT;

-- Normalize existing refi_purpose values
UPDATE loans
   SET refi_purpose = 'rate_term', updated_at = NOW()
 WHERE refi_purpose = 'Rate and Term Change';

UPDATE loans
   SET refi_purpose = 'cashout', cashout_reason = 'debt_consolidation', updated_at = NOW()
 WHERE refi_purpose = 'Debt Consolidation';

UPDATE loans
   SET refi_purpose = 'cashout', cashout_reason = 'home_improvement', updated_at = NOW()
 WHERE refi_purpose = 'Home Improvement';

UPDATE loans
   SET refi_purpose = NULL, updated_at = NOW()
 WHERE refi_purpose = 'Other';

COMMIT;
