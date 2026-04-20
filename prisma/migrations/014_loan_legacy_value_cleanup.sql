-- Migration 014: normalize legacy loan value outliers (D7 data cleanup).
--
-- Dropdowns (src/lib/constants/picklists.js + ref_loan_types) use canonical
-- codes, but historical loan rows carry variants from older import scripts
-- and manual entry. Consolidates:
--
--   loans.property_type:
--     'sfr'            (2)  → 'single_family'
--     'SFH-Detached'   (11) → 'single_family'
--     'sitebuilt'      (6)  → 'single_family'
--     'Condo'          (1)  → 'condo'          (case fix)
--     'multi_unit'     (1)  → '2-4unit'        (align w/ picklists.js)
--
--   loans.occupancy:
--     'primary_residence' (1) → 'primary'
--
--   loans.loan_type:
--     'Conventional'   (1)  → 'conventional'   (case fix)
--
-- Safe: dropdowns reflect the canonical target, so re-edited rows already
-- need to round-trip through the new value. Not backed by user-visible
-- data beyond the dropdown (MCR/XML exports use the stored string
-- directly; normalizing to canonical gives cleaner output).
--
-- Idempotent — WHERE clauses target only the legacy values.

BEGIN;

-- property_type
UPDATE loans SET property_type = 'single_family', updated_at = NOW()
 WHERE property_type IN ('sfr', 'SFH-Detached', 'sitebuilt');

UPDATE loans SET property_type = 'condo', updated_at = NOW()
 WHERE property_type = 'Condo';

UPDATE loans SET property_type = '2-4unit', updated_at = NOW()
 WHERE property_type = 'multi_unit';

-- occupancy
UPDATE loans SET occupancy = 'primary', updated_at = NOW()
 WHERE occupancy = 'primary_residence';

-- loan_type
UPDATE loans SET loan_type = 'conventional', updated_at = NOW()
 WHERE loan_type = 'Conventional';

COMMIT;
