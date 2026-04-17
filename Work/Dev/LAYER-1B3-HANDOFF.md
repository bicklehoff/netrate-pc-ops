# UAD Layer-1b2b + 1b3 — Handoff

**Status:** Planned, not executed. Picks up after Layer-1b2a (PR #88, shipped 2026-04-17).
**Author:** PC Dev session 2026-04-17 (end-of-day handoff)
**Scope:** Finish Layer 1 — drop `borrowers` table, rename `loans.borrower_id` → `loans.contact_id`, update ~37 files to read from `contacts` instead of `borrowers`.

---

## Current state (post-PR #88)

**Schema:**
- `staff` (renamed from `mlos`) with UAD columns
- `mlos` VIEW exists as compat layer (unused — nothing reads via view anymore after PR #88 code sweep)
- `contacts` has all borrower auth/PII merged in (1129 rows = 773 original + 127 orphan inserts; 229 email collisions merged in place)
- `loans.borrower_id` still points at `borrowers.id` (FK unchanged — this is the next rename target)
- `contacts.borrower_id` FK to borrowers still in place (used as the bridge map)
- `loan_participants` populated (848 rows: 842 primary_borrower + 6 co_borrower)
- `scenarios.contact_id`: 24 of 56 populated (12 via email, 12 via lead_id; 32 remain NULL — no email + no lead_id match)

**Legacy tables still present:**
- `borrowers` (837 rows) — all data merged into contacts but table still referenced by `loans.borrower_id` FK + read directly by ~20 code paths
- `loan_borrowers` (26 rows) — data migrated to loan_participants, unused by code post-1b2a verification, safe to drop
- `loan_contacts` (840 rows) — data migrated to loan_participants, still referenced by Prisma schema

**Prisma model:** `Mlo` model still named Mlo (with `@@map("staff")` after PR #88). Rename model to Staff in 1b3.

---

## The work ahead

### Step 1 — Pre-flight verification

Run `scripts/layer-1-dry-run.mjs` again (or write a fresh verify script) to confirm:
- Every `loans.borrower_id` value has a corresponding contact via `contacts.borrower_id` chain
- Every borrower has a matching contact (should be 837/837 from dry-run)
- No stray FKs to borrowers that I missed

SQL to pre-validate:
```sql
-- Any loan whose borrower_id doesn't map to a contact?
SELECT count(*) FROM loans l
LEFT JOIN contacts c ON c.borrower_id = l.borrower_id
WHERE l.borrower_id IS NOT NULL AND c.id IS NULL;
-- Expected: 0
```

### Step 2 — Code sweep (BIG — do this BEFORE the column rename)

Update all ~37 files to:
1. Replace `LEFT JOIN borrowers b ON b.id = l.borrower_id` with `LEFT JOIN contacts c ON c.borrower_id = l.borrower_id` (note: keeping `l.borrower_id` for now, until column rename)
2. Rename JOIN alias `b` → `c` where appropriate (or keep `b` as just an alias — doesn't matter to SQL)
3. Replace `FROM borrowers WHERE id = ${loan.borrower_id}` with `FROM contacts WHERE borrower_id = ${loan.borrower_id}` (note the change in matching column)
4. Update field reads — `b.first_name` etc. → `c.first_name` (same fields exist on contacts after Layer-1a merge)
5. NextAuth `src/lib/auth.js` — replace borrower lookup to query contacts table (email match + password_hash check — both exist on contacts now)

**Files to review (inventory from 2026-04-17 grep):**

Read-from-borrowers patterns (need to switch to contacts):
- `src/lib/auth.js` — NextAuth MLO session (wait, MLO auth is staff table, not borrowers — this might not be affected; re-grep to confirm)
- `src/app/api/portal/mlo/mcr/push/route.js` (2 occurrences)
- `src/app/api/portal/mlo/pipeline/route.js`
- `src/app/portal/dashboard/page.js`
- `src/app/api/portal/mlo/loans/[id]/payroll/route.js` (multiple)
- `src/app/api/portal/mlo/loans/[id]/route.js` (multiple)
- `src/app/api/portal/mlo/loans/[id]/xml/route.js`
- `src/app/api/portal/mlo/loans/[id]/conditions/route.js`
- `src/app/api/portal/mlo/loans/[id]/files/route.js`
- `src/app/api/portal/mlo/loans/[id]/files/create-folder/route.js`
- `src/app/api/portal/mlo/loans/[id]/docs/route.js`
- `src/app/api/portal/mlo/loans/[id]/ssn/route.js`
- `src/app/api/portal/mlo/loans/[id]/application/route.js`
- `src/app/api/portal/mlo/loans/[id]/contact/route.js`
- `src/app/api/portal/mlo/loans/import/route.js`
- `src/app/api/portal/mlo/leads/[id]/convert/route.js`
- `src/app/api/portal/mlo/contacts/[id]/new-deal/route.js`
- `src/app/api/portal/mlo/contacts/[id]/route.js`
- `src/app/api/portal/mlo/contacts/route.js`
- `src/app/api/portal/mlo/contacts/[id]/loans/route.js`
- `src/app/api/portal/loans/route.js`
- `src/app/api/portal/loans/[id]/docs/route.js`
- `src/app/api/portal/loans/[id]/checklist/route.js`
- `src/app/api/portal/apply/route.js`
- `src/app/api/portal/auth/verify/route.js`
- `src/app/api/portal/sms/send-code/route.js` (borrower portal auth)
- `src/app/api/portal/sms/verify-code/route.js` (borrower portal auth)
- `src/app/api/dialer/contacts/[id]/route.js`
- `src/app/api/dialer/contacts/route.js`
- `src/app/api/corebot/ingest/route.js`
- `src/app/api/corebot/order-out/route.js`
- `src/app/api/corebot/identify/route.js`
- `src/lib/borrower-session.js` (CRITICAL — borrower portal session/auth)
- `src/lib/borrower-actions.js` (CRITICAL — borrower portal ops)
- `src/lib/contact-status.js`
- `src/lib/corebot/processor.js`
- `src/lib/mismo-builder.js` (XML export — reads borrower legal names)

### Step 3 — Migration 008 (schema cutover)

```sql
BEGIN;

-- 1. Remap loans.borrower_id to point at contacts.id (via contacts.borrower_id bridge)
UPDATE loans l
SET borrower_id = c.id
FROM contacts c
WHERE c.borrower_id = l.borrower_id
  AND c.id != l.borrower_id;  -- skip Case 3 orphans where UUID is already correct

-- 2. Rename column
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_borrower_id_fkey;
ALTER TABLE loans RENAME COLUMN borrower_id TO contact_id;
ALTER TABLE loans ADD CONSTRAINT loans_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);
DROP INDEX IF EXISTS idx_loans_borrower_id;
CREATE INDEX IF NOT EXISTS idx_loans_contact_id ON loans(contact_id);

-- 3. Drop legacy tables + columns
DROP TABLE IF EXISTS loan_borrowers CASCADE;  -- replaced by loan_participants
DROP TABLE IF EXISTS loan_contacts CASCADE;   -- replaced by loan_participants
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_borrower_id_fkey;
ALTER TABLE contacts DROP COLUMN IF EXISTS borrower_id;
DROP TABLE IF EXISTS borrowers CASCADE;
DROP VIEW IF EXISTS mlos;  -- compat view from migration 007, no longer needed

COMMIT;
```

### Step 4 — Prisma schema cleanup

- Remove `Borrower` model
- Remove `LoanBorrower` model
- Remove `LoanContact` model
- Remove `Contact.borrower` relation + `borrowerId` field
- Rename `Loan.borrowerId` → `Loan.contactId`, `Loan.borrower` → `Loan.contact`
- Remove `Contact.loan_contacts` relation
- Remove `Loan.loanBorrowers` and `Loan.loanContacts` relations
- Rename `Mlo` model → `Staff` model (cosmetic — @@map("staff") already in place)
- Update all `mloId` fields to remain as-is (column stays `mlo_id`) or rename to `staffId` (decision: keep `mloId` for minimum churn, rename as separate pass later)

### Step 5 — Deploy flow

**CRITICAL ORDERING:** Migration 008 drops `borrowers` table and renames `loans.borrower_id`. If code ships first with old queries, it breaks. If migration runs first with old code deployed, it breaks.

Options:
- **A. Atomic**: migrate + merge simultaneously. ~50s outage window.
- **B. Staged**: 
  1. Code PR with new queries (targets `contacts`, references `loan.borrower_id` temporarily) — ships, works because borrowers still exists as fallback
  2. Migration 008 runs — renames column, drops borrowers
  3. Second code PR — switches `l.borrower_id` → `l.contact_id` in queries

Stage B is cleaner but 2 PRs. Since site is solo-use pre-launch, A is fine.

### Step 6 — Smoke tests (MANDATORY — these paths have the real risk)

Post-deploy, verify by curling + manual:
- MLO portal login → works (staff table via NextAuth)
- **Borrower portal magic-link flow** — the big one. Requires manual test: load `/portal/auth/login`, request magic link, receive email, click, land in dashboard. If this breaks, users can't log in.
- MLO pipeline renders loan list with borrower names
- Open a loan detail page — borrower section renders (legal name, nickname, SSN last-four)
- Payroll view — loan detail shows comp data without error
- XML export — generates MISMO XML for a test loan
- CoreBot order-out — if testable without triggering real orders

### Step 7 — Cleanup

- Delete `Work/Dev/drafts/layer-1b-full-merge-draft.sql` (superseded by actual migrations 006-008)
- Update FoH April README (v1.6) — mark D9a identity model ✅
- Update memory files if anything surfaced (e.g., if Prisma re-generation becomes needed)

---

## Non-obvious gotchas

1. **NextAuth session shape.** Look for `session.user.borrowerId` references in components. These become `session.user.contactId`. Browser sessions may persist with old shape — could force a session reset.

2. **src/lib/borrower-session.js and src/lib/borrower-actions.js** are dedicated borrower-portal modules. Read them first — they likely contain the most nuanced borrower→contact mapping.

3. **SSN encryption key.** `src/lib/encryption.js` uses a key from env. When copying ssn_encrypted from borrowers to contacts, the encryption context doesn't change (same data, same key). No decryption/re-encryption needed if migrating at DB level.

4. **`dobEncrypted` and `ssnEncrypted` uniqueness.** Borrower model has these as NOT NULL. Contact model (Layer-1a) has them as nullable. Post-migration 008, contacts rows that originated from borrowers will have them populated; original CRM contacts have them null. That's expected.

5. **LoanContact legacy data.** 840 rows migrated to loan_participants. After drop, the join history is in loan_participants. If any code still references `prisma.loanContact`, it'll error — but since Prisma isn't runtime, only raw SQL references matter (grep `loan_contacts` to find them).

6. **MISMO XML export** (`src/lib/mismo-builder.js`) reads borrower legal names, DOB, SSN for the XML output. These fields all exist on contacts now. Update the query, verify output with a sample loan.

---

## Rollback plan

Neon point-in-time recovery as of just before migration 008 ran. Capture exact timestamp before running.

If migration 008 runs but code deploy fails:
- Rollback via Neon PITR to restore borrowers table
- Code PR not merged — no code change to revert

If both run and production has issues:
- Rollback via Neon PITR
- Revert code PR
- Re-deploy the pre-migration state

---

## Estimated effort

- Step 1 (verify): 10 min
- Step 2 (code sweep, 37 files, careful): 2-3 hours
- Step 3 (migration 008 SQL): 30 min
- Step 4 (Prisma schema): 20 min
- Step 5 (deploy): 30 min
- Step 6 (smoke tests): 30 min
- Total: 4-5 hours for a careful execution

Fresh session recommended.
