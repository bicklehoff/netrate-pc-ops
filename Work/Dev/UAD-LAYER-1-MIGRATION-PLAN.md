# UAD Layer 1 — Migration Plan

**Status:** Draft · written 2026-04-17 · awaiting David review
**Scope:** D9a (identity model) Layer 1 only — lead intake + pipeline. Layers 2–4 deferred.
**Depends on:** [`UAD-SPEC.md`](./UAD-SPEC.md) · [`audits/README.md`](./audits/README.md) (FoH April)

---

## 1. Key insight — this is a consolidation, not a greenfield build

The current schema is already substantial (1629 lines, ~40 models, full application modules in place). Layer 1 is primarily a **rename + consolidation** migration, not new-table construction. The application modules from `1003-BUILD-SPEC.md` are already modeled (`LoanEmployment`, `LoanIncome`, `LoanAsset`, `LoanLiability`, `LoanREO`, `LoanDeclaration`, `LoanTransaction`). Product-specific extensions (`LoanConv`, `LoanFha`, `LoanVa`, `LoanDscr`, `LoanHecm`) are in place.

What's missing for UAD:
- **Two identity tables** (`borrowers` + `contacts`) where UAD wants one
- **`staff` table** (`mlos` today doesn't carry the full UAD staff fields)
- **`deal_participants` junction** that covers both contacts and staff (`loan_borrowers` today covers contacts only)
- **Service provider tables** (none exist today)
- **Scenarios `contact_id` population** (field exists, but borrower strings still populated in parallel)

---

## 2. Current state → UAD target mapping

| UAD target | Current equivalent | Delta |
|---|---|---|
| `contacts` | **`borrowers`** (auth + PII + portal) **+ `contacts`** (CRM: lead_score, marketing opts, zoho_*) | Merge both tables. `borrowers` carries auth; `contacts` carries marketing. UAD wants one record per person with both. |
| `staff` | `mlos` | Rename + add fields: `license_states[]`, `commission_rate`, explicit role enum (`broker_owner`, `mlo`, `processor`, `loa`, `admin`). Existing fields (nmls, ldoxOfficerId, organizationId) keep. |
| `leads` | `leads` | Mostly fine. Add `view_token` index, tighten enum on `status`. |
| `deals` | `loans` | Rename. No field restructure in Layer 1 — deal modules (employment/income/assets) already linked correctly via `loan_borrowers`. |
| `deal_participants` | `loan_borrowers` | Extend to include staff, not just contacts. Add `staff_id` (nullable, mutually exclusive with `contact_id`), `private_docs` flag, `notification_prefs` jsonb. |
| `scenarios` | `scenarios` | Already has `contact_id`/`lead_id`/`loan_id` FKs. Layer 1: **populate them**, drop the `borrower_name/email/phone` string writes in new code (leave columns for backfill safety). |
| `service_provider_accounts` | — | New |
| `service_provider_contacts` | — | New |
| `deal_service_providers` | — | New |

**Also affected (not Layer 1 schema changes but touched by Layer 1 code):**
- `CallLog`, `CallNote`, `SmsMessage` all reference `contactId` — already correct; verify they don't also need borrower-row reads
- `ContactNote`, `Document`, `LoanEvent` — pointers to the old names, updated at rename time
- `LoanContact` — appears to be a per-loan contact-role junction (realtor, title, etc.); review whether it folds into `deal_participants` (contact-role) or stays separate for Layer 3 service-provider split

---

## 3. Merge rules — `borrowers` + `contacts` → `contacts`

The hard part. Today a person can have:
- A `borrowers` row (if they signed up for portal or applied)
- A `contacts` row (if an MLO created them or they came through CRM import)
- Both, with `contacts.borrower_id` FK linking them
- Neither, while only a `leads` row exists

**Proposed merge logic (executed once as a data migration):**

1. **Borrowers with a linked contact** (`contacts.borrower_id IS NOT NULL`): merge — borrower fields win for identity (legal name, DOB, SSN, email, phone, auth), contact fields win for marketing (lead_score, opts, Zoho IDs, strike_rate_opt_in).
2. **Borrowers without a linked contact**: create a new `contacts` row from the borrower, marketing fields null.
3. **Contacts without a borrower**: keep as-is, null `portal_auth`.
4. **Referential integrity:** for each merged pair, rewrite `loan_borrowers.borrower_id`, `scenarios.contact_id`, `scenarios.loan_id → contact`, `CallLog.contact_id`, etc. to the new unified id.

Collision risk (same email on two `borrowers` rows, or borrower+contact with different emails that both refer to the same real person): flag to David for manual resolution pre-migration. Production counts needed before designing the merge script — a dry-run report first.

---

## 4. Migration strategy — two options

### Option A — Additive, then deprecate (safer, more throwaway work)
1. Create new `contacts_v2`, `staff`, `deal_participants_v2`, `deals` (view), service-provider tables
2. Dual-write: new code writes to both old and new; old code keeps writing to old
3. Backfill old → new in batch
4. Switch reads to new one surface at a time
5. Flip writes to new-only
6. Drop old tables

**Pros:** zero-downtime, incremental, reversible at every step.
**Cons:** months of dual-write code, `v2` suffix cruft, every code site eventually touched twice.

### Option B — In-place rename + merge (leaner, one big PR)
1. Feature-branch migration: rename `borrowers` → merge into `contacts`, `mlos` → `staff`, `loans` → `deals`, `loan_borrowers` → `deal_participants`
2. Single Prisma migration script (Postgres `ALTER TABLE RENAME`, `UPDATE` for merges)
3. One code-site sweep for type renames (Prisma regenerates types)
4. Deploy atomic to a maintenance window (2–5 min outage while migration runs)
5. Backout plan: point-in-time restore from Neon snapshot if migration fails

**Pros:** one PR, no dual-write cruft, final state reached immediately, matches D-philosophy ("long-term fixes, no hacky").
**Cons:** needs a maintenance window, all-or-nothing deploy.

**My recommendation: Option B**, for these reasons:
- Production volume today is low (we can afford a 2–5 min window at 3 AM ET)
- David's stated philosophy opposes additive cruft ("design for scale, no hacky shortcuts")
- Dual-write coordination is a bug farm — harder to reason about than a well-tested one-shot migration
- Neon point-in-time restore is our safety net
- Subsequent layers (2–4) assume the new schema — Option A extends that uncertainty

**Conditions for Option B:**
- Full dry-run on a Neon branch from prod snapshot before real migration
- Rollback plan documented and tested
- All Prisma-client code paths grep-verified before cutover
- Maintenance window pre-announced

---

## 5. Layer 1 migration sequence (Option B)

**PR 1 — Schema rename + merge migration (this is the big one)**
1. Migration script:
   - `ALTER TABLE borrowers RENAME TO contacts_legacy`
   - `ALTER TABLE contacts RENAME TO crm_contacts_legacy`
   - Create new `contacts` table with unified schema
   - `INSERT INTO contacts SELECT …` merging both legacy tables per §3 rules
   - Rewrite FKs: `loan_borrowers`, `scenarios`, `CallLog`, `SmsMessage`, `ContactNote`, `Document.requestedBy`, etc.
   - `ALTER TABLE mlos RENAME TO staff` + add new columns (`license_states`, `commission_rate`, `role_v2`)
   - `ALTER TABLE loans RENAME TO deals`
   - `ALTER TABLE loan_borrowers RENAME TO deal_participants` + add `staff_id`, `private_docs`, `notification_prefs`
   - Drop legacy tables after verification
2. Prisma schema update — rename models, update relations
3. Single code sweep for Prisma type renames (`prisma.loan` → `prisma.deal`, etc.)
4. Service-provider tables ship empty in same PR (no data migration needed)

**PR 2 — Scenarios `contact_id` discipline**
- Remove `borrower_name/email/phone` string writes from new code (columns stay for backfill)
- Backfill `contact_id` on historical scenarios via email lookup
- Add NOT NULL constraint on `contact_id` at the Layer 2 work boundary (not Layer 1)

**PR 3 — Lead conversion flow**
- `POST /api/portal/mlo/leads/:id/convert` — email lookup → find/create contact, create deal, transfer scenarios
- MLO pipeline view update to render new unified model

**PR 4 — Lead capture auto-email**
- Email + SMS on lead creation (unblocks Claw relay `cmo0m2hy2mv25q95r` CoreCRM lead intake)

**Layer 1 done** when all 4 PRs merge, smoke test passes, ICanBuy lead flow works end-to-end.

---

## 6. Code impact estimate

Grep-level count on the current HEAD (worktree):

| Rename | Approx occurrences | Risk |
|---|---|---|
| `prisma.loan` / `prisma.borrower` / `prisma.mlo` / `prisma.loanBorrower` | ~hundreds across `src/app/api/**`, `src/lib/**` | Type-system-checked; compile errors surface every call-site |
| `loan.borrower`, `loan.mlo`, `loan.loanBorrowers` relation names | ~same | Same — Prisma types enforce |
| Raw SQL with snake-case table names (`FROM loans`, `FROM mlos`, etc.) | some — need grep audit | Not type-checked; easy to miss |
| `borrowerId` field references in code (parameters, UI state, URLs) | pervasive | Mostly internal, but URL paths like `/portal/borrower/[id]` visible externally — need redirect plan or keep paths |

**URL paths:** keep `/portal/borrower/*` and `/portal/mlo/*` external URL structure unchanged to avoid breaking bookmarks, even though the underlying model is `contacts`/`staff`. Route file renames are internal.

---

## 7. Application LITE field list (Layer 1 capture scope)

Per David 2026-04-17 (audit of UAD open-item §11). These are the fields captured on Deal or Contact, not deferred to LOS:

**Contact (identity — lives on `contacts` table):**
- first_name, last_name, email, phone, dob (encrypted), ssn (encrypted), ssn_last_four, current_address

**Deal — Employment & income (already in `LoanEmployment` / `LoanIncome` via `loan_borrowers`):**
- Layer 1 captures: current employer, title, start date, employment type (W2/self-emp/retired), **total monthly gross income**
- Deferred to LOS: 2-yr history, income split (base/OT/bonus/commission), K1s, tax returns

**Deal — Assets (`LoanAsset`):**
- Layer 1 captures: total liquid assets, down payment source (own/gift/proceeds), gift fund amount if applicable
- Deferred to LOS: per-account records, 2-mo statements, retirement details

**Deal — Property (`loans` + `LoanREO` for investment):**
- Layer 1 captures: address, **county (auto-populated via geocoding API on address write — stored, not re-looked-up at query time)**, property type, occupancy, estimated value, units, HOA, prop tax, insurance
- Deferred to LOS: year built, sqft, appraisal

**Deal — Loan details (`loans` / `deals` core):**
- All existing fields in `loans` stay — already the right scope

**Deal — Co-borrower (linked Contact + `LoanBorrower` row + `LoanEmployment` + `LoanIncome`):**
- Layer 1 captures: linked Contact, relationship, community-property flag, total monthly gross income
- Layer 1 skips: asset duplication for co-borrower (defer to Layer 3)

**Deal — Declarations (`LoanDeclaration` per LoanBorrower):**
- Layer 1 captures: URLA Section 8 yes/no answers (bankruptcy, lawsuits, delinquency, primary-residence intent)
- Deferred: full narrative disclosures

**Key design note:** Because the modules already exist as sub-tables tied to `loan_borrowers`, Layer 1 does **not** add new module tables. It wires intake forms to these existing tables and enforces the "Layer 1 captures" field subset.

---

## 8. Open questions for David

1. **Merge strategy go/no-go:** Option A (additive) vs Option B (in-place rename + merge)? I recommend B.
2. **Production duplicate-identity count:** I want a Neon query result before finalizing the merge script — how many `borrowers` rows lack a matching `contacts.borrower_id`, how many `contacts` have collisions by email with a `borrowers` row, how many ambiguous cases. Dry-run first, actual migration second.
3. **URL path policy:** keep `/portal/borrower/*` and `/portal/mlo/*` external URLs stable even though models rename? My lean: yes, back-compat redirects on any we do rename.
4. **LoanContact fate:** today's `LoanContact` looks like a per-loan contact-role junction (realtor, title, etc.). Does it fold into (a) `deal_participants` with roles expanded, or (b) stays separate until Layer 3 service-provider split? My lean: (a) — realtors are UAD-contacts with a role (AD-15), and that matches today's usage.
5. **Maintenance window:** acceptable for the migration deploy? 2–5 min at 3 AM ET, pre-announced. If not, we go Option A.

---

## 9. Not in Layer 1

- **Quote composer + Layer 3 Lite shareable links** → Layer 2
- **Borrower portal rebuild on Contact model** → Layer 3
- **Service provider assignment to deals + Order Outs UI** → Layer 3
- **Strike rate monitoring per funded deal** → Layer 4
- **Trigger campaigns + past_client marketing** → Layer 4
- **Clone deal UI** → Layer 3
- **Private docs enforcement in UI** → Layer 3 (schema flag ships now)
- **`ref_*` reference-data tables** → D9d, separate from Layer 1

---

## 10. Rollout risks

1. **Orphaned records during merge** — borrower without contact, contact with stale `borrower_id` pointing to deleted row. Mitigation: dry-run + reconciliation report pre-migration.
2. **Scenarios in flight** — active MLO quotes created minutes before the migration window. Mitigation: pause lead intake (503 on `/api/lead`) during the window + resume after.
3. **Prisma client regeneration** — `npx prisma generate` must succeed on first try. Mitigation: dry-run on worktree against Neon branch before real deploy.
4. **Zoho sync drift** — `zoho_contact_id` on old `contacts` table must survive merge. Mitigation: explicit preservation rule in merge script §3.
5. **Cascading organizations_id** — org-scoping (D5) relies on every FK having `organization_id`. New `deal_participants` must inherit org from deal. Mitigation: enforce in migration via `UPDATE … SET organization_id = …`.

---

## 11. Decision points before shipping PR 1

- [ ] David sign-off on Option B (§4)
- [ ] Production duplicate-identity dry-run results reviewed (§8.2)
- [ ] URL path policy confirmed (§8.3)
- [ ] `LoanContact` fate decided (§8.4)
- [ ] Maintenance window scheduled
- [ ] Neon branch dry-run passes
- [ ] Rollback plan documented + tested
- [ ] PR 1 scope ring-fenced — no feature additions mixed in

---

## 12. Change log
- **2026-04-17 v0.1** — initial draft, FoH April Track B output. Awaiting David review + answers to §8 open questions.
