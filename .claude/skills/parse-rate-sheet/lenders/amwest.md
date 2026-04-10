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

18 products in DB after parser fix (was 13 with merged products before).
Last parse date: check `rate_sheets` table.

## Known Issues / Fixes

### Parser misclassification of FHA/Jumbo as Conventional (fixed 2026-04-10)

**Symptom:** Rate tool showing rates "too low for the pricing" for AmWest. The
Conv 30yr Fixed (fannie) curve had wild discontinuities (e.g. 5.875% → +1.08
when 5.750% was -1.67) and outlier rows at 4.750-5.125% that should never
have been there.

**Cause:** `parseAmwestCode` in `src/lib/rates/parsers/amwest.js` had a loose
regex `/30\s*YR|30\)/.test(rawCode)` for the conventional 30yr branch.
AmWest product codes have trailing "30 YR" / "30 YEAR" descriptors:
- `FCF30 30 YEAR` — real Fannie 30yr Fixed
- `FHA30  30 YR` — FHA 30yr (matched conv 30 due to "30 YR")
- `JEA30 30 YEAR` — Jumbo 30yr (matched conv 30 due to "30 YEAR")
- `VA30 30 YR` — VA 30yr (would have matched too)

The strict `/^FHA30$/` and `/^VA30$/` regexes failed to match the codes
because of the trailing text. So FHA, VA, and Jumbo products fell through
to the loose conventional branch and got merged into the same DB product
as the real Fannie row.

**Fix:** Restructured `parseAmwestCode` to dispatch on the FIRST whitespace-
delimited token. Each lender family (Jumbo JE, FHA, VA, USDA, Conv F*) is
checked against the first token only. Conv check requires the first token
to start with `F` (so FHA/FCF/FF/FM/FMFT all match conv except FHA which
is caught earlier). Order matters: Jumbo (JE) must come before Conv (F)
since neither is a substring of the other but JE codes don't start with F.

**Variant detection added:** RN (RefiNow), HO (HomeOne), HP (HomePossible)
in addition to existing RP (RefiPossible). These check both the first token
and the second token (e.g. `FCF30 RN 30 YEAR` → second token "RN").

**Verification:** After fix, parser produces 18 unique products (was 16
with collisions). Production `/api/pricing` for AmWest shows par at 6.375%
finalPrice 100.003 (was incorrectly showing par around 5.5-5.875%).

## parse-gcs-rates.mjs

Line 222 only passes `programs`. Add: `agencyLlpas, govAdj, jumboAdj, loanAmountAdj, stateAdj, lenderFee, compCap`.
