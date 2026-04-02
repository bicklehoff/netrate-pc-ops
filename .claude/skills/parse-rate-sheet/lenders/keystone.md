# Keystone Funding — Rate Sheet Reference

## File Format

Single XLSX (`80220_*.xlsx`), one sheet with rate grid starting ~row 5.

Parser: `src/lib/rates/parsers/keystone.js`
Entry: `parseRates(xlsxBuffer)`

## Sign Convention

Sheet convention: **negative = cost** (e.g., -0.250 in sheet = cost of 0.250).
Engine convention: positive = cost.
**Parser negates** all LLPA values.

## Product Structure

18 products in DB. Rate grid format: rows are rates, columns are lock periods.

## Template Parser

Keystone is the **reference implementation** for all parsers. It:
- Uses dynamic header search (no hardcoded row offsets)
- Extracts ALL sections (LLPAs, loan amt adj, state adj, spec payups, pricing specials, occupancy adj)
- Negates LLPAs to positive=cost convention

When writing a new parser, start from Keystone's structure.

## Adjustment Rules (DB)

Status: **0 rows** — adjustment_rules not yet seeded for Keystone.

No `src/data/lender-adjustments/keystone/` directory yet. Parser extracts the data but it hasn't been moved to the DB seed pipeline.

## Fees & Comp

| Item | Value |
|------|-------|
| Lender fee | $1,125 |
| Comp cap (purchase) | $3,595 |
| Comp cap (refi) | $3,595 |

## Validated Scenario

6.250%, Purchase, 75% LTV, 760 FICO, $400K, CO → **$1,708 credit**. Matches OC exactly.
