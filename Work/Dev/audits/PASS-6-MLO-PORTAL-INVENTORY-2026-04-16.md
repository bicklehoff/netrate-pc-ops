# D8 Inventory Pass 6 — MLO Portal Static Data

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 6
**Date:** 2026-04-16
**Status:** Complete — Catalog phase only. Findings identified, no code changes.
**Blocks:** D7 (MLO Portal UX redesign) per audit spec
**Scope:** All MLO portal pages and shared Portal components

---

## Scope Walked

**Files sampled:**

**MLO Pages (21 total):**
- `src/app/portal/mlo/page.js` — Pipeline dashboard (ACTIVE_STATUSES, ALL_STATUSES, STATUS_LABELS, TIER1_FILTERS hardcoded)
- `src/app/portal/mlo/loans/[id]/page.js` — Loan detail view
- `src/app/portal/mlo/scenario-alerts/page.js` — Rate alerts queue
- `src/app/portal/mlo/leads/[id]/page.js` — Lead detail (PURPOSES, PROPERTY_TYPES, OCCUPANCY, STATES hardcoded)
- `src/app/portal/mlo/leads/page.js` — Leads table
- `src/app/portal/mlo/contacts/[id]/page.js` — Contact detail
- `src/app/portal/mlo/contacts/page.js` — Contacts table
- `src/app/portal/mlo/tools/quote-generator/page.js` — Quote builder launcher
- `src/app/portal/mlo/tools/hecm-optimizer/page.js` — HECM calculator launcher

**Portal Components (key samples):**
- `src/components/Portal/QuoteGenerator/QuoteScenarioForm.js` — Quote form (STATES, LOAN_TYPES, PURPOSES, TERMS, LOCK_DAYS hardcoded)
- `src/components/Portal/PayrollSection.js` — CD upload + payroll (HOUSE_FEE_RATE hardcoded)
- `src/components/Portal/CompensationSection.js` — Comp breakdown (HOUSE_FEE_RATE hardcoded)
- `src/components/Portal/PipelineTable.js` — Loan table (STATUS_LABELS, STATUS_COLORS, PURPOSE_LABELS, TYPE_LABELS hardcoded)
- `src/components/Portal/LoanDetailView.js` — Loan view (STATUS_LABELS, STATUS_COLORS, DOC_TYPES, EVENT_ICONS hardcoded)
- `src/components/RateTool/StrikeRateForm.js` — Rate alert form (LOAN_TYPES hardcoded)

**Not walked (out of D8 Pass 6 scope):**
- API routes under `src/app/api/portal/mlo/**` (D4/D5 territory — data integrity and org scoping)
- Borrower portal (`src/app/portal/borrower/**`) — Pass 5

---

## Static Data Catalog

### A. Hardcoded Picklists (Loan Types, Purposes, Status, States)

| ID | Location | Content | Consumed By | Risk | Notes |
|---|---|---|---|---|---|
| **MLO-1** | `src/app/portal/mlo/page.js:16-46` | ALL_STATUSES (13 values: prospect, applied, processing...), STATUS_LABELS (display names), ACTIVE_STATUSES, SETTLED_STATUSES, CANCELLED_STATUSES, TIER1_FILTERS | Pipeline page bulk actions, status dropdowns | **HIGH** | Duplicated in 5+ files; not in `src/lib/constants/`. If a status value is added to DB schema (e.g. 'approved_conditional'), portal won't show it. |
| **MLO-2** | `src/components/Portal/QuoteGenerator/QuoteScenarioForm.js:6-20` | STATES=['CA','CO','OR','TX'], LOAN_TYPES (conv, fha, va, dscr, bankstatement), PURPOSES (purchase, refinance, cashout), TERMS=[30,25,20,15], LOCK_DAYS=[15,30,45,60] | Quote generator form dropdowns | **HIGH** | Duplicated in 3+ files. Adding a state or loan type requires edits in StrikeRateForm, leads/[id]/page, and quote form. Should read from DB or shared constants. |
| **MLO-3** | `src/app/portal/mlo/leads/[id]/page.js:7-34` | PURPOSES (purchase, refinance, cashout, heloc, reverse), PROPERTY_TYPES (sfr, condo, townhome, 2-4unit, manufactured), OCCUPANCY (primary, second_home, investment), STATES (CO, CA, TX, OR) | Lead detail form dropdowns | **HIGH** | Duplicated with QuoteScenarioForm + PipelineTable; different label text in some cases ('heloc'/'HELOC/2nd', 'reverse' in leads but not in quote form). Divergence risk. |
| **MLO-4** | `src/components/Portal/PipelineTable.js:13-38` | STATUS_LABELS (13 values), STATUS_COLORS (color map), ALL_STATUSES, PURPOSE_LABELS (5 values), PURPOSE_COLORS, TYPE_LABELS (5 values) | Pipeline table column rendering, filtering | **HIGH** | Duplicated with page.js + LoanDetailView. Three separate STATUS_LABELS objects, two with different color palettes (e.g. 'processing': yellow-100 in LoanDetailView, amber-500 in PipelineTable). |
| **MLO-5** | `src/components/Portal/LoanDetailView.js:10-50` | STATUS_LABELS (9 values — subset of full set), STATUS_COLORS (color map), DOC_TYPES (6 values: pay_stub, w2, bank_statement, tax_return, id, other), DOC_STATUS_COLORS, DOC_STATUS_LABELS, EVENT_ICONS (emoji map for timeline) | Loan detail page, document section | **HIGH** | STATUS_LABELS here subset of PipelineTable. DOC_TYPES hardcoded; no shared definition. EVENT_ICONS (emoji) should be in constants — emoji choice is design debt if changed. |
| **MLO-6** | `src/components/RateTool/StrikeRateForm.js:16-23` | LOAN_TYPES (conv, fha, va, usda, jumbo, dscr) | Rate alert signup (below rate tool, on rate watch page, state pages) | **MEDIUM** | Different from QuoteScenarioForm's LOAN_TYPES (includes 'jumbo', omits 'bankstatement'). Another divergence risk. |
| **MLO-7** | `src/app/portal/mlo/scenario-alerts/page.js:11-16` | STATUS_FILTERS (all, pending, sent, declined) — alert queue statuses, NOT loan statuses | Scenario alert page filter buttons | **MEDIUM** | Separate picklist for alerts vs loans; currently simple (4 values). Lower urgency but should be documented as intentional. |

### B. Hardcoded Business Rules / Constants

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MLO-8** | `src/components/Portal/PayrollSection.js:546` + `src/components/Portal/CompensationSection.js:39` | HOUSE_FEE_RATE = 0.12948857 (12.948857%) | **HIGH** | Hardcoded in TWO places. Broker compensation is split: gross × 0.12948857 → house fee, rest → LO comp. If NetRate changes comp policy, two files must be edited + redeploy. Silent wrong output if only one is updated. Already has calculation inline (line 548: `const house = gross * HOUSE_FEE_RATE`). |
| **MLO-9** | `src/components/Portal/QuoteScenarioForm.js:64-90` | Default closing date logic: 4 business days before last business day of month. Hardcoded algorithm in `getDefaultClosingDate()`. | **MEDIUM** | Business logic (not data) but deployed code. If closing rules change (e.g., "3 business days"), code must be edited. Currently used by quote form only; acceptable complexity since it's algorithmic, not reference data. |
| **MLO-10** | `src/components/Portal/QuoteScenarioForm.js:97-106` | Funding date derivation: CO+TX purchase = same day; CA+OR+refi = +3 business days. Hardcoded in `deriveFromClosing()`. | **MEDIUM** | Business rule (state+purpose determines funding delay). If rules change by state, code edit required. OK for now but candidate for `ref_funding_rules` table later. |
| **MLO-11** | `src/components/Portal/QuoteScenarioForm.js:393-394` | FHA UFMIP hardcoded as 1.75% in JSX: `{scenario.loan_type === 'fha' && effectiveLoan > 0 && ... Math.round(effectiveLoan * 0.0175)}` | **HIGH** | Same issue as `pricing-v2.js:369` (D8 Pass 1 finding B3). Also hardcoded here in display layer. If HUD raises UFMIP in 2027, will show wrong number until redeploy. |

### C. Duplicated Business Rules

| ID | Location 1 | Location 2 | Content | Risk | Notes |
|---|---|---|---|---|---|
| **MLO-12** | `src/components/Portal/PayrollSection.js:37-55` | `src/components/Portal/CompensationSection.js:39-46` | HOUSE_FEE_RATE + comp split calculation | **HIGH** | Same calculation (`gross * HOUSE_FEE_RATE` + subtraction) in two places. Extract to `src/lib/payroll-calc.js` or DB table. |

### D. Mock/Placeholder Copy

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MLO-13** | `src/app/portal/mlo/page.js:386-387` | `"Welcome back, {session?.user?.name || 'there'}. Manage your active applications."` | **LOW** | Boilerplate greeting. Not stale, but generic. Acceptable. |

### E. Stale or Candidate for DB Migration

| ID | Location | Content | Recommendation | Priority |
|---|---|---|---|---|
| **MLO-14** | `src/components/Portal/PipelineTable.js:82` | `isExpiringSoon()` hardcodes "7 days" threshold for lock expiration warning. Magic number. | Move to DB config or constant `LOCK_EXPIRY_WARN_DAYS = 7` | LOW |
| **MLO-15** | `src/components/Portal/QuoteScenarioForm.js:89` | Fallback closing date (end of next month + 15) if no valid date found. Fallback logic OK, but hardcoded "15". | Document intent; consider parameterizing if rules change. | LOW |

---

## Key Findings Summary

### Critical Issues

1. **Status picklist duplication (MLO-1, MLO-4, MLO-5):** 13 status values hardcoded in 5+ files with divergent color schemes. If a status is added to DB (e.g. 'approved_conditional'), portal UI won't display it until code is edited in each location.

2. **Loan type / purpose picklist divergence (MLO-2, MLO-3, MLO-6):** Three separate definitions with inconsistent labels ('heloc' vs 'HELOC/2nd', 'bankstatement' vs 'jumbo'). Risk: borrower/lender sees different label than MLO, or new product type silently omitted.

3. **Broker compensation split (MLO-8, MLO-12):** HOUSE_FEE_RATE hardcoded in two places with inlined calculation. If NetRate changes comp policy from 12.95% to 13% or introduces tiered rates, both files must be updated. Silent wrong output if only one is changed.

4. **FHA UFMIP duplication (MLO-11 + D8 Pass 1 B3):** Hardcoded as 1.75% in QuoteScenarioForm JSX display AND in pricing-v2.js. When HUD updates UFMIP (annually), borrower sees stale rate in quote form AND in pricer. Two codebases, two updates needed.

### High-Risk (Operationally Wrong Output)

- **MLO-2, MLO-3, MLO-6** — New loan types or states added to DB won't appear in any dropdown until code is edited.
- **MLO-8, MLO-12** — Wrong compensation paid to LOs if comp rate changes and only one instance updated.

### Medium-Risk (Cosmetic or Infrequent)

- **MLO-4, MLO-5** — Status colors diverge between pages (confusing visual presentation).
- **MLO-7** — Alert status filter is separate from loan status; currently OK but should be documented.
- **MLO-9, MLO-10** — Closing/funding date rules are algorithmic; lower priority but candidates for DB config if rules expand.

### Low-Risk

- **MLO-13, MLO-14, MLO-15** — Boilerplate text, magic numbers in non-critical contexts.

---

## Portal Redesign Implications (D9 Layer 1)

When D9 Layer 1 ships with the new Contact/Deal schema:

- **Naturally resolved by D9:** Status picklist (MLO-1, MLO-4, MLO-5) will be unified into a single Contact/Deal lifecycle picklist tied to the schema. No migration needed if portal is rebuilt on D9 schema.
- **Naturally resolved by D9:** Broker compensation structure (MLO-8, MLO-12) will be part of the Deal financing model; likely moved to DB config. Redesign can extract HOUSE_FEE_RATE to DB during migration.
- **Remains:** Loan type / purpose divergence (MLO-2, MLO-3, MLO-6) — these are product attributes, not schema. Must be unified in constants or DB regardless of D9 Layer 1.
- **Remains:** FHA UFMIP duplication (MLO-11 vs pricing-v2.js) — crosses layers (display vs pricing). Must be unified even after redesign.

---

## Ship-Immediately Candidates

None in this pass. All findings are either:
1. Foundational to the redesign (worth batching with D9 Layer 1 schema decisions)
2. Cross-layer (require alignment with pricer + portal simultaneously)
3. Low-urgency cosmetic

**Exception:** If MLO-2/MLO-3/MLO-6 divergence is discovered to cause borrower-facing silent omissions (e.g., a lender is in DB but quote form has no match), extract constants immediately. Recommend audit query first.

---

## Recommended Remediation Order

1. **Unified picklist constants** — After D8 inventory converges, consolidate MLO-1/MLO-2/MLO-3/MLO-4/MLO-5/MLO-6 into a single source in `src/lib/constants/` or DB tables. Apply to all surfaces.
2. **FHA UFMIP** — Extract MLO-11 + Pass 1 B3 to `src/lib/rates/ref-fha-ufmip.js` (or DB). Consumed by pricing-v2.js AND QuoteScenarioForm.
3. **Broker compensation** — Move MLO-8/MLO-12 to `src/lib/payroll-calc.js` with exported `splitCompensation(gross, rate=0.12948857)`. Consumed by PayrollSection + CompensationSection.
4. **Date rules** — Parameterize MLO-9/MLO-10 into optional config object; can stay in QuoteScenarioForm for now but document as candidate for DB config in future.

---

## Open Questions for Driver

1. **Loan type aliasing:** StrikeRateForm includes 'jumbo' but QuoteScenarioForm has 'bankstatement'. Are these equivalent? Should there be a canonical loan-type mapping (borrower-facing label vs internal code)?
2. **Status color scheme:** PipelineTable and LoanDetailView have different color palettes for the same statuses. Intentional (different context)? Should be unified design-wide?
3. **MLO-7 (alert statuses):** Should `scenario_alerts.status` (pending/sent/declined) use the loan status enum, or is it intentionally separate?
4. **Comp rate policy:** Is 12.948857% locked, or does it vary by geography/MLO level? If policy-configurable, should be in `lender_config` or similar, not hardcoded.

---

## File Paths (Reference)

**Primary files (sorted by risk):**
- `src/app/portal/mlo/page.js:16-46` — Pipeline status definitions
- `src/components/Portal/PipelineTable.js:13-38` — Duplicated picklists + colors
- `src/components/Portal/QuoteGenerator/QuoteScenarioForm.js:6-20, 393-394` — Loan types, UFMIP hardcoding
- `src/app/portal/mlo/leads/[id]/page.js:7-34` — Purpose/state picklists
- `src/components/Portal/PayrollSection.js:546` — Comp split
- `src/components/Portal/CompensationSection.js:39` — Comp split (duplicate)
- `src/components/Portal/LoanDetailView.js:10-50` — Status labels + doc types
- `src/components/RateTool/StrikeRateForm.js:16-23` — Divergent loan types

---

## Summary

**D8 Pass 6 complete.** Found 15 findings across MLO portal and shared Portal components. **Critical:** 3 (status duplication, loan type divergence, comp rate hardcoding). **High:** 4. **Medium:** 3. **Low:** 5.

Most high-risk findings will be naturally resolved when D9 Layer 1 ships the new schema (contact/deal lifecycle replaces fragmented status sets). Loan type divergence and FHA UFMIP duplication require cross-layer remediation regardless.

No code changes in this pass (inventory only). Findings feed directly into D8 remediation and D9 design.
