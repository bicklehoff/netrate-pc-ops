-- Migration 051 — rename rule_type 'prepay' → 'prepay_joint'
--
-- Context: D9c.6a (PR #224) introduced `prepay_term` and `prepay_structure`
-- for ResiCentral's additive prepay model (term LLPA + structure LLPA sum
-- independently). Everstream uses a fundamentally different model: a joint
-- (term × structure) matrix where a single LLPA covers both dimensions
-- simultaneously. Merging the two into a shared rule_type would require
-- decomposing joint LLPAs into additive parts, which cannot be done without
-- knowing the underlying workbook values.
--
-- Resolution: distinguish the two models explicitly.
--   prepay_joint     — Everstream: match by (prepay_years, feature) together,
--                      single LLPA for the combination.
--   prepay_term      — ResiCentral: match by prepay_years, term LLPA only.
--   prepay_structure — ResiCentral: match by feature, structure LLPA only.
--
-- This migration renames the data. Companion code changes:
--   - everstream-llpas.js: emits 'prepay_joint' instead of 'prepay'
--   - price-dscr.js: matches on 'prepay_joint', removes "temporary" note
--
-- Idempotent: re-running when already migrated affects 0 rows (WHERE clause
-- matches no rows) and returns cleanly.

UPDATE nonqm_adjustment_rules
   SET rule_type = 'prepay_joint'
 WHERE rule_type = 'prepay';
