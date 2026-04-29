# Unified Architecture Directive (UAD)

**Status:** Draft v1.1 — architecture decisions captured + 3 amendments 2026-04-24
**Author:** PC Dev + David Burson
**Date:** 2026-04-16 (initial) · 2026-04-24 (amendments to AD-10/11/12 — see §2 inline + §13 log)
**Audit dimension:** D9 (Site Audit 2026)
**Build target:** Layer 1 first (lead intake + pipeline), then stack

> The UAD defines the data architecture that all front-of-house systems build on:
> website, borrower portal, MLO portal, quote composer, pricing engine, and CRM.
> It replaces the current fragmented model (separate borrowers, mlos, contacts, leads tables)
> with a unified identity + deal + scenario architecture designed for shop-ready scale.

---

## Table of contents

1. [Problem statement](#1-problem-statement)
2. [Architecture decisions](#2-architecture-decisions)
3. [Data model](#3-data-model)
4. [Identity lifecycle](#4-identity-lifecycle)
5. [Pricing architecture](#5-pricing-architecture)
6. [Scenario and quote model](#6-scenario-and-quote-model)
7. [Application modules](#7-application-modules)
8. [Marketing lifecycle](#8-marketing-lifecycle)
9. [Portal access model](#9-portal-access-model)
10. [Build layers](#10-build-layers)
11. [Open items](#11-open-items)
12. [Audit integration](#12-audit-integration)
13. [Decisions log](#13-decisions-log)

---

## 1. Problem statement

The current schema has four disconnected identity systems that can all describe the same person with no guarantee they are linked:

| System | Table | Key problem |
|--------|-------|-------------|
| Lead capture | `leads` | No email uniqueness. Can create duplicate leads for same person. |
| CRM contact | `contacts` | Separate from borrowers. Linked via nullable `borrower_id`. |
| Borrower auth | `borrowers` | Carries auth + PII. Only created at portal signup or application. |
| Quote snapshot | `scenarios` | Stores `borrower_name/email/phone` as **denormalized strings**, not FKs. |

A single person (John Smith, john@example.com) can have:
- 3 Lead records (rate alert, contact form, ICanBuy)
- 2 Scenario records (MLO quote, rate tool save) with no link between them
- 1 Contact record (if MLO manually created)
- 1 Borrower record (if John signed up for portal)
- No system-level awareness that these are the same person

The pricing engine is similarly fragmented: `homepage-db.js` runs a parallel pricing path that diverges from `/api/pricing` for the same scenario inputs. Calculators are built independently — some pull from the DB, some are fully hardcoded client-side math, some are hybrid. Reference data (county loan limits, closing costs, FHA UFMIP, PLF tables) is baked into the deploy as static JSON/JS files.

The UAD addresses all of this with a unified data architecture.

---

## 2. Architecture decisions

These were decided in the 2026-04-16 architecture session (David + PC Dev).

### AD-1: Lead is the entry point
Every email capture creates a Lead. The Lead table is the funnel — it captures how someone entered (source, UTM data, original scenario). Leads are cheap, disposable, and have no compliance obligations.

### AD-2: Convert is the MLO's qualification decision
Conversion creates a Contact (find-or-create by email, last name fallback) + Deal. The Lead record archives with attribution data. Scenarios and docs follow from Lead to Contact. This is the gate where someone enters the regulated pipeline.

### AD-3: Contact is the unified person
Absorbs today's `borrowers` and `contacts` tables. Carries identity (name, DOB, SSN, email, phone), marketing stage, communication preferences, and optional portal auth credentials. The UI displays contacts by role — the "Borrowers" module shows borrower-role contacts, the "Realtors" module shows realtor-role contacts.

**Contact does NOT carry loan-level data.** It is a light identity record. Employment, income, assets, declarations — all of that lives on the Deal as application snapshots.

### AD-4: Staff is separate from contacts
MLOs, processors, LOAs, and admins live in a `staff` table. They have fundamentally different fields (NMLS, commission rate, license states, admin permissions) and query patterns. Linked to deals via `deal_participants` junction with role.

### AD-5: Deal is the application
The Deal (loan) carries all loan-specific data plus situational snapshots (employment, income, assets at time of application). It references the Contact for identity fields (name, DOB, SSN) — never duplicates them. This is "Application LITE" — the subset of 1003/URLA fields we capture without replacing the LOS.

### AD-6: Clone deal pulls from a previous deal
When creating a new deal for an existing contact, the MLO can pre-fill from a previous deal's modules (borrower info, co-borrower, employment/income, assets). Contact identity fields pull from the Contact record. The system highlights conflicts between the previous deal snapshot and current data. MLO resolves each conflict.

### AD-7: Strike rate lives on the Deal
Each funded deal has its own `current_rate` and strike rate status. Per-property, per-loan. The Contact is the notification target, but the rate-to-beat is deal-level. A contact with 5 funded loans gets 5 independent strike rate monitors.

### AD-8: Marketing stage lives on the Contact
Four stages: lead, in_process, closed, past_client. Trigger campaigns query deal attributes to build audience. One birthday email per contact, but multiple strike rate alerts if multiple deals trigger.

### AD-9: One pricing entry point
All surfaces (front site, MLO portal, quote composer, homepage) use the same pricing API entry point. A product router dispatches to the correct engine based on loan type. Separate engines may use different DB tables, but the API contract is unified.

### AD-10: Scenarios link to Contact + Deal (both optional)
A scenario can exist with neither (anonymous rate tool use), with just a Contact (lead's saved scenario), or with both (MLO quote for a deal). Scenarios never store borrower identity as denormalized strings — they reference the Contact by ID.

**Amendment 2026-04-24 (AD-10a): Split `scenarios` into three tables.** The original AD-10 treats `scenarios` as a single table carrying four conceptually different things: anonymous pricing snapshots, rate alert subscriptions, MLO-built quotes, and deal pricing references. Each has a different lifecycle, required fields, and access patterns. The overloaded-table pattern forces nullable FKs, owner_type flags, and query-time filtering that will compound as D9c features land. Before building D9c Layer 2/3, split the concept:

- **`scenarios`** — immutable pricing snapshots. A frozen rate ladder for a given input set at a moment in time. Can be anonymous. Never mutated post-insert; re-pricing produces a new row.
- **`rate_alerts`** — borrower-initiated subscriptions. Has email/contact, cadence, days, status. References a scenario (the scenario the borrower wants updates on). Mutable (pause, resume, edit cadence).
- **`quotes`** — MLO deliverables. Attached modules, version, engagement tracking, status. References a scenario. Snapshot-on-send semantics (see AD-12a).

Each references `scenario_id`. Scenarios are the immutable pricing moments; `rate_alerts` and `quotes` *reference* scenarios without *being* them. This split is PR-1 of D9c — doing it first makes all subsequent D9c work cleaner; doing it later is a multi-PR refactor touching every reader/writer.

### AD-11: Calculator modules are composable
MLO can attach selected calculator reports (Cost of Waiting, Rent vs Buy, amortization, etc.) to a quote. Front site renders calculators standalone. Same functions, two rendering contexts. The quote becomes a multi-page deliverable with rates + selected analysis modules.

**Amendment 2026-04-24 (AD-11a): Concrete module contract with versioning and render variants.** The original AD-11 describes modules as pure functions with two rendering contexts but leaves the operational contract under-specified. Without a concrete contract, each module will be built differently and composability will break. Adopt the following registry pattern before extracting the first module:

```js
// src/lib/calc-modules/cost-of-waiting/index.js
export const module = {
  id: 'cost-of-waiting',
  version: 1,                       // integer, bumped on logic changes
  label: 'Cost of Waiting',
  inputSchema: zodSchema,           // declares required scenario fields + MLO-tunable config
  compute: pureFn,                  // (inputs) → result object — no side effects
  renderStandalone: Component,      // full page layout for /tools/* routes
  renderEmbedded: Component,        // compact layout for embedded in quote
  renderPDF: Component,             // print-friendly for PDF generation
};
```

All modules register in a central registry at `src/lib/calc-modules/registry.js`. Standalone pages at `/tools/<id>` import `renderStandalone`. Quote composer reads the registry, lets MLO pick from available modules, and attaches each as `{moduleId, version, config}` on the quote record. On quote render, the composer looks up the registered module by id + version and invokes the appropriate render variant. Version pinning means saved/sent quotes re-render with the exact logic they were built with, not current logic — no surprise changes to a borrower's saved quote. New logic ships as `version: 2` and older quotes keep rendering their pinned version (or explicitly migrate).

> **Full design spec:** [`Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md`](AD-11A-CALCULATOR-MODULE-REGISTRY.md) (drafted 2026-04-29). Resolves the three load-bearing questions the amendment leaves open — compute purity (services-injection model), render variants (three components per version), and version lifetime (forever, per AD-12a). Also locks the `quotes.attached_modules` JSONB shape: `{moduleId, version, config, result, snapshotMeta}` — the `result` is frozen at send time, never re-computed on render.

### AD-12: Shareable quote links (Layer 3 Lite)
MLO-generated quotes produce an interactive link (not just PDF). Borrower opens the link, sees live quote with attached calc modules. Email capture on engagement creates or links a Lead. This IS the lead capture mechanism for MLO-sourced prospects.

**Amendment 2026-04-24 (AD-12a): Snapshot-on-send immutability.** The original AD-12 says "borrower opens the link, sees live quote" — but scenarios are mutable (re-priced by MLO, rate sheets refresh nightly). Live-rendering a sent quote is a trust bug: a borrower who opens a quote link tomorrow sees different rates than yesterday, with no explanation. Quote systems we benchmarked (Lender Price, Banking Bridge, Optimal Blue) all treat sent quotes as immutable. Adopt the same semantics:

- **On send:** MLO clicks "Send to Borrower" → quote composer freezes the current scenario + attached modules (including their pinned versions from AD-11a) + rate snapshot + fees + MLO branding into a `quotes` row. The row is immutable post-insert.
- **On borrower open:** `/portal/quote/[id]` renders exactly what was sent, using the frozen snapshot. Timestamp displayed prominently ("Quote as of 2026-04-24 14:32 MT"). The underlying scenario may have moved on; the quote has not.
- **Fresh rates CTA:** Each rendered quote includes a "Get fresh rates for this scenario" link that re-prices against current rate sheets and surfaces a new quote (new `quotes` row) if the borrower wants the update. The old quote stays accessible for reference.
- **Versioning:** If MLO re-sends the same scenario with updates, create a new `quotes` row with a `parent_quote_id` pointer. Borrower dashboard shows the quote chain.
- **Engagement tracking:** views, module clicks, fresh-rate requests, and application-start events tie to the specific `quotes.id` the borrower interacted with — attribution stays accurate.

Immutability applies to the *quote* surface. The *scenario* the quote was built from may continue to evolve (re-priced daily by the Rate Alert cron if subscribed, re-used for a new quote if MLO decides). Quote and scenario have different immutability contracts: scenario is append-mostly (new row per re-price), quote is truly immutable.

### AD-13: Borrowers can save scenarios from the front site
If a visitor wants to save a scenario from any calculator, email capture triggers, magic link auth, Lead created. They get a lightweight "My Scenarios" portal where saved scenarios persist. Rate alerts are one type of saved scenario, not a separate system.

### AD-14: Service providers have accounts and contacts
Title companies, appraisal management companies, insurance agencies, and attorneys are stored in a directory. The account is the company; the contact is the individual (closer, appraiser, agent). Assigned to deals for "Order Outs" — the foundation for CoreBot processing automation.

### AD-15: Realtors are contacts with a role
Realtors share enough DNA with borrower-contacts (name, email, phone, marketing lifecycle) to live in the same `contacts` table, distinguished by role. They get a limited deal view (status, milestones, property — not financials or PII) and their own campaign lifecycle (partnership nurture, rate transparency updates, co-branded referral).

### AD-16: 3rd party contacts are NOT contacts
Service providers on a deal (title, appraiser, insurance) are operational, not relational. They don't get portal access or marketing campaigns. They live in the service provider directory, not the contacts table.

---

## 3. Data model

### 3.1 Core tables

#### `contacts` (everyone you have ongoing relationships with)

Replaces today's `borrowers` + `contacts` tables.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| role | enum | borrower, co_borrower, realtor |
| first_name | text | |
| last_name | text | |
| email | text | UNIQUE per organization |
| phone | text | |
| dob_encrypted | text | AES-256-GCM. Contact-level, not deal-level. |
| ssn_encrypted | text | AES-256-GCM. Contact-level, not deal-level. |
| ssn_last_four | text | For display/lookup |
| current_address | jsonb | Mailing address (not subject property) |
| communication_prefs | jsonb | Email vs SMS, language, frequency caps |
| marketing_stage | enum | lead, in_process, closed, past_client |
| portal_auth | jsonb | Nullable. password_hash, magic_token, sms_code, etc. Added when portal access granted. |
| assigned_mlo_id | UUID | FK to staff (nullable) |
| tags | text[] | For campaign segmentation |
| source | text | Original lead source (preserved from conversion) |
| converted_from_lead_id | UUID | FK to leads (nullable, set on conversion) |
| zoho_contact_id | text | Legacy CRM link |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `staff` (your team)

Replaces today's `mlos` table. Separate from contacts.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| role | enum | broker_owner, mlo, processor, loa, admin |
| first_name | text | |
| last_name | text | |
| email | text | UNIQUE |
| phone | text | |
| nmls | text | |
| license_states | text[] | |
| commission_rate | decimal | |
| ldox_officer_id | text | LoanDox integration |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `leads` (funnel entry point)

Retains current structure with cleanup.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| name | text | As entered (may not match contact name later) |
| email | text | Key dedup field. NOT unique — same person can have multiple leads from different sources. |
| phone | text | |
| source | text | rate-tool, contact-form, icanbuy, referral, manual |
| source_detail | text | |
| utm_source | text | |
| utm_medium | text | |
| utm_campaign | text | |
| status | enum | new, contacted, qualified, prospect, converted |
| assigned_mlo_id | UUID | FK to staff (nullable) |
| contact_id | UUID | FK to contacts. Set on conversion. |
| scenario_data | jsonb | Snapshot of original scenario (if from rate tool) |
| loan_purpose | text | Quick filters without parsing scenario_data |
| property_state | text | |
| credit_score | int | |
| view_token | text | Auto-generated for access links |
| converted_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `deals` (loans / applications)

Replaces today's `loans` table. The application lives here.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| status | enum | draft, submitted, processing, approved, closing, funded, withdrawn, denied |
| loan_purpose | enum | purchase, refinance, cashout |
| loan_type | enum | conventional, fha, va, usda, dscr, hecm, bank_statement |
| loan_amount | decimal | |
| property_value | decimal | |
| ltv | decimal | Computed |
| term | int | |
| interest_rate | decimal | Set when locked |
| lender_name | text | |
| loan_number | text | |
| — | — | **Application modules below (see section 7)** |
| strike_rate_status | enum | active, watching, triggered, converted, inactive. Null until funded. |
| current_rate | decimal | Rate to beat for strike rate. Set at funding, updated on refi. |
| closing_date | date | |
| funding_date | date | |
| application_date | date | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `deal_participants` (junction — people on a deal)

Replaces today's `loan_borrowers` table. Links both contacts and staff.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| deal_id | UUID | FK to deals |
| contact_id | UUID | FK to contacts (nullable — one of contact_id or staff_id is set) |
| staff_id | UUID | FK to staff (nullable) |
| role | enum | primary_borrower, co_borrower, realtor, mlo, processor, loa |
| has_portal_access | boolean | Default false. Contacts only. |
| private_docs | boolean | Default false. If true, uploaded docs visible only to this participant + staff. |
| notification_prefs | jsonb | Which updates they receive |
| created_at | timestamptz | |

**Constraint:** UNIQUE on (deal_id, contact_id) and (deal_id, staff_id) — a person appears once per deal.

### 3.2 Service provider tables

#### `service_provider_accounts` (the company)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| name | text | Company name (e.g. "Chicago Title") |
| type | enum | title, appraisal_mgmt, insurance, attorney, surveyor, other |
| phone | text | Main office |
| fax | text | Yes, title companies still fax |
| email | text | General inbox |
| address | jsonb | |
| website | text | |
| coverage_areas | text[] | States or counties served |
| notes | text | Preferences, turnaround times, special instructions |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `service_provider_contacts` (person at the company)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| account_id | UUID | FK to service_provider_accounts |
| name | text | |
| email | text | |
| phone | text | |
| title | text | Closer, escrow officer, appraiser, etc. |
| is_primary | boolean | Default contact for this account |
| notes | text | |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `deal_service_providers` (assignment to a deal)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| deal_id | UUID | FK to deals |
| account_id | UUID | FK to service_provider_accounts |
| contact_id | UUID | FK to service_provider_contacts (nullable — the specific person handling this deal) |
| role | enum | title, appraiser, hazard_insurance, flood_insurance, attorney, other |
| status | enum | pending, ordered, received, cleared |
| ordered_at | timestamptz | |
| received_at | timestamptz | |
| notes | text | |
| created_at | timestamptz | |

### 3.3 Scenario and quote tables

#### `scenarios` (quotes / pricing snapshots — composable)

Retains current structure from D6 work. Key changes: `borrower_name/email/phone` string fields replaced by `contact_id` FK. Extension tables for product-specific inputs.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| contact_id | UUID | FK to contacts (nullable — null for anonymous rate tool use) |
| deal_id | UUID | FK to deals (nullable — null for saved scenarios without a deal) |
| mlo_id | UUID | FK to staff (nullable) |
| lead_id | UUID | FK to leads (nullable — set when scenario created from lead capture) |
| owner_type | enum | mlo, borrower, system |
| source | enum | rate-tool, mlo-quote, application, rate-alert, system |
| visibility | enum | public, internal |
| status | enum | draft, priced, sent, viewed, accepted, declined, expired |
| — | — | **Core scenario inputs** |
| loan_purpose | enum | purchase, refinance, cashout |
| loan_type | enum | conventional, fha, va, usda, dscr, hecm, bank_statement |
| loan_amount | decimal | |
| property_value | decimal | |
| ltv | decimal | |
| fico | int | |
| state | text | |
| county | text | |
| property_type | enum | sfr, condo, pud, 2unit, 3unit, 4unit, townhouse |
| occupancy | enum | primary, second_home, investment |
| term | int | |
| product_type | enum | fixed, arm |
| lock_days | int | |
| — | — | **Refi-specific** |
| current_rate | decimal | |
| current_balance | decimal | |
| current_payment | decimal | |
| current_lender | text | |
| — | — | **Computed results** |
| monthly_payment | decimal | |
| monthly_savings | decimal | |
| cash_to_close | decimal | |
| — | — | **Alert fields** |
| alert_frequency | text | |
| alert_status | enum | active, paused, triggered, unsubscribed |
| last_priced_at | timestamptz | |
| last_sent_at | timestamptz | |
| send_count | int | |
| unsub_token | text | |
| — | — | **Quote lifecycle** |
| attached_modules | text[] | Calculator modules selected by MLO: cost_of_waiting, rent_vs_buy, amortization, etc. |
| share_token | text | For Layer 3 Lite shareable links |
| sent_at | timestamptz | |
| viewed_at | timestamptz | |
| expires_at | timestamptz | |
| pdf_url | text | |
| version | int | |
| parent_scenario_id | UUID | FK to scenarios (nullable — for versioning) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Extension tables** (existing from D6, unchanged):
- `scenario_rates` — per-lender pricing results for this scenario
- `scenario_fee_items` — closing cost line items (TRID sections A-I)
- `scenario_hecm` — HECM-specific fields (PLF, max claimable, draw amounts)
- `scenario_dscr` — DSCR-specific fields (monthly_rent, unit_count, tier, dscr_ratio per rate)

---

## 4. Identity lifecycle

### 4.1 Lead lifecycle

```
Email capture (any source)
  │
  ▼
Lead created (status: new)
  │
  ├─ Rate tool save → Lead + Scenario created, linked via lead_id
  ├─ Contact form → Lead created, no scenario
  ├─ ICanBuy referral → Lead created with scenario_data snapshot
  ├─ MLO manual entry → Lead created
  │
  ▼
MLO works the lead
  │
  ├─ status: contacted → qualified → prospect (nurturing, no deal yet)
  │
  ▼
MLO converts the lead
  │
  ├─ Email lookup: find existing Contact or create new
  │   ├─ Primary match: email
  │   └─ Fallback match: last name (if email changed)
  ├─ Deal created (borrower info pre-filled from lead's scenario data)
  ├─ Scenarios + docs transfer from Lead to Contact
  ├─ Lead.status → converted, Lead.contact_id set
  └─ Lead archived (attribution data preserved)
```

### 4.2 Conversion dedup rules

1. Search `contacts` by email (case-insensitive) within the organization
2. If match found → link to existing Contact
3. If no match → search by last name within organization (fallback for email changes)
4. If still no match → create new Contact
5. Deal created and linked to Contact via `deal_participants` (role: primary_borrower)
6. All scenarios with matching `lead_id` get `contact_id` set

### 4.3 Override hierarchy

Two sources of info to start: borrower-provided and MLO-provided.

- **MLO has final say over borrower.** If MLO updates a field, it overrides borrower-provided value.
- **When system analyzes docs** (future): system surfaces differences or missing info, MLO chooses whether to update/override.
- **Conflict display:** When cloning a deal or merging lead data, the system shows both values side-by-side and lets the MLO resolve.

No automated overrides. MLO always confirms.

---

## 5. Pricing architecture

### 5.1 Current state

11 calculator/pricing surfaces, 3 tiers of data sourcing:

**DB-driven (already good):** Rate Tool, DSCR Calculator, DSCR Rate Page, Refinance Calculator, MLO Quote Generator — all call `/api/pricing` or `/api/pricing/dscr`.

**Fully hardcoded (no DB):** Purchase Calculator, Refinance Analyzer, Cost of Waiting, HECM Optimizer — all client-side math with hardcoded constants.

**Hybrid:** Homepage Rate Card (parallel pricing path via `homepage-db.js` that diverges from `/api/pricing`), DSCR Calculator (broker comp applied client-side), Second Lien Comparison.

### 5.2 Target state

**One API entry point** with a product router:

```
POST /api/pricing
  ├─ loan_type: conventional/fha/va/usda → pricing-v2 engine → rate_products/rate_prices tables
  ├─ loan_type: dscr/bank_statement → price-dscr engine → nonqm_* tables
  ├─ loan_type: hecm → hecm engine → ref_hecm_plf table (move from hardcoded)
  └─ [future: jumbo-specific, if pricing differs enough from conventional]
```

**All surfaces** that display priced rates use this entry point:
- Homepage rate card → calls `/api/pricing` for 4 default scenarios (retires `homepage-db.js` parallel path)
- Rate Tool → already uses `/api/pricing`
- DSCR Calculator → already uses `/api/pricing/dscr` (route under unified entry point)
- MLO Quote Generator → already uses `/api/pricing`
- Refinance Calculator → already uses `/api/pricing`
- Rate alerts / strike rates → call `/api/pricing` on schedule

**Stateless calculators** (Purchase Calc, Cost of Waiting, Refi Analyzer) remain client-side math. They don't need the pricing engine — they take user-entered rates as input. But their math functions become composable modules (see section 6) so they can be attached to quotes.

### 5.3 Reference data migration

Static data currently baked into the deploy moves to DB tables:

| Current location | Target | Priority |
|---|---|---|
| `src/data/county-loan-limits.js` (3,235 counties) | `ref_county_loan_limits` table | High — stales annually |
| `FHA_BASELINE_LIMIT = Math.round(832750 * 0.65)` | Derivable from `ref_county_loan_limits` at query time | High |
| `src/lib/rates/closing-costs.js` (STATE_DEFAULTS) | `ref_closing_cost_defaults` table | Medium — changes infrequently |
| `pricing-v2.js` comp rate/cap fallbacks (0.02, $3,595) | Validate `rate_lenders` has no nulls, then remove fallbacks | Medium |
| `pricing-v2.js` FHA UFMIP fallback (0.0175) | `ref_fha_ufmip` table (or validate `rate_lenders.fha_ufmip`) | High — regulatory, changes rarely but critically |
| HECM PLF lookup table (hardcoded in ScenarioContext) | `ref_hecm_plf` table | Low — build when HECM engine is prioritized |
| `src/data/loan-limits-2025.json` | Delete after `ref_county_loan_limits` exists | Low — cleanup |

D8 inventory passes will identify additional candidates. This list is seeded from D8 Pass 1 findings.

---

## 6. Scenario and quote model

### 6.1 Three layers

```
Layer 1: Pricing Engines (sources of truth for rates)
  ├─ pricing-v2 (conventional, FHA, VA, USDA)
  ├─ price-dscr (Non-QM DSCR — Everstream)
  ├─ price-hecm (reverse mortgage — HUD PLF tables)
  └─ [future engines as needed]

Layer 2: Calculator Modules (composable analysis tools)
  ├─ cost_of_waiting (inputs: current rate, new rate, loan amount)
  ├─ rent_vs_buy (inputs: home price, rent, appreciation, tax rate)
  ├─ refi_break_even (inputs: current vs new terms, closing costs)
  ├─ amortization_schedule (inputs: rate, amount, term)
  ├─ purchase_affordability (inputs: income, debts, rate, down payment)
  └─ [future modules as needed]

Layer 3: Quote Composer (assembles the deliverable)
  ├─ Pulls rates from Layer 1 (via product router)
  ├─ Attaches selected Layer 2 modules (MLO chooses)
  ├─ Links to Contact (identity) + Deal (loan)
  └─ Outputs: interactive link (Layer 3 Lite) + PDF + email
```

### 6.2 Front site vs back of house

**Front site (public, anonymous or lead-level):**
- Layer 1 exposed via Rate Tool, DSCR calc, homepage — stateless by default
- Layer 2 exposed via standalone calculator pages — stateless by default
- Save scenario → email capture → Lead created → scenarios persist in "My Scenarios" portal
- Layer 3 Lite: borrower receives MLO's quote link → views interactive quote → engagement triggers lead capture

**Back of house (MLO portal):**
- Layer 3 full: MLO builds quote, selects calc modules to attach, generates deliverable
- Quote linked to Contact + Deal
- Shareable link generated → borrower views interactive version
- PDF generated for email/print

### 6.3 Calculator module contract

Each module is a pure function:

```javascript
function costOfWaiting({ currentRate, newRate, loanAmount, term }) {
  // returns: { monthlySavings, annualSavings, waitingCostTable, opportunityCost }
}
```

- Takes inputs, returns a result object
- No side effects, no DB calls, no API calls
- The same function renders standalone on the front site and embedded in a quote
- The quote composer passes scenario inputs to the function and includes the output in the deliverable

---

## 7. Application modules

The deal's application data is organized into clean segments. These segments serve triple duty:

1. **UI layout** — each segment is a section/page in the application form
2. **Clone deal** — MLO selects which segments to pull from a previous deal
3. **Data model** — clean separation of concerns, clear field ownership

### 7.1 Module definitions

#### Module: Borrower identity
**Source:** Contact record (pulled in, not duplicated on deal)
- Legal name, DOB, SSN, email, phone, current address
- This module is NOT editable on the deal — edit the Contact record directly

#### Module: Employment and income
**Source:** Deal snapshot (copied from previous deal or entered fresh)
- Current employer, title, start date, years in field
- Monthly base income, overtime, bonus, commission
- Self-employment: business name, years, monthly net income
- Co-borrower employment (separate sub-module if applicable)

#### Module: Assets
**Source:** Deal snapshot
- Bank accounts (institution, type, balance)
- Retirement accounts
- Other assets (gift funds, proceeds from sale)
- Down payment source breakdown

#### Module: Property
**Source:** Deal-specific (never cloned unless refi of same property)
- Subject property address, type, occupancy, units
- Property value (estimated or appraised)
- HOA, property tax, insurance estimates

#### Module: Loan details
**Source:** Deal-specific
- Purpose, type, amount, term, product type
- Lock status, rate (when locked), lender
- LTV, CLTV

#### Module: Co-borrower
**Source:** Linked Contact + deal snapshot
- Co-borrower identity (Contact record — same as Module 1)
- Co-borrower employment/income (deal snapshot)
- Co-borrower assets (deal snapshot)
- Relationship to primary borrower, community property state

#### Module: Declarations
**Source:** Deal-specific (always fresh per application)
- URLA Section 8 declarations
- Never cloned — must be answered fresh for each deal

### 7.2 Clone deal workflow

1. MLO creates new deal for existing Contact
2. System shows: "Pre-fill from a previous deal?" with list of Contact's closed deals
3. MLO selects which deal and which modules to pull:
   - Borrower identity → always from Contact (current)
   - Employment/income → checkbox (may have changed)
   - Assets → checkbox (accounts change)
   - Co-borrower → checkbox (same co-borrower?)
   - Property → NO by default (different property, unless same-property refi)
   - Loan details → NO (different loan)
   - Declarations → NEVER (regulatory requirement: fresh answers)
4. System highlights conflicts between previous deal snapshot and any known current data
5. MLO resolves each conflict, confirms
6. New deal created with clean data

---

## 8. Marketing lifecycle

### 8.1 Contact marketing stages

| Stage | Entry trigger | Exit trigger | Campaign type |
|-------|--------------|-------------|---------------|
| **lead** | Email capture (any source) | Deal created + submitted | Lead nurture drips, education, rate updates |
| **in_process** | Deal submitted / active | Deal funded or withdrawn | No marketing. Loan updates, doc reminders, milestone notifications only. |
| **closed** | Deal funded | Closed campaign concludes (~3 months) | Post-close campaign: 3-6 emails (survey, referral ask, review request, helpful homeowner tips) |
| **past_client** | Closed campaign complete | Never (permanent) | Newsletter + strike rates + trigger campaigns |

### 8.2 Trigger campaigns (past_client stage)

These fire based on external events matched against deal attributes:

| Trigger event | Audience query | Data source |
|---|---|---|
| Rate drop hits strike rate | Funded deals where `deal.current_rate` > market rate by X bps | Pricing engine + deal.current_rate |
| Loan limits increase | Deals near previous limit, or prospects priced out last year | Annual FHFA announcement + deal.loan_amount |
| Home value appreciation | Deals where estimated equity enables new products (PMI removal, HELOC, cashout) | Home value API + deal.property_value |
| Condo rule change | Deals with `property_type = 'condo'` in affected areas | Manual trigger or compliance alert |
| Rate/term opportunity | Deals where shorter term at same payment is now available | Pricing engine + deal.current_rate + deal.monthly_payment |

**Cadence:** one email per Contact even if multiple deals trigger. Bundle opportunities in a single communication. MLO screens all trigger emails before send (initial policy — automate later as confidence grows).

### 8.3 Realtor campaigns

Realtors have their own campaign lifecycle:

| Stage | Campaign type |
|-------|---------------|
| Active partnership | Rate transparency updates ("what your buyers can get this week") |
| Post-close | Co-branded partnership email, referral ask |
| Ongoing | Newsletter (realtor edition), market updates, new product announcements |

### 8.4 Automated emails (Layer 1)

For initial build, only two automated emails:
1. **Lead capture confirmation** — email + SMS, automatic, no MLO screening
2. **All other emails** — MLO screens before send until automation rules are established

---

## 9. Portal access model

### 9.1 Borrower portal

- Portal access tied to Contact record (portal_auth field)
- Contact must have `has_portal_access = true` on at least one `deal_participants` record
- Login via magic link (email) or SMS code — no passwords by default

### 9.2 Deal-level access

Each deal participant sees:
- **Primary borrower:** Full deal view — status, timeline, doc upload, tasks, messaging, all modules
- **Co-borrower (shared):** Same as primary borrower (married, joint application)
- **Co-borrower (private docs):** Full deal view, but their uploaded docs visible only to them + staff, not to primary borrower
- **Realtor:** Limited view — status, key milestones, property details, closing date. No financials, income, credit, or other participant PII.

### 9.3 One primary, CC others

- One Contact is the primary communication target per deal
- Co-borrowers, realtors can be CC'd on selected updates via `notification_prefs` on `deal_participants`
- Avoids the Arive problem of complex per-person email routing

---

## 10. Build layers

### Layer 0 — Current state (what exists today)
- Leads table captures from contact form + rate tool
- Scenarios table (D6 work) captures pricing snapshots
- Rate engine works (pricing-v2 + price-dscr)
- MLO portal has quote generator, pipeline view
- Borrower portal has application flow, doc upload

### Layer 1 — Lead intake + pipeline (FIRST BUILD)
**Goal:** intake leads, give MLO a pipeline view, enable conversion flow. This is what the Claw campaign relays need (backlog #78 CoreCRM lead intake).

- Clean up Lead table: email dedup, status lifecycle
- `contacts` table (new): unified person, replaces borrowers + contacts
- `staff` table (new): replaces mlos
- `deals` table (new): replaces loans, with application modules
- `deal_participants` junction
- Conversion flow: Lead → Contact + Deal (email lookup, pre-fill from lead's scenario data)
- MLO pipeline view: leads by status, deals by stage
- Lead capture auto-email (email + SMS)
- Scenarios updated: `contact_id` FK replaces denormalized borrower strings

### Layer 2 — Quote composer + Layer 3 Lite
**Goal:** MLO can build and send interactive quotes, borrowers can view and engage.

- Quote builder in MLO portal (rewire existing Quote Generator to Contact/Deal model)
- Attach calculator modules to quotes
- Shareable quote links (interactive, not just PDF)
- Email capture on quote engagement
- "My Scenarios" portal for leads who save from front site

### Layer 3 — Borrower portal + deal management
**Goal:** borrower-facing portal on new Contact/Deal model, co-borrower access, doc upload.

- Borrower portal auth on Contact record (magic link, SMS)
- Deal view with application modules
- Doc upload (private docs support for unmarried co-borrowers)
- Realtor limited view
- Clone deal feature
- Service provider directory + deal assignment

### Layer 4 — Strike rates + lifecycle marketing + CoreBot foundation
**Goal:** deal-based strike rates, trigger campaigns, Order Outs.

- Strike rate monitoring per funded deal
- Trigger campaigns querying deal attributes
- MLO screening queue for outbound emails
- Service provider Order Outs (CoreBot foundation)
- Campaign stage automation (lead → in_process → closed → past_client)

---

## 11. Open items

Decisions deferred to later — captured here so they don't get lost.

| Item | Context | Decide when |
|---|---|---|
| Strike rate screening workflow | MLO reviews before send. Exact UI/UX for screening queue. | Layer 4 build |
| Email cadence rules | Frequency caps, per-contact dedup across multiple deal triggers. | Layer 4 build |
| Seasoning period | When does "closed" become "past_client"? ~3 months proposed. | Layer 4 build |
| Clone deal UX | Exact module selection UI, conflict resolution display. | Layer 3 build |
| Application LITE field list | Which 1003/URLA fields we capture vs defer to LOS. | Layer 1 build — reference 1003-BUILD-SPEC.md |
| Portal access for co-borrowers | Exact permission model, notification routing. | Layer 3 build |
| HECM engine | Move PLF tables to DB, build proper HECM pricing engine. | When HECM volume warrants |
| Jumbo pricing | Separate engine or pricing-v2 with product filter? | When jumbo product set is defined |
| Home value data source | Zillow API, FHFA HPI, or manual? For equity-based trigger campaigns. | Layer 4 build |
| Vendor directory scope | Start with title companies only? Or all types at once? | Layer 3 build |
| Lead portal ("My Scenarios") | Exact UX for saved scenarios, multiple scenario management. | Layer 2 build |
| Rent vs Buy module | Inputs, outputs, data sources for this new calculator. | Layer 2 build |

---

## 12. Audit integration

### D9 definition

The UAD becomes **Dimension 9** of the Site Audit 2026. It covers the full data architecture redesign:

| Sub-dimension | Scope |
|---|---|
| D9a · Identity model | Lead → Contact → Deal lifecycle, contact roles, staff separation, service providers |
| D9b · Pricing unification | One entry point, product router, retire parallel paths, all surfaces use same engine |
| D9c · Scenario/quote model | Scenarios link to Contact + Deal, composable calc modules, Layer 3 Lite |
| D9d · Reference data migration | County limits, closing costs, PLF tables, comp caps → DB tables |
| D9e · Application modules | Clean segment model for deal data, clone deal, Application LITE |

### Relationship to other dimensions

| Dimension | Relationship to D9 |
|---|---|
| D5 (org scoping) | Complete for current schema. D9 tables get org_id from the start — built into the design. |
| D6 (unified pricing/scenarios) | Partially complete. D9b extends it (unified entry point). D9c extends it (composable quotes, contact linking). |
| D7 (MLO Portal UX) | Blocked on D9. Portal redesign should use new Contact/Deal model. D7 = "implement portal on D9 schema." |
| D8 (static data) | D8 inventory findings feed D9d (reference data migration). D8 passes can run in parallel with D9 spec work. |

### Reshaped audit queue

```
1. ✅ D1-D5 (done, with D0 re-audits pending for D1/D2/D4)
2. 🔄 D6 (in progress — PR 14 soak, Core Non-QM LLPA parser)
3. 🆕 D9 UAD spec (THIS DOCUMENT) — architecture decisions captured
4. 🔄 D8 inventory passes 2-8 (parallel with D9 — findings feed D9d)
5. ⏳ D0 re-audit retries for D1, D2, D4
6. ⏳ D9 Layer 1 build (lead intake + pipeline + conversion)
7. ⏳ D8 remediation (reference data migration, informed by D8 inventory + D9d design)
8. ⏳ D7 MLO Portal UX (redesigned on top of D9 schema)
9. ⏳ D9 Layers 2-4 (quote composer, borrower portal, strike rates)
10. ⏳ D6 wrap-up (PR 14 drop old tables, Core Non-QM LLPA parser)
```

---

## 13. Decisions log

| ID | Date | Decision | Decided by |
|----|------|----------|-----------|
| AD-1 | 2026-04-16 | Lead is the entry point for all email captures | david+pc-dev |
| AD-2 | 2026-04-16 | Convert = MLO decision, creates Contact + Deal | david+pc-dev |
| AD-3 | 2026-04-16 | Contact is the unified person (absorbs Borrower), displayed as "Borrowers" | david+pc-dev |
| AD-4 | 2026-04-16 | Staff separate from contacts | david+pc-dev |
| AD-5 | 2026-04-16 | Deal is the application, references Contact for identity, no duplication | david+pc-dev |
| AD-6 | 2026-04-16 | Clone deal pulls from previous deal modules, Contact provides identity | david+pc-dev |
| AD-7 | 2026-04-16 | Strike rate lives on the Deal (per-property, per-loan) | david+pc-dev |
| AD-8 | 2026-04-16 | Marketing stage on Contact: lead → in_process → closed → past_client | david+pc-dev |
| AD-9 | 2026-04-16 | One pricing entry point, routes by loan type to correct engine | david+pc-dev |
| AD-10 | 2026-04-16 | Scenarios link to Contact + Deal (both optional) | david+pc-dev |
| AD-11 | 2026-04-16 | Calculator modules are composable, attachable to quotes | david+pc-dev |
| AD-12 | 2026-04-16 | Shareable quote links (Layer 3 Lite) for borrower engagement | david+pc-dev |
| AD-13 | 2026-04-16 | Borrowers can save scenarios from front site (email capture → Lead) | david+pc-dev |
| AD-14 | 2026-04-16 | Service providers: accounts (company) + contacts (person), assigned to deals | david+pc-dev |
| AD-15 | 2026-04-16 | Realtors are contacts with a role, own campaign lifecycle | david+pc-dev |
| AD-16 | 2026-04-16 | 3rd party service providers are NOT contacts, no portal access or marketing | david+pc-dev |
| AD-10a | 2026-04-24 | Split `scenarios` into three tables (scenarios / rate_alerts / quotes) as PR-1 of D9c — amends AD-10 | david+pc-dev |
| AD-11a | 2026-04-24 | Concrete module contract: pure compute + render variants + version pinning + central registry — amends AD-11 | david+pc-dev |
| AD-12a | 2026-04-24 | Snapshot-on-send immutability for quote links (scenario may evolve; quote does not) — amends AD-12 | david+pc-dev |

---

*This spec captures the full UAD architecture as discussed 2026-04-16. It is the foundation for all front-of-house systems. Build order: Layer 1 (lead intake) first, then stack. Open items are captured in section 11 and will be resolved as each layer is built.*

*Amendment note (2026-04-24): after D7 polish closure and before D9c build, David asked for an architecture evaluation of the scenario/quote model (the "crux of lead intake"). Three load-bearing concerns surfaced: scenarios table overloaded, calculator module contract under-specified, quote links lack immutability. All three amend D9c scope; none revise D9a/D9b/D9d/D9e. See AD-10a/AD-11a/AD-12a inline amendments in §2.*
