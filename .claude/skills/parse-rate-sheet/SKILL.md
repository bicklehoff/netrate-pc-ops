---
name: parse-rate-sheet
description: "Parse mortgage wholesale rate sheet files (CSV, XLSX, XLSM) into structured JSON for the pricing engine. Use this skill whenever the user drops a rate sheet file, says 'parse rate sheet', 'update rates', 'new rate sheets', 'parse this', or mentions rate sheet files by name or lender. Also trigger when rate sheet parsing fails and needs debugging or when a lender's format has changed."
---

# Rate Sheet Parser

Parse raw wholesale mortgage rate sheet files into structured JSON that the pricing engine consumes. Supports multiple lenders with auto-detection and self-healing when formats change.

## Working Directory

`D:\PROJECTS\netrate-pc-ops`

## Quick Start

When given a rate sheet file (or a zip containing multiple):

1. Extract if zip
2. For each file, identify the lender
3. Parse using the appropriate parser
4. Merge all results into `src/data/parsed-rates.json`
5. Report what worked and what failed
6. If a parser failed, debug and fix it

## Lender Identification

Inspect file content to determine the lender. Check in this order:

| Signal | Lender | Parser | File Type |
|--------|--------|--------|-----------|
| CSV with `FinalBasePrice` column header | EverStream (rates) | `src/lib/rates/parsers/everstream.js` | CSV |
| XLSX with 19 LLPA sheets including "Elite FNMA LLPA" | EverStream (LLPAs) | Same parser, `parseLLPAs()` | XLSX |
| CSV with product codes like `FNMA Conforming 30 Yr Fixed Refinance` | TLS (The Loan Store) | `src/lib/rates/parsers/tls.js` | CSV |
| XLSX with single sheet, rate grid starting ~row 5 | Keystone | `src/lib/rates/parsers/keystone.js` | XLSX |
| XLSX with sheet named "RATESHEET" | SWMC (Sun West) | `src/lib/rates/parsers/swmc.js` | XLSX |
| XLSX with sheets "FT_LLPAS" or "LLPAS" | AmWest | `src/lib/rates/parsers/amwest.js` | XLSX |
| XLSX with "WS DU & LP Pricing" sheet | Rocket Pro TPO | No dedicated parser yet | XLSX |

File ID prefixes from the download system:
- `96573` = EverStream rates CSV
- `96596` = EverStream LLPAs XLSX
- `61534` = TLS CSV
- `80220` = Keystone XLSX
- `99522` = SWMC XLSX
- `47006` = AmWest XLSX

## CRITICAL: Read the ENTIRE Rate Sheet

**Every line matters.** Rate sheets contain adjustment sections (LLPAs, loan amount adj, state adj, spec payups) scattered throughout the file — not just rate grids. Missing these adjustments causes pricing errors of 0.5-1.0+ points.

**Before writing or updating ANY parser, complete this checklist:**

1. List ALL sheets in the workbook
2. Scan EVERY row in EVERY sheet for section headers containing: `LLPA`, `adjustment`, `payup`, `spec`, `state`, `loan amount`, `FICO`, `LTV`, `compensation`, `fee`, `special`, `occupancy`, `second home`, `investment`, `purchase`, `refinance`, `cashout`, `property type`, `condo`, `manufactured`
3. Document what you find (sheet, row, column, content)
4. Map each section to the parser output format below

**Use this scanning script:**
```javascript
const XLSX = require('xlsx');
const wb = XLSX.readFile(filePath);
const keywords = ['llpa','adjustment','payup','spec','state','loan amount','fico','ltv',
  'compensation','fee','special','occupancy','second home','investment','purchase',
  'refinance','cashout','property type','condo','manufactured'];
for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 0; r <= range.e.r; r++) {
    for (let c = 0; c <= Math.min(range.e.c, 20); c++) {
      const cell = ws[XLSX.utils.encode_cell({r,c})];
      if (!cell) continue;
      const v = String(cell.v).trim();
      if (v.length < 5) continue;
      if (keywords.some(kw => v.toLowerCase().includes(kw))) {
        console.log(sheetName, 'Row', r, 'Col', c, ':', v.substring(0, 80));
      }
    }
  }
}
```

## Parser API

Each parser in `src/lib/rates/parsers/` exports:

```javascript
module.exports = { parseRates, parse, lenderId };
```

**XLSX parsers** take a Buffer: `parseRates(xlsxBuffer)`.
**CSV parsers** take a string: `parseRates(csvContent)`.

Read the parser source to confirm the API before calling.

## Required Output Format

Each parser MUST return ALL of these fields:

```javascript
{
  sheetDate: '2026-03-24',  // from filename or sheet
  programs: [...],           // rate grids (existing)

  // --- NEW: Adjustment data (the heart of accurate pricing) ---
  llpas: {                   // FICO/LTV matrices — positive = cost (GSE convention)
    purchase: { ">=780": [0, 0, ...], "760-779": [...], ... },
    refinance: { ... },
    cashout: { ... },
    ltvBands: ["<=30", "30.01-60", "60.01-70", "70.01-75", "75.01-80", ...]
  },
  loanAmountAdj: [           // per-term loan amount tiers
    { min: 75000, max: 99999, adj30yr: -0.5, adj15yr: -0.5 },
    { min: 400000, max: 548250, adj30yr: 0.075, adj15yr: 0.075 },
  ],
  stateAdj: {                // per-state, per-term
    "CO": { adj30yr: 0.05, adj15yr: 0.05 },
    "CA": { adj30yr: -0.15, adj15yr: -0.125 },
  },
  specPayups: {              // rate x loan amount matrix
    conv30: {
      loanAmtBuckets: [{ min: 475001, max: 500000 }, ...],
      byRate: { "6.25": [0.03, 0.505, ...], ... }
    }
  },
  pricingSpecials: {         // temporary promos
    purchaseSpecial: [...],
    refinanceSpecial: [...],
  },
  occupancyAdj: {            // second home / investment LTV adjustments
    secondHome: [0, 0.45, 0.55, 0.75, ...],
    investment: [0, 0.25, 0.45, 0.6, ...],
    ltvBands: ["0-60", "60.01-70", ...]
  },
  lenderFee: 1125,           // from sheet, NOT hardcoded
  compCap: {                 // from OC or sheet
    purchase: 3595,
    refinance: 3595
  },
}
```

**LLPA sign convention:** The pricing engine expects **positive = cost to borrower**. If the rate sheet stores LLPAs as negative numbers (e.g., Keystone: -0.250 = cost), **negate them** in the parser. See Keystone's `parseLlpa()` function for the pattern.

**FICO key format:** Must match the engine's `getFicoBand()` output: `">=780"`, `"760-779"`, `"740-759"`, etc. Normalize spaces: `"720 - 739"` → `"720-739"`.

## Merge Into parsed-rates.json

Write merged results to `src/data/parsed-rates.json`:

```json
{
  "lenders": [
    {
      "lenderId": "keystone",
      "sheetDate": "2026-03-24",
      "programs": [...],
      "llpas": {...},
      "loanAmountAdj": [...],
      "stateAdj": {...},
      "specPayups": {...},
      "pricingSpecials": {...},
      "occupancyAdj": {...},
      "lenderFee": 1125,
      "compCap": {...}
    }
  ],
  "date": "2026-03-24",
  "generatedAt": "2026-03-24T16:00:00.000Z"
}
```

**All fields must be present** for each lender. Use `null` if a section doesn't exist in the rate sheet.

## When a Parser Fails

This is the most important part. When a parser throws an error:

1. **Read the parser source** — understand what it expects (sheet names, column positions, row offsets)
2. **Inspect the actual file** — use the xlsx npm package to dump sheet names, headers, and first few rows:
   ```javascript
   const XLSX = require('xlsx');
   const wb = XLSX.readFile(filePath);
   console.log('Sheets:', wb.SheetNames);
   const ws = wb.Sheets[wb.SheetNames[0]];
   const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
   // Print first 10 rows to see structure
   ```
3. **Compare expected vs actual** — the format may have shifted (new columns, moved rows, renamed sheets)
4. **Fix the parser** — update the parser code to handle the new format while maintaining backward compatibility
5. **Test the fix** — reparse and verify the output looks reasonable (rates between 4-8%, prices between 95-105)
6. **Log what changed** — use `mcp__netrate-context__capture_thought` to record what broke and how you fixed it:
   ```
   category: "pattern"
   source: "pc-dev"
   topics: ["rate-sheet-parser", lenderId]
   content: "Keystone rate sheet format changed: rate grid moved from row 5 to row 8. Updated parser offset."
   ```

## Validation

After parsing, validate the output:
- Rates should be between 3.0% and 12.0%
- Prices should be between 90.0 and 108.0
- Each lender should have at least 5 programs
- 30yr conventional should exist for every lender
- Date should be today or very recent

If validation fails, warn but still save — partial data is better than no data.

## After Parsing

1. Commit `src/data/parsed-rates.json` with message: "Update parsed rates: [date] — [N] programs from [lenders]"
2. Push to trigger Vercel deploy (pricing engine uses this file as fallback)
3. Report summary: lender, program count, date, any failures

## Verification Against OC (Optimal Blue)

After updating any parser, verify the output matches OC. Run this scenario:

```
POST /api/pricing
{ loanAmount: 400000, loanPurpose: "purchase", loanType: "conventional",
  creditScore: 760, propertyValue: 533333, term: 30, productType: "fixed",
  lockDays: 30, state: "CO" }
```

For the lender you updated, check:
- `costBeforeFees` should match OC's "Discount/Rebate" column
- `llpaBreakdown` should show lender-specific values (not GSE defaults)
- `compDollars` should match OC's "LO Comp" column
- `lenderFee` should match OC's "Lender Fees" column

**Template parser (reference):** `src/lib/rates/parsers/keystone.js` — uses dynamic header search, extracts ALL sections, negates LLPAs to positive=cost convention.

**Task specs:** See `Work/Dev/PARSER-REWRITE-TASKS.md` for per-lender section maps with exact row locations.

## Building a New Parser

When you encounter a lender with no parser:

1. **Run the scanning script** (see "Read the ENTIRE Rate Sheet" above) — map every section
2. Create `src/lib/rates/parsers/[lenderId].js` following Keystone as the template
3. Use **dynamic header search** (find rows by text, not hardcoded row numbers) — sheets shift between reprices
4. Export `{ parseRates, parse, lenderId }`
5. Return ALL fields in the required output format (programs + adjustments)
6. Update `scripts/parse-gcs-rates.mjs` to pass all new fields through
7. Test against the sample file — verify rates 3-12%, prices 90-108
8. Verify against OC (see above)
9. Log the new parser via capture_thought
