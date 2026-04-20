-- Migration 017: loans.loan_term months → years (D7 / Scenario Vocab Audit PR 3).
--
-- Unifies loan_term unit across the system. Before: loans.loan_term was
-- months (MISMO/LDox convention), scenarios.term + rate_products.term +
-- contacts.current_loan_term were years. Multiple code paths carried ad-hoc
-- translations (payroll/route divides by 12 for display; PipelineTable
-- renders "360yr" for a 30-year loan — a silent display bug).
--
-- After: everything internal is years. Translation happens at external
-- boundaries only: MISMO XML in/out multiplies/divides by 12; LDox
-- ingest divides by 12; CD-extractor LLM prompt returns years.
--
-- Standard-value rows (120/180/240/300/360/480 months) convert cleanly.
-- 16 legacy Zoho-import rows have anomalous values (144/228/336/348
-- months — likely remaining-term stored in original-term column).
-- All 16 are archived/settled historical loans with fake-looking loan
-- numbers (e.g. '1.32E+11' Excel scientific-notation leaks). They
-- convert via Math.round(v/12) to preserve the ratio; the single
-- term=30 row is Rocket Mortgage archived (not our loan) and already
-- looks like years — set to NULL to mark as unknown.

BEGIN;

-- FIRST: null the single outlier row that was already in years (Rocket
-- Mortgage archived) — must happen BEFORE the /12 pass converts legitimate
-- 360-month rows to 30. Otherwise the cleanup targets the wrong rows.
UPDATE loans
   SET loan_term = NULL,
       updated_at = NOW()
 WHERE loan_term = 30
   AND loan_number = '3551407285';

-- Standard values: exact division
UPDATE loans
   SET loan_term = loan_term / 12,
       updated_at = NOW()
 WHERE loan_term IN (120, 180, 240, 300, 360, 480);

-- Anomalous values: round to nearest year (preserves ratio for historical fidelity)
UPDATE loans
   SET loan_term = ROUND(loan_term / 12.0)::int,
       updated_at = NOW()
 WHERE loan_term IN (144, 228, 336, 348);

COMMIT;
