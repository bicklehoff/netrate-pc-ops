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
2. Identify the lender (see table below)
3. **Read the per-lender reference file** in `lenders/` for that lender's format, quirks, and sign convention
4. Run the scanning script to map all adjustment sections
5. Parse using the appropriate parser
6. Write to DB using `writeRatesToDB()`
7. Report what worked and what failed — fix any parser errors

## Lender Identification

| Signal | Lender | Parser | File |
|--------|--------|--------|------|
| CSV with `FinalBasePrice` column header | EverStream | `parsers/everstream.js` | CSV (+XLSX LLPAs) |
| CSV with product codes like `FNMA Conforming 30 Yr Fixed Refinance` | TLS | `parsers/tls.js` | CSV |
| XLSX with single sheet, rate grid starting ~row 5 | Keystone | `parsers/keystone.js` | XLSX |
| XLSX with sheet named `RATESHEET` | SWMC | `parsers/swmc.js` | XLSX |
| XLSX with sheets `FT_LLPAS` or `LLPAS` | AmWest | `parsers/amwest.js` | XLSX |
| XLSX with `Conv LLPA` and `Conventional and Government` sheets | Windsor | `parsers/windsor.js` | XLSX |

File ID prefixes from GCS: `96573`=EverStream CSV, `96596`=EverStream XLSX, `61534`=TLS, `80220`=Keystone, `99522`=SWMC, `47006`=AmWest, `65196`=Windsor.

All parsers: `src/lib/rates/parsers/`. Exports: `{ parseRates, parse, lenderId }`.

## CRITICAL: Scan the ENTIRE Rate Sheet First

Rate sheets contain adjustment sections scattered throughout — not just rate grids. Missing them causes pricing errors of 0.5–1.0+ points. Run this before touching any parser:

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
      if (v.length < 5 && keywords.some(kw => v.toLowerCase().includes(kw)))
        console.log(sheetName, 'Row', r, 'Col', c, ':', v.substring(0, 80));
    }
  }
}
```

## Required Output Format

```javascript
{
  sheetDate: '2026-03-24',  // from filename or sheet
  programs: [...],           // rate grids

  llpas: {                   // FICO/LTV matrices — positive = cost (engine convention)
    purchase: { ">=780": [0, 0, ...], "760-779": [...], ... },
    refinance: { ... },
    cashout: { ... },
    ltvBands: ["<=30", "30.01-60", "60.01-70", "70.01-75", "75.01-80", ...]
  },
  loanAmountAdj: [{ min: 75000, max: 99999, adj30yr: -0.5, adj15yr: -0.5 }],
  stateAdj: { "CO": { adj30yr: 0.05, adj15yr: 0.05 } },
  specPayups: { conv30: { loanAmtBuckets: [], byRate: {} } },
  pricingSpecials: {},
  occupancyAdj: { secondHome: [], investment: [], ltvBands: [] },
  lenderFee: 1125,           // from sheet, NOT hardcoded
  compCap: { purchase: 3595, refinance: 3595 },
}
```

**LLPA sign convention (engine-side):** `positive = cost to borrower`. If a lender's sheet stores LLPAs as negative (cost), **negate** in the parser. Check the per-lender file for each lender's convention.

**FICO key format:** Must match `getFicoBand()` output: `">=780"`, `"760-779"`, `"740-759"`, etc. Normalize spaces. Special: `"<=639 or NTC"` → parse as `{ ficoMin: 0, ficoMax: 639 }`.

## Database Pipeline

### Architecture

```
Rate Sheet → Parser → writeRatesToDB() → rate_products (upsert) → rate_sheets (log) → rate_prices
                                       → adjustment_rules (seeded separately via seed-adjustment-rules.mjs)
```

### How to Write Rate Prices to DB

```javascript
require('dotenv').config();
const { writeRatesToDB } = require('./src/lib/rates/db-writer');
const { parseRates } = require('./src/lib/rates/parsers/swmc');

const buf = fs.readFileSync('./sheet.xlsx');
const result = parseRates(buf);
// Filter to agency only if needed: result.programs.filter(p => ['fha','va','conventional'].includes(p.loanType))
await writeRatesToDB('swmc', result.programs, result.sheetDate, 'sheet.xlsx');
```

### Sheet Deactivation Rule

One active sheet per lender. When `writeRatesToDB` runs: supersede existing active sheet → delete its prices → insert new sheet + prices. Transactional — rollback on any failure.

### Adjustment Rules (separate step)

Static adjustments (FICO/LTV grids, gov adj, promos) are seeded separately:

```bash
node scripts/seed-adjustment-rules.mjs --lender swmc --force
node scripts/seed-adjustment-rules.mjs --lender swmc --dry-run   # preview
```

Skip `--force` to protect existing data (only re-seed on new rate sheet day). Per-lender JSON files live in `src/data/lender-adjustments/{lender}/`. Each lender has a `conv-llpa.json`, `gov-adj.json`, `lender-config.json`.

### Tables

| Table | Purpose |
|-------|---------|
| `rate_lenders` | Lender metadata, fees, comp caps |
| `rate_products` | Product taxonomy (raw name → queryable fields). Auto-upserted by db-writer. |
| `rate_sheets` | One row per parse event |
| `rate_prices` | Rate/price rows per product+sheet |
| `adjustment_rules` | FICO/LTV grids, gov adj, promos — seeded via seed script |

## Pricing Math — ABSOLUTE RULES

```
Step 1: Base price from rate_prices (FinalBasePrice or sheet equivalent)
Step 2: Add credits (SRP, loan amt, risk-based)
Step 3: Subtract costs (FICO/LTV LLPA, investor adj)
Step 4: Apply product feature adj (gov FICO, state, promo credits)
Step 5: Subtract broker comp (ALWAYS last)

FINAL PRICE > 100 → REBATE → borrower receives money
FINAL PRICE < 100 → DISCOUNT → borrower pays
Dollar = |final - 100| × loanAmount / 100
```

**Adjustment order in pricing-v2.js:**

| Step | Type | Direction | Notes |
|------|------|-----------|-------|
| 2 | FICO/LTV LLPA | cost = subtract | `price -= ficoLtvCost` for conv; `price += val` for FHA |
| 3 | SRP | credit = add | |
| 4 | Risk-based | credit = add | Core conv only |
| 5 | Loan amount | credit = add | |
| 5a | Product loan amount | varies | Per-product |
| 5b | Purchase credit | credit = add | `price += pf.value` |
| 5c | Product features | `price += pf.value` | gov FICO adj, state, promos |
| 6 | Investor (FNMA/FHLMC) | cost = subtract | `price -= investorCost` |
| 7 | Broker comp | cost = subtract | Always last |

**productFeature sign rule:** `price += pf.value`. Positive = credit (improves price). Negative = cost (reduces price). If a lender's gov adj is negative=cost in the sheet, negate before storing.

### Verified Example (EverStream, FNMA Core 30yr, 6.124%, $450K, Refi, CO, 780 FICO, 75% LTV)

| Step | Value | Running |
|------|-------|---------|
| Base | | 98.6732 |
| FICO/LTV refi (780, 70.01-75%) | -0.125 | 98.5482 |
| SRP (CO, Fixed 30yr, Impounds) | +1.830 | 100.3782 |
| Risk-based (780-799, 70.01-75%) | +0.050 | 100.4282 |
| Loan amt (>400K<=500K) | +0.030 | 100.4582 |
| FNMA 21-30yr | -0.220 | 100.2382 |
| Broker comp ($3,595/$450K) | -0.799 | 99.439 |

99.439 < 100 → DISCOUNT → borrower pays $2,525. Matches LoanSifter exactly.

## Validation

- Rates: 3.0%–12.0%
- Prices: 90.0–108.0
- Minimum 5 programs per lender
- 30yr conventional must exist
- Sheet date: today or recent

Warn on failure but still save — partial data beats no data.

## After Parsing

1. `writeRatesToDB(lenderCode, programs, sheetDate, sourceFile)`
2. If LLPA data changed, update `src/data/lender-adjustments/{lender}/` and re-seed
3. Report: products matched/unmatched/created, prices inserted, date
4. Verify via `/api/pricing` against OC (see per-lender file for expected values)
5. `capture_thought` if anything unusual happened

## Building a New Parser

1. Run scanning script → map every section
2. Create `src/lib/rates/parsers/{lenderId}.js` following Keystone as template
3. Dynamic header search (find rows by text, not hardcoded offsets)
4. Export `{ parseRates, parse, lenderId }`
5. Return all required output fields
6. Update `scripts/parse-gcs-rates.mjs` to pass all new fields
7. Create `src/data/lender-adjustments/{lenderId}/` with JSON files
8. Add seed functions to `scripts/seed-adjustment-rules.mjs`
9. Create `lenders/{lenderId}.md` in this skill directory
10. Verify against OC

## Per-Lender Reference Files

For format details, section maps, sign conventions, and adjustment seeding status, read `lenders/{lenderId}.md` before working on that lender.
