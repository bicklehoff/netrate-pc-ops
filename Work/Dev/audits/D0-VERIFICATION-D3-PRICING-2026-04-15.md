# D3 · Pricing Engine Correctness · Verification Re-audit

**Audit:** Site Audit 2026 · D0 (verification of claimed-done dimensions) · Dimension D3
**Date:** 2026-04-15
**Scope:** Pricing engine paths at commit 4a8a5ad
**Approach:** code read, read-only

## Verdict

⚠️ **CRITICAL ISSUE FOUND** — `homepage-db.js` lacks error resilience that `/api/pricing` has, causing the `'5.875%'` hardcoded fallback to display on production homepage when any active lender has no adjustment-rule rows.

This explains tonight's 5.875% mystery in PR #73's verification.

## What was checked

1. **Pricing engine (`pricing-v2.js`):** core math, Step 1–7 financial adjustments, APR/P&I formulas
2. **Homepage data loader (`homepage-db.js`):** product query, filtering, ladder construction, par picking
3. **Par picker (`pick-par-rate.js`, new in PR #73):** grouping, at-or-above-par filter, lowest-rate selection, fallback
4. **API pricing (`price-scenario.js`, `/api/pricing/route.js`):** scenario loading, product filtering, lender config handling
5. **Mortgage math (`mortgage-math.js`):** PI, LTV, APR formulas
6. **Product filters:** homepage-db WHERE clause vs price-scenario client-side filters
7. **Error handling:** exception handling and null-return paths in both routes

## Findings

### Critical: homepage-db vs /api/pricing divergence in missing-lender-adj handling

**`/api/pricing` (via `price-scenario.js:146-150`):**

```javascript
const lenderAdj = await getDbLenderAdj(lenderId, scenario.loanType);
// Lenders with no adjustment rules (e.g., TLS — LLPAs baked into product codes)
// get an empty adj object so pricing can still proceed with zero adjustments.
const EMPTY_ADJ = { ficoLtvGrids: { ... }, srp: { ... }, ... };
const effectiveAdj = lenderAdj || EMPTY_ADJ;
```

**`homepage-db.js:69-70`:**

```javascript
const lenderAdj = await getDbLenderAdj(lenderCode, loanType);
if (!lenderAdj) return null;   // ← hard fail, no fallback
```

**Impact:** If the active rate sheet contains products from a lender without seeded adjustment rules, homepage-db returns null for that call. Cascades to `getHomepageRatesFromDB` returning `{ conv30: null, conv15: null, fha30: null, va30: null }`. `src/app/page.js:56-58` then fires the hardcoded fallback (`'5.875%' / '5.94%' / '$2,366'`). Meanwhile `/api/pricing` continues with EMPTY_ADJ and returns valid rates.

This is the root cause of the production 5.875% display after PR #73 merged. PR #73's `pick-par-rate.js` logic is correct but never runs because `priceProduct` short-circuits upstream.

### Product filtering divergence (minor)

- `homepage-db.js` applies hard WHERE filters at DB query level: `is_streamline=false AND is_interest_only=false AND is_high_balance=false AND is_buydown=false`
- `/api/pricing` loads all products and applies client-side filters (buydown, high-balance, jumbo conditional on loan classification)
- For standard conforming purchases on a clean sheet both should include the same products. Not a bug, but slightly stricter pre-filter in homepage-db.

### PR #73 pick-par-rate integration — correct

- Grouping by rate and keeping max finalPrice per rate: ✓ correct (`pick-par-rate.js:42-51`)
- Filter to at-or-above par (finalPrice >= 100): ✓ correct (line 56)
- Select lowest qualifying rate: ✓ correct (line 61)
- Fallback to closest-to-par with lower-rate tiebreak: ✓ correct (lines 66–73)

Integration in `homepage-db.js`:
- Ladder constructed from pricing-v2 results (line 139): ✓ correct shape
- finalPrice recomputed from rounded discount/rebate dollars (line 138): mathematically correct, uses rounded values but the error is ≪ 1 cent for the standard scenario

**Precision note (non-blocking):** for FHA, pricing-v2 uses `effectiveLoanAmount` (with UFMIP) to compute dollars, but homepage-db uses base `loanAmount` to recompute finalPrice. Conventional paths are unaffected (`effectiveLoanAmount == loanAmount`). Worth a follow-up if FHA homepage display ever drifts.

### Financial correctness (PR #54 follow-up)

Re-verified the mortgage math:

1. **APR calculation (`mortgage-math.js:45-60`):** binary search for the rate that equates P&I on `loanAmount − netFinanceCharges` to P&I at noteRate on `loanAmount`. Matches TRID/RESPA spec.
2. **P&I calculation (lines 15–21):** standard amortization formula. Correct.
3. **LTV in DEFAULT_SCENARIO:** 74.999% — safely in ≤75 LTV band. Correct.
4. **Pricing-v2 Step 1–7:**
   - Base price conversion (discount format → 100-based): ✓ (`pricing-v2.js:24`)
   - FICO/LTV adjustments as cost-subtracted from base: ✓ (line 390)
   - SRP/Risk-based/Loan-amount as credits added: ✓ (lines 433, 441, 450)
   - Investor-specific as cost-subtracted: ✓ (line 549)
   - Broker comp as cost-subtracted: ✓ (line 582)

No regressions found in PR #54 fixes.

### Regressions from PRs #63–#72 — none detected

- **Scenario table migrations (#67, #68):** touched storage/retrieval APIs, not pricing math. No cross-contamination.
- **DSCR work (#69, #70, #71, #72):** separate domain (`src/lib/pricing-nonqm/`). Doesn't leak into agency paths.

## Most likely explanation for the 5.875% production display

Missing adjustment-rule rows for at least one lender on the active 2026-04-15 rate sheet (likely TLS or another code-based lender):

1. Active rate sheet contains products from lender X
2. Lender X has no rows in `adjustment_rules` for the loan type being priced
3. `getDbLenderAdj()` returns null
4. `homepage-db.js:70` hard-fails → `priceProduct('conventional', 30)` returns null
5. `getHomepageRatesFromDB()` returns `{ conv30: null, ... }`
6. `src/app/page.js:56`: `const conv30Rate = fmtRate(d?.conv30) || '5.875%';` — fallback fires
7. Homepage shows 5.875%

Meanwhile `/api/pricing` handles the same scenario via EMPTY_ADJ fallback and returns the correct 5.990% picker result.

## Recommended next actions

1. **Immediate fix:** mirror the EMPTY_ADJ fallback in `homepage-db.js`. Either import `EMPTY_ADJ` from `price-scenario.js` (preferred — single source) or duplicate the constant inline. Replace `if (!lenderAdj) return null;` with `const effectiveAdj = lenderAdj || EMPTY_ADJ;` and pass `effectiveAdj` to `priceRate`.
2. **Verify active-sheet state:** `SELECT DISTINCT lender_id FROM rate_products WHERE rate_sheet_id = (SELECT id FROM rate_sheets WHERE status='active' ORDER BY effective_date DESC LIMIT 1);` then check which of those have any `adjustment_rules` rows.
3. **Defense-in-depth:** add a server-side warning log when `priceProduct` returns null in `homepage-db.js`, surfacing which step failed (no sheet / no products / no lenderAdj / no ladder / no par).
4. **Follow-up:** consider extracting `EMPTY_ADJ` to `src/lib/rates/empty-adj.js` to avoid drift between price-scenario and homepage-db.

---

**Files inspected:**

- `src/app/page.js` (lines 44–70: fallback logic)
- `src/lib/rates/homepage-db.js` (lines 33–167: priceProduct)
- `src/lib/rates/pick-par-rate.js` (lines 38–74: par selection)
- `src/lib/rates/price-scenario.js` (lines 65–249: scenario pricing)
- `src/lib/rates/pricing-v2.js` (lines 360–612: core pricing engine)
- `src/lib/mortgage-math.js` (lines 15–61: APR + P&I)
- `src/lib/rates/db-adj-loader.js` (lines 10–20: adjustment loader)
- `src/app/api/pricing/route.js`
