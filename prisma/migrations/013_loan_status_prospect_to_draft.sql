-- Migration 013: unify loans.status 'prospect' → 'draft' (D7 LD-4/5).
--
-- Two code paths currently write to loans.status for pre-submission loans:
--   - Active portal (leads/convert, quotes, new-deal, create-inbound,
--     content/[slug]) writes 'draft' → 3 rows
--   - corebot/ingest (LDOX sync) writes 'prospect'              → 13 rows
--
-- Both represent the same lifecycle state (loan row exists, not yet
-- applied). Local STATUS_LABELS maps in StatusHeader.js, NotesActivity-
-- Section.js, and contacts/[id]/page.js use 'draft' as the key. Pipeline
-- loan-statuses.js canonical uses 'prospect'. Result: inconsistent status
-- rendering — a 'draft' loan shows as raw 'draft' in pipeline; a
-- 'prospect' loan shows as raw 'prospect' on loan-detail header.
--
-- Canonical chosen: 'draft'. 'prospect' is a lead/contact sales-funnel
-- concept in the mortgage domain (cf. contacts.status = 'lead'); using
-- it as a loan-status key creates cross-entity ambiguity. 'draft' is
-- neutral engineering language for "row exists, not finalized."
--
-- Idempotent: WHERE status='prospect' becomes a no-op once run.

BEGIN;

UPDATE loans
   SET status = 'draft',
       updated_at = NOW()
 WHERE status = 'prospect';

COMMIT;
