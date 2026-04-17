-- Migration 006: UAD Layer-1b1 — data fill
-- Date: 2026-04-17
-- Part of FoH April (D9 Layer 1 — phased rollout, part b1)
--
-- DESIGN: IDEMPOTENT data fill. Every statement is safe to re-run.
--   - Merges borrower auth/PII data INTO contacts (3 cases):
--       Case 1: 481 linked pairs (contacts.borrower_id = borrowers.id)
--       Case 2: 229 email collisions (same email, no FK link)
--       Case 3: 356 orphan borrowers (no matching contact)
--     After completion: every borrower has exactly one corresponding
--     contact where contacts.borrower_id = borrowers.id.
--   - Populates loan_participants:
--       From 840 loan_contacts rows (role='primary_borrower')
--       From 26 loan_borrowers rows (mapped via contacts.borrower_id)
--     Uses ON CONFLICT DO NOTHING — safe to re-run.
--   - Backfills 56 scenarios.contact_id via email lookup.
--
-- ZERO CODE IMPACT: no drops, no renames, no FK rewrites.
-- - `borrowers`, `loan_borrowers`, `loan_contacts` tables stay intact
-- - `loans.borrower_id` unchanged (column name + FK target)
-- - NextAuth continues reading from `borrowers` as before
-- - `mlos` table unchanged (rename deferred to Layer-1b2)
--
-- Layer-1b2 (separate migration) does the cutover:
--   - Rename mlos → staff + update 17 raw SQL call sites
--   - Rewrite loans.borrower_id → loans.contact_id
--   - NextAuth session shape update (borrower → contact)
--   - Drop borrowers, loan_borrowers, loan_contacts, contacts.borrower_id
--
-- Run: node scripts/_run-migration-006.mjs
--
-- Rollback: Neon point-in-time recovery. Since this only ADDs data to
-- the new structures (no deletes), manual rollback can also:
--   UPDATE contacts SET dob_encrypted = NULL, ssn_encrypted = NULL, ... (reset merged fields)
--   DELETE FROM contacts WHERE source = 'borrower-migration'       (remove orphan inserts)
--   TRUNCATE loan_participants                                     (re-run fill)
--   UPDATE scenarios SET contact_id = NULL WHERE <criteria>        (unset backfilled)

BEGIN;

-- ============================================================
-- STEP 1: Case 1 — Merge 481 linked pairs
-- UPDATE contact with borrower's auth/PII. Contact's id stays unchanged.
-- Idempotent: re-run overwrites with same source data.
-- ============================================================

UPDATE contacts c
SET
  dob_encrypted    = b.dob_encrypted,
  ssn_encrypted    = b.ssn_encrypted,
  ssn_last_four    = b.ssn_last_four,
  phone_verified   = b.phone_verified,
  password_hash    = b.password_hash,
  magic_token      = b.magic_token,
  magic_expires    = b.magic_expires,
  sms_code         = b.sms_code,
  sms_code_expires = b.sms_code_expires,
  sms_attempts     = b.sms_attempts,
  sms_locked_until = b.sms_locked_until,
  legal_first_name = b.legal_first_name,
  legal_last_name  = b.legal_last_name,
  nickname         = b.nickname,
  email            = COALESCE(c.email, b.email),
  phone            = COALESCE(c.phone, b.phone)
FROM borrowers b
WHERE c.borrower_id = b.id;

-- ============================================================
-- STEP 2: Case 2 — 229 email collisions
-- Contact has no FK but shares email with a borrower. Merge auth/PII,
-- set contacts.borrower_id = borrower.id.
-- Idempotent: once borrower_id is set, the WHERE clause excludes them.
-- ============================================================

UPDATE contacts c
SET
  dob_encrypted    = COALESCE(c.dob_encrypted, b.dob_encrypted),
  ssn_encrypted    = COALESCE(c.ssn_encrypted, b.ssn_encrypted),
  ssn_last_four    = COALESCE(c.ssn_last_four, b.ssn_last_four),
  phone_verified   = b.phone_verified OR c.phone_verified,
  password_hash    = COALESCE(c.password_hash, b.password_hash),
  magic_token      = COALESCE(c.magic_token, b.magic_token),
  magic_expires    = COALESCE(c.magic_expires, b.magic_expires),
  sms_code         = COALESCE(c.sms_code, b.sms_code),
  sms_code_expires = COALESCE(c.sms_code_expires, b.sms_code_expires),
  sms_attempts     = GREATEST(COALESCE(c.sms_attempts, 0), COALESCE(b.sms_attempts, 0)),
  sms_locked_until = COALESCE(c.sms_locked_until, b.sms_locked_until),
  legal_first_name = COALESCE(c.legal_first_name, b.legal_first_name),
  legal_last_name  = COALESCE(c.legal_last_name, b.legal_last_name),
  nickname         = COALESCE(c.nickname, b.nickname),
  phone            = COALESCE(c.phone, b.phone),
  borrower_id      = b.id
FROM borrowers b
WHERE c.borrower_id IS NULL
  AND c.email IS NOT NULL
  AND lower(c.email) = lower(b.email);

-- ============================================================
-- STEP 3: Case 3 — 356 orphan borrowers
-- INSERT new contact rows preserving borrower's UUID.
-- NOT EXISTS guard makes this idempotent — subsequent runs find
-- the contact already created (by borrower_id match in Case 1 state).
-- ============================================================

INSERT INTO contacts (
  id, organization_id, first_name, last_name, email, phone,
  dob_encrypted, ssn_encrypted, ssn_last_four, phone_verified,
  password_hash, magic_token, magic_expires,
  sms_code, sms_code_expires, sms_attempts, sms_locked_until,
  legal_first_name, legal_last_name, nickname,
  role, marketing_stage, source, created_at, updated_at, borrower_id
)
SELECT
  b.id, b.organization_id, b.first_name, b.last_name, b.email, b.phone,
  b.dob_encrypted, b.ssn_encrypted, b.ssn_last_four, b.phone_verified,
  b.password_hash, b.magic_token, b.magic_expires,
  b.sms_code, b.sms_code_expires, b.sms_attempts, b.sms_locked_until,
  b.legal_first_name, b.legal_last_name, b.nickname,
  'borrower', 'lead', 'borrower-migration', b.created_at, b.updated_at, b.id
FROM borrowers b
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.borrower_id = b.id);

-- ============================================================
-- STEP 4: Populate loan_participants from loan_contacts
-- 840 loan_contacts rows, all role='borrower' → role='primary_borrower'.
-- ON CONFLICT DO NOTHING makes re-run safe. The UNIQUE INDEXes on
-- (loan_id, contact_id) from migration 005 enforce dedup.
-- ============================================================

INSERT INTO loan_participants (
  loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
)
SELECT
  lc.loan_id,
  lc.contact_id,
  'primary_borrower',
  COALESCE(CASE WHEN lc.is_primary THEN 0 ELSE 1 END, 0),
  COALESCE(l.organization_id, '00000000-0000-4000-8000-000000000001'),
  COALESCE(lc.created_at, now()),
  COALESCE(lc.updated_at, now())
FROM loan_contacts lc
JOIN loans l ON l.id = lc.loan_id
WHERE lc.contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Populate loan_participants from loan_borrowers (26 rows)
-- Map borrower_id → contact_id via contacts.borrower_id (populated
-- by Steps 1-3 above).
-- ============================================================

INSERT INTO loan_participants (
  loan_id, contact_id, role, ordinal, organization_id, created_at, updated_at
)
SELECT
  lb.loan_id,
  c.id,
  CASE WHEN COALESCE(lb.ordinal, 0) = 0 THEN 'primary_borrower' ELSE 'co_borrower' END,
  COALESCE(lb.ordinal, 0),
  COALESCE(l.organization_id, '00000000-0000-4000-8000-000000000001'),
  COALESCE(lb.created_at, now()),
  COALESCE(lb.updated_at, now())
FROM loan_borrowers lb
JOIN contacts c ON c.borrower_id = lb.borrower_id
JOIN loans l ON l.id = lb.loan_id
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 6: Backfill scenarios.contact_id via email lookup
-- 56 scenarios have borrower_email strings but 0 have contact_id.
-- Idempotent: only updates rows where contact_id IS NULL.
-- ============================================================

UPDATE scenarios s
SET contact_id = c.id
FROM contacts c
WHERE s.contact_id IS NULL
  AND s.borrower_email IS NOT NULL
  AND s.borrower_email != ''
  AND lower(c.email) = lower(s.borrower_email)
  AND c.organization_id = s.organization_id;

COMMIT;
