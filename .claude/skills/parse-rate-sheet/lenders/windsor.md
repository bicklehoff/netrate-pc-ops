# Windsor Mortgage Solutions — Rate Sheet Reference

## File Format

XLSX (`65196_*.xlsx`), 16 sheets.

Parser: `src/lib/rates/parsers/windsor.js`
Entry: `parseRates(xlsxBuffer)`

## Sign Convention

Sheet convention: **negative = cost**.
**Parser negates** LLPA values.

## Key Sheets and Adjustment Sections

**Sheet: Conv LLPA**
- Row 14: "Conventional LLPAs"
- Row 16: Purchase FICO (Terms > 15yr) — grid
- Row 30: Non Cashout Refinance FICO — grid
- Row 44: Cash Out Refinance — grid
- Row 58: "Purchase - LLPAs by Product Feature" (Condo, Investment, Second Home, Manufactured)
- Row 72: "Non Cashout Refinance - LLPAs by Product Feature"
- Row 86: "Cashout Refinance - LLPAs by Product Feature"
- Row 100: "Other Adjustments (Excluded from cap)" — 90 day locks, extension fees
- Row 101 col 11: LLPA Caps
- Row 105: Lender Administration Fee
- Row 109: "Conventional State Tier (Excluded from cap)"
- Row 110 col 9: "Conforming Conventional Special ($350K+ - 680 FICO)"

**Sheet: Gov LLPA**
- Row 14: "Government LLPAs"
- Row 16: Government FICO Adjustments — grid
- Row 30: VA Price Adjustments + FHA Price Adjustments
- Row 39 col 7: USDA Price Adjustments
- Row 42: VA IRRRL Investment Property and Second Home
- Row 47–49: FICO tiers for FHA/VA
- Row 51: State Adjuster
- Row 58: Other Adjustments
- Row 64: Manufactured Home
- Row 65: Lender Administration Fee

**Sheet: Jumbo 4 LLPA**
- Separate FICO/LTV grids for Jumbo 4 product

**Sheet: Conventional and Government (main rate grid)**
- Row 181 col 15: "30/25 Year Fixed >$350K Investment" — occupancy/loan amt adj
- Row 204: "30/25 Year Fixed >$350K Second Home"

## Adjustment Rules (DB)

Status: **0 rows** — adjustment_rules not yet seeded for Windsor.

Existing reference: `src/data/lender-llpas/windsor-complete.json` (pre-extracted grids).

Next step: Create `src/data/lender-adjustments/windsor/` JSON files. Note: lender fee is on "Lender Administration Fee" row in sheet — read dynamically.

## Fees & Comp

| Item | Value |
|------|-------|
| Lender fee | Extract from "Lender Administration Fee" row |
| Comp cap (purchase) | $4,595 |
| Comp cap (refi) | $3,595 |

## Rate Prices (DB)

After parser fix (2026-04-10): 100+ products with proper loan amount tier
differentiation. Last parse date: check `rate_sheets` table.

## Known Issues / Fixes

### Parser collapsing all loan amount tiers + jumbo bleed (fixed 2026-04-10)

**Symptom:** Windsor pricing on the rate tool was wildly off — par showing
6.625% when other lenders showed 5.875-5.990. Parser was producing 20+
identical "Conventional 30yr Fixed" programs that all collided in the DB,
with prices from totally different products (loan amount tiers, Florida,
Investment, even Prime Jumbo) merged into one.

**Root causes — four separate bugs:**

1. **Unicode `≤` (U+2264) not matching ASCII `<=` regex.** Section labels
   use `≤$275K` format. Parser regex `(>|<=?)\s*\$?(\d+)K?` only matches
   ASCII `<=`. So `≤$275K` → no loan amount label → collides with the base
   product.

2. **No `loanAmountRange` set on programs.** Even when the loan amount
   label parsed, the parser didn't convert it into the `{min, max}` shape
   that db-writer expects. So products had loan_amount_min/max NULL,
   meaning the engine couldn't filter by loan amount.

3. **No Jumbo detection.** Windsor has multiple "Prime Jumbo 1/2/3/4"
   sheets. Parser saw "Prime Jumbo 1 30 Year Fixed" → loanType=conventional
   (default) → name "Conventional 30yr Fixed" → collided with the conv base.

4. **No Investment occupancy or state-specific row detection.** Sections
   like "30/25 Year Fixed >$350K Investment" or "30/25 Year Fixed Florida
   >$350K" → all collapsed into base "Conventional 30yr Fixed >350K".

**Fixes:**
- Normalize Unicode `≤`/`≥` to `<=`/`>=` at the top of `parseProductHeader`
- Added `parseLoanAmountRange()` helper that converts labels like ">350K"
  or "<=275K" or "> 250K <= 275K" into `{min, max}` dollar amounts
- Pass `loanAmountRange` through to the program object
- Added Jumbo detection: `Prime Jumbo (\d+)` → `isJumbo`, `jumboTier`,
  category='jumbo', name = "Prime Jumbo X 30yr Fixed"
- Added Investment occupancy detection
- Added Florida/state detection — but state-specific rows are SKIPPED
  during parsing because the engine doesn't currently support per-product
  state filtering. TODO: revisit when engine supports state filtering.

**Verification:** After fix, base "Conventional 30yr Fixed >350K" curve
is monotonic with par around 5.750-5.875% raw, 6.125% after broker comp.
Aligns with cluster of other lenders within 1/4 point.

Cleaned up 12 stale orphan products from previous parses (db-writer doesn't
delete products that aren't in the new write — they stay with 0 prices).

## parse-gcs-rates.mjs

Line 257 only passes `programs`. Add: `llpas, govAdj, loanAmountAdj, stateAdj, lenderFee, compCap`.
