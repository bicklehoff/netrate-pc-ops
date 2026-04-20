-- Migration 015: unify loans.property_type on pricing-native vocab (D7 / Scenario Vocab Audit).
--
-- Before this migration, three parallel vocabularies coexisted for the same
-- concept (see Work/Dev/audits/SCENARIO-VOCABULARY-AUDIT-2026-04-20.md):
--   - Pricing-native:  sfr, condo, townhome, pud, multi_unit, manufactured
--   - Apply-flow:      sfr, condo, townhome, multi_unit, manufactured (ZOD)
--   - MLO-portal:      single_family, condo, townhouse, multi_unit,
--                      manufactured, SFH-Detached, SFH-Attached
--
-- Canonical chosen: pricing-native. Rate parsers already emit this; ZOD
-- already enforces it; MISMO + MCR exporters already translate from it.
-- Only MLO-portal surfaces diverge — those update in the same PR.
--
-- Consequence previously: an MLO-created loan writing property_type=
-- 'single_family' would not match any rate-sheet LLPA rule (rules keyed
-- on 'sfr'), silently missing property-type LLPA adjustments at pricing
-- time.
--
-- Migration 014 (2026-04-20) had earlier moved outliers toward
-- 'single_family' / '2-4unit' — that direction was reversed after the
-- full audit identified pricing-native as the right canonical.
--
-- Idempotent — WHERE clauses target only the legacy values.

BEGIN;

UPDATE loans SET property_type = 'sfr', updated_at = NOW()
 WHERE property_type IN ('single_family', 'SFH-Detached', 'SFH-Attached', 'sitebuilt');

UPDATE loans SET property_type = 'multi_unit', updated_at = NOW()
 WHERE property_type = '2-4unit';

-- Also flip 'townhouse' → 'townhome' if any exist (ZOD canonical uses 'townhome').
UPDATE loans SET property_type = 'townhome', updated_at = NOW()
 WHERE property_type = 'townhouse';

COMMIT;
