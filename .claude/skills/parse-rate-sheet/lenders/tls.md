# TLS (The Loan Store) — Rate Sheet Reference

## File Format

Single CSV (`61534_*.csv`). No LLPA companion file.

Parser: `src/lib/rates/parsers/tls.js`
Entry: `parseRates(csvContent)`

## Sign Convention

N/A — no LLPA sections in the CSV. TLS encodes pricing tiers in product names.

## Product Structure

Product codes in CSV like:
- `FNMA Conforming 30 Yr Fixed Purchase`
- `FNMA Conforming 30 Yr Fixed Refinance`
- `FHA 30 Yr Fixed Purchase`

Tiers are baked into separate product rows rather than LLPA grids. 130 products in DB.

## Adjustment Rules (DB)

Status: **0 rows** — TLS uses GSE defaults.

TLS has no separate LLPA sheet. Options:
1. Use GSE defaults (current behavior — may be accurate enough)
2. Get LLPA grid from TLS rep if one exists
3. TLS may encode adjustments as separate product price points (check CSV)

No `src/data/lender-adjustments/tls/` directory yet.

## Minimum Parser Updates Needed

- Add `lenderFee: 1281` to parser output (currently hardcoded in pricing.js)
- Add `compCap: { purchase: 4595, refinance: 3595 }` to parser output
- Pass new fields through in `parse-gcs-rates.mjs` line 181

## Fees & Comp

| Item | Value |
|------|-------|
| Lender fee | $1,281 |
| Comp cap (purchase) | $4,595 |
| Comp cap (refi) | $3,595 |

## Rate Prices (DB)

130 products, last parse date unknown. Check `rate_sheets` table for latest.
