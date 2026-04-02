# AmWest Funding — Rate Sheet Reference

## File Format

XLSX (`47006_*.xlsx`), 12 sheets.

Parser: `src/lib/rates/parsers/amwest.js`
Entry: `parseRates(xlsxBuffer)`

## Sign Convention

Sheet convention: **positive = cost** (already in engine convention).
No negation needed in parser.

## Key Sheets and Adjustment Sections

**Sheet: FT_LLPAS (Fast Track LLPAs)**
- Row 14: "FAST TRACK LLPA's (FFT & FMFT)"
- Row 17: Purchase FICO/LTV grid (terms > 15yr)
- Row 28: Purchase additional: Condo, Second Home
- Row 37: Refi FICO/LTV grid
- Row 51: Refi Condo adj
- Row 57: Cashout FICO/LTV grid
- Row 71: Cashout Condo adj
- Row 28 col 13: "OTHER PRICE ADJUSTMENTS"
- Row 38 col 13: State Adjuster (FIXED Program)
- Row 47 col 13: LLPA WAIVER
- Row 56 col 13: Cumulative LLPA Caps
- Row 74 col 13: MAX LOAN AMOUNT
- Row 77: LPMI adjustments
- Row 106: "Lender Fees: CONVENTIONAL $1,295"

**Sheet: LLPAS (Standard/Agency LLPAs)**
- Row 14: "AGENCY LLPAs (DU/LP) - FIXED & ARM"
- Row 17: Purchase FICO/LTV grid
- Row 28: Purchase additional: Condo, Second Home
- Row 16 col 13: NOO Additional Adjustments (30yr Fixed only)
- Row 24 col 13: 2nd Home Additional Adjustments (30yr Fixed only)
- Row 39 col 13: OTHER PRICE ADJUSTMENTS
- Row 49 col 13: State Adjuster (FIXED Program)
- Row 53 col 13: LLPA WAIVER
- Row 63 col 13: Cumulative LLPA Caps
- Row 86 col 13: MAX LOAN AMOUNT
- Row 87: LPMI adjustments

**Sheet: GOV**
- Row 76: "PRICE ADJUSTMENTS"
- Row 79: "GOVERNMENT PRICE ADJUSTMENTS" + "FICO ADJUSTMENTS"
- Row 82: "Note Loan Amount<=$99,999 (FHA/VA/USDA)"
- Row 83: "Note Loan Amount $100k to $149,999"
- Row 85: "VA IRRRL LTV >90.00%"
- Row 96: State Adjuster for Govt - FIXED
- Row 121: "Lender Fees: VA, FHA & USDA $1,295"

**Sheet: JUMBO**
- Row 42: FICO/LTV grids
- Row 50: Occupancy adjustments
- Row 66: LOAN AMOUNT ADJUSTERS
- Row 89: "Lender Fees: JUMBO $1,395"

**Sheet: CONV**
- Row 142: "Lender Fees: CONVENTIONAL $1,295"

## Adjustment Rules (DB)

Status: **0 rows** — adjustment_rules not yet seeded for AmWest.

Existing reference: `src/data/lender-llpas/amwest-complete.json` (pre-extracted grids).

Next step: Create `src/data/lender-adjustments/amwest/` JSON files and add seed functions to `seed-adjustment-rules.mjs`.

## Fees & Comp

| Item | Value |
|------|-------|
| Lender fee (Conv/Gov) | $1,295 |
| Lender fee (Jumbo) | $1,395 |
| Comp cap (purchase) | $4,595 |
| Comp cap (refi) | $3,595 |

## Rate Prices (DB)

13 products in DB. Last parse date: check `rate_sheets` table.

## parse-gcs-rates.mjs

Line 222 only passes `programs`. Add: `agencyLlpas, govAdj, jumboAdj, loanAmountAdj, stateAdj, lenderFee, compCap`.
