# Rate Sheet Parser Rewrite — Task Templates

## Context

Keystone parser has been rewritten as the template. It now captures ALL adjustment sections from the rate sheet (LLPAs, loan amt adj, state adj, spec payups, pricing specials, occupancy adj, comp cap, lender fee). The pricing engine uses these lender-specific adjustments instead of GSE defaults.

**Verified:** Keystone 6.250% at Purchase/75%LTV/760FICO/$400K/CO matches OC exactly ($1,708 credit).

Each remaining parser needs the same treatment. Use Keystone as the model.

**Output format** — each parser should return these fields alongside `programs`:
```json
{
  "llpas": { "purchase": {}, "refinance": {}, "cashout": {}, "ltvBands": [] },
  "loanAmountAdj": [{ "min": 0, "max": 0, "adj30yr": 0, "adj15yr": 0 }],
  "stateAdj": { "CO": { "adj30yr": 0.05, "adj15yr": 0.05 } },
  "specPayups": { "conv30": { "loanAmtBuckets": [], "byRate": {} } },
  "pricingSpecials": {},
  "occupancyAdj": { "secondHome": [], "investment": [], "ltvBands": [] },
  "lenderFee": 1295,
  "compCap": { "purchase": 3595, "refinance": 3595 }
}
```

**LLPA sign convention:** Pricing engine expects positive = cost. Some lenders store LLPAs as negative (cost). Negate if needed (see Keystone's `parseLlpa` function).

**Verification:** After updating each parser, run the same scenario through the pricing API:
```
POST /api/pricing
{ loanAmount: 400000, loanPurpose: "purchase", loanType: "conventional",
  creditScore: 760, propertyValue: 533333, term: 30, productType: "fixed",
  lockDays: 30, state: "CO" }
```
Compare the lender's output against OC.

---

## Task 1: AmWest Parser

**File:** `src/lib/rates/parsers/amwest.js`
**Input:** XLSX with 12 sheets
**Rate sheets:** `C:/Users/bickl/Downloads/47006_03242026_1053016301.xlsx`

### Adjustment sections to parse:

**Sheet: FT_LLPAS (Fast Track LLPAs)**
- Row 14: "FAST TRACK LLPA's (FFT & FMFT)"
- Row 16: Purchase (terms > 15yr) — FICO/LTV grid at row 17
- Row 28: "Purchase Loan Additional" — Condo, Second Home adj
- Row 37: Refi FICO/LTV grid
- Row 51: Refi Condo adj
- Row 57: Cashout FICO/LTV grid
- Row 71: Cashout Condo adj
- Row 28 col 13: "OTHER PRICE ADJUSTMENTS"
- Row 38 col 13: "State Adjuster (FIXED Program)"
- Row 47 col 13: "LLPA WAIVER"
- Row 56 col 13: "Cumulative LLPA Caps"
- Row 74 col 13: "MAX LOAN AMOUNT"
- Row 77: LPMI adjustments
- Row 106: "Lender Fees: CONVENTIONAL $1,295"

**Sheet: LLPAS (Standard/Agency LLPAs)**
- Row 14: "AGENCY LLPAs (DU/LP) - FIXED & ARM"
- Row 16: Purchase FICO/LTV grid at row 17
- Row 28: Purchase Loan Additional — Condo, Second Home
- Row 16 col 13: "NOO Additional Adjustments (30YR FIXED ONLY)"
- Row 24 col 13: "2nd Home Additional Adjustments (30YR FIXED ONLY)"
- Row 39 col 13: "OTHER PRICE ADJUSTMENTS"
- Row 49 col 13: "State Adjuster (FIXED Program)"
- Row 53 col 13: "LLPA WAIVER"
- Row 63 col 13: "Cumulative LLPA Caps"
- Row 86 col 13: "MAX LOAN AMOUNT"
- Row 87: LPMI adjustments

**Sheet: GOV**
- Row 76: "PRICE ADJUSTMENTS"
- Row 79: "GOVERNMENT PRICE ADJUSTMENTS" + "FICO ADJUSTMENTS"
- Row 82: "Note Loan Amount<=$99,999 (FHA/VA/USDA)"
- Row 83: "Note Loan Amount $100k to $149,999"
- Row 85: "VA IRRRL LTV >90.00%"
- Row 96: "State Adjuster for Govt - FIXED"
- Row 121: "Lender Fees: VA, FHA & USDA $1,295"

**Sheet: JUMBO**
- Row 42: FICO/LTV grids
- Row 50: Occupancy adjustments
- Row 66: "LOAN AMOUNT ADJUSTERS"
- Row 89: "Lender Fees: JUMBO $1,395"

**Sheet: CONV**
- Row 142: "Lender Fees: CONVENTIONAL $1,295"

**Existing data:** `src/data/lender-llpas/amwest.json` has pre-extracted FICO/LTV grids. Merge or replace with parser output.

**LenderFee:** $1,295 (Conv/Gov), $1,395 (Jumbo)
**CompCap:** TBD — check OC

### parse-gcs-rates.mjs update needed:
Line 222 only passes `programs`. Add all new fields.

---

## Task 2: Windsor Parser

**File:** `src/lib/rates/parsers/windsor.js`
**Input:** XLSX with 16 sheets
**Rate sheets:** `C:/Users/bickl/Downloads/65196_03242026_1115254063.xlsx`

### Adjustment sections to parse:

**Sheet: Conv LLPA**
- Row 14: "Conventional LLPAs"
- Row 16: Purchase FICO (Terms > 15yr) — grid
- Row 30: Non Cashout Refinance FICO — grid
- Row 44: Cash Out Refinance — grid
- Row 58: "Purchase - LLPAs by Product Feature" (Condo, Investment, Second Home, Manufactured)
- Row 72: "Non Cashout Refinance - LLPAs by Product Feature"
- Row 86: "Cashout Refinance - LLPAs by Product Feature"
- Row 100: "Other Adjustments (Excluded from cap)" — 90 day locks, extension fees
- Row 101 col 11: "LLPA Caps"
- Row 105: "Lender Administration Fee"
- Row 109: "Conventional State Tier (Excluded from cap)"
- Row 110 col 9: "Conforming Conventional Special ($350K+ - 680 FICO)"

**Sheet: Gov LLPA**
- Row 14: "Government LLPAs"
- Row 16: "Government FICO Adjustments" — grid
- Row 30: "VA Price Adjustments" + "FHA Price Adjustments"
- Row 39 col 7: "USDA Price Adjustments"
- Row 42: "VA IRRRL Investment Property and Second Home"
- Row 47-49: FICO tiers for FHA/VA
- Row 51: "State Adjuster"
- Row 58: "Other Adjustments"
- Row 64: "Manufactured Home"
- Row 65: "Lender Administration Fee"

**Sheet: Jumbo 4 LLPA**
- Has its own LLPA grids (separate from conventional)

**Sheet: Conventional and Government (main)**
- Row 181 col 15: "30/25 Year Fixed >$350K Investment" — occupancy/loan amt adj
- Row 204: "30/25 Year Fixed >$350K Second Home"

**LenderFee:** On "Lender Administration Fee" row — extract from sheet
**CompCap:** TBD — check OC

### parse-gcs-rates.mjs update needed:
Line 257 only passes `programs`. Add all new fields.

---

## Task 3: SWMC Parser

**File:** `src/lib/rates/parsers/swmc.js`
**Input:** XLSX with 1 sheet (RATESHEET, 4400+ rows)
**Rate sheets:** `C:/Users/bickl/Downloads/99522_03242026_1226449040.xlsx`

### Adjustment sections to parse:

**Rows 8-26: Header/Fees/Promos**
- Row 8 col 14: "Attorney Fee for Texas loans: Purchase"
- Row 9 col 14: "Attorney Fee for Texas loans: Refinance"
- Row 18: "UW Fee Charged to Borrower"
- Row 18 col 9: "MARCH WHOLESALE PROMO: 25 bps on all Conv..."
- Row 22 col 9: "FHA & USDA MARCH SPECIAL: 35 bps..."
- Row 24: "UW Fee-In" option
- Row 26: "UW Fee is $795 for Full Docs / $425 for Streamlines"

**Row 896+: GOVERNMENT PROGRAM PRICE ADJUSTMENTS**
- Row 899-903: FICO adjustments (>=700, 680-699, 640-659, 620-639, <620)
- Row 900 col 17: Condo adjustment
- Row 901 col 9: Manufactured Home adjustment

**Rows 1316+: Convention LLPA area (historically)**
- Scan this area for FICO/LTV grids

**Existing data:** `src/data/lender-llpas/swmc.json` has pre-extracted grids. Merge or replace.

**LenderFee:** Multiple: $795 (Full Doc), $425 (Streamlines), $1,195 (standard), $1,695 (NQM)
**CompCap:** TBD — check OC

### parse-gcs-rates.mjs update needed:
Line 212 only passes `programs`. Add all new fields.

---

## Task 4: EverStream Parser

**File:** `src/lib/rates/parsers/everstream.js`
**Input:** CSV (rates) + XLSX (19 LLPA sheets)
**Rate sheets:** CSV: `96573_03242026_0951174477.csv`, XLSX: `96596_03242026_0951183710.xlsx`

### Current state:
- Already parses 19 LLPA sheets from XLSX
- Already has `src/data/lender-llpas/everstream.json`
- LLPAs are loaded by pricing engine via `lender-llpas/index.js`

### Missing sections (check XLSX sheets):
- Loan amount adjustments (may be in LLPA sheets)
- State adjustments
- Spec payups
- Property type adjustments (condo, manufactured)
- Occupancy adjustments
- Comp cap
- Lender fee ($999 hardcoded in pricing.js)

### Key question:
EverStream's LLPA XLSX has 19 sheets. Some may contain loan amt/state/occupancy adjustments beyond the FICO/LTV grids. Audit each sheet's full content.

### parse-gcs-rates.mjs update:
Lines 242-246 pass `llpas` but not other fields. Add all new fields.

---

## Task 5: TLS Parser

**File:** `src/lib/rates/parsers/tls.js`
**Input:** Single CSV file
**Rate sheets:** `96573_03242026_0951174477.csv`

### Special case:
TLS is a flat CSV — no adjustment sections in the file. LLPAs are tier-encoded in product codes (different products for different tiers). No XLSX companion file.

### Options:
1. Check if TLS provides a separate LLPA document (PDF or XLSX not in GCS)
2. Use GSE defaults (current behavior) — may be accurate enough for TLS
3. Add TLS to `lender-llpas/` manually if we can get their LLPA grid

### Minimum updates:
- Add `lenderFee: 1281` to parser output (currently hardcoded in pricing.js)
- Add `compCap` from OC
- Pass new fields through in `parse-gcs-rates.mjs` (line 181)

---

## Task 6: Update parse-gcs-rates.mjs

The GCS parse script needs to pass all new fields for every lender. Currently only Keystone does this. Each lender's parse function should return and pass through:
```
llpas, loanAmountAdj, stateAdj, specPayups, pricingSpecials, occupancyAdj, lenderFee, compCap
```

Also update the `combined` object writer (line 320-334) to include all fields, not just `programs` and `llpas`.

---

## Execution order

1. **AmWest** — most adjustment data available (12 sheets with explicit LLPA grids)
2. **Windsor** — 16 sheets with Conv LLPA + Gov LLPA
3. **SWMC** — single sheet but has gov adjustments + FICO grids
4. **EverStream** — already has LLPAs, just needs loan amt/state/comp
5. **TLS** — CSV only, least data to add

Each task: update parser → re-parse sheet → update parsed-rates.json → verify against OC → commit.
