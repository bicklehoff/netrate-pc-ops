---
name: parse-rate-sheet
description: "Parse mortgage wholesale rate sheet files (CSV, XLSX, XLSM) into structured JSON for the pricing engine. Use this skill whenever the user drops a rate sheet file, says 'parse rate sheet', 'update rates', 'new rate sheets', 'parse this', or mentions rate sheet files by name or lender. Also trigger when rate sheet parsing fails and needs debugging or when a lender's format has changed."
---

# Rate Sheet Parser

Parse raw wholesale mortgage rate sheet files into structured JSON that the pricing engine consumes. Supports multiple lenders with auto-detection and self-healing when formats change.

## Working Directory

`D:\PROJECTS\netrate-pc-ops`

## HARD RULE: No Adjusters = No Parse

**If a rate sheet contains only rates and prices — no FICO/LTV LLPA grids, no loan-amount adjusters, no state/occupancy/purpose adjusters of any kind — STOP. Do not parse that lender.**

A rate sheet without published LLPAs cannot be priced accurately. Without the adjuster data, our engine applies zero adjustments and produces rebates that are consistently $500-$1500 too generous vs the lender's real pricing. We've verified this empirically with TLS (2026-04-10) — their CSV has 6 columns (product code, rate, 4 lock periods) and zero adjustment data. Reverse-engineering the grid from their broker portal works mathematically but the result is a fragile snapshot that goes stale silently when they update their LLPAs.

**What to do instead:**
1. Mark the lender as `excluded` in `rate_lenders.status` so they don't appear in pricing results
2. Delete any previously parsed rate_prices / rate_sheets / rate_products for them
3. Tell David: "This lender's rate sheet has no LLPA data. We can't price them accurately. Ask the AE for their LLPA matrix as a separate document, or exclude them from the site."
4. Once David gets a proper LLPA sheet from the AE, we can re-enable the lender

**TLS is currently excluded for this reason.** Remove from the lender identification table below if encountered.

## Quick Start

When given a rate sheet file (or a zip containing multiple):

1. Extract if zip
2. Identify the lender (see table below)
3. **Read the per-lender reference file** in `lenders/` for that lender's format, quirks, and sign convention
4. Run the scanning script to map all adjustment sections
5. **CHECK: Does the sheet have ANY adjuster data?** If no → STOP. See "HARD RULE" above.
6. Parse using the appropriate parser
7. **Verify lender DB config** — missing fields = silent pricing failures
8. Write to DB using `writeRatesToDB()`
9. Write adjustments via `writeAdjustmentsToDB()` if parser extracts them
10. Verify via `/api/pricing` — check finalPrice is near 100 for par rates
11. **Report results and issues** — update lender reference file

## Lender Identification

| Signal | Lender | Parser | File |
|--------|--------|--------|------|
| CSV with `FinalBasePrice` column header | EverStream | `parsers/everstream.js` | CSV (+XLSX LLPAs) |
| XLSX with single sheet, rate grid starting ~row 5 | Keystone | `parsers/keystone.js` | XLSX |
| XLSX with sheet named `RATESHEET` | SWMC | `parsers/swmc.js` | XLSX |
| XLSX with sheets `FT_LLPAS` or `LLPAS` | AmWest | `parsers/amwest.js` | XLSX |
| XLSX with `Conv LLPA` and `Conventional and Government` sheets | Windsor | `parsers/windsor.js` | XLSX |

**Excluded lenders (do not parse — no LLPA data):**
- **TLS** (file prefix `61534`) — CSV has only rate/price data, no adjusters. Marked `status='excluded'` in `rate_lenders`. Re-enable only if TLS provides an LLPA matrix as a separate document.

File ID prefixes from GCS: `96573`=EverStream CSV, `96596`=EverStream XLSX, `80220`=Keystone, `99522`=SWMC, `47006`=AmWest, `65196`=Windsor.

All parsers: `src/lib/rates/parsers/`. Exports: `{ parseRates, parse, lenderId }`.

## CRITICAL: Scan the ENTIRE Rate Sheet First

Rate sheets contain adjustment sections scattered throughout — not just rate grids. Missing them causes pricing errors of 0.5-1.0+ points. Run this before touching any parser:

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

**FICO key format:** Must match `getFicoBand()` output: `">=780"`, `"760-779"`, `"740-759"`, etc. Normalize spaces. Special: `"<=639 or NTC"` -> parse as `{ ficoMin: 0, ficoMax: 639 }`.

## Price Format — CRITICAL

Lenders use one of two price formats. The **pricing engine (pricing-v2.js) works in 100-based math**. Discount-format prices are converted to 100-based in `getBasePrice()`.

| Format | Par | Cost | Credit | Lenders |
|--------|-----|------|--------|---------|
| **100-based** | 100 | <100 | >100 | EverStream, Keystone, SWMC*, Windsor |
| **discount** | 0 | positive | negative | TLS, AmWest |

*SWMC raw prices are discount but the parser converts to 100-based (`100 - price`).

The `rate_lenders.price_format` column tells the engine which format is stored. The `product.priceFormat` field flows through `db-loader -> price-scenario -> pricing-v2` so `getBasePrice()` can convert.

**If you add a new lender:** set `price_format` in `rate_lenders` to match what the parser stores (after any conversion). If the parser outputs discount format, set `'discount'`. If it converts to 100-based, set `'100-based'`.

## Step 6a: Verify Lender DB Config (MANDATORY)

Before writing rates, check that the lender has ALL required pricing fields set. Missing any of these = lender silently excluded from pricing results.

```javascript
require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.PC_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const res = await client.query(
  "SELECT code, comp_rate, max_comp_cap_purchase, max_comp_cap_refi, uw_fee, price_format, fha_ufmip FROM rate_lenders WHERE code = $1",
  [lenderCode]
);
console.log(res.rows[0]);
await client.end();
```

**Required fields (price-scenario.js will skip lender if missing):**

| Field | Required For | Default |
|-------|-------------|---------|
| `comp_rate` | All pricing | Must be set (e.g. `0.02` = 2%) |
| `max_comp_cap_purchase` | All pricing | Must be set (e.g. `4595`) |
| `max_comp_cap_refi` | All pricing | Must be set (e.g. `3595`) |
| `uw_fee` | All pricing | Must be set (lender's UW fee in dollars) |
| `price_format` | Correct price math | `'100-based'` or `'discount'` |
| `fha_ufmip` | FHA pricing only | `0.0175` (1.75%) — set if lender has FHA products |

**If any field is null, fix it immediately:**
```javascript
await client.query("UPDATE rate_lenders SET comp_rate = 0.02, fha_ufmip = 0.0175 WHERE code = $1", [lenderCode]);
```

## Adjustment Rules

### Lenders WITH adjustment rules (seeded to `adjustment_rules` table)

SWMC, EverStream, Keystone, Windsor — these have FICO/LTV grids, SRP tables, gov adj, promos, etc.

**Two paths to seed:**
1. **Parsed from rate sheet** (preferred): `writeAdjustmentsToDB(lenderCode, parsedResult)` from `src/lib/rates/adj-writer.js` — source tagged as `{lender}/parsed-sheet`
2. **Manual from JSON**: `node scripts/seed-adjustment-rules.mjs --lender {code}` — source tagged as `{lender}/conv-llpa.json` etc.

Both sources coexist in DB. Parsed rules are cleared and re-written on each parse. Manual rules persist unless explicitly deleted.

### Lenders WITHOUT adjustment rules

TLS, AmWest — LLPAs are baked into tier-differentiated product codes (different product per FICO/LTV tier).

**These lenders still price correctly.** `price-scenario.js` provides an empty adj object (`EMPTY_ADJ`) when `getDbLenderAdj()` returns null. The pricing engine applies zero adjustments, which is correct because the adjustments are already reflected in the product-level pricing.

## Database Pipeline

### Architecture

```
Rate Sheet -> Parser -> writeRatesToDB() -> rate_products (upsert) -> rate_sheets (log) -> rate_prices
                     -> writeAdjustmentsToDB() -> adjustment_rules (for lenders with parsed adj data)
```

### How to Write Rate Prices to DB

```javascript
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { writeRatesToDB } = require('./src/lib/rates/db-writer');

// TLS example (CSV):
const { parse } = require('./src/lib/rates/parsers/tls');
const csvPath = path.join(process.env.USERPROFILE, 'Downloads', 'filename.csv');
const ratesCsv = fs.readFileSync(csvPath, 'utf-8');
const result = parse({ ratesCsv });
await writeRatesToDB('tls', result.programs, result.sheetDate || '2026-04-08', 'filename.csv');

// SWMC example (XLSX):
const { parse: parseSwmc } = require('./src/lib/rates/parsers/swmc');
const buf = fs.readFileSync(path.join(process.env.USERPROFILE, 'Downloads', 'filename.xlsx'));
const result = parseSwmc({ ratesXlsx: buf });
await writeRatesToDB('swmc', result.programs, result.sheetDate, 'filename.xlsx');
// Also write adjustments:
const { writeAdjustmentsToDB } = require('./src/lib/rates/adj-writer');
await writeAdjustmentsToDB('swmc', result);
```

**Parser call signatures vary by lender.** Check each parser's `parse()` function for the expected input shape. Common patterns:
- CSV parsers: `parse({ ratesCsv })` where `ratesCsv` is file content string
- XLSX parsers: `parse({ ratesXlsx })` where `ratesXlsx` is a Buffer
- Some parsers take file paths, others take content — **read the parser before calling it**

### Sheet Deactivation Rule

One active sheet per lender. When `writeRatesToDB` runs: supersede existing active sheet -> delete its prices -> insert new sheet + prices. Transactional — rollback on any failure.

### Validation (db-writer runs this automatically)

- Every program must have: `name`, `loanType`, `term` (non-null)
- Rates: 1.0-15.0 range
- Prices: numeric, not NaN
- **Known edge case:** HELOC products may have `term: null` — parser must set a default (30)

### Tables

| Table | Purpose |
|-------|---------|
| `rate_lenders` | Lender metadata, fees, comp caps, price format |
| `rate_products` | Product taxonomy (raw name -> queryable fields). Auto-upserted by db-writer. |
| `rate_sheets` | One row per parse event |
| `rate_prices` | Rate/price rows per product+sheet |
| `adjustment_rules` | FICO/LTV grids, gov adj, promos — seeded via adj-writer or seed script |

## Pricing Math — ABSOLUTE RULES

```
Step 1: Base price from rate_prices (converted to 100-based if discount format)
Step 2: Add credits (SRP, loan amt, risk-based)
Step 3: Subtract costs (FICO/LTV LLPA, investor adj)
Step 4: Apply product feature adj (gov FICO, state, promo credits)
Step 5: Subtract broker comp (ALWAYS last)

FINAL PRICE > 100 -> REBATE -> borrower receives money
FINAL PRICE < 100 -> DISCOUNT -> borrower pays
Dollar = |final - 100| x loanAmount / 100
```

**Adjustment order in pricing-v2.js:**

| Step | Type | Direction | Notes |
|------|------|-----------|-------|
| 1 | Base price | `getBasePrice(rateEntry, priceFormat)` | Converts discount->100-based |
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

99.439 < 100 -> DISCOUNT -> borrower pays $2,525. Matches LoanSifter exactly.

## Step 10: Post-Parse Report and Self-Improvement

After every parse, report and update:

### Report to David
```
Lender: {code}
Sheet date: {date}
Programs: {count} ({new} new, {existing} updated)
Prices: {inserted} (deduped from {raw})
Adjustments: {adj_count} rules written (if applicable)
Lender config: comp_rate={x}, uw_fee={x}, price_format={x}, fha_ufmip={x}
Pricing API: {lender} returning {count} results, par ~{rate}% @ {finalPrice}
Issues: {any problems encountered}
```

### If something went wrong — capture it
1. **Update the lender reference file** (`lenders/{code}.md`) with what you learned
2. **If a parser bug was found and fixed**, note it in the lender file under "Known Issues / Fixes"
3. **If a new edge case was discovered** (e.g. HELOC null term, discount format not converted), add it to the relevant section of this skill file
4. `capture_thought` via MCP if the issue could affect other lenders or is architecturally significant

### Common failure modes (learned the hard way)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Lender missing from pricing results | `comp_rate` or `uw_fee` is null in `rate_lenders` | Set the missing field (Step 6a) |
| Lender missing from FHA results | `fha_ufmip` is null | Set to `0.0175` |
| `finalPrice` near 0 instead of ~100 | Discount-format prices not converted | Check `rate_lenders.price_format` matches what parser stores |
| Validation error: "missing term" | Product (e.g. HELOC) has `term: null` | Fix in parser — set a default term |
| 0 results for lender with rates | No adjustment rules AND old code path | Fixed: empty adj fallback in price-scenario.js |
| `require()` returns stale parser | Node module cache | `delete require.cache[require.resolve('./path')]` before requiring |
| ENOENT on Windows file path | Backslashes in bash | Use `path.join(process.env.USERPROFILE, 'Downloads', filename)` |

## Validation Ranges

- Rates: 3.0%-12.0%
- Prices (100-based): 90.0-108.0
- Prices (discount): -8.0 to 10.0
- Minimum 5 programs per lender
- 30yr conventional must exist
- Sheet date: today or recent

Warn on failure but still save — partial data beats no data.

## After Parsing (full checklist)

1. `writeRatesToDB(lenderCode, programs, sheetDate, sourceFile)`
2. `writeAdjustmentsToDB(lenderCode, parsedResult)` if parser extracts adj data
3. Verify lender DB config (Step 6a) — fix any nulls
4. Report: products matched/unmatched/created, prices inserted, date
5. Verify via `/api/pricing` — par rate finalPrice should be near 100
6. Update lender reference file if anything changed
7. `capture_thought` if anything unusual happened

## Building a New Parser

1. Run scanning script -> map every section
2. Create `src/lib/rates/parsers/{lenderId}.js` following existing parsers as template
3. Dynamic header search (find rows by text, not hardcoded offsets)
4. Export `{ parseRates, parse, lenderId }`
5. Return all required output fields
6. Set `price_format` in `rate_lenders` to match parser output format
7. Ensure all products have non-null `term` (HELOC, HELOC -> 30)
8. Create `lenders/{lenderId}.md` in this skill directory
9. Verify against pricing API — finalPrice near 100 for par rates
10. Verify against OC (LoanSifter or lender portal) if available

## Per-Lender Reference Files

For format details, section maps, sign conventions, and adjustment seeding status, read `lenders/{lenderId}.md` before working on that lender.
