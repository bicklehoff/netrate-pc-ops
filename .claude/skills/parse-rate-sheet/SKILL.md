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

## Parser API

Each parser in `src/lib/rates/parsers/` exports:

```javascript
module.exports = { parseRates, parseLLPAs, parse, lenderId };
```

**Important**: `parseRates()` takes file CONTENT (string), not a file path. For XLSX parsers, `parse()` takes a file PATH. Read the parser source to confirm the API before calling.

```javascript
const fs = require('fs');

// CSV parsers (EverStream, TLS):
const content = fs.readFileSync(filePath, 'utf8');
const result = parser.parseRates(content);
// Returns: { programs: [...], sheetDate: '2026-03-24' }

// XLSX parsers (Keystone, SWMC, AmWest):
const result = parser.parse(filePath);
// Returns: { programs: [...] } or { products: [...] }
```

Each program in the output has:
- `productName` — e.g., "FNMA 25/30yr Fixed"
- `loanType` — "conventional", "fha", "va", "usda", "jumbo", "dscr", "nonqm"
- `term` — 30, 25, 20, 15, 10
- `category` — "agency" or "nonqm"
- `rates` — array of `{ rate, price, lockDays }`

## Output Format

Write merged results to `src/data/parsed-rates.json`:

```json
{
  "products": [...all programs from all lenders...],
  "date": "2026-03-24",
  "lenderCount": 5,
  "lenders": ["everstream", "tls", "keystone", "swmc", "amwest"],
  "generatedAt": "2026-03-24T16:00:00.000Z"
}
```

Only include 30-day lock rates to keep file size under 1MB.

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

## Building a New Parser

When you encounter a lender with no parser:

1. Inspect the file structure thoroughly (all sheets, all columns, identify rate grids)
2. Create `src/lib/rates/parsers/[lenderId].js` following the pattern of existing parsers
3. Export `{ parseRates, parse, lenderId }`
4. Add to `src/lib/rates/parsers/index.js` registry
5. Test against the sample file
6. Log the new parser via capture_thought
