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

42 products in DB. Last parse date: check `rate_sheets` table.

## parse-gcs-rates.mjs

Line 257 only passes `programs`. Add: `llpas, govAdj, loanAmountAdj, stateAdj, lenderFee, compCap`.
