# D9e Phase 1 PR 3b — Scope document

**Status:** scoped 2026-04-23 · execution pending David's split decision
**Prerequisites:** PR 3a (migration 046) shipped ✓
**Successor:** PR 3c drops `loan_borrowers` table after 3b soak

---

## 1. Purpose

Move every populated field out of `loan_borrowers` into the satellite tables that are now schema-ready, **and rewire the 17 src/ files that read or write `loan_borrowers` today** to use the satellites instead. Data must land correctly on all 22 loans (14 settled, 8 draft/archived) — these are live CRM records, not archive dust.

Entering 3b: `loan_borrowers` has 28 rows of snapshot data. Exiting 3b: satellites carry every populated field; `loan_borrowers` still exists but is no longer read or written by any code path. 3c drops it after soak.

---

## 2. Prerequisites that PR 3a didn't cover

Two schema gaps surfaced while scoping this PR:

### 2a. `loan_incomes` missing `loan_id` + `contact_id`

PR 2 added `loan_id`/`contact_id` to `loan_employments`, `loan_declarations`, `loan_assets`, `loan_liabilities`, `loan_reos`. It **missed `loan_incomes`**. Currently that table keys only on `loan_borrower_id`, so dropping `loan_borrowers` would orphan every income row.

**Fix:** Migration 047 adds `loan_id` + `contact_id` NOT NULL (table is empty → no backfill needed) + indexes + FK → `contacts(id)`.

### 2b. `loan_participants` missing `marital_status`

11 `loan_borrowers` rows have `marital_status` populated. It's per-application (not per-person identity), so MISMO-correct home is `loan_participants`, not `contacts`.

**Fix:** Migration 047 adds `loan_participants.marital_status TEXT`.

### 2c. Nullable `loan_borrower_id` on satellites

Today `loan_employments.loan_borrower_id`, `loan_declarations.loan_borrower_id`, `loan_incomes.loan_borrower_id` are all NOT NULL. Post-rewire the app will write new rows via satellites **without** going through `loan_borrowers`. Need to make those nullable during soak so new writes don't fail.

**Fix:** Migration 047 promotes those three columns to nullable. 3c drops them entirely.

---

## 3. Migration 047 — data transform

### Pre-data DDL (pre-conditions above)

1. `ALTER TABLE loan_incomes ADD COLUMN loan_id NOT NULL, contact_id NOT NULL` + FK + 2 indexes
2. `ALTER TABLE loan_participants ADD COLUMN marital_status TEXT`
3. `ALTER TABLE {employments,declarations,incomes} ALTER COLUMN loan_borrower_id DROP NOT NULL`

### Data transform (ordered, all idempotent via NOT EXISTS)

| Step | Source | Destination | Prod rows affected |
|---|---|---|---|
| 1 | `loan_borrowers.marital_status` | `loan_participants.marital_status` (UPDATE via (loan_id,contact_id) match) | 11 |
| 2 | `loan_borrowers.current_address` + `address_years` + `address_months` + `monthly_rent` + `housing_type` | INSERT `loan_housing_history` (`housing_type='current'`) | 17 |
| 3 | `loan_borrowers.previous_address*` (prod: 0 rows) | INSERT `loan_housing_history` (`housing_type='previous'`) | 0 |
| 4 | `loan_borrowers.{employer_name, position_title, years_in_position, employment_status}` | INSERT `loan_employments` (with `is_primary=true`, `self_employed=false`) | 2 |
| 5 | `loan_borrowers.{monthly_base_income, other_monthly_income, other_income_source}` | INSERT `loan_incomes` | 9 |
| 6 | `loan_borrowers.declarations` JSONB (non-HMDA keys) | INSERT `loan_declarations` | 11 |
| 7 | `loan_borrowers.declarations` JSONB (HMDA keys) | INSERT `loan_demographics` | ≤11 (subset with HMDA keys) |
| 8 | `loan_borrowers.declarations → citizenshipStatus` | UPDATE `contacts.us_citizenship_indicator` (if NULL) | ≤11 |

Each insert includes `loan_borrower_id = lb.id` during soak so we keep the bridge intact until 3c drops the column.

### JSONB → `loan_declarations` key mapping (step 6)

```
applyingForNewCredit      → applying_for_new_credit        BOOLEAN
applyingForOtherMortgage  → applying_for_other_mortgage    BOOLEAN
authorizeCreditPull       → authorize_credit_pull          BOOLEAN
authorizeVerification     → authorize_verification         BOOLEAN
bankruptcy                → bankruptcy                     BOOLEAN
bankruptcyChapter         → bankruptcy_type                TEXT
coSignerOnDebt            → co_signer_on_other_loan        BOOLEAN
deedInLieu                → deed_in_lieu                   BOOLEAN
delinquentFederalDebt     → delinquent_federal_debt        BOOLEAN
familyRelationshipSeller  → family_relationship_seller     BOOLEAN
foreclosure               → foreclosure                    BOOLEAN
lawsuitParty              → party_to_lawsuit               BOOLEAN
outstandingJudgments      → outstanding_judgments          BOOLEAN
preForeclosureSale        → pre_foreclosure_sale           BOOLEAN
primaryResidence          → intent_to_occupy               BOOLEAN
priorOwnership3Years      → ownership_interest_last_three_years  BOOLEAN
priorPropertyTitleHeld    → prior_property_title_held      TEXT
priorPropertyType         → property_type_of_ownership     TEXT
priorityLien              → priority_lien                  BOOLEAN
undisclosedBorrowing      → undisclosed_borrowing          BOOLEAN
undisclosedBorrowingAmount→ undisclosed_borrowing_amount   NUMERIC(12,2)
```

### Verification after migration

Row-count invariants asserted in runner:
```
loan_borrowers.marital_status populated   → loan_participants.marital_status populated on matching (loan_id,contact_id)
loan_borrowers.current_address IS NOT NULL → loan_housing_history row with housing_type='current'
loan_borrowers.employer_name IS NOT NULL  → loan_employments row with matching (loan_id,contact_id)
loan_borrowers.monthly_base_income IS NOT NULL → loan_incomes row
loan_borrowers.declarations IS NOT NULL   → loan_declarations row
Rows with hmdaEthnicity/Race/Sex keys     → loan_demographics row
```

Each invariant is a COUNT comparison. Runner aborts if counts don't match.

Plus **spot-check** queries running against 3 specific settled loans to verify their data is retrievable from satellites post-migration. Queries match what the UI will run after the code rewire.

---

## 4. Code rewire — 17 files

Every one of these needs to stop reading/writing `loan_borrowers` and use the new satellite shape instead. Shadow-audit confirmed (during 3a planning) there are **no other files** that reach `loan_borrowers` data indirectly.

### Writers → switch to satellite INSERTs

| File | Change |
|---|---|
| `api/portal/mlo/loans/import/route.js` | MISMO XML import: create loan_participants + loan_employments + loan_incomes + loan_declarations + loan_housing_history instead of loan_borrowers rows. Biggest single file change in the PR. |
| `api/portal/mlo/contacts/[id]/new-deal/route.js` | Clone-deal: read primary participant's satellite data for the source loan; insert fresh satellite rows for the new loan. |

### Read+write

| File | Change |
|---|---|
| `api/portal/mlo/loans/[id]/application/route.js` | 1003 form GET/PUT. Fetches + upserts the full declarations + employment + income tree. Must read from satellites; writes directly to satellites. |

### Readers → switch queries to satellite JOINs

| File | What it reads today | What it reads after |
|---|---|---|
| `lib/mismo-builder.js` | `loan.loanBorrowers[]` array | `loan.participants[]` joined with satellites |
| `lib/corebot/processor.js` | co-borrower names via loan_borrowers JOIN contacts | loan_participants JOIN contacts |
| `lib/application-gate.js` | already uses contacts — minor type/comment cleanup | (trivial) |
| `components/Portal/PrequalLetter/PrequalLetterModal.js` | co-borrower first/last from loan_borrowers | participants JOIN contacts |
| `components/Portal/PayrollSection.js` | (trivial — indirect ref) | no change likely |
| `components/Portal/Core/sections/OverviewSection.js` | co-borrower display | participants |
| `components/Portal/Core/sections/BorrowerSection.js` | full co-borrower tabs + employment/income/declarations | participants + satellites |
| `components/Portal/Core/sections/ApplicationSection.js` | 1003 display | satellites |
| `app/portal/dashboard/page.js` | borrower auth check + primary name | loan_participants |
| `api/portal/mlo/pipeline/route.js` | co-borrower list for pipeline rows | loan_participants JOIN contacts |
| `api/portal/mlo/loans/[id]/xml/route.js` | MISMO XML export — full borrower tree | satellites (loan_housing_history, loan_employments, loan_incomes, loan_declarations, loan_demographics) |
| `api/portal/mlo/loans/[id]/route.js` | loan detail — full model with all sub-relations | satellites |
| `api/portal/mlo/loans/[id]/payroll/route.js` | (trivial) | minimal |
| `api/portal/loans/[id]/checklist/route.js` | borrower auth check | loan_participants |
| `api/portal/apply/route.js` | public application intake → writes loan_borrowers | writes satellites |
| `api/corebot/order-out/route.js` | already uses contacts — minor | (trivial) |
| `api/corebot/identify/route.js` | co-borrower context for file ID | loan_participants |
| `api/corebot/ingest/route.js` | no direct ref — minor | (trivial) |

**Complexity concentration:** The top 5 files by effort are `loans/import/route.js`, `loans/[id]/xml/route.js`, `loans/[id]/route.js`, `loans/[id]/application/route.js`, and `BorrowerSection.js`. Everything else is 1–2 query rewrites.

---

## 5. Neon branch rehearsal protocol

Per [DEV-PLAYBOOK.md §3](DEV-PLAYBOOK.md), rehearsal is **mandatory** for 3b (multi-step data transform with value-based WHERE clauses).

### Procedure

```bash
# 1. Create Neon branch off prod
neon branches create --name migration-047-test

# 2. Get branch connection string
BRANCH_URL=$(neon connection-string migration-047-test)

# 3. Run migration against branch
PC_DATABASE_URL="$BRANCH_URL" node scripts/_run-migration-047.mjs

# 4. Run spot-check queries on the branch
PC_DATABASE_URL="$BRANCH_URL" node scripts/_spot-check-migration-047.mjs

# 5. Inspect post-state manually — pick 3 random settled loans from prod,
#    compare their loan_borrowers data against what's now in satellites
#    on the branch. Diff any mismatches.

# 6. Point local dev server at Neon branch, load MLO portal, verify:
#    - Loan detail page renders co-borrower data correctly
#    - MISMO XML export matches prior output (diff the XML)
#    - Prequal letter shows correct names
#    - Pipeline displays co-borrower badges
#    (This validates the code rewire changes in parallel, before merge.)

# 7. If all green: apply to prod
PC_DATABASE_URL="$PROD_URL" node scripts/_run-migration-047.mjs

# 8. Delete the branch
neon branches delete migration-047-test
```

### What the spot-check script validates

- Every `loan_borrowers` row with data has a corresponding populated row in each relevant satellite
- JSONB keys that should have parsed haven't been silently dropped
- `loan_borrowers.declarations` raw JSONB is preserved as a fallback (we don't modify loan_borrowers at all during migration — it stays as a read-only backup through 3c)
- Post-transform, spot-check loan IDs return identical MLO detail data vs. pre-transform

---

## 6. PR split decision

**Option A — single atomic PR 3b** (~1 PR)
- Migration 047 + all 17 file rewires in one commit
- Neon branch tests the full change together
- Pros: atomic, single review, single smoke test
- Cons: review surface is 17 files + 300+ lines of SQL parse rules; any issue after merge means revert everything

**Option B — split into 3b-data + 3b-code** (~2 PRs)
- **3b-data:** migration 047 only (DDL + data transform). Apply to prod after Neon rehearsal. App still reads/writes loan_borrowers; satellites now have parallel data.
- **3b-code:** rewire 17 files to read/write satellites. App still writes to loan_borrowers too during a short overlap, or stops writing it entirely — needs tactical decision.
- Pros: each PR is ~half the size, independent rollback, data correctness gets its own soak before code risk
- Cons: longer total time, risk of dual-path bugs during the overlap window

**Recommendation: Option A (atomic).** The 22-loan data set is small; rehearsal on Neon validates both data + code together against real prod-shaped data. A dual-path window in Option B invites bugs ("did this endpoint write to the old table or the new one?") that rehearsal alone won't surface.

---

## 7. Time estimate

- Migration 047 SQL + runner + spot-check script: 2-3h
- Neon branch rehearsal + iteration: 1-2h
- Code rewire (17 files): 4-6h
- Verification + smoke + prod apply: 1h
- **Total: 8-12h** — substantial single session, or split across two.
