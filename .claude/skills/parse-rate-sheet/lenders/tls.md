# TLS (The Loan Store) — Rate Sheet Reference

## ⛔ EXCLUDED FROM PRICING (2026-04-10)

**TLS is not parsed or priced.** Their CSV contains only rate/price data (6 columns: product code, rate, 4 lock periods) with **zero LLPA/adjuster sections**. Without published adjustments we cannot price accurately — the engine would apply zero adjustments and produce rebates that are consistently $500-$1500 too generous vs TLS's real borrower-paid pricing.

**Verification:** On 2026-04-10 we reverse-engineered TLS's conventional refi FICO/LTV grid from ~12 direct portal quotes. We confirmed the grid was seeable and additive, BUT:
- The grid would need to be built separately for conv purchase, FHA purchase, FHA refi, VA purchase, VA refi, USDA, etc. — ~80+ scenarios in the TLS portal
- TLS updates LLPAs on their own schedule; our reverse-engineered grid would silently go stale
- The correct fix is to ask TLS's AE for their published LLPA matrix as a separate document

**State:** `rate_lenders.status = 'excluded'`. All TLS rate_prices, rate_products, rate_sheets, and adjustment_rules were deleted on 2026-04-10. The parser (`src/lib/rates/parsers/tls.js`) still exists but is not called by any automated workflow.

**To re-enable:**
1. Obtain an official LLPA matrix from TLS's AE (PDF or Excel)
2. Write a parser for it (likely into `parsers/tls-llpa.js`)
3. Update `rate_lenders.status` back to NULL or 'active'
4. Parse the rate CSV + LLPA doc and verify pricing against TLS direct borrower-paid quotes

---

## (Historical reference — do not use for new parses)

## File Format

Single CSV (`61534_*.csv`). No LLPA companion file.

Parser: `src/lib/rates/parsers/tls.js`
Entry: `parse({ ratesCsv })` where `ratesCsv` is the file content string (NOT a file path)

## Price Format

**Discount** — `0 = par`, `positive = cost (points)`, `negative = credit (rebate)`.
`rate_lenders.price_format = 'discount'`. The pricing engine converts to 100-based via `getBasePrice()`.

## Sign Convention

N/A — no LLPA sections in the CSV. TLS encodes pricing tiers in product codes.

## Product Structure

Product codes in CSV decoded by `decodeProductCode()`:
- `CONF30` = Conventional 30yr Fixed
- `FHA30STR` = FHA 30yr Streamline
- `VA30IRRRL` = VA 30yr IRRRL
- `N30_E35_DSCR` = Non-QM 30yr DSCR (tier E35)
- `H1M_WB_HELOC` = HELOC
- `CONF301/0BD` = Conventional 30yr 1-0 Buydown

147 products across conventional, FHA, VA, USDA, jumbo, non-QM (DSCR, bank statement), HELOC, 2nd liens.

Lock periods: 15, 30, 45, 60 days.

## Adjustment Rules (DB)

Status: **0 rows** — TLS uses GSE defaults. LLPAs are baked into tier-differentiated product codes (different product per FICO/LTV tier).

**This is correct and intentional.** The pricing engine provides an empty adj object (EMPTY_ADJ) for lenders with no rules. Zero adjustments are applied, which is correct because adjustments are reflected in product-level pricing.

No `src/data/lender-adjustments/tls/` directory needed.

## Lender DB Config

| Field | Value | Status |
|-------|-------|--------|
| `comp_rate` | `0.02` (2%) | Set 2026-04-08 |
| `max_comp_cap_purchase` | `4595` | Set |
| `max_comp_cap_refi` | `3595` | Set |
| `uw_fee` | `1281` | Set |
| `price_format` | `discount` | Set |
| `fha_ufmip` | `0.0175` | Set 2026-04-08 |

## Fees & Comp

| Item | Value |
|------|-------|
| Lender fee | $1,281 |
| Comp cap (purchase) | $4,595 |
| Comp cap (refi) | $3,595 |

## Known Issues / Fixes

| Date | Issue | Fix |
|------|-------|-----|
| 2026-04-08 | HELOC product had `term: null`, failed db-writer validation | Set `term: 30` in parser's `decodeProductCode()` for HELOC pattern |
| 2026-04-08 | `comp_rate` was null — TLS excluded from pricing results | Set `comp_rate = 0.02` in `rate_lenders` |
| 2026-04-08 | `fha_ufmip` was null — TLS excluded from FHA pricing | Set `fha_ufmip = 0.0175` in `rate_lenders` |
| 2026-04-08 | `finalPrice` showed ~3.7 instead of ~96.2 | Discount format wasn't being converted to 100-based. Fixed in `getBasePrice()` (PR #33) |

## Rate Prices (DB)

147 products, 14,094 prices (deduped from 15,843). Last parse: 2026-04-08.

## Pricing API Verification (2026-04-08)

| Scenario | TLS Results | Par Rate | Final Price |
|----------|-------------|----------|-------------|
| Conv 30yr, 780 FICO, $400K, Purchase, CO | 385 opts | ~5.990% | 99.996 |
| FHA 30yr, 680 FICO, $350K, Purchase, TX | 192 opts | ~7.375% | 100.021 |
| VA 30yr, 740 FICO, $500K, Purchase, CO | 175 opts | ~5.875% | 100.213 |
