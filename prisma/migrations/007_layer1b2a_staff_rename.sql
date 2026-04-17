-- Migration 007: UAD Layer-1b2a — mlos → staff rename + scenarios lead_id backfill
-- Date: 2026-04-17
-- Part of FoH April (D9 Layer 1 — phased rollout, part b2a)
--
-- DESIGN: Zero-downtime table rename via backward-compat view.
--   1. ALTER TABLE mlos RENAME TO staff
--      → FK constraints from other tables survive (PostgreSQL tracks FKs by OID)
--   2. CREATE VIEW mlos AS SELECT * FROM staff
--      → old code with `FROM mlos` keeps working during the code-deploy window
--   3. Add missing UAD columns to staff (license_states, commission_rate, etc.)
--   4. Update role check constraint to UAD enum
--   5. Backfill remaining 44 scenarios.contact_id via lead_id → contact chain
--
-- Strategy:
--   - Run this migration BEFORE merging the code PR. Old deployed code
--     reads via the `mlos` view (still works).
--   - Merge code PR → new code reads `staff` directly.
--   - Migration 008 (later) drops the `mlos` view + legacy tables.
--
-- ZERO DOWNTIME: at every point, code that queries `mlos` or `staff` works.
--
-- Run: node scripts/_run-migration-007.mjs

BEGIN;

-- ============================================================
-- STEP 1: Rename mlos → staff
-- FK constraints (loans.mlo_id etc.) survive — PostgreSQL tracks FKs by OID.
-- ============================================================

ALTER TABLE mlos RENAME TO staff;

-- ============================================================
-- STEP 2: Backward-compat view so FROM mlos keeps resolving
-- Read-only — old code is read-only on this table (verified via grep).
-- ============================================================

CREATE OR REPLACE VIEW mlos AS SELECT * FROM staff;

-- ============================================================
-- STEP 3: Add UAD-spec columns to staff
-- ============================================================

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS license_states TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check,
  DROP CONSTRAINT IF EXISTS mlos_role_check,
  ADD CONSTRAINT staff_role_check
    CHECK (role IN ('broker_owner', 'mlo', 'processor', 'loa', 'admin'));

-- ============================================================
-- STEP 4: Backfill remaining scenarios.contact_id via lead_id fallback
-- Layer-1b1 backfilled 12 of 56 via email lookup. The remaining 44 have
-- no email on the scenario but DO have a lead_id. Chain: scenario.lead_id
-- → lead.email → contact.email → contact.id.
--
-- Idempotent: only touches scenarios where contact_id IS NULL.
-- ============================================================

UPDATE scenarios s
SET contact_id = c.id
FROM leads l
JOIN contacts c ON lower(c.email) = lower(l.email)
WHERE s.contact_id IS NULL
  AND s.lead_id IS NOT NULL
  AND s.lead_id = l.id
  AND l.email IS NOT NULL
  AND l.email != ''
  AND c.organization_id = s.organization_id;

COMMIT;
