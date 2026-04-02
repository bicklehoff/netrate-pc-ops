# SWMC (Sun West Mortgage Company) — Rate Sheet Reference

## File Format

Single XLSX (`99522_*.xlsx`), one sheet: `RATESHEET`, ~4,400+ rows.

Parser: `src/lib/rates/parsers/swmc.js`
Entry: `parseRates(xlsxBuffer)`

## Sign Convention

**Conforming FICO/LTV grid:** positive = cost (already in engine convention, no negation needed).
**Gov FICO adj / state adj / property adj:** negative in sheet = credit. **Must negate** when storing as `productFeature` rows (engine does `price += pf.value`).
- Sheet `-0.25` for FICO >=700 → stored as `+0.25` → `price += 0.25` (credit) ✓
- Sheet `+1.75` for FICO 500-579 → stored as `-1.75` → `price += -1.75` (cost) ✓

## Product Structure

Products appear in triples (3 side-by-side per row block). Parser finds section headers by pattern matching. Agency products parsed: FHA/VA 30yr/15yr fixed, FHA/VA HB, VA cashout, conv 30/20/15/10yr, conv ARMs (5/6, 7/6, 10/6), conv HB, HomeReady, Super-conforming, HomePossible, HomeOne.

Excluded (David's decision): NonQM, DSCR, HECM, ITIN, DPA, HELOC.

## Key Sheet Sections

| Rows | Content |
|------|---------|
| 8–26 | Header: fees, promos, ARM caps, max final prices |
| 335–896 | Government products (FHA/VA/USDA) |
| 896–1059 | Government price adjustments (FICO, state, property) |
| 1060–1315 | Conforming products (all terms + ARMs) |
| 1316–1583 | Conforming FICO/LTV grids (purchase, limited cashout, cashout) + additional adj |
| 1584+ | Home Possible, DPA, HECM, NonQM, ITIN, Jumbo, HELOC — SKIP |

**Promo location:** Row 19 col 9 (conv promo), Row 23 col 9 (FHA/USDA promo). Text includes bps amount. Update monthly.

## Adjustment Rules (DB)

Status: **233 rows** in `adjustment_rules` (seeded 2026-04-02).
Source files: `src/data/lender-adjustments/swmc/`

| File | Content | Rows |
|------|---------|------|
| `conv-llpa.json` | Conv FICO/LTV grids (purchase/refi/cashout), 9×9 bands | 207 ficoLtv rows |
| `gov-adj.json` | Raw gov adj values (reference only — seed uses lender-config) | — |
| `lender-config.json` | Gov FICO adj (pre-negated), state adj (pre-negated), property adj (pre-negated), loan amt adj, monthly promos | 26 productFeature rows |

Re-seed: `node scripts/seed-adjustment-rules.mjs --lender swmc --force`

### Not yet seeded (phase 2)

- Conforming additional adjustments: ARM, Condo, Investment, Second Home, Manufactured, 2-4 Units, High Balance, Subordinate Financing — LTV-banded, in `conv-llpa.json` as `additionalAdjustments` arrays. Need negation when stored as productFeature.
- FHA Streamline / VA IRRRL specific FICO adj (`_additional` suffix keys in gov adj) — streamline-only, skip until streamline products priced.
- Allterms adj: 7-10 financed properties, renovation, LPMI coverage tiers.

## LTV Bands (Conforming)

`["<=30","30.01-60","60.01-70","70.01-75","75.01-80","80.01-85","85.01-90","90.01-95",">95"]`

Note: `">95"` band. The seed script's `parseLtv()` now handles this: `">95"` → `{ ltvMin: 95.01, ltvMax: 100 }`.

## FICO Bands (Conforming)

`[">=780","760-779","740-759","720-739","700-719","680-699","660-679","640-659","<=639 or NTC"]`

Note: `"<=639 or NTC"` is SWMC's lowest tier. `parseFico()` handles this: → `{ ficoMin: 0, ficoMax: 639 }`. NTC-only adj skipped (no FICO to match on).

## Gov FICO Adj (FHA + VA, pre-negated values in lender-config.json)

| FICO | Sheet Value | Stored (negated) | Effect |
|------|-------------|------------------|--------|
| >=700 | -0.25 | +0.25 | credit |
| 680-699 | -0.125 | +0.125 | credit |
| 580-599 | +0.125 | -0.125 | cost |
| 500-579 | +1.75 | -1.75 | cost |
| NTC | +1.00 | — | skipped (no FICO) |

Bands 640-659, 620-639, 600-619 = 0 (skipped).

## Monthly Promos

Update `lender-config.json` promos array each month and re-seed with `--force`. April 2026: conv +0.25, FHA/USDA +0.35.

## Fees & Comp

| Item | Value |
|------|-------|
| UW fee (non-streamline) | $1,195 |
| UW fee (streamline) | $625 |
| UW fee (NQM) | $1,299 |
| Max final price FHA/VA/USDA | 105 |
| Max final price Conv standard | 104 |
| Max final price Conv HB | 103 |
| Comp cap (purchase) | $4,595 |
| Comp cap (refi) | $3,595 |

## Rate Prices (DB)

1,368 price rows for 21 agency products. Last updated 2026-04-02.
Products with 0 prices: DSCR 30yr Fixed, NonQM 30yr Fixed full/alt (excluded by design).
