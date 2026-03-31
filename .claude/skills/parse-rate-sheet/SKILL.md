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
4. Write to DB using `writeRatesToDB()` — auto-creates products + inserts prices in one step
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
| XLSX with "Conv LLPA" and "Conventional and Government" sheets | Windsor | `src/lib/rates/parsers/windsor.js` | XLSX |
| XLSX with "WS DU & LP Pricing" sheet | Rocket Pro TPO | No dedicated parser yet | XLSX |

File ID prefixes from the download system:
- `96573` = EverStream rates CSV
- `96596` = EverStream LLPAs XLSX
- `61534` = TLS CSV
- `80220` = Keystone XLSX
- `99522` = SWMC XLSX
- `47006` = AmWest XLSX
- `65196` = Windsor XLSX

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

## Database Pipeline (PRIMARY — replaces JSON file)

Rate data now flows to the database, not a JSON file. The pricing engine reads from DB.

### Architecture

```
Rate Sheet File → Parser → DB Writer → rate_prices table → Pricing API → Website
                                     → rate_sheets table (parse event log)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/rates/db-writer.js` | Takes parser output, matches to rate_products, writes to rate_sheets + rate_prices |
| `src/lib/rates/db-loader.js` | Loads rate data from DB in the shape the pricing engine expects |
| `scripts/populate-products.js` | DEPRECATED — db-writer.js now auto-upserts products |
| `scripts/migrate-to-pc-db.js` | Data migration script (CRM + rate data) |

### Database Tables

| Table | Purpose | Changes |
|-------|---------|---------|
| `rate_lenders` | Lender metadata, fees, comp caps | Rarely |
| `rate_products` | Product taxonomy — maps raw names to queryable fields | Rarely (when new products appear) |
| `rate_sheets` | One row per parse event — lender, date, file, row count | Daily |
| `rate_prices` | Individual rate/price rows — rate, price, lock_days, linked to product + sheet | Daily |
| `lender_adjustments` | SRP, LLPA grids, loan amt adj as JSONB | Rarely (on lender bulletin) |
| `broker_config` | David's comp caps, business settings (singleton) | Rarely |
| `fee_templates` | Per-state fee estimates (HUD sections A-H) | Rarely |

### How to Write Rates to DB

```javascript
const { writeRatesToDB } = require('./src/lib/rates/db-writer');
const { parseRates } = require('./src/lib/rates/parsers/everstream');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const { sheetDate, programs } = parseRates(csvContent);
const result = await writeRatesToDB('everstream', programs, sheetDate, csvPath);
// result: { sheetId, pricesInserted, productsMatched, productsUnmatched }
```

### Sheet Deactivation Rule

**One active sheet per lender at any time.**

When `writeRatesToDB` runs:
1. BEGIN transaction
2. Set all existing active sheets for this lender to `status = 'superseded'`
3. Delete rate_prices for superseded sheets (keep DB clean)
4. Insert new sheet as `status = 'active'`
5. Insert new rate_prices
6. COMMIT

If anything fails, ROLLBACK — DB stays unchanged. No partial states.

### State-Specific Product Dedup

EverStream CSV has state-specific variants (e.g., "FNMA 25/30Yr Fixed FL > 400K Core" for Florida). The parser strips the state prefix, causing these to map to the same product as the base variant. The DB writer inserts duplicates.

**Current fix:** After parsing, deduplicate rate_prices — keep first inserted row per (product_id, rate, lock_days). The first row is the base product (no state prefix), which is correct for non-FL/TX states.

**Future fix:** Create separate rate_products entries for state-specific variants and filter by borrower's state in the pricing engine.

### Product Matching

The DB writer matches parsed programs to `rate_products` rows by `raw_name`. The raw_name format is:
- `"FNMA 30yr Fixed Core"` (no loan amount range)
- `"FNMA 30yr Fixed Core [375000-400000]"` (with range)

New products are auto-created by `writeRatesToDB()`. No separate step needed — the writer upserts `rate_products` before inserting prices. The return value includes `productsCreated` count.

### Static Adjustments (LenderAdjustment)

LLPAs, SRP tables, loan amount adjustments, and lender-specific adjustments are stored as JSONB in `lender_adjustments`. These rarely change — update when the lender sends a bulletin.

Complete static configs are also stored as JSON files in `src/data/lender-llpas/` for reference:
- `everstream-complete.json` (2.5 MB, 19 sheets)
- `keystone-complete.json`, `amwest-complete.json`, `windsor-complete.json`, `swmc-complete.json`
- TLS uses GSE defaults (no separate LLPA sheet)

### Connection

Database: `netrate_pc` on Neon (same project as old `neondb`).
Env var: `PC_DATABASE_URL` (pooled) / `PC_DIRECT_URL` (direct).

## Legacy: parsed-rates.json (DEPRECATED)

The old `src/data/parsed-rates.json` file is still present as a fallback but is no longer the primary data source. The pricing API reads from the database first.

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

## LOAN PRICING RULES — ABSOLUTE, NO EXCEPTIONS

```
Step 1: Start with FinalBasePrice from CSV (e.g., 98.6732)
Step 2: Add credits (SRP, loan amt credit, risk-based credit)
Step 3: Subtract costs (FICO/LTV hit, FNMA/FHLMC hit)
Step 4: Subtract broker comp (always last adjustment)
Step 5: Read the final number

FINAL PRICE > 100 → REBATE → borrower RECEIVES money → green ($X)
FINAL PRICE < 100 → DISCOUNT → borrower PAYS money → red $X
FINAL PRICE = 100 → PAR → no cost, no credit

Dollar amount = |final price - 100| × loan amount / 100

NEVER determine credit vs charge until AFTER comp is subtracted.
NEVER call a discount a credit. Below par = CHARGE. ALWAYS.
```

### Adjustment Order

| Order | Adjustment | Source | Direction |
|-------|-----------|--------|-----------|
| 1 | FICO/LTV LLPA | Parsed rate sheet LLPA grids | Cost = subtract from base |
| 2 | SRP (Servicing Released Premium) | Core Conv SRP tab in LLPA XLSX | Credit = add to base |
| 3 | Risk-Based Price Adjustment | Core Conv LLPAs tab, Risk Based section | Credit = add to base |
| 4 | Loan Amount Adjustment | Core Conv LLPAs tab | Credit = add to base |
| 5 | Investor-specific (FNMA/FHLMC) | Core Conv LLPAs tab, FNMA/FHLMC Only sections | Cost = subtract from base |
| 6 | Broker comp | BrokerConfig in DB | Cost = subtract (always last) |

### Display Convention (Borrower-Facing)

- REBATE (above par after all adjustments) → green text, parentheses: ($2,525)
- DISCOUNT (below par after all adjustments) → red text, no parentheses: $1,832

### Comparing to LoanSifter

LoanSifter's displayed price already has comp deducted. To compare:
- Our: base + credits - costs - comp = final price
- LS: shows final price (comp already deducted)
- These should match

### EverStream FNMA vs FHLMC Adjustments (from Core Conv LLPAs tab)

| Investor | 21-30yr | 20/15/10yr | ARMs |
|----------|---------|------------|------|
| FNMA | -0.220 | -0.140 | -0.220 |
| FHLMC | -0.150 | 0 | -0.150 |

These are costs — subtract from base.

### Example: FNMA Core 30yr Fixed > $400K, 6.124%, $450K loan, Refi, CO, 780 FICO, 75% LTV

| Step | Adjustment | Value | Running Total |
|------|-----------|-------|--------------|
| Base | CSV FinalBasePrice | | 98.6732 |
| 1 | FICO/LTV refi (780, 70.01-75%) | -0.125 | 98.5482 |
| 2 | SRP (CO, Fixed 20/25/30yr, Impounds) | +1.830 | 100.3782 |
| 3 | Risk-Based (780-799, 70.01-75%) | +0.050 | 100.4282 |
| 4 | Loan Amt (>400K<=500K) | +0.030 | 100.4582 |
| 5 | FNMA 21-30yr | -0.220 | 100.2382 |
| 6 | Broker comp ($3,595 / $450K = 0.799%) | -0.799 | 99.4392 |
| | **Final price** | | **99.439** |

99.439 < 100 → DISCOUNT → borrower PAYS: 0.561% = $2,525. Matches LoanSifter exactly.

## Validation

After parsing, validate the output:
- Rates should be between 3.0% and 12.0%
- Prices should be between 90.0 and 108.0
- Each lender should have at least 5 programs
- 30yr conventional should exist for every lender
- Date should be today or very recent

If validation fails, warn but still save — partial data is better than no data.

## After Parsing

1. Write to DB using `writeRatesToDB(lenderCode, programs, sheetDate, sourceFile)`
2. Report summary: lender, products matched/unmatched, prices inserted, date
3. New products are auto-created — check `productsCreated` in the result
4. Verify on website: check /rates page shows updated rates for this lender
5. Log via `capture_thought` if anything unusual happened (new products, format changes)

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

**All 6 core parsers are complete** and output the standard format. Summary:

| Lender | LLPA Source | Sign Convention | Fee | Comp Cap (P/R) |
|--------|------------|-----------------|-----|----------------|
| Keystone | Parser (FICO/LTV grids + spec payups) | Negate (sheet neg=cost) | $1,125 | $3,595/$3,595 |
| AmWest | Parser (FT + Agency grids, Gov FICO, Jumbo) | None (sheet pos=cost) | $1,295 | $4,595/$3,595 |
| Windsor | Parser (Conv + Gov + Jumbo 4 grids) | Negate (sheet neg=cost) | $1,295 | $4,595/$3,595 |
| SWMC | Parser (Agency grids, Gov FICO/state) | None (sheet pos=cost) | $1,195 | $4,595/$3,595 |
| EverStream | Parser (19 LLPA sheets converted) | Negate (sheet neg=cost) | $999 | $4,595/$3,595 |
| TLS | GSE defaults (no LLPA sheets) | N/A | $1,281 | $4,595/$3,595 |

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
