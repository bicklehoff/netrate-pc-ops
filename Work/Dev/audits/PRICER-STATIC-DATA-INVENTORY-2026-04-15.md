# Pricer Scenario — Static Data Inventory

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 1
**Date:** 2026-04-15
**Produced by:** sibling session via explore-agent dispatch
**Status:** Complete. Findings cross-referenced in [`README.md §9`](./README.md#9-pricer-inventory--cross-references).
**Scope:** only files in the pricer scenario flow. Homepage, UI components, marketing pages, schema.org markup, and other surfaces are deferred to subsequent passes of this dimension.

---

## Pipeline

```
POST /api/pricing → src/app/api/pricing/route.js
                 → priceScenario()         src/lib/rates/price-scenario.js
                 → loadRateDataFromDB()    src/lib/rates/db-loader.js       (Neon)
                 → getDbLenderAdj()        src/lib/rates/db-adj-loader.js    (Neon)
                 → priceRate() per row     src/lib/rates/pricing-v2.js
```

## Static dependencies found in the pricer path

### A. Bundled data files in `src/data/`

| ID | File | Content | Consumed by | Risk | Notes |
|---|---|---|---|---|---|
| **A1** | `src/data/county-loan-limits.js` | All 3,235 US counties + baseline limits (2026). Header: "Generated: 2026-03-20". | `price-scenario.js` (`classifyLoan`, `getLoanLimits`) | **ANNUAL** | Generated from `fhfa-loan-limits-2026.csv`. Filename has no year — staleness not obvious. |
| **A2** | `src/lib/rates/defaults.js:12` | `FHA_BASELINE_LIMIT = Math.round(832750 × 0.65) = 541288` | `price-scenario.js` | **ANNUAL** | Hardcoded constant. Becomes stale when FHFA raises baseline (Jan 2027). |

### B. Hardcoded constants in `src/lib/rates/` that behave like reference data

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **B1** | `pricing-v2.js:340` | Broker comp rate fallback = `0.02` | LOW | Only fires if `rate_lenders.comp_rate` is null. Policy-based, not regulatory. |
| **B2** | `pricing-v2.js:342-343` | Broker comp cap fallback = `$3,595` (purchase + refi) | LOW-MED | Only fires if lender caps are null. |
| **B3** | `pricing-v2.js:369` | FHA UFMIP fallback = `0.0175` (1.75%) | **HIGH** | HUD updates UFMIP annually. Lender config should override, but if any active lender has null `fha_ufmip`, this stale fallback fires. |

### Not data — correctly hardcoded (schema, not reference)

- **FICO band thresholds** (`pricing-v2.js:168-179, 248-258`) — schema definition for the adjustment grids.
- **LTV band thresholds** (`pricing-v2.js:263-267`) — same.
- **`DEFAULT_SCENARIO`** values (fico 780, loanAmount 400K, ltv 75, etc.) — publishing anchors, not reference data.
- **`EMPTY_ADJ` template** in `price-scenario.js:149` — algorithm fallback, not data.

### Explicitly NOT in the pricer path (audit can skip)

- `src/data/loan-limits-2025.json` — only imported by `CountyLoanLimits.js` UI component, **not** the pricer. But it's still a stale 2025-named file sitting in the repo.
- `src/data/county-tax-rates.js` — not in pricer path.
- `src/lib/rates/closing-costs.js` — not in pricer path.
- `src/lib/rates/config.js` (LO_CONFIG) — not in pricer path.
- Rate sheet parser files (amwest.js, keystone.js, etc.) — ingest pipeline only, not runtime pricing.
- `db-writer.js`, `adj-writer.js` — seed/admin only.

## Top audit findings

1. **FHA UFMIP (B3) is the highest-risk constant** — 1.75% is stale the moment a lender's config row is missing `fha_ufmip`. First audit action: `SELECT code, fha_ufmip FROM rate_lenders WHERE status='active'` — every row should be non-null. If any are null, the pricer silently falls back to a stale number.

2. **FHA_BASELINE_LIMIT (A2) is derived but hardcoded** — `Math.round(832750 × 0.65)`. When FHFA raises the baseline in January, this constant is wrong until someone edits the file and redeploys. Either move to DB keyed by year, or compute at build time from the county limits file.

3. **`county-loan-limits.js` (A1) is bundled** — 3,235 rows baked into the deploy. Works fine for 2026 but requires a manual regeneration + code deploy each January. Plus the filename doesn't include a year, so there's no in-code signal that it's stale. Rename to `county-loan-limits-2026.js` for now, or move to a `ref_county_loan_limits` table keyed on `(year, state, county_fips)`.

4. **Stale file still in repo** — `src/data/loan-limits-2025.json` is imported by the UI component `CountyLoanLimits.js`. Not a pricer concern but flag it to the audit anyway — it's embarrassing-stale and misleading.

## Recommended DB-ification targets (priority order)

1. **`ref_fha_ufmip`** — highest impact. Keyed by `(year, loan_purpose, case_type)` with value. Replaces B3. Audit priority #1.
2. **`ref_county_loan_limits`** — replaces A1 + A2 together. Keyed by `(year, state, county_fips)` with baseline_1unit through 4unit, conforming_1unit through 4unit, is_high_cost. Derive FHA_BASELINE_LIMIT at query time.
3. **Lender comp defaults** — low priority, but codify: require `rate_lenders.comp_rate`, `comp_cap_purchase`, `comp_cap_refi` NOT NULL. Remove B1/B2 fallbacks entirely once data is clean.

## Cadence summary

- **DB rate pipeline**: updates 4×/day weekdays (GCS → GH Action → Neon).
- **Static pricer data** (this inventory): updates **only on code deploy**. Every item above requires a developer action.
- **LLPA adjustment grids**: already DB-driven via `db-adj-loader.js` + `rate_adjustments` table — no audit concern there. That's the architectural pattern to apply to the items above.

---

**Scope note.** This inventory lists only what the *pricer scenario flow* depends on. Homepage par picker, marketing pages, hardcoded rates in JSX prose, schema.org markup, and UI components have their own static-data exposure and would need separate inventory passes — queued as D8 Passes 2–8 in the [audit spec](./README.md#d8--static-data--stale-by-deploy--).
