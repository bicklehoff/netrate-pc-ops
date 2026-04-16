# D8 Pass 8 — Reference Data Inventory

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 8
**Date:** 2026-04-16
**Scope:** Regulatory, industry, and business reference data bundled in-code. Feeds D9d (reference data migration schema design).
**Precursor passes:** This pass catalogs reference-data surfaces that Pass 1 (Pricer Scenario inventory) flagged as "deferred to later passes." County loan limits (A1), FHA_BASELINE_LIMIT (A2), and FHA UFMIP (B3) are already cataloged in `PRICER-STATIC-DATA-INVENTORY-2026-04-15.md` — cross-referenced here by existing IDs, **not** re-cataloged.

---

## 1. Scope and definitions

**Reference data** = values that are externally-defined and change on a cadence independent of NetRate's business logic. They go stale the moment a regulator, industry body, or market publishes a new version. Characterized by:

- **External authority** — we don't set the values; FHFA, HUD, VA, USDA, state assessors, title industry do
- **Cadence-driven staleness** — they get wrong at a known date (annual reset, case-number date, quarterly rebase)
- **Pricing/compliance blast radius** — if we use stale values the loan is mispriced, the GFE is wrong, or a disclosure is incorrect

**NOT reference data (explicitly excluded from this pass):**

- **Enums / code-only taxonomies** — `LOAN_TYPES`, `CONDITION_STAGES`, `CONDITION_STATUSES`, `DOC_PREFIXES`, `DOC_SUBTYPES`, `ACTION_TAKEN`, `APPLICATION_METHODS`, `LIEN_STATUSES`. These are vocabulary the code uses to talk to itself. They change only when we refactor. They belong in TypeScript/Zod schemas, not in a database table. D9d should explicitly **not** migrate these.
- **Business policy constants** — `DEFAULT_SCENARIO` (780/75/purchase), `DEFAULT_ORG_ID`, `LO_CONFIG` (David's NMLS/contact). These are business-set anchors, not external reference data.
- **Lender-specific rate/adjustment data** — already DB-driven via `rate_lenders` / `rate_adjustments`. Out of scope.
- **Schema thresholds** — FICO band breakpoints, LTV band breakpoints in `pricing-v2.js`. These define the grid shape, not reference values.

---

## 2. Findings catalog

All items below are reference data with external authority. Pass 1 findings are referenced by existing ID (A1, A2, B3) rather than re-cataloged.

### 2.1 Regulatory — Loan limits (FHFA / HUD / VA)

| ID | File:Line | Content | Cadence | Staleness blast radius | Proposed table |
|---|---|---|---|---|---|
| **A1 (Pass 1)** | `src/data/county-loan-limits.js:1-3235` | All 3,235 US counties, baseline + 1–4 unit limits, 2026 | **Annual (Jan 1)** | Whole country mis-priced if not regenerated before Jan 1 each year | `ref_county_loan_limits` |
| **A2 (Pass 1)** | `src/lib/rates/defaults.js:12` | `FHA_BASELINE_LIMIT = Math.round(832750 × 0.65) = 541288` | **Annual** | All FHA classifications in pricer wrong until redeploy | Derive from `ref_county_loan_limits` — no separate table |
| **REF-1** | `src/lib/quotes/fee-builder.js:83` | `isHighBalance = baseLoanAmount > 726200` | **Annual** | FHA MIP rate misses +25bps high-balance adder; monthly MIP under-quoted on GFE for all high-balance FHA | Use `ref_county_loan_limits.baseline_1unit` at query time (726200 is the stale 2023 baseline — already 2 years out of date) |
| **REF-2** | `src/data/loan-limits-2025.json` | Stale 2025 loan limits JSON | **Orphaned — should be deleted** | Not pricer-facing (only used by `CountyLoanLimits.js` UI) but visible on the marketing site | Delete file; replace consumer with query to `ref_county_loan_limits` |
| **REF-3** | `src/lib/hecm/constants.js:4` | `DEFAULT_FHA_LIMIT = 1209750` (2025 HECM limit) | **Annual (Jan)** | HECM principal limit calculation caps at old ceiling; legitimate borrowers lose access to higher loan amounts | `ref_hecm_limits(year, max_claim_amount)` — single value per year, trivial to version |

### 2.2 Regulatory — Government insurance / funding fees (HUD / VA / USDA)

| ID | File:Line | Content | Cadence | Staleness blast radius | Proposed table |
|---|---|---|---|---|---|
| **B3 (Pass 1)** | `src/lib/rates/pricing-v2.js:369` | `ufmipRate = brokerConfig?.fhaUfmip \|\| 0.0175` | **Event-driven (HUD mortgagee letter)** | Pricer fallback fires if any active `rate_lenders` row has null `fha_ufmip`; stale UFMIP flows into `effectiveLoanAmount` and every downstream number | `ref_fha_ufmip(effective_from, effective_to, loan_purpose, rate)` |
| **REF-4** | `src/lib/quotes/fee-builder.js:82-89` | `getFhaMipRate()` — hardcoded FHA annual MIP schedule: `<=15yr/LTV≤90: 15bps`, `<=15yr/LTV>90: 40bps`, `>15yr/LTV≤95: 50bps`, `>15yr/LTV>95: 55bps`, `+25bps high balance` | **Event-driven (HUD, last change 3/20/2023)** | Every FHA quote PDF shows wrong monthly MIP; compounds after refinance when case-number date matters | `ref_fha_annual_mip(effective_from, effective_to, case_number_date_from, term_max, ltv_max, base_loan_amount_min, rate_bps)` |
| **REF-5** | `src/lib/quotes/fee-builder.js:91` | `FHA_UFMIP_RATE = 0.0175` — duplicate of B3, consumed in quote builder instead of pricer | **Event-driven** | Quote fee breakdown diverges from pricer if HUD updates one but lender `fha_ufmip` column updated separately | Consolidate with B3 — both paths read from `ref_fha_ufmip` |
| **REF-6** | `src/lib/hecm/constants.js:3` + `calculations.js:97,159` + `optimizer.js:49` | `UFMIP_RATE = 0.02` (HECM UFMIP, 2%). Hardcoded again at three call sites. | **Event-driven (HUD)** | HECM payoff math and principal-limit calc wrong; advisory output to seniors is materially incorrect | `ref_hecm_ufmip(effective_from, effective_to, rate)` |
| **REF-7** | `src/lib/hecm/constants.js:5` + `calculations.js:78,145,205` + `optimizer.js:45,87` | `DEFAULT_MIP_RATE = 0.50` (HECM annual MIP, 50 bps) | **Event-driven (HUD)** | Same as REF-6 — HECM advisory math wrong | `ref_hecm_annual_mip(effective_from, effective_to, rate)` |
| **REF-8** | `src/lib/quotes/eligibility.js:206` | VA funding fee disclosure text `"1.25%-3.3%"` — hardcoded prose, no numeric table anywhere | **Event-driven (VA)** | String is merely informational today, but no pricing path actually charges a VA funding fee — this is an unbuilt feature disguised as a disclosed one | `ref_va_funding_fee(effective_from, effective_to, purpose, down_payment_min, is_first_use, is_exempt, rate)` — proper grid, 12-ish rows |
| **REF-9** | HECM UFMIP hardcoded as magic number `0.02` in `optimizer.js:49`, `calculations.js:97`, `calculations.js:159` — not even importing `UFMIP_RATE` | Same as REF-6 | Same as REF-6 | Same as REF-6 — call out the duplication separately because fixing REF-6 without also fixing these call sites leaves a silent stale path |

### 2.3 HECM PLF / rate sheet tables

| ID | File:Line | Content | Cadence | Staleness blast radius | Proposed table |
|---|---|---|---|---|---|
| **REF-10** | `src/lib/hecm/plf-table.js:1-130` | HUD Principal Limit Factor table — 128 rate rows × 38 age columns = ~4,800 values. Source: `REVERSEAPP2022_DB_Zelezniak_test.xlsm` | **Event-driven (HUD publishes new PLF tables; 2017 was last major)** | Entire HECM calculator wrong if HUD re-publishes; right now the 2022 table is effectively stable but the staleness is silent | `ref_hecm_plf(effective_from, effective_to, expected_rate_bps, age, factor)` |
| **REF-11** | `src/lib/hecm/constants.js:6` | `FOA_PLF_CORRECTION = 0.389 / 0.382` | **Event-driven (FOA pricing engine anomaly)** | Corrects a pricing-engine mismatch; if FOA changes their LOS, correction is wrong | Keep as derived constant OR `ref_lender_corrections(lender_code, metric, value, rationale)` — low priority |
| **REF-12** | `src/lib/hecm/rate-sheet.js:10-27` + rest of file | `FOA_PRICING` ASL pricing grid (margin × PLU buckets) dated 3/3/2026. Plus `ASL_PRICING` Moneyhouse (2/18/2026). | **Weekly/bi-weekly (lender rate sheets)** | HECM pricing output diverges from lender rate sheet within days; user sees phantom yields | `ref_hecm_pricing(lender_code, product, rate_sheet_date, margin, plu_bucket_min, plu_bucket_max, price)` — should flow through the same rate-sheet pipeline that conventional/FHA already uses |

### 2.4 Geographic / tax reference (state & county)

| ID | File:Line | Content | Cadence | Staleness blast radius | Proposed table |
|---|---|---|---|---|---|
| **REF-13** | `src/data/county-tax-rates.js:15-29` (STATE_AVERAGES) | 50-state effective property tax rates (decimal). Source: "US Census Bureau, Tax Foundation estimates" | **Annual** | PITI quote understated or overstated by hundreds/month; especially material in NJ (2.40%), IL (1.97%), TX (1.68%) | `ref_state_tax_rates(state, effective_from, effective_to, avg_effective_rate, source)` |
| **REF-14** | `src/data/county-tax-rates.js:40+` (COUNTY_TAX_RATES) | County-level rates for CO/CA/TX/OR (licensed states). Many counties still placeholder = state avg. File has explicit `TODO: Populate with real data`. | **Annual** | Same as REF-13 but geolocated — borrower expects accurate county rate; brand promise is transparency | `ref_county_tax_rates(state, county_fips, effective_from, effective_to, rate, source, is_placeholder)` |
| **REF-15** | `src/lib/rates/closing-costs.js:6-16` | Third-party closing-cost estimates by state: `CO $2800, TX $3200, OR $2600, CA $3500` | **Annual-ish (market drift, title co. changes)** | GFE estimate off; borrower sees different final number at closing | `ref_state_closing_costs(state, effective_from, effective_to, third_party_cost_amount, source)` |
| **REF-16** | `scripts/seed-fee-templates.mjs:29+` | 4 states × 2 purposes = 8 fee templates hardcoded in the seed script (title fees, recording, MERS, flood cert, tax service, appraisal, etc.). Already writes to DB (`fee_templates` table) — seed-only. | **Annual-ish** | Low (DB-driven at runtime) — but the seed script **is** the source of truth, so changes require a code edit + re-run | Promote authoritative values out of seed script into admin UI or versioned ref table; current DB table is already right shape, just needs admin write path |

### 2.5 Licensing / business scope

| ID | File:Line | Content | Cadence | Staleness blast radius | Proposed table |
|---|---|---|---|---|---|
| **REF-17** | Implicit — no canonical source file | NetRate's licensed states (CA, CO, TX, OR) appear in `closing-costs.js`, `seed-fee-templates.mjs`, county-tax-rates.js, marketing prose, schema.org markup. No single `LICENSED_STATES` constant. | **Event-driven (new NMLS license filed)** | Public site might quote a state we're not licensed in (UDAAP risk); pricer might succeed for ineligible state | `ref_licensed_states(state, effective_from, effective_to, license_number, nmls_id)` — also exposes the list to the homepage / compliance footer |

### 2.6 Rate-sheet-adjacent (lender-authored, near-reference)

These are authored by lenders but stored in JSON staging files that get seeded into `adjustment_rules`. Not strictly external reference data, but worth noting because they have the same stale-by-deploy shape.

| ID | File:Line | Content | Cadence | Staleness blast radius | Proposed table |
|---|---|---|---|---|---|
| **REF-18** | `src/data/lender-adjustments/{lender}/*.json` (dir not present on disk in this worktree — referenced by `seed-adjustment-rules.mjs:24`) | Per-lender LLPA staging JSON | **Weekly (lender rate sheets)** | Already DB-driven via `adjustment_rules`; staging files are the handoff format. Low risk if seed is re-run each rate sheet update. | Already handled (`adjustment_rules`); call out that staging dir is canonical source — keep or replace with admin UI upload |

---

## 3. Proposed D9d table list (grouped, deduped)

This is the key deliverable. Each table is a self-contained reference entity. All tables use `effective_from DATE NOT NULL` and `effective_to DATE NULL` for temporal versioning so the pricer can look up the right row by transaction date, not by "most recent."

### 3.1 Loan limits
- `ref_county_loan_limits` — absorbs A1, A2, REF-1, REF-2. Keys: `(year, state, county_fips)`. Columns: `baseline_1unit ... baseline_4unit, conforming_1unit ... conforming_4unit, is_high_cost, effective_from, effective_to`.
- `ref_hecm_limits` — absorbs REF-3. Keys: `(year)`. Columns: `max_claim_amount, effective_from, effective_to`.

### 3.2 Government insurance
- `ref_fha_ufmip` — absorbs B3, REF-5. Keys: `(effective_from, loan_purpose, case_type)`. Columns: `rate, effective_from, effective_to, hud_mortgagee_letter_ref`.
- `ref_fha_annual_mip` — absorbs REF-4. Keys: `(effective_from, case_number_date_from, term_max, ltv_max, base_loan_amount_min)`. Columns: `rate_bps, is_high_balance_adder, effective_from, effective_to`.
- `ref_va_funding_fee` — absorbs REF-8 (promotes prose disclosure to real grid). Keys: `(effective_from, purpose, down_payment_min, is_first_use, is_exempt)`. Columns: `rate, effective_from, effective_to, va_circular_ref`.
- `ref_hecm_ufmip` — absorbs REF-6, REF-9. Keys: `(effective_from)`. Columns: `rate, effective_from, effective_to`.
- `ref_hecm_annual_mip` — absorbs REF-7. Keys: `(effective_from)`. Columns: `rate, effective_from, effective_to`.

### 3.3 HECM pricing
- `ref_hecm_plf` — absorbs REF-10. Keys: `(effective_from, expected_rate_bps, age)`. Columns: `factor, effective_from, effective_to, hud_table_version`.
- `ref_hecm_pricing` — absorbs REF-12. Keys: `(lender_code, product, rate_sheet_date, margin_bps, plu_bucket)`. Columns: `price`. (Effectively promotes HECM into the existing rate-sheet pipeline pattern.)
- `ref_lender_corrections` (optional, low priority) — absorbs REF-11. Keys: `(lender_code, metric)`. Columns: `value, rationale`.

### 3.4 Geographic / tax
- `ref_state_tax_rates` — absorbs REF-13. Keys: `(state, effective_from)`. Columns: `avg_effective_rate, source, effective_from, effective_to`.
- `ref_county_tax_rates` — absorbs REF-14. Keys: `(state, county_fips, effective_from)`. Columns: `rate, source, is_placeholder, effective_from, effective_to`.
- `ref_state_closing_costs` — absorbs REF-15. Keys: `(state, effective_from)`. Columns: `third_party_cost_amount, source, effective_from, effective_to`.
- `ref_fee_templates` (rename/formalize existing `fee_templates`) — absorbs REF-16. Keys: `(state, county, purpose, effective_from)`. Already exists — formalize the schema and add admin write path.

### 3.5 Business scope
- `ref_licensed_states` — absorbs REF-17. Keys: `(state, effective_from)`. Columns: `license_number, nmls_id, effective_from, effective_to`.

### 3.6 Summary count
**13 new `ref_*` tables proposed** (plus one rename/formalization of `fee_templates`). Every one consolidates scattered constants/files and every one has a measurable staleness blast radius.

---

## 4. Enum vs reference-data distinction (explicit for D9d)

D9d should **not** migrate these — they're code vocabulary, not data:

| File | Content | Why it stays in code |
|---|---|---|
| `src/lib/constants/loan-types.js` | LOAN_TYPES, LOAN_TERMS, LOAN_PURPOSES | Enum; changes when code changes |
| `src/lib/constants/conditions.js` | CONDITION_STAGES, CONDITION_STATUSES, CONDITION_TYPES, CONDITION_OWNER_ROLES | Enum + UI color tokens |
| `src/lib/constants/doc-types.js` | DOC_PREFIXES, DOC_SUBTYPES, CONDITION_TO_PREFIX, PREFIX_TO_CONDITION | Naming-protocol vocabulary |
| `src/lib/constants/mcr-fields.js` | ACTION_TAKEN, APPLICATION_METHODS, LIEN_STATUSES, LEAD_SOURCES, APPLICATION_CHANNELS | HMDA/MCR enums — stable taxonomy |
| `src/lib/constants/lenders.js` | LENDERS list | Dropdown options; real lender config lives in `rate_lenders` |
| `src/lib/constants/initial-doc-list.js` | Document-checklist construction logic | Business rules, not data |
| `src/lib/constants/submission-checklists.js` | Per-loan-type checklists | Business rules (should be data-driven eventually, but that's a product decision — not a regulator update) |
| `src/lib/constants/org.js` | DEFAULT_ORG_ID, DEFAULT_ORG_NAME | Business anchor |
| `src/lib/rates/config.js` | LO_CONFIG (NMLS, phone, email) | Business profile; should eventually move to `orgs` table but it's one row, not a grid |
| `src/lib/rates/defaults.js DEFAULT_SCENARIO` | Publishing anchor (780/400K/75%) | Business policy, not reference data |

**Rule of thumb for D9d:** if the value changes because of a code refactor, it stays in code. If the value changes because FHFA / HUD / VA / USDA / state assessor / market published something new, it's reference data and goes in a `ref_*` table.

---

## 5. Cross-references

- **Pass 1 (Pricer inventory)** — A1, A2, B3 cataloged there; re-referenced not re-cataloged
- **Pass 7 (Scheduled tasks)** — annual-cadence ref data (county limits, state tax rates) should have scheduled refresh/validation jobs; Pass 8 findings feed scheduled-task design
- **D5 verification (Org scoping)** — `ref_*` tables are globally scoped (no org_id) because the reference values don't vary per org — FHFA doesn't publish per-org loan limits. Exception: `ref_licensed_states` is per-org (or becomes part of org profile)
- **Audit spec `README.md §D8`** — this pass completes D8 inventory. Passes 2–7 cover homepage, UI, marketing, schema.org, scheduled tasks, MLO portal
- **D9d scope** — the 13 `ref_*` tables above are the D9d scope. D9a-c (identity, pricing, quotes) remain as defined in UAD spec

---

## 6. Open questions (for David / D9d design)

1. **Temporal model — effective dating vs year keying?** Pass 1 proposed `(year, ...)` keys for county loan limits. This pass proposes `(effective_from, effective_to)` for most tables. They're not equivalent — effective dating handles mid-year HUD mortgagee letters cleanly; year keying doesn't. Recommend effective dating as the universal pattern. Confirm before schema design.

2. **FHA case-number date vs origination date?** FHA MIP schedule depends on **case number assignment date**, not origination date. Do we currently track case number date on loans? If not, `ref_fha_annual_mip` lookup is imprecise.

3. **Who owns the refresh cadence?** Annual reference data (county limits, state tax rates) needs a calendar. Is this Mac Admin's job (scheduled task + tracker item) or PC Dev's (build-time check + fail-if-stale)?

4. **HECM pricing — promote to main rate-sheet pipeline?** REF-12 (FOA/Moneyhouse pricing) duplicates the pattern we already solved for conventional/FHA via GCS → GH Action → Neon. Should HECM join that pipeline, or keep separate for now?

5. **VA funding fee — build now or later?** REF-8 flagged that VA funding fee is disclosed in prose but never actually charged by any pricing path. Is this a D9d table we design but don't yet populate? Or wait until VA pricing is a real product?

6. **`loan-limits-2025.json` (REF-2) — delete now?** Not pricer-critical but visibly stale on the marketing site. Standalone cleanup, or folded into D9d migration?

7. **`county-tax-rates.js` placeholders (REF-14)** — file literally has `TODO: Populate with real data` for CA/TX/OR counties. Do we source county data before D9d migration, or migrate schema + fill values in a follow-up?

---

*End Pass 8. D8 inventory is complete with this pass. D9d design can now proceed against the 13-table proposed schema.*
