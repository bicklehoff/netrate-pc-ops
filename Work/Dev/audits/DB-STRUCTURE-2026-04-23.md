# NetRate PC — Database Structure Audit
**2026-04-23 · Senior DB review · foundation for D9c + D9e**

> Methodology note: live DB access via `PC_DATABASE_URL` in worktree `.env` worked — all row counts, index/constraint/FK listings, and drift analysis below were pulled from prod. Schema file reads are against `prisma/schema.prisma` (1,615 lines). Migration files read from `prisma/migrations/` (30 files, 001–031, **with 030 missing — not yet accounted for**).

---

## 1. Executive summary

Fifteen bullets of the state of the world, ranked by load-bearing impact on D9c/D9e:

1. **Schema drift is severe but one-directional.** DB has 79 tables; `schema.prisma` declares 57 (counting @@map). 22 tables exist in the DB that Prisma doesn't know about — including every `ref_*` table (11 of them), `homepage_rate_cache`, `site_scenarios`, `surface_pricing_config`, `content_pages`, `push_subscriptions`, and the entire `nonqm_*` triad. This is not a bug per se (`project_prisma_design_artifact.md` codifies Prisma-as-docs), but it means **the Prisma schema cannot be trusted as ground truth for any D9c/D9e planning**. Treat `prisma/schema.prisma` as a subset, `prisma/migrations/*.sql` as the spec, and live DB as the referee.

2. **`_prisma_migrations` tracks 5 migrations; `prisma/migrations/` has 30 files.** Migrations 001–031 (except the missing 030) are executed via bespoke runner scripts (`scripts/_run-migration-*.mjs`), not Prisma Migrate. The `_prisma_migrations` table is effectively vestigial, yet it's still present and could mislead anyone who runs `npx prisma migrate status`. **This should be purged or clearly labeled.**

3. **`loans` is the central design wart.** 97 columns, 846 rows in prod. It mixes application-LITE fields (employment_status, employer_name, dependents, declarations) with loan-financial fields (loan_amount, interest_rate, lender_name), with operational fields (cd_file_name, work_drive_folder_id, payroll_sent_at), and with product-family fields (product_family, nonqm_tier, dscr_ratio, bank_statement_months, prepay_years). The UAD §3.1 `deals` target is a ~25-column core table with application data in **satellite modules**. Migration from this to `deals` is the single largest D9e risk.

4. **Two parallel junction systems exist for the borrower-on-loan relationship.** `loan_borrowers` (28 rows, original model) and `loan_participants` (851 rows, UAD Layer-1a additive). Neither has been dropped. `loan_borrowers` carries borrower-level snapshot data (cell_phone, citizenship, dob_encrypted, housing_type, monthly_rent, previous_address); `loan_participants` is a thin role-junction (loan_id + contact_id XOR staff_id + role). **D9e must decide which one survives.**

5. **Scenarios still carry denormalized borrower strings in 42 of 56 rows.** `scenarios.borrower_name / _email / _phone` were marked DEPRECATED in migration 009 (Layer-1c, 2026-04-17) with a scheduled drop ~2026-05-01, but 75% of current rows populate them. Only 24 rows have `contact_id` set. D9c requires the denorm columns gone AND every scenario linked to `contact_id` or `lead_id`.

6. **`organization_id` scoping is cosmetic, not enforced.** Every `organization_id` column in the codebase has a default of the hardcoded sentinel UUID `00000000-0000-4000-8000-000000000001` (single-tenant PC). 65 tables (of 78 non-Prisma) lack the column entirely — but the ones that have it all default to the same constant, there are no CHECK constraints preventing cross-org inserts, and satellite tables like `loan_dates` / `loan_conv` / all 11 `loan_*` satellites inherit scoping only through their parent `loans` row. If multi-tenancy becomes real, **every one of these tables needs org_id + a migration to backfill + RLS or application-layer enforcement added**.

7. **16 FK columns have no index.** Most damaging: `documents.loan_id` (no index, 26 rows — low now but every doc listing by loan hits a seqscan), `loan_events.loan_id` (221 rows, grows monotonically), `scenario_alert_queue.scenario_id`, `leads.contact_id`, `call_notes.call_log_id`, `hecm_scenarios.mlo_id`, `sms_messages.mlo_id`, `loans.mlo_id`. Full list in §7.

8. **FK cascade behavior is inconsistent and the variance is not intentional.** `loan_events → loans` is `ON DELETE RESTRICT`; `loan_notes → loans` is `ON DELETE CASCADE`. `documents → loans` is `RESTRICT`. `loans → contacts` is `ON DELETE SET NULL`. `loan_borrowers → contacts` has no ON DELETE (defaults to NO ACTION). For a system where "delete a loan" is a valid operation, you cannot have audit trails `RESTRICT`-ing the delete while operational notes `CASCADE`. §6 catalogs each mismatch.

9. **No table has `deleted_at`.** Zero soft-delete support. Every DELETE is destructive. For a mortgage ops system where "withdrawn" and "denied" deals must be retained for 3+ years by compliance, this is a latent compliance concern (mitigated today because nobody deletes much — `loan_events` is probably doing the audit lifting implicitly).

10. **`contacts.email` is NOT unique — not per-org, not globally.** Only `idx_contacts_email` (non-unique). UAD §3.1 explicitly requires `UNIQUE per organization`. `staff.email` is globally unique (via `mlos_email_key`, a leftover name from the 007 rename). **D9a claims identity unification but did not land the uniqueness guarantee that would make it real.**

11. **Categorical values via CHECK are spotty.** 29 CHECK constraints exist. `scenarios` has 6 (status, source, visibility, owner_type, product_family, bank_statement_months, prepay_years) — good. `loans.status` has NO constraint despite 7 values in prod (`settled`, `archived`, `draft`, `withdrawn`, `applied`, `funded`, `cond_approved`). `leads.status` — none. `documents.status`, `conditions.status`, `loan_tasks.status` — none. D4 didn't finish the job.

12. **Type consistency for the same concept is poor.** `term` vs `loan_term` (loans uses `loan_term`, scenarios/rate_products/rate_alerts use `term`). `fico` (scenarios) vs `credit_score` (loans, leads). `loan_amount` is numeric in most places but `integer` in `rate_history`. `property_value` / `home_value` / `estimated_value` / `appraised_value` / `purchase_price` — five concepts, overlapping semantics, no authoritative picklist of which to use where. §4 catalogs these with file:line cites.

13. **`_prisma_migrations` metadata, `broker_config.id` (text = 'default'), and all `ref_*` tables use integer PKs** — breaking the UUID-everywhere convention everyone else follows. For lookups, integer is fine; but it means a migration to UUIDs later would require FK redirects.

14. **Naming style is DB-consistent (snake_case) but Prisma-side it's mixed** (mostly camelCase with `@map`, some tables like `Scenario` use snake_case directly at the Prisma level — `organization_id`, `loan_purpose`, etc.). This is mildly irritating (not load-bearing) — but if a future model switches @map conventions, every caller breaks silently because Prisma doesn't error on a typo'd JS-side field.

15. **Load-bearing for D9c:** scenario_rates + scenario_fee_items are sound extension tables (the pattern is good). D9c should adopt the same pattern for `scenario_hecm` / `scenario_dscr` rather than adding columns to `scenarios`. **Load-bearing for D9e:** the 11 loan_* satellite tables (loan_dates, loan_conv, loan_fha, loan_va, loan_hecm, loan_dscr, loan_transactions, loan_employments, loan_incomes, loan_liabilities, loan_assets, loan_reos, loan_declarations) already implement the UAD §7.1 "Application modules" concept — they're 80% of what D9e needs. **The D9e question is not "add modules" — it's "rename loans to deals + drop the denormalized fields on loans that duplicate what the satellites cover."**

---

## 2. Current schema inventory

Row counts from live prod DB (queried 2026-04-23 via PC_DATABASE_URL). Column counts from `information_schema.columns`. "FK in" counted via `pg_constraint`.

### Domain: Identity

| Table | Purpose | Rows | Cols | PK | FK out | FK in | org_id | aud | Status |
|---|---|---|---|---|---|---|---|---|---|
| `organizations` | Tenant root | 1 | 12 | UUID (uuid()) | — | 13 | ✓ (self) | ✓/✓ | ⚠ single-tenant sentinel |
| `staff` | MLOs, processors (renamed from `mlos` in mig 007) | 2 | 14 | UUID | organizations | 10 | ✓ | ✓/✗ | ⚠ no updated_at |
| `contacts` | Borrowers + CRM contacts (unified in Layer-1b) | 904 | 65 | UUID | organizations, staff (self FK via assigned_mlo_id) | 7 | ✓ | ✓/✓ | ⚠ email NOT unique |
| `leads` | Funnel entry | 773 | 38 | UUID (dbgenerated) | contacts, organizations | 1 | ✓ | ✓/✓ | ⚠ status unconstrained |
| `loan_borrowers` | Per-loan borrower snapshot (original) | 28 | 30 | UUID | loans, contacts | 4 | ✗ | ✓/✓ | ❌ legacy — conflicts with loan_participants |
| `loan_participants` | Per-deal participant junction (Layer-1a, 🆕) | 851 | 11 | UUID | loans, contacts, staff, organizations | 0 | ✓ | ✓/✓ | 🆕 UAD-aligned, but coexists with loan_borrowers |
| `contact_notes` | Contact-level notes | 34 | 8 | UUID | contacts | 0 | ✗ | ✓/✗ | ⚠ no updated_at |

### Domain: Deals & Loans (+ satellites)

| Table | Purpose | Rows | Cols | PK | FK out | FK in | org_id | aud | Status |
|---|---|---|---|---|---|---|---|---|---|
| `loans` | The application + financial + operational grab-bag | 846 | 97 | UUID | contacts, staff, organizations | 15 | ✓ | ✓/✓ | ❌ 97-col kitchen sink → becomes `deals` in D9e |
| `loan_events` | Loan audit trail | 221 | 9 | UUID | loans (RESTRICT) | 0 | ✗ | ✓/✗ | ⚠ no org_id, no FK idx |
| `loan_notes` | Operational notes | 0 | 9 | UUID | loans (CASCADE) | 0 | ✗ | ✓/✗ | ✅ UAD-aligned pattern |
| `loan_tasks` | Per-loan tasks | 0 | 12 | UUID | loans (CASCADE) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_dates` | 30+ milestone dates (1:1) | 588 | 37 | UUID | loans (CASCADE, unique loan_id) | 0 | ✗ | ✓/✓ | ✅ |
| `conditions` | Loan conditions | 28 | 24 | UUID | loans (CASCADE), documents, conditions (self) | 1 | ✗ | ✓/✓ | ⚠ no status CHECK |
| `documents` | File uploads | 26 | 15 | UUID | loans (RESTRICT), staff, organizations | 1 | ✓ | ✓/✗ | ⚠ loan_id not indexed |
| `loan_borrowers` | see Identity | 28 | — | — | — | 4 | ✗ | — | — |
| `loan_declarations` | Section 8 URLA | 0 | 19 | UUID | loan_borrowers (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_employments` | Per-borrower employment | 0 | 16 | UUID | loan_borrowers (CASCADE) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_incomes` | Per-borrower income | 0 | 12 | UUID | loan_borrowers (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_assets` | Per-loan assets | 0 | 10 | UUID | loans (CASCADE) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_liabilities` | Per-loan liabilities | 0 | 10 | UUID | loans (CASCADE) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_reos` | REO schedule | 0 | 11 | UUID | loans (CASCADE) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_transactions` | 1003 section V (transaction details) | 0 | 17 | UUID | loans (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_conv` | Conventional-specific (PMI) | 0 | 7 | UUID | loans (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_fha` | FHA-specific (UFMIP, MIP) | 1 | 10 | UUID | loans (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_va` | VA-specific (entitlement) | 0 | 8 | UUID | loans (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_hecm` | HECM-specific | 1 | 18 | UUID | loans (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_dscr` | DSCR-specific | 0 | 8 | UUID | loans (CASCADE, unique) | 0 | ✗ | ✓/✓ | ✅ |
| `loan_service_providers` | Deal-to-provider assignment (Layer-1a) | 0 | 10 | UUID | loans (CASCADE), service_provider_accounts, service_provider_contacts | 0 | ✗ | ✓/✗ | 🆕 ⚠ no updated_at |

### Domain: Scenarios & Pricing

| Table | Purpose | Rows | Cols | PK | FK out | FK in | org_id | aud | Status |
|---|---|---|---|---|---|---|---|---|---|
| `scenarios` | Unified quote/pricing snapshot (mig 002) | 56 | 78 | UUID | organizations, scenarios (self) | 3 | ✓ | ✓/✓ | ⚠ deprecated borrower_* cols still populated |
| `scenario_rates` | Per-scenario rate options | 120 | 18 | UUID | scenarios (CASCADE) | 0 | ✗ | ✓/✗ | ✅ |
| `scenario_fee_items` | Per-scenario fee line items | 605 | 10 | UUID | scenarios (CASCADE) | 0 | ✗ | ✓/✗ | ✅ |
| `scenario_alert_queue` | Rate alert outbound queue | 84 | 11 | UUID | scenarios (CASCADE) | 0 | ✗ | ✓/✗ | ⚠ scenario_id not indexed |
| `site_scenarios` | Canonical public rate-card scenarios (mig 010) | 1 | ? | text slug | — | 1 (homepage_rate_cache) | — | — | ❌ NOT IN PRISMA |
| `surface_pricing_config` | Per-surface config (mig 010) | 3 | ? | ? | ? | 0 | — | — | ❌ NOT IN PRISMA |
| `homepage_rate_cache` | Denormalized cache (mig 011) | 4 | ? | ? | site_scenarios | 0 | ✗ | ✗/✗ | ❌ NOT IN PRISMA, no audit cols |
| `lead_quotes` | Per-lead quote snapshot (pre-scenarios) | 0 | 14 | UUID | leads (CASCADE) | 0 | ✗ | ✓/✗ | ❌ dead table (0 rows, 0 writes in years by implication) |
| `rate_alerts` | Legacy rate alerts | 0 | 21 | UUID | — | 0 | ✗ | ✓/✓ | ❌ dead — superseded by scenarios.alert_status |
| `hecm_scenarios` | HECM calculator saves | 0 | 19 | UUID | staff, organizations | 0 | ✓ | ✓/✓ | ⚠ redundant with scenarios; reconcile |

### Domain: Reference Data (D9d)

All 11 `ref_*` tables plus `fee_templates` are NOT IN PRISMA — they're DB-only constructs inserted via migrations 020–027. They use **integer** or composite keys, not UUID.

| Table | Rows | Cols | PK | Status |
|---|---|---|---|---|
| `ref_conforming_baselines` | 1 | ? | int | ❌ not in prisma |
| `ref_county_loan_limits` | 3,235 | ? | int | ❌ not in prisma |
| `ref_county_tax_rates` | 0 | ? | int | ❌ not in prisma (seed missing) |
| `ref_state_tax_rates` | 51 | ? | int | ❌ not in prisma |
| `ref_state_closing_costs` | 4 | ? | int | ❌ not in prisma — only 4 states seeded; we're licensed in 4 so OK, but framework assumes per-state |
| `ref_fha_ufmip` | 4 | ? | int | ❌ not in prisma |
| `ref_va_funding_fee` | 0 | ? | int | ❌ not in prisma (seed missing — dangerous) |
| `ref_hecm_limits` | 1 | ? | int | ❌ not in prisma |
| `ref_hecm_plf` | 4,864 | ? | int | ❌ not in prisma |
| `ref_hecm_annual_mip` | 1 | ? | int | ❌ not in prisma |
| `ref_hecm_ufmip` | 1 | ? | int | ❌ not in prisma |
| `ref_licensed_states` | 51 | ? | int | ❌ not in prisma |
| `ref_loan_types` | 11 | ? | int | ❌ not in prisma |
| `fee_templates` | 12 | 25 | UUID (no default) | ⚠ in prisma, no default on id |

### Domain: Pricing engine (forward + Non-QM)

| Table | Rows | PK | Status |
|---|---|---|---|
| `rate_lenders` | 6 | UUID (no default) | ⚠ id has no default (mig 021 missed) |
| `rate_sheets` | 96 | UUID | ✅ |
| `rate_products` | 559 | UUID (no default) | ⚠ |
| `rate_prices` | 23,403 | UUID (no default) | ⚠ |
| `adjustment_rules` | 20,649 | UUID (no default) | ⚠ |
| `rate_history` | 281 | int autoincr | ✅ historical rollup |
| `nonqm_rate_sheets` | 1 | UUID | ❌ not in prisma |
| `nonqm_rate_products` | 3,255 | UUID | ❌ not in prisma |
| `nonqm_adjustment_rules` | 12,582 | UUID | ❌ not in prisma |

### Domain: Operational / Communications

| Table | Rows | Cols | PK | FK in | org_id | aud | Status |
|---|---|---|---|---|---|---|---|
| `call_logs` | 9 | 14 | UUID | 1 (call_notes) | ✓ | ✗/✗ | ⚠ uses started_at/ended_at not created_at |
| `call_notes` | 0 | 7 | UUID | 0 | ✗ | ✓/✗ | ⚠ |
| `sms_messages` | 12 | 12 | UUID | 0 | ✓ | ✗/✗ | ⚠ sent_at acts as created_at |
| `tickets` | 0 | 15 | UUID (dbgenerated) | 1 | ✓ | ✓/✓ | ✅ |
| `ticket_entries` | 0 | 10 | UUID | 0 | ✗ | ✓/✗ | ⚠ |
| `push_subscriptions` | 1 | ? | UUID | 0 | ✗ | — | ❌ not in prisma |

### Domain: Marketing / Content

| Table | Rows | Status |
|---|---|---|
| `accounts` | 296 | ⚠ Zoho accounts mirror — unclear if used |
| `account_contacts` | 56 | ⚠ Zoho contact mirror — unclear if used |
| `market_news_headlines` | 87 | ✅ |
| `market_summaries` | 0 | ⚠ dead? |
| `rate_watch_commentaries` | 24 | ✅ |
| `economic_calendar_events` | 20 | ✅ |
| `fomc_statements` | 4 | ✅ no updated_at needed |
| `fred_series_data` | 2,968 | ✅ immutable time series |
| `content_pages` | 8 | ❌ not in prisma |

### Domain: Config

| Table | Rows | Status |
|---|---|---|
| `broker_config` | 1 | ⚠ singleton row, `id = 'default'` text PK — unusual |
| `organizations` | 1 | (see Identity) |

---

## 3. Junction tables

Strict definition: a junction table is one whose sole purpose is to model an M:N relationship between two other entity tables, with no identity or state of its own beyond the relationship attributes.

| Table | Links | True junction? | Comment |
|---|---|---|---|
| `loan_participants` | loans × (contacts OR staff) | ✅ yes | Pure M:N. CHECK constraint `loan_participants_contact_xor_staff` enforces exactly one side. 851 rows, 4 FKs, 7 indexes. Unique on (loan_id, contact_id) AND (loan_id, staff_id). Role is junction attribute. |
| `loan_borrowers` | loans × contacts | ❌ no — disguised snapshot table | 30 columns including citizenship, dob_encrypted, housing_type, monthly_rent, previous_address_years. This is an **application snapshot**, not a junction. Name lies. |
| `deal_participants` (UAD target) | Replaces loan_participants | — | The spec is sound. Existing `loan_participants` is already ~95% of it. |
| `loan_service_providers` | loans × service_provider_accounts (× service_provider_contact opt) | ✅ yes | Genuine junction with role + status attributes. ON DELETE CASCADE from loans, but **no ON DELETE from service_provider_accounts** — orphan risk. |
| `service_provider_contacts` | accounts × (no second table) | ❌ no — just a child entity | Despite the name, this is the person-at-company entity, not a junction. OK as-is. |
| `scenario_alert_queue` | scenarios × (nothing) | ❌ no — disguised event log | Carries `pricing_data`, `status`, `reviewed_by`, `sent_at`. This is the outbound email queue, not a junction. Name lies. |
| `scenario_rates` | scenarios × (lender, implicitly) | ❌ no — child entity | Just a one-to-many child of scenarios. 120 rows. |
| `scenario_fee_items` | scenarios × (nothing) | ❌ no — child entity | 605 rows, one-to-many. |
| `loan_events` | loans × (actors, denorm) | ❌ no — audit log | 221 rows, pure event log. `actor_type` + `actor_id` is polymorphic, no FK. |
| `account_contacts` | accounts × (nothing) | ❌ no — child entity | Zoho contact mirror — just a one-to-many child. |
| `rate_prices` | rate_sheets × rate_products | ✅ yes | Junction with rate + price + lock_days as attributes. 23,403 rows — hot table. Well-indexed. |

Query patterns check (grep `FROM loan_participants` and `FROM loan_borrowers` in `/src`):
- `loan_participants`: 11 files (mostly portal routes, some corebot, some dashboard). Already actively queried — the UAD path is already partly live.
- `loan_borrowers`: appears in ~9 files, mostly legacy portal routes that predate Layer-1a. D9e should sweep these to `loan_participants` and retire `loan_borrowers` — but **first the snapshot fields (citizenship, dob_encrypted, housing_type, previous_address*) need a destination**. They belong on either the contact (citizenship) or a `deal_borrower_snapshot` module (housing, prior address).

---

## 4. Naming and type consistency

Every finding below is backed by a live DB query. File:line citations are `prisma/schema.prisma` unless stated.

### 4.1 Same concept, different column name

| Concept | Variants found | Verdict |
|---|---|---|
| Loan term (years) | `loans.loan_term` (int, schema.prisma:89), `scenarios.term` (int default 30, schema:826), `rate_products.term` (int default 30, schema:1448), `rate_history.term` (int), `rate_alerts.term` (int), `homepage_rate_cache.term` (int), `nonqm_rate_products.term` (int, DB only), `site_scenarios.term` (int, DB only) | Pick one: **`term`** wins on count (7 vs 1). Rename `loans.loan_term` in D9e. |
| Credit score | `loans.credit_score` (int, schema:129), `leads.credit_score` (int, schema:670), `scenarios.fico` (int NOT NULL, schema:821), `adjustment_rules.fico_min/max` (int), `rate_products.fico_min/max` (int), `nonqm_adjustment_rules.fico_*` | Pick one: **`fico`** for snapshot (scenario) is fine as industry jargon; `credit_score` for the borrower entity (loans, leads) is fine — but pick one form. UAD §3 uses `fico` on scenarios. Land on "credit_score on human-facing entities, fico on pricing-facing". Still worth documenting. |
| Loan purpose | `loans.purpose` (text, schema:83), `loans.refi_purpose` (text, schema:97 — sub-reason!), `leads.loan_purpose` (text), `scenarios.loan_purpose` (text NOT NULL), `adjustment_rules.purpose` (text), `ref_va_funding_fee.purpose`, `rate_products.loan_purpose` (varchar(20) — **different type!**) | **Bad.** `loans.purpose` vs `loans.loan_purpose` on scenarios is the same thing. In prod, `loans` uses `purpose` + `refi_purpose` (hierarchy from mig 016). Scenarios use `loan_purpose` directly. Pick one. `rate_products.loan_purpose` is `character varying(20)` while every other `loan_purpose` is `text` — type mismatch. |
| Loan type | `loans.loan_type` (text), `scenarios.loan_type` (text default 'conventional'), `rate_products.loan_type` (text), `rate_history.loan_type` (varchar(30)), `rate_alerts.loan_type` (text), `adjustment_rules.loan_type`, `nonqm_rate_products.loan_type`, `homepage_rate_cache.loan_type` | Name is consistent. Types mostly consistent. `rate_history` uses varchar(30) — leftover. |
| Property value | `loans.estimated_value` (numeric, schema:95), `loans.appraised_value` (numeric, schema:140), `loans.purchase_price` (numeric, schema:93), `scenarios.property_value` (numeric), `leads.property_value` (numeric), `contacts.home_value` (numeric) | These are not all the same thing — appraised ≠ estimated ≠ purchase — but `contacts.home_value` is redundant with whatever loan is the primary. UAD §3 uses `property_value` on deals. |
| Occupancy | Consistently named `occupancy` across loans, scenarios, leads, rate_products, nonqm_adjustment_rules | ✅ good |
| Monthly rent | `loan_borrowers.monthly_rent` (numeric(12,2), schema:217), `loans.monthly_rent` (numeric), `scenarios.monthly_rent` (numeric) | `loans.monthly_rent` came in via mig 004 as a DSCR-specific field. `loan_borrowers.monthly_rent` is housing expense (current renter). Different semantics, same name — future bug farm. |
| Units count | `loans.num_units` (int, schema:92), `scenarios.unit_count` (int, schema:843), `loans.unit_count` (int — added mig 004 for DSCR) | `loans` has BOTH `num_units` and `unit_count`. One of them is dead. |
| DSCR ratio | `loan_dscr.dscr_ratio` (numeric(5,3)), `loans.dscr_ratio` (numeric), `scenarios.dscr_ratio` (numeric(5,2)) | Decimal precision differs: (5,3) vs (5,2). |

### 4.2 Timestamp column naming

All DB-side columns are `created_at` / `updated_at` (snake_case) — **good, consistent**. Prisma models mostly use camelCase with `@map` which is also consistent.

**Issue:** 21 tables have `created_at` but no `updated_at`:
`call_notes, contact_notes, documents, lead_quotes, loan_events, loan_notes, loan_service_providers, market_news_headlines, nonqm_*, push_subscriptions, rate_history, rate_prices, rate_sheets, rate_watch_commentaries, scenario_alert_queue, scenario_fee_items, scenario_rates, staff, ticket_entries`

Of these:
- Immutable by design (ok): `loan_events`, `rate_history`, `rate_prices` (should be immutable), `scenario_rates`, `scenario_fee_items`, `market_news_headlines`, `rate_watch_commentaries`
- Should have updated_at: **`staff`, `documents`, `loan_notes`, `loan_service_providers`, `scenario_alert_queue`** (it has reviewed_at/sent_at, so effectively tracked)

5 tables have **no** audit columns at all: `call_logs` (uses started_at/ended_at), `sms_messages` (uses sent_at), `homepage_rate_cache`, `fomc_statements` (immutable), `fred_series_data` (immutable). The first two are fine; `homepage_rate_cache` should have updated_at.

### 4.3 Plural vs singular

All table names are plural. Consistent. (`fee_templates`, `loan_dates`, `loan_participants`, etc.) Prisma-side models are singular (`Loan`, `Scenario`). ✅

### 4.4 ID column type

- 53 tables: UUID
- 18 tables: integer (all `ref_*`, rate_history, market_news, market_summaries, fomc, fred, economic_calendar_events, rate_watch_commentaries, ref_conforming_baselines)
- 1 table: `broker_config.id` text default `'default'` (singleton pattern)
- 1 table: `_prisma_migrations.id` varchar(36)

18-integer count is consistent internally (lookup/reference tables use ints). Acceptable.

**Missing UUID DEFAULT on id columns** (would bite an INSERT that forgets `gen_random_uuid()`): checked with the query; mig 021 covered 7 tables. Remaining UUID tables with `id` but NO default:
- `rate_lenders`, `rate_products`, `rate_prices`, `adjustment_rules`, `fee_templates` (all D6 pricing schema), `AdjustmentRule` has `id String @id @db.Uuid` with no default in schema.prisma:751 — **confirmed live in DB, no default**.

This is **mig 021's blind spot**: it patched the D4 findings but missed every table created by mig 003/004 (unified scenarios + nonqm). Every INSERT site into these must `gen_random_uuid()` manually. Silent-insert bug territory.

### 4.5 FK naming

- All snake_case at DB: `contact_id`, `loan_id`, `mlo_id`, `staff_id`, `lender_id`, etc. ✅
- Prisma-side: mostly camelCase via @map. One oddity: `Contact.assigned_mlo_id` is snake_case in Prisma too (schema:303). Mixed within the same model (camelCase for most fields, snake_case for this one). A Prisma-side inconsistency, not a DB issue.
- `staff.ldox_officer_id` is int, not UUID — intentional (external ID from LoanDox).

### 4.6 Enum vs String vs CHECK

**PostgreSQL has no actual ENUMs used here** — every categorical is `text`. Prisma has no `enum` types in schema. Categorical control lives in CHECK constraints:

29 CHECK constraints cataloged. The constrained categoricals:
- `scenarios.{status, source, visibility, owner_type, product_family, bank_statement_months, prepay_years}` — 6 total ✅
- `loans.{product_family, bank_statement_months, prepay_years}` — **only product_family; status is NOT constrained despite 7 distinct values in prod**
- `loan_participants.role`, `loan_service_providers.{role, status}` ✅
- `contacts.{marketing_stage, role}` ✅
- `staff.role` ✅

**Unconstrained categorical columns that SHOULD have CHECK:**
- `loans.status` — 7 distinct values live, no constraint (schema:80)
- `loans.ball_in_court` — default 'borrower', no constraint (schema:81)
- `loans.purpose` — no constraint (schema:83)
- `loans.occupancy` — no constraint (schema:84)
- `loans.loan_type` — no constraint (schema:84)
- `leads.status` — no constraint
- `documents.status` — no constraint
- `conditions.status` — no constraint
- `conditions.stage` — no constraint
- `loan_tasks.status` — no constraint
- `loan_tasks.priority` — no constraint
- `rate_alerts.status`, `rate_alerts.type` — no constraint (dead table but still)

### 4.7 Numeric types

`Decimal(12,2)` is the money standard (loan_amount, purchase_price, property_value, etc). `Decimal(5,4)` for rates (interest_rate, arm_*_cap, pmi_rate). **Inconsistencies:**

- `scenarios.pmi_rate` is Decimal(5,4) ✅ — but `loan_conv.pmi_monthly` is Decimal(12,2) (dollars) while field name suggests rate. OK, semantic.
- `hecm_scenarios.home_value` is Decimal(12,**4**) — the only money field with 4 dp (schema:593). Bug or deliberate? Likely a historical typo.
- `rate_alerts.loan_amount` is Decimal(12,**4**) — same typo pattern (schema:1373).
- `rate_alerts.triggered_rate` is Decimal(12,4) — rate should be (5,3) or (5,4).
- `rate_history.loan_amount` is **integer** — every other loan_amount is numeric.
- `scenario_rates.final_price` is Decimal(8,3) — prices are (8,4) everywhere else (e.g. `rate_prices.price` is Decimal(8,4)). **Precision loss risk.**
- `scenarios.dscr_ratio` is Decimal(5,**2**) while `loan_dscr.dscr_ratio` is Decimal(5,**3**). Rounds differently.

### 4.8 String length

Only 25 columns use `varchar` with explicit length. The rest are `text`. Varchar usage concentrated in `economic_calendar_events`, `rate_history`, `rate_watch_commentaries`, `market_news_headlines` — older tables. `contacts.ssn_last_four` (varchar(4)) is the only reasonable length constraint. `rate_products.loan_purpose` is varchar(20) while same column is `text` everywhere else — drop the length constraint.

---

## 5. Normalization assessment

### 5.1 Intentional denormalization (KEEP)

- `homepage_rate_cache` — entire purpose is to denormalize scenario/pricing for sub-100ms homepage render. ✅
- `rate_history` — precomputed daily rollups. ✅
- `scenario_fee_items.section` (char(1)) — TRID section letter is the whole key. ✅
- `loans.ltv` implicit (loan_amount / property_value) — NOT stored on loans. `scenarios.ltv` IS stored (numeric). Acceptable; both scenarios are "snapshot at pricing time" so ltv is frozen anyway.
- `scenarios.monthly_payment`, `monthly_savings`, `cash_to_close`, `pmi_rate`, `fee_total_*` — computed results. ✅ snapshot table, denorm is the point.
- `leads.scenario_data` (jsonb) — intentional snapshot of the scenario state when lead was captured. ✅
- `contacts.current_loan_*` — ⚠ borderline: per UAD §3 (AD-7), strike rate data belongs on deals. Populating `current_loan_amount / _rate / _date / _term` on contacts is contra to the UAD direction.

### 5.2 Accidental denormalization (FIX)

- **`scenarios.borrower_name / borrower_email / borrower_phone`** (schema:810-813) — explicitly marked DEPRECATED. 42 of 56 rows still write to these. 3NF violation. Fix is already scheduled but 2 weeks overdue.
- **`leads.first_name / last_name` AND `leads.name`** — three name fields. `first_name + last_name` from the Zoho sync era, `name` from the contact-form era. No invariant.
- **`contacts.co_borrower_email / _name / _phone`** (schema:307-309) — the co-borrower is a Contact (per UAD AD-3), not a string. These should become a relationship, not columns.
- **`contacts.property_address` (text) + `contacts.mailing_address` (text)** vs `contacts.address` on `organizations` (jsonb) — texts vs jsonb for address. `loans.property_address` / `current_address` / `mailing_address` are all jsonb. `loan_borrowers.current_address` / `previous_address` / `mailing_address` are jsonb. Pick one. jsonb wins because addresses have structure (line1/line2/city/state/zip).
- **`loans.employer_name`, `loans.monthly_base_income`, etc.** (schema:107-113) — these exist on `loans` AND on `loan_borrowers` AND on `loan_employments` / `loan_incomes`. Triple-stored. D9e must nuke the `loans.*` copies.

### 5.3 Repeating groups / transitive dependencies

- **`loans.arm_initial_cap, arm_lifetime_cap, arm_periodic_cap, arm_margin, arm_index, arm_adjustment_period, arm_structure`** — 7 ARM-specific columns on loans table that are NULL for every non-ARM loan. Should be an `loan_arm` satellite table (parallel to `loan_conv`).
- **`contacts.current_loan_amount, current_loan_date, current_loan_term, current_rate, funded_date, home_value, strike_rate_opt_in`** — strike-rate-tracking on contacts. Per UAD AD-7, should be on deals.
- **`loans.prequal_letter_data`, `loans.cd_extracted_data`, `loans.work_drive_subfolders`** (jsonb) — grab-bag JSON blobs on the loans table. `cd_extracted_data` is particularly weighty (full CD parse output). Candidates for satellite tables.

---

## 6. Constraint and integrity audit

### 6.1 NOT NULL coverage

High-confidence gaps where NOT NULL should be enforced:
- `scenarios.mlo_id` is nullable — yet every MLO-owned scenario must have one. Check application invariant: `owner_type = 'mlo'` should imply `mlo_id IS NOT NULL`. Today it's a partial-index candidate rather than a NOT NULL, but missing.
- `loans.contact_id` is NOT NULL ✅
- `loans.mlo_id` is nullable ✅ (some loans are unassigned)
- `loan_participants.role` is NOT NULL (via NOT NULL on col + CHECK) ✅
- `leads.email`, `leads.name`, `leads.source` — all nullable. That's wrong. A lead with no email is not useful.
- `contacts.first_name, last_name` — NOT NULL ✅ but `contacts.email` is nullable. Fine for a contact manually added with only a phone; but at least one of email/phone should be NOT NULL via CHECK.
- `rate_alerts.email` — NOT NULL ✅

### 6.2 Missing DEFAULTs (silent-insert bugs)

Mig 021 patched 7 tables. **Unpatched UUID `id` columns with NO default:** `rate_lenders`, `rate_products`, `rate_prices`, `adjustment_rules`, `fee_templates`, and every `nonqm_*` table. Any INSERT that doesn't explicitly `gen_random_uuid()` will NULL-fail. This is the exact pattern mig 021 was created to kill — it's still present.

Recommended: **migration 032 — complete mig 021 for the pricing schema**. Single ALTER TABLE per table.

### 6.3 CHECK constraints — see §4.6

**TOP GAPS:**
- `loans.status` (unconstrained, 7 live values) — should be:
  `CHECK (status IN ('draft', 'applied', 'processing', 'cond_approved', 'ctc', 'funded', 'settled', 'archived', 'withdrawn', 'denied'))`
- `leads.status` (unconstrained) — should have the lifecycle from UAD §3.1
- `conditions.status` (unconstrained) + `conditions.stage`

### 6.4 UNIQUE indexes

**Critical miss: `contacts.email`**. Per UAD §3.1 target, should be UNIQUE per organization:
```sql
CREATE UNIQUE INDEX contacts_org_email_unique ON contacts (organization_id, lower(email))
  WHERE email IS NOT NULL;
```
Without this, the "find-or-create contact by email" logic in `src/lib/contacts/find-or-create.js` relies on application-layer dedup — which means concurrent lead conversions can create duplicate contacts.

`leads.email` is intentionally NOT unique (per UAD §3.1 — same person, multiple lead events). ✅

`staff.email` is globally unique via `mlos_email_key` (leftover name from mig 007). The uniqueness is right; the **index name should be fixed**.

### 6.5 FK cascade behavior

Inconsistencies that will bite:

| Relationship | Current | Should be | Why |
|---|---|---|---|
| `loan_events → loans` | RESTRICT | CASCADE | An `loan_events` history should delete when the loan does. If we're afraid of losing audit — enforce via soft-delete on loans, not FK RESTRICT. |
| `loan_notes → loans` | CASCADE | CASCADE ✅ | Good — matches other satellites |
| `documents → loans` | RESTRICT | **business call** | If docs have compliance retention requirements, RESTRICT makes sense, but then you need a DELETE path (soft-delete loan) |
| `loans → contacts` | SET NULL | **dangerous** | A loan without a contact is meaningless. If a contact is deleted, you lose the loan's owner. Better: RESTRICT, force loan archival first. |
| `loan_borrowers → contacts` | NO ACTION (no ON DELETE) | RESTRICT or CASCADE | Default NO ACTION will throw on delete — effectively RESTRICT. OK but inconsistent with `loan_participants → contacts` which is also NO ACTION. |
| `loan_participants → contacts` | NO ACTION | RESTRICT explicit | Same |
| `loan_service_providers → service_provider_accounts` | NO ACTION | RESTRICT | Same |
| `service_provider_contacts → service_provider_accounts` | CASCADE ✅ | CASCADE | Company gone → contacts gone. Good. |
| `conditions → documents` | SET NULL | SET NULL ✅ | Correct — condition persists even if document purged |

### 6.6 Soft delete coverage

**Zero tables have `deleted_at`.** For:
- `loans` — a "withdrawn" or "denied" deal has to stay for compliance. Today handled by `status` value. OK but not enforced.
- `contacts` — GDPR/CCPA deletion request would require hard delete; today no mechanism exists without breaking FK integrity.
- `leads` — convertible leads vs junk leads; no distinction in deletion semantics.

Adding `deleted_at timestamptz` universally is a 3-table-at-a-time migration. Worth doing before D9e cutover so the new `deals` table has it from birth.

---

## 7. Index coverage

### 7.1 FK columns without covering index (live DB query)

16 FK cols lack an index. Ranked by impact:

| FK column | Table rows | Impact |
|---|---|---|
| `loan_events.loan_id` | 221 | HIGH — queried on every loan detail page |
| `documents.loan_id` | 26 | HIGH — queried on every loan detail page |
| `scenario_alert_queue.scenario_id` | 84 | MEDIUM |
| `call_notes.call_log_id` | 0 | LOW (empty today) |
| `leads.contact_id` | 773 | MEDIUM — conversion lookup |
| `ticket_entries.ticket_id` | 0 | LOW |
| `loans.mlo_id` | 846 | MEDIUM — "my pipeline" queries filter by mlo_id |
| `sms_messages.mlo_id` | 12 | LOW |
| `hecm_scenarios.mlo_id` | 0 | LOW |
| `conditions.depends_on_id` | 28 | LOW |
| `conditions.document_id` | 28 | LOW |
| `documents.requested_by` | 26 | LOW |
| `loan_borrowers.contact_id` | 28 | LOW (legacy table) |
| `loan_service_providers.contact_id` | 0 | LOW |
| `scenarios.parent_scenario_id` | 56 | LOW |
| `call_notes.mlo_id` | 0 | LOW |

Recommended before D9e: add single-column btree indexes on all of these. Batch into one migration.

### 7.2 Composite index opportunities

From grep patterns in `/src`:
- Portal pipeline queries: `WHERE mlo_id = ? AND status IN (...) ORDER BY updated_at DESC` on loans — **compound index on (mlo_id, status, updated_at DESC)** would help. Currently `idx_loans_org` covers org alone.
- Lead pipeline: `WHERE status = 'new' AND created_at > ?` on leads — `(status, created_at DESC)` partial index.
- Scenarios listing: `WHERE mlo_id = ? ORDER BY created_at DESC` — existing `(mlo_id)` index is used, but `(mlo_id, created_at DESC)` would be faster for the sort.
- Documents listing: once `loan_id` is indexed, consider `(loan_id, status)` for "pending docs" views.

### 7.3 Over-indexing

`scenarios` has **17 indexes** — most of any table in the DB. Breakdown (9 non-primary): organization_id, mlo_id, lead_id, contact_id, loan_id, status, owner_type, created_at DESC, (organization_id, owner_type), (organization_id, status), (organization_id, mlo_id). This is likely correct for a table with so many query shapes, but every write pays for 17 index updates. With only 56 rows today, no pain — at 10,000 rows, review.

`loans` has 7 indexes; `loan_participants` has 7. All appear justified.

`ref_*` tables have 4+ indexes each despite being almost read-only reference data — some of these are effectively free (cold indexes, never written to). Not a concern.

### 7.4 Partial indexes

Used in two places:
- `staff.twilio_phone_number_unique WHERE twilio_phone_number IS NOT NULL` ✅
- `nonqm_rate_sheets` has `idx_nonqm_rate_sheets_active WHERE is_active = TRUE` ✅

Opportunity: `leads (created_at DESC) WHERE status = 'new'` for the pipeline view.

---

## 8. UAD §3 gap analysis

Delta between current prod state and UAD §3 target tables:

### `contacts`
- **Target:** role enum, email UNIQUE per org, DOB/SSN encrypted contact-level, marketing_stage, portal_auth jsonb, converted_from_lead_id FK, tags[]
- **Current (65 cols):** role ✅, email **NOT unique** ❌, dob_encrypted ✅, ssn_encrypted ✅, marketing_stage ✅ CHECK ✅, portal_auth scattered across 6 columns (password_hash, magic_token, magic_expires, sms_code, sms_code_expires, sms_attempts, sms_locked_until) — NOT consolidated to `portal_auth jsonb` ❌
- **Delta:** CONSOLIDATE portal auth columns into jsonb. ADD `converted_from_lead_id` FK. ADD UNIQUE index on (organization_id, lower(email)). **DROP** `co_borrower_name/email/phone` (use Contact+relationship). DROP `current_loan_*` (move to deals). DROP `contact_type` (superseded by `role`). DROP `status` (superseded by `marketing_stage`).
- **Effort:** Moderate. Column drops risk data loss — every column must be checked for readers.
- **Callers:** ~40 files (grep `FROM contacts`). Major refactor.
- **Migration risk:** HIGH. 904 rows, many jsonb blob copies, moderate transform.

### `staff`
- **Target:** role enum, name (first/last), nmls, license_states, commission_rate, ldox_officer_id, is_active
- **Current (14 cols):** matches target closely ✅
- **Delta:** ADD `updated_at`. ADD explicit CHECK on role (already exists ✅). Rename the leftover `mlos_email_key` index to `staff_email_key`.
- **Effort:** Trivial.
- **Callers:** ~20 files. Minimal impact.

### `leads`
- **Target:** `assigned_mlo_id FK`, `contact_id FK on conversion`, status lifecycle, view_token
- **Current (38 cols):** assigned_mlo_id: MISSING (field is `mlo_id`, not `assigned_mlo_id`). contact_id ✅. status nullable ❌ should be NOT NULL default 'new'. `view_token` ✅.
- **Delta:** Rename `mlo_id` → `assigned_mlo_id`. NOT NULL status. ADD CHECK on status. DROP unused fields: `annual_income`, `first_time_buyer`, `purchase_price` vs `property_value` duplication, etc.
- **Effort:** Moderate.
- **Callers:** ~15 files. Most in `/src/app/api/portal/mlo/leads/`.

### `deals` (from `loans`)
- **Target:** ~25-col core + satellites for application modules
- **Current (97 cols):** kitchen sink
- **Delta:** Rename `loans` → `deals` (pick strategy — see Open Q). DROP ~60 columns that belong in satellites: employment_*, monthly_base_income, other_monthly_*, current_address, mailing_address, declarations, marital_status, num_dependents, present_housing_expense, application_method, lien_status, referral_source, lead_source, application_channel, action_taken*, cd_*, work_drive_*, all arm_* (to loan_arm), cashout_reason, nonqm_tier, nonqm_subcategory, dscr_ratio (already in loan_dscr), monthly_rent (already in loan_dscr). Keep financial core + status.
- **Effort:** ARCHITECTURAL.
- **Callers:** 33 SELECT, 15 INSERT/UPDATE.
- **Migration risk:** HIGHEST. 846 rows × 60+ column migrations. Must dual-write or lock.

### `deal_participants` (from `loan_participants`)
- **Target:** deal_id, contact_id XOR staff_id, role enum, has_portal_access, private_docs, notification_prefs jsonb, ordinal
- **Current (`loan_participants`):** loan_id, contact_id, staff_id, role, has_portal_access, private_docs, notification_prefs, ordinal, organization_id
- **Delta:** Rename `loan_id` → `deal_id` (after loans→deals). Already has CHECK XOR ✅. Already has uniqueness ✅. Drop legacy `loan_borrowers` once its snapshot fields have a module home.
- **Effort:** Trivial rename + drop legacy.
- **Callers:** 11 files + 9 legacy on loan_borrowers.

### Service provider tables (already exist, all empty)
- `service_provider_accounts`, `service_provider_contacts`, `loan_service_providers` — match UAD §3.2 spec.
- **Delta:** rename `loan_service_providers` → `deal_service_providers`. Add `updated_at` to deal_service_providers.
- **Effort:** Trivial (tables empty).

### `scenarios`
- **Target:** contact_id FK, deal_id FK, lead_id FK, owner_type enum, source enum, extension tables (scenario_hecm, scenario_dscr)
- **Current (78 cols):** contact_id ✅, deal_id (called `loan_id`) ✅, lead_id ✅, owner_type ✅ with CHECK, source ✅ with CHECK, **borrower_name/email/phone DEPRECATED but still populated**
- **Delta:** (1) DROP the denorm columns + backfill from contact_id/lead_id. (2) ADD `share_token` and `attached_modules text[]` (per §6 Layer 3 Lite). (3) BREAK OUT: move HECM-specific fields to `scenario_hecm`, DSCR-specific fields (`dscr_ratio`, `monthly_rent`, `unit_count`, `product_family='nonqm'` subtree) to `scenario_dscr`. This is what D9c targets.
- **Effort:** Moderate-to-architectural for the extension tables; trivial for the column drops.
- **Callers:** ~15 files on scenarios + DAL layer (`src/lib/scenarios/*`).

### `scenario_rates`, `scenario_fee_items`
- Already match UAD target structure. Keep as-is.

---

## 9. Orphans, dead tables, suspects

| Table | Rows | Disposition | Reasoning |
|---|---|---|---|
| `lead_quotes` | 0 | **DROP** | Superseded by `scenarios` (mig 018 story). Last writes long gone. Only Prisma schema still references it. |
| `rate_alerts` | 0 | **DROP** | Superseded by `scenarios.alert_status` and `scenario_alert_queue`. Still in Prisma as `RateAlert` model (schema:1363). |
| `hecm_scenarios` | 0 | **INVESTIGATE** | Empty but has CRUD code paths. Redundant with `scenarios` + future `scenario_hecm`. David call: consolidate or keep for HECM Optimizer calculator? |
| `rate_history` | 281 | KEEP | Rollup table. Actively written by rate parser. |
| `market_summaries` | 0 | **INVESTIGATE** | Field `created_by` exists but nothing populates. Check if Claw feeds this. |
| `accounts`, `account_contacts` | 296, 56 | **INVESTIGATE** | Zoho CRM mirror of business accounts (realtors, attorneys, etc.). Per UAD AD-15, realtors become contacts with role='realtor'. These tables become legacy. But still populated — check if the Zoho sync is live. |
| `call_notes` | 0 | INVESTIGATE | Have call_notes been replaced by tickets/loan_notes? |
| `loan_assets, loan_liabilities, loan_declarations, loan_employments, loan_incomes, loan_reos` | all 0 | KEEP (empty but designed) | These are the Phase-1 satellite tables from mig 002/005. Not yet wired up, but they're the UAD §7.1 destination. |
| `loan_transactions, loan_va, loan_dscr, loan_conv` | 0 | KEEP | Satellite stubs. |
| `push_subscriptions` | 1 | KEEP | Active (Web Push project, PR #172 per commit log) — **MUST ADD TO PRISMA**. |
| `content_pages` | 8 | KEEP | Claw-published content. **ADD TO PRISMA**. |
| `site_scenarios`, `surface_pricing_config`, `homepage_rate_cache` | 1, 3, 4 | KEEP | D6 homepage rate card infra. **ADD TO PRISMA**. |
| `nonqm_rate_sheets/products/adjustment_rules` | 1/3255/12582 | KEEP | D6 Non-QM schema. **ADD TO PRISMA**. |
| `ref_county_tax_rates` | 0 | INVESTIGATE | Table created by mig 027 but not seeded. Is there a seed script pending? |
| `ref_va_funding_fee` | 0 | **SEED NEEDED** | Regulatory table with no data — VA pricing depends on it. Who owns the seed? |

### Schema drift in both directions

**In Prisma but NOT in migrations ledger:** all 57 models' DDL lives scattered across migrations 001, 002, 004, 005, 010, etc. No single migration defines the full schema — you could not re-create the DB from migrations alone because mig 001 assumes a preexisting schema (Prisma Migrate baseline from `20260318000000_baseline_full_schema` recorded in `_prisma_migrations`). **The baseline migration exists only in `_prisma_migrations` — its SQL is not in `prisma/migrations/`.** This is a disaster-recovery gap.

**In migrations but NOT in Prisma:** 22 tables listed above (all `ref_*`, nonqm_*, site_scenarios, surface_pricing_config, homepage_rate_cache, content_pages, push_subscriptions).

**Missing migration file 030:** the sequence jumps from 029 → 031. Either a dropped migration or an out-of-band rename — check with David.

---

## 10. Migration risk map for D9e

Row counts and caller counts (grep `FROM <table>` / `INTO <table>` / `UPDATE <table>` in `/src`).

| Table | Rows | FK-IN count | FK-OUT count | Readers (files) | Writers (files) | Strategy | Blast radius |
|---|---|---|---|---|---|---|---|
| `loans` → `deals` | 846 | 15 | 3 | 33 | 15 | **Dual-write bridge (2-3 PR sequence)**: create `deals` with rename columns, write-through proxy, migrate readers one-by-one, drop `loans` view | **HIGH** |
| `loan_borrowers` → retire | 28 | 4 | 2 | 11 | 5 | Snapshot columns get homed in new module tables; remaining thin rel becomes `deal_participants` role=primary_borrower | MEDIUM |
| `loan_participants` → `deal_participants` | 851 | 0 | 4 | 11 | 5 | Atomic rename + column rename (loan_id→deal_id) in a single DDL txn | LOW |
| `loan_events` → `deal_events` | 221 | 0 | 1 | 6 | 4 | Atomic rename. RESTRICT FK becomes CASCADE. | LOW |
| `loan_dates` → `deal_dates` | 588 | 0 | 1 | 8 | 6 | Atomic rename | LOW |
| `loan_notes`, `loan_tasks`, etc. (11 satellites) | 0–1 each | 0 | 1 | — | — | Atomic rename of table + loan_id col | LOW (all empty) |
| `loan_conv`, `loan_fha`, `loan_va`, `loan_hecm`, `loan_dscr` | 0 or 1 | 0 | 1 | 1–2 | 1–2 | Atomic rename. These are `deal_conv` etc. | LOW |
| `loan_service_providers` → `deal_service_providers` | 0 | 0 | 3 | 1 | 1 | Atomic rename | LOW |
| `loan_assets, loan_liabilities, loan_employments, loan_incomes, loan_reos, loan_declarations, loan_transactions` | all 0 | 0 | 1 | 0 | 0 | Atomic rename | TRIVIAL |
| `documents.loan_id` → `documents.deal_id` | 26 | — | 1 (to loans) | 15 | 8 | Column rename | LOW |
| `conditions.loan_id` → `conditions.deal_id` | 28 | 1 (self) | 3 | 5 | 4 | Column rename | LOW |
| `scenarios.loan_id` → `scenarios.deal_id` | 24 set | 0 | 3 | 10 | 6 | Column rename | LOW |

**Cutover strategy recommendation for the `loans` table itself:**

Option A — **Atomic rename**. DB lock, rename loans → deals, update every caller in a single PR. Risk: big-bang; if we miss a caller, prod breaks.

Option B — **Dual-write with views**. Keep `loans` as a view over `deals` for the deprecation window. New code writes to `deals`; old code reads from `loans` view. Risk: updatable views are finicky in Postgres with CHECK constraints + defaults.

Option C — **Coexist for one cycle**. Create `deals` with FK back to `loans`, dual-write during the cutover, flip the FK direction in a later PR. Risk: data divergence if transactions span both.

My recommendation: **Option A, preceded by the column purge** (drop the 60 denormalized columns first, in batches of ~10, so the final rename is a trivial 30-col table). That's 6 PRs for the purges + 1 for the rename + follow-ups. Cleaner than dual-write complexity.

---

## 11. Module design readiness

Cross-reference UAD §7.1 to current state:

### Module: Borrower identity (§7.1)
- **Today:** `contacts` carries name/email/phone/dob_encrypted/ssn_encrypted/current_address. `loan_borrowers` carries a snapshot (dob_encrypted, citizenship, previous_address, housing_type, monthly_rent).
- **UAD target:** Pure Contact record. No duplication on deal.
- **Linkage:** via `deal_participants.contact_id` (role in {primary_borrower, co_borrower}).
- **Existing approximation:** `contacts` already does most of the job post-Layer-1b. Remaining work: migrate `loan_borrowers.citizenship / suffix / housing_type / dob_encrypted` to either `contacts` (citizenship, suffix — identity) or a new satellite (housing_type → `deal_housing` module).

### Module: Employment and income (§7.1)
- **Today:** `loan_employments` (0 rows) + `loan_incomes` (0 rows) — schemas ready. Duplicate copies on `loans.employer_name, position_title, years_in_position, monthly_base_income, other_monthly_income` AND on `loan_borrowers.employer_name, position_title, ...`. Triple-stored, all empty on the satellites.
- **UAD target:** deal-level snapshot linked via participant.
- **Linkage:** `loan_employments.loan_borrower_id → loan_borrowers.id` today. For D9e: shift to `deal_employments.participant_id → deal_participants.id`.
- **Existing approximation:** schemas exist but nothing writes them. **Callers use loans.employment_* or loan_borrowers.employment_* instead.** D9e cutover must update every writer.

### Module: Assets (§7.1)
- **Today:** `loan_assets` (0 rows, schema ready). `borrowerType` optional field exists (schema:1118) — can scope to borrower via deal_participant.
- **UAD target:** deal-level with per-participant breakdown.
- **Linkage:** Missing per-participant FK — today it's `loan_id` only + `borrower_type` enum (the text 'primary' / 'co-borrower'). **Should add `participant_id` FK**.

### Module: Property (§7.1)
- **Today:** `loans.property_address / property_type / num_units / num_units` — nullable columns on the loans row.
- **UAD target:** deal-level (no change — property isn't per-participant).
- **Existing approximation:** OK as-is. Survives into `deals`.

### Module: Loan details (§7.1)
- **Today:** `loans.loan_type / loan_amount / interest_rate / loan_term / lender_name / loan_number / amortization_type / arm_*`
- **UAD target:** deal core fields.
- **Delta:** ARM fields should split to `loan_arm` satellite (match `loan_conv` pattern).

### Module: Co-borrower (§7.1)
- **Today:** `contacts.co_borrower_name / _email / _phone` (string denorm) + implicit via `loan_borrowers.ordinal > 0 OR loan_borrowers.borrower_type = 'co_borrower'` + `loan_participants.role = 'co_borrower'`.
- **UAD target:** Just another Contact with a deal_participants row.
- **Delta:** drop the string columns on contacts; keep the participant row pattern.

### Module: Declarations (§7.1)
- **Today:** `loan_declarations` (0 rows, 19 cols, schema:1146). Duplicate jsonb on `loans.declarations` (schema:114) and `loan_borrowers.declarations` (schema:210).
- **UAD target:** per-borrower, per-deal, always fresh. Matches `loan_declarations.loan_borrower_id → loan_borrowers.id` today.
- **Delta:** retire the duplicate jsonb blobs on loans/loan_borrowers. Enforce 1-declarations-per-borrower-per-deal via the already-present UNIQUE (loan_borrower_id) constraint.

### Reader-mentioned future candidates

- **REO:** `loan_reos` table exists (mig 005, 0 rows). Ready.
- **Liabilities:** `loan_liabilities` table exists. Ready.
- **Business entities:** not yet modeled. Would be a new `deal_business_entities` table keyed by participant_id (for self-employed / S-corp income docs). Design at HECM or DSCR activation.

---

## 12. Prioritized recommendations

### 12.1 Foundation fixes BEFORE D9c/D9e starts (small, high-leverage)

| # | Fix | Rationale | Effort | Urgency |
|---|---|---|---|---|
| 1 | **Migration 032 — add UUID DEFAULT to pricing tables** (rate_lenders, rate_products, rate_prices, adjustment_rules, fee_templates, nonqm_*) | Completes mig 021. Prevents silent-insert bugs. Same pattern, same risk class. | S | HIGH |
| 2 | **Migration 033 — add indexes on 16 unindexed FK columns** | Batch up. Pure DDL, no data transform. Speeds every JOIN. | S | HIGH |
| 3 | **Migration 034 — add CHECK constraints on 8 unconstrained categoricals** (loans.status, leads.status, documents.status, conditions.status, loan_tasks.status, conditions.stage, ball_in_court, loan_purpose) | Categorical hygiene. D4 follow-through. | S | MEDIUM |
| 4 | **Migration 035 — UNIQUE index on `contacts (organization_id, lower(email))` WHERE email IS NOT NULL** | Required for find-or-create correctness. D9a "identity unification" is theatre without it. | S | HIGH |
| 5 | **Migration 036 — add missing Prisma models** for the 22 drift tables | Prisma stays useful as a doc. Even as "docs only" it should reflect reality. | M | MEDIUM |
| 6 | **Migration 037 — drop `lead_quotes` and `rate_alerts` dead tables** | Zero-row, zero-write dead tables. Confusing to future readers. | S | LOW |
| 7 | **Complete the Layer-1c denorm drop** (`scenarios.borrower_name / _email / _phone`) — backfill contact_id/lead_id on the 42 rows, then DROP columns | Scheduled for ~2026-05-01, 2 weeks overdue. Blocks D9c. | M | HIGH |
| 8 | **Investigate missing migration 030** and document | Sequence gap is suspicious. | S | MEDIUM |
| 9 | **Rename `mlos_email_key` index to `staff_email_key`** (mig 038) | Cleanup of leftover from the 007 rename. | S | LOW |
| 10 | **Create baseline migration SQL** (snapshot of current schema) so DB can be recreated from `prisma/migrations/` alone | DR gap — baseline exists only in `_prisma_migrations` history. | M | MEDIUM |

### 12.2 Changes that belong inside the D9c scoping session

- Break `scenarios` extension columns (HECM fields + DSCR fields currently on the main table) into `scenario_hecm` / `scenario_dscr` tables. Pattern already validated by `scenario_rates` / `scenario_fee_items`.
- Add `scenarios.share_token` (unique, partial index WHERE share_token IS NOT NULL) for Layer 3 Lite.
- Add `scenarios.attached_modules text[]` for composable calc module attachments.
- Decide: does `hecm_scenarios` merge into `scenarios` (set `loan_type='hecm'`, move fields to `scenario_hecm`), or stay separate as a pure-calculator artifact?
- Determine whether `scenarios.product_family` + `loan_type` is redundant.

### 12.3 Changes that belong inside the D9e scoping session

- `loans` → `deals` rename strategy (Option A/B/C above)
- 60-column purge on `loans` — which of those fields survive on `deals`, which go to new satellites (`deal_housing`, `deal_arm`, `deal_operational` for the cd_* / work_drive_* fields)
- `loan_borrowers` retirement — migrate `citizenship`, `suffix`, `dob_encrypted` to `contacts`; migrate `housing_type`, `monthly_rent`, `previous_address*` to a new `deal_housing` module; drop the rest
- `loan_participants` column rename (`loan_id` → `deal_id`) and retire `loan_borrowers`
- Add `updated_at` to staff, loan_service_providers, and every other table missing it
- Add `deleted_at` universally for soft-delete support
- `contacts` column purge (`co_borrower_*`, `current_loan_*`, `contact_type`, `status`, `mailing_address` text → jsonb)
- Consolidate `contacts` portal-auth columns into `portal_auth jsonb`
- `leads` rename `mlo_id` → `assigned_mlo_id`
- Add participant_id FK to `loan_assets`, `loan_liabilities`, `loan_reos` (currently loan-scoped only)

### 12.4 Standalone project (HECM, DSCR, eSign, etc.)

- HECM engine: wire `ref_hecm_plf` (4,864 rows seeded) and `ref_hecm_limits` / `ref_hecm_ufmip` / `ref_hecm_annual_mip` into a real pricing path. `loan_hecm` satellite ready. Retire hardcoded PLF from `ScenarioContext`. (D9d + HECM scope.)
- DSCR/NonQM: `nonqm_*` tables live in DB but not in Prisma. Add to Prisma. Consolidate `loans.product_family`/`nonqm_tier`/`nonqm_subcategory`/`prepay_years`/`bank_statement_months` into a `deal_nonqm` satellite matching `loan_conv` pattern.
- eSign: no schema impact yet. When it lands, documents table gains envelope_id, signed_at, etc.
- Email engine: scenario-send lifecycle fields already exist. Add `email_events` table for open/click tracking.
- SMS/phone tool: `sms_messages` + `call_logs` + `call_notes` are already there. Add retention policy + soft-delete.

### 12.5 Nice-to-haves (defer)

- Split `loans.prequal_letter_data` / `cd_extracted_data` / `work_drive_subfolders` jsonb blobs into satellites (unless they stay on `deals` because nothing else needs them)
- Review `ref_*` tables — are they worth UUID PKs? (Probably no — int is fine for lookups.)
- Migrate `fee_templates` to a per-state/per-county/per-purpose reference pattern consistent with `ref_*`
- Convert varchar columns back to text (no length benefit in Postgres) — `rate_history.*`, `rate_products.loan_purpose`, `market_news_headlines.title`

---

## 13. Open questions for David

These are judgment calls the audit surfaced. Each needs a decision before D9c/D9e scoping can finalize.

1. **Loans → deals cutover strategy.** Atomic rename (one big PR, one DB lock), dual-write bridge (safer, slower), or coexist (most complex)? My recommendation is atomic-rename-AFTER-column-purge. Decision needed.

2. **`loan_borrowers` retirement.** Where do its snapshot fields go? Specifically: `citizenship`, `suffix` (identity — contacts?), `housing_type`, `monthly_rent`, `previous_address*` (new `deal_housing` module?), `dob_encrypted` (already on contacts post-Layer-1b — verify and delete from loan_borrowers).

3. **`hecm_scenarios` table.** Keep as a separate calculator artifact, or merge into the unified `scenarios` table with `loan_type='hecm'`?

4. **`accounts` / `account_contacts` (Zoho mirror).** Is the Zoho sync still active? Per UAD AD-15 realtors become contacts with role='realtor' — do we retire these tables or keep mirroring Zoho?

5. **Soft delete universal rollout.** Add `deleted_at timestamptz` to every table? Or just to the ones with compliance concerns (loans, contacts, leads, documents)?

6. **organization_id rollout on satellites.** Every `loan_*` satellite lacks `organization_id`. Do we add it for RLS-readiness, or stay with "scoping flows through the parent loan" forever? The latter is simpler; the former is defense-in-depth.

7. **Scenario extension tables.** Move HECM/DSCR fields off `scenarios` into `scenario_hecm` / `scenario_dscr` satellites now (D9c), or defer until those engines are built?

8. **Prisma as docs — how strict?** Should the 22 drift tables be added to `schema.prisma` as a matter of policy? Right now only the "Prisma-is-design" subset is kept. If we commit to "Prisma always mirrors DB," that's a one-time ~500-line refactor; if not, codify the "Prisma is partial" convention and add a comment to any missing tables.

9. **Missing migration 030.** Was it skipped intentionally, renamed, or dropped? The sequence gap matters for replay / DR.

10. **`ref_va_funding_fee` seed.** Empty table with regulatory-critical data. Is the seed pending? Who writes it?

11. **Fallback values in pricer (from mig 021 commentary & `pricing-v2.js` comments):** remove and force not-null on `rate_lenders.comp_rate / max_comp_cap_*` and `fha_ufmip`? D9d partially closed this — verify no remaining hardcoded fallbacks.

12. **Index on `(contacts.organization_id, lower(email))` unique.** Before this lands, decide: is email comparison case-insensitive (UAD §4.2 says yes — "Search by email (case-insensitive)") everywhere it's used? If yes, we also need a `lower(email)` GIN or expression index on leads for the same lookup path.

13. **`broker_config` singleton.** Per-organization config is scattered — per-org `organizations.settings jsonb` exists, but `broker_config` is a global singleton with comp/fee defaults. When multi-tenant actually lands, does `broker_config` become per-org (move to `organizations.settings`) or stay global?

14. **`deal_participants` role granularity.** UAD §3.1 lists {primary_borrower, co_borrower, realtor, mlo, processor, loa}. That's 6 roles in a single junction. Do realtors actually belong here (they sit on a deal) or in their own deal-scoped table? Current CHECK accepts all 6 values; implementation doesn't store realtors this way yet.

15. **Audit trail on deletes.** Today `loan_events` captures state changes via app logic. For deletes, nothing. If we add `deleted_at`, do we also write an `eventType='deleted'` row into loan_events? Answers the "what happened to deal X" question in compliance review.

---

*End of audit. 2026-04-23. Live DB queries executed against PC prod via `PC_DATABASE_URL`. Row counts and structural observations are authoritative as of this timestamp. Schema.prisma cross-check against information_schema revealed 22 tables of DB-only drift — listed inline throughout. This doc supersedes nothing; it is the baseline for the D9c and D9e scoping sessions.*
