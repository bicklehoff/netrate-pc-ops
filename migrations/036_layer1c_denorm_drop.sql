-- Migration 036 — Layer-1c denorm drop
--
-- Context:
--   Migration 009 (2026-04-17) stopped the DAL from WRITING denormalized
--   identity strings to `scenarios.borrower_name/email/phone`, but left
--   the columns in place for a soak window. Today's API rename PR
--   (#178 `borrower_* → contact_*`) removed the last API-surface reads
--   of these columns. Only `src/lib/scenarios/transform.js` still reads
--   them as a last-resort fallback in `deriveIdentity()`.
--
--   Soak window was scheduled to end ~2026-05-01; this migration closes
--   it a week early. Safe because:
--     - API consumers all read `contact_name/email/phone` post-#178
--     - Transform fallback gracefully degrades (undefined → null)
--     - Pre-flight found no borrower-facing surface that depends on them
--
-- Pre-flight state (2026-04-23):
--   56 scenarios total
--   24 have contact_id (D9a compliant)
--   30 need backfill (have denorm data but no contact_id):
--     14 with borrower_email → backfillable via email match
--     16 orphans (no email, no phone — likely pre-UAD test data)
--
-- Operation:
--   Step 1. INSERT any missing contacts from scenario denorm data
--           (scoped per organization_id, lowercased email).
--   Step 2. UPDATE scenarios.contact_id by email match.
--   Step 3. DROP the three denorm columns.
--
-- Rollback:
--   Destructive. If a bug is found after deploy, restore requires Neon
--   PITR. Rehearse on Neon branch before prod run.
--
-- Atomic:
--   Wrapped in BEGIN/COMMIT. Any step failure rolls back the whole
--   migration, leaving the columns intact.

BEGIN;

-- Step 1: Backfill missing contacts from scenario denorm data.
--         Uses the unique partial index from migration 035 via
--         NOT EXISTS (not ON CONFLICT — the partial predicate
--         makes ON CONFLICT fiddly on edge cases).
INSERT INTO contacts (
  organization_id, email, first_name, last_name, phone,
  created_at, updated_at
)
SELECT DISTINCT
  s.organization_id,
  lower(s.borrower_email),
  -- Name split: first token = first_name, remainder = last_name
  COALESCE(NULLIF(split_part(s.borrower_name, ' ', 1), ''), 'Unknown'),
  NULLIF(
    substring(s.borrower_name FROM position(' ' IN s.borrower_name) + 1),
    ''
  ),
  NULLIF(s.borrower_phone, ''),
  NOW(), NOW()
FROM scenarios s
WHERE s.contact_id IS NULL
  AND s.borrower_email IS NOT NULL
  AND s.borrower_email <> ''
  AND NOT EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.organization_id = s.organization_id
      AND lower(c.email) = lower(s.borrower_email)
      AND c.email IS NOT NULL
      AND c.email <> ''
  );

-- Step 2: Link scenarios to contacts via email.
UPDATE scenarios s
SET contact_id = c.id,
    updated_at = NOW()
FROM contacts c
WHERE s.contact_id IS NULL
  AND s.borrower_email IS NOT NULL
  AND s.borrower_email <> ''
  AND c.organization_id = s.organization_id
  AND lower(c.email) = lower(s.borrower_email);

-- Step 3: Drop deprecated columns.
--         Any scenarios remaining with NULL contact_id were orphan rows
--         (no identifiable contact) — they lose their denorm strings
--         but remain as valid scenario records.
ALTER TABLE scenarios DROP COLUMN IF EXISTS borrower_name;
ALTER TABLE scenarios DROP COLUMN IF EXISTS borrower_email;
ALTER TABLE scenarios DROP COLUMN IF EXISTS borrower_phone;

COMMIT;
