-- Migration 009: UAD Layer-1c — scenarios.contact_id bridge catchup + index
-- Date: 2026-04-17
-- Part of FoH April (D9 Layer 1 capstone — the denormalization cleanup)
--
-- DESIGN: Idempotent catchup. Picks up scenarios whose identity bridge
-- became available since migration 006 ran.
--   Step 1: Scenarios whose lead has since been converted to a contact
--           — pull `scenarios.contact_id` from `leads.contact_id`.
--   Step 2: Re-run migration 006's email-match in case new contacts
--           were created between 006 and now that share a borrower_email.
--   Step 3: Ensure idx_scenarios_contact_id exists for the new LEFT JOIN
--           in the scenario DAL.
--
-- SCOPE — NOT DOING:
--   - No aggressive contact creation. Per UAD AD-1/AD-2, Contact is the
--     post-conversion identity. Scenarios pre-conversion carry identity
--     via `lead_id` — the DAL's read path JOINs leads for display.
--   - Not dropping `scenarios.borrower_name/email/phone`. Those remain
--     nullable for the soak period. PR 2 drops them after DAL write
--     cutover is verified (2 weeks).
--
-- EXPECTED POST-STATE:
--   scenarios_contact_id_null = scenarios where the lead is unconverted
--     OR the scenario is truly anonymous (rare — saved-scenario POST
--     always creates a lead). Both are legitimate NULL states.
--
-- Run: node scripts/_run-migration-009.mjs
--
-- Rollback: Neon point-in-time recovery. Manual undo reverses Steps 1–2
-- UPDATEs by clearing contact_id on affected rows, but since the source
-- of truth (leads.contact_id, contacts.email) is unchanged, re-running
-- this migration re-derives the same state.

BEGIN;

-- ============================================================
-- STEP 1: Pull contact_id from converted leads
-- ============================================================

UPDATE scenarios s
SET contact_id = l.contact_id,
    updated_at = NOW()
FROM leads l
WHERE s.contact_id IS NULL
  AND s.lead_id IS NOT NULL
  AND s.lead_id = l.id
  AND l.contact_id IS NOT NULL;

-- ============================================================
-- STEP 2: Re-run the email match from migration 006
-- Picks up cases where contacts were created between 006 and 009.
-- ============================================================

UPDATE scenarios s
SET contact_id = c.id,
    updated_at = NOW()
FROM contacts c
WHERE s.contact_id IS NULL
  AND s.borrower_email IS NOT NULL
  AND s.borrower_email != ''
  AND lower(c.email) = lower(s.borrower_email)
  AND c.organization_id = s.organization_id;

-- ============================================================
-- STEP 3: Index (idempotent)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_scenarios_contact_id ON scenarios(contact_id);

COMMIT;
