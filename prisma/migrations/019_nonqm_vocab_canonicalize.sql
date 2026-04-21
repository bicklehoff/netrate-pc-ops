-- Migration 019: NonQM adjustment_rules vocab canonicalization (Scenario Vocab Audit PR 4).
--
-- Aligns the Everstream DSCR LLPA rules to the scenario-wide canonical
-- occupancy + loan_purpose vocabulary established in the 2026-04-20 audit.
--
-- Occupancy mapping:    noo      → investment    (3,420 rows)
--                       second   → secondary     (3,420 rows)
--                       primary  → primary       (unchanged, 3,420 rows)
--
-- Loan-purpose mapping: nco_refi → rate_term     (3,420 rows)
--                       co_refi  → cashout       (3,420 rows)
--                       purchase → purchase      (unchanged, 3,420 rows)
--
-- Also normalizes the 7 scenarios.loan_purpose='refinance' rows to the
-- canonical flat 4-value vocab (purchase/rate_term/cashout/streamline).
-- All 7 are DSCR rate-tool scenarios without cashout signals, so rate_term
-- is the correct bucket.
--
-- `adjustment_rules.purpose='irrrl'` (753 VA IRRRL rows) is intentionally
-- LEFT AS-IS. IRRRL matches the Loan Sifter vendor vocabulary and is
-- specific enough that folding it into `streamline` would lose information.
--
-- Sibling PR: code changes (parser SECTION_MAP + widget + calculator +
-- pricing-v2:519/535 secondHome bug) ship together. Migration + code must
-- apply atomically — rate sheet ingest writes canonical going forward.

BEGIN;

-- nonqm_adjustment_rules.occupancy → canonical
UPDATE nonqm_adjustment_rules
   SET occupancy = 'investment'
 WHERE occupancy = 'noo';

UPDATE nonqm_adjustment_rules
   SET occupancy = 'secondary'
 WHERE occupancy = 'second';

-- nonqm_adjustment_rules.loan_purpose → canonical
UPDATE nonqm_adjustment_rules
   SET loan_purpose = 'rate_term'
 WHERE loan_purpose = 'nco_refi';

UPDATE nonqm_adjustment_rules
   SET loan_purpose = 'cashout'
 WHERE loan_purpose = 'co_refi';

-- scenarios.loan_purpose: 7 rows of URLA top-level 'refinance' → flat pricing vocab.
-- All 7 are DSCR rate-tool refi scenarios with no cashout signals, so rate_term.
UPDATE scenarios
   SET loan_purpose = 'rate_term',
       updated_at   = NOW()
 WHERE loan_purpose = 'refinance';

COMMIT;
