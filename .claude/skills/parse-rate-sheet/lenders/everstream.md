# EverStream Lending — Rate Sheet Reference

## File Format

Two files per repricing:
- **CSV** (`96573_*.csv`) — rate prices, one row per product/rate/lock
- **XLSX** (`96596_*.xlsx`) — 19 LLPA sheets

Parser: `src/lib/rates/parsers/everstream.js`
Entry points: `parse(csvContent, xlsxBuffer)` or `parseRates(csvContent)`

## Sign Convention

Sheet convention: **negative = cost** (the sheet shows -0.250 as a cost).
Engine convention: positive = cost.
**Parser negates** LLPA values: sheet -0.250 → stored 0.250.

Exception: SRP and risk-based values in the XLSX are positive = credit (no negation).

## Product Structure

EverStream has two tiers and two investors per tier:
- **Core** — FNMA and FHLMC (pooled pricing)
- **Elite** — FNMA and FHLMC (separate LLPA grids per investor)

Products: Gov (FHA/VA/USDA), Conv (30/20/15/10yr), ARM (5/6, 7/6, 10/6), High Balance

## LLPA Sheets (XLSX, 19 sheets)

Key sheets and what they contain:
| Sheet | Content |
|-------|---------|
| Core Conv LLPAs | FICO/LTV grids (purchase/refi/cashout), risk-based, loan amount, FNMA/FHLMC investor adj |
| Core Conv SRP | SRP table per state/term/impounds |
| Elite FNMA LLPA | Elite FNMA FICO/LTV grids |
| Elite FHLMC LLPA | Elite FHLMC FICO/LTV grids |
| Elite Conv SRP | Amount-banded SRP per state |
| Core FHA LLPAs | FHA FICO/LTV grids |
| Core FHA SRP | FHA SRP table |
| Elite FHA LLPAs | FICO×LoanAmt grid + purpose/state/FICO/LTV grid |
| Elite Govt SRP | Amount-banded FHA SRP |
| Elite VA LLPAs | VA FICO/LoanAmt grid + purpose/state/FICO/LTV grid |
| Elite VA SRP | Amount-banded VA SRP |
| Core VA LLPAs | VA feature-based adj (refi, cashout, IRRRL) |

## Adjustment Rules (DB)

Status: **Complete — 19,108 rows** in `adjustment_rules`.
Source files: `src/data/lender-adjustments/everstream/`

| File | Content |
|------|---------|
| `elite-conv-llpa.json` | Elite FNMA/FHLMC FICO/LTV grids |
| `elite-conv-srp.json` | Elite SRP amount-banded |
| `core-conv-llpa.json` | Core FICO/LTV + risk-based + loan amount |
| `core-conv-srp.json` | Core SRP per state/term |
| `elite-fha-llpa.json` | Elite FHA FICO×LoanAmt + purpose/state/LTV |
| `elite-fha-srp.json` | Elite FHA SRP |
| `core-fha-llpa.json` | Core FHA FICO/LTV |
| `core-fha-srp.json` | Core FHA SRP |
| `elite-va-llpa.json` | Elite VA FICO×LoanAmt + purpose/state/LTV |
| `elite-va-srp.json` | Elite VA SRP |
| `core-va-llpa.json` | Core VA feature adj (refi/cashout/IRRRL) |
| `lender-config.json` | Investor adj, FHLMC specials, purchase credit, FICO adj |
| `product-loan-amount-llpas.json` | Per-product loan amount adjustments |

Re-seed: `node scripts/seed-adjustment-rules.mjs --lender everstream --force`

## Key Quirks

**State variant dedup:** CSV contains state-specific rows (e.g., "FNMA 25/30Yr Fixed FL > 400K Core"). Parser strips state prefix → maps to same product as base → DB writer deduplicates (keeps first inserted = base). This is correct for non-FL/TX states.

**FHA SRP band matching:** Use UFMIP-adjusted loan amount (not base) to look up the SRP band. UFMIP = 1.75% → $400K loan → $406,999 effective → hits $400K-$500K band, not $375K-$400K.

**Elite FHA/VA LS quirk:** LoanSifter applies refi grid to purchase scenarios for Elite govt. Our engine uses the correct grid per purpose. This creates a small diff vs LS (not a bug on our side).

**Purchase credit:** +0.10 applies to ALL loan types (conv/fha/va). Confirmed from `product-loan-amount-llpas.json`.

**FICO adj split:** `coreFeatures` (all loan types: conv/fha/va) vs `fhaOnlyFeatures` (FHA only: state/property/occupancy).

## Fees & Comp

| Item | Value |
|------|-------|
| Lender fee | $999 |
| Comp cap (purchase) | $4,595 |
| Comp cap (refi) | $3,595 |

## Validation

Verified: FNMA Core 30yr, 6.124%, $450K, Refi, CO, 780 FICO, 75% LTV → 99.439 → $2,525 discount. Matches LoanSifter exactly.

All 21 LS validation rows confirmed (exact adj match).
