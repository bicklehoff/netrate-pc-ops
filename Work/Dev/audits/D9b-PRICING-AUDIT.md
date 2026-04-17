---
date: 2026-04-17
author: pc-dev
audit: D9b — Pricing Unification Inventory
source_commit: 08b8580e5ff9a6c0989aff34e4fbe4d2e7ddad85
branch: claude/determined-bose-343ddc
scope: inventory only — no fixes
---

# D9b — Pricing Audit

Full map of every file that computes, transforms, or displays a mortgage rate at NetRate Mortgage. Written to spec the pricing-unification PRs that follow.

> **Two drift bugs already leaked to prod.** PR #82 (lenders `LIMIT 1` bug in homepage-db) and the parallel `homepage-db.js` engine itself (D3 D0 re-audit, patched in PR #77 with `EMPTY_ADJ`). The risk surface below explains how.

---

## 1. Engines

| # | File | Role | Canonical? | Callers |
|---|------|------|-----------|---------|
| E1 | `src/lib/rates/pricing-v2.js` | Core engine — `priceRate(rateEntry, product, scenario, lenderAdj, brokerConfig, llpaGrids)` walks base → LLPAs → SRP → investor → comp. Single 613-line module. | **CANONICAL** (math) | E2, E4 |
| E2 | `src/lib/rates/price-scenario.js` | Shared wrapper — `priceScenario(body)`. Loads lenders from DB, filters programs, calls `priceRate()` per rate entry, returns sorted ladder. | **CANONICAL** (orchestration) | API1, API4, API5, API6, API10, E2-callers below |
| E3 | `src/lib/rates/engine.js` | Thin helper module — re-exports `calculateMonthlyPI as calculatePI`, `calculateAPR` from `mortgage-math.js`; defines `getFicoBand`, `getLtvBandIndex`. No actual pricing — but has a second `getFicoBand` (`src/lib/rates/engine.js:11-22`) that disagrees with the one in `pricing-v2.js:168-179` (`>=800` band vs. `>=780` band). | helper | RateTool hook, other calculators |
| E4 | `src/lib/rates/homepage-db.js` | **PARALLEL** — computes homepage hero rates. Reimplements the `priceScenario()` orchestration: own SQL query against `rate_sheets`, own broker-config build (hardcoded `compRate: 0`), own product filter list, own ladder building, calls shared `priceRate()` and shared `pickParRate()`. ~250 lines of duplicated plumbing. | **parallel — remove** | `src/app/page.js:38`, `src/app/rate-watch/page.js:236` |
| E5 | `src/lib/rates/pick-par-rate.js` | Pure par-rate selector — "lowest rate with finalPrice ≥ 100, else closest-to-par." | **CANONICAL** (selection) | E4, RateTool hook, (should be but isn't) E2 |
| E6 | `src/lib/rates/sub-financing-comparison.js` | **PARALLEL** — inlines a hardcoded GSE LLPA grid (`src/lib/rates/sub-financing-comparison.js:18-42`) and hardcoded `COMP_RATE = 0.02`, `COMP_CAP_REFI = 3595` (`:47-48`). Used for the HELOC/Cash-out comparison math. | **parallel — remove** | Unknown — no grep hits for `SubFinancingComparison` import. Possibly dead. |
| E7 | `src/lib/rates/empty-adj.js` | Frozen empty-adjustments fallback. Import-only — used when `getDbLenderAdj()` returns null. | shared constant | E2, E4 |
| E8 | `src/lib/rates/defaults.js` | `DEFAULT_SCENARIO` ($400K, 75 LTV, 780 FICO, CO, 30yr, purchase) + `FHA_BASELINE_LIMIT` (`541,288`, derived from hardcoded `832,750 × 0.65`). | shared constants | E2, E4, RateTool, rate widgets |
| E9 | `src/lib/rates/db-loader.js` | `loadRateDataFromDB()` — shapes `rate_sheets × rate_products × rate_prices × rate_lenders` into the structure `priceRate()` expects. | **CANONICAL** (data load) | E2 (not E4 — E4 queries direct) |
| E10 | `src/lib/rates/db-adj-loader.js` | `getDbLenderAdj(lenderCode, loanType)` — builds the LLPA/SRP/investor/feature shape from `adjustment_rules`. In-memory cache, 5-min TTL. | **CANONICAL** (adj load) | E2, E4 |
| E11 | `src/lib/pricing-nonqm/price-dscr.js` | DSCR/Non-QM engine — separate product family (Everstream). Own `loadActiveDscrSheet()`, own `priceDscrScenario()`. Uses `nonqm_rate_sheets`, `nonqm_rate_products`, `nonqm_adjustment_rules` tables. Lives outside the agency path entirely. | **CANONICAL** (DSCR) | API2 |
| E12 | `src/lib/rates/closing-costs.js` | State-level default third-party costs (`CO 2800, TX 3200, OR 2600, CA 3500`). | shared constant | RateTool `src/components/RateTool/index.js:52` |
| E13 | `src/lib/rates/math.js` | Re-exports `calcMonthlyPI` for backward compat. No math of its own. | helper | E2-via-reprice-route |
| E14 | `src/lib/mortgage-math.js` | **CANONICAL** `calculateMonthlyPI`, `calculateLTV`, `calculateAPR` (binary search). Single source. | **CANONICAL** (math) | E3, E4, E13, MLO quote creation |
| E15 | `src/lib/rates/config.js` | `LO_CONFIG` — David's NMLS/contact info. Not pricing; appears in RateTool header. | reference | RateTool |
| E16 | `src/lib/rates/parsers/*` | 6 lender-specific parsers (amwest, everstream, keystone, swmc, tls, windsor) — rate-sheet ingestion only, not runtime pricing. | ingest pipeline | `scripts/parse-gcs-rates.mjs` |
| E17 | `src/lib/hecm/*` | HECM (reverse mortgage) engine. Separate product family. Hardcoded rate tables in `src/lib/hecm/rate-sheet.js`, PLF table in `src/lib/hecm/plf-table.js`, UFMIP rate `0.02` in `src/lib/hecm/constants.js:3`. | **CANONICAL** (HECM) | `src/app/tools/hecm-optimizer/page.js`, `src/app/tools/reverse-mortgage-calculator/page.js` |

**Count: 17 distinct pricing-adjacent modules, 3 engines that actually price (pricing-v2, homepage-db, price-dscr) plus 1 dead/questionable parallel (sub-financing-comparison) and 1 isolated family (hecm).**

---

## 2. Data sources

### 2.1 DB tables (Neon Postgres)

| Table | Written by | Read by | Notes |
|-------|-----------|---------|-------|
| `rate_sheets` | `src/lib/rates/db-writer.js`, `scripts/parse-gcs-rates.mjs` | E2 (`price-scenario.js:42`), E4 (`homepage-db.js:56,202`) | One row per lender per effective date. `status='active'` |
| `rate_products` | db-writer | E2 (via E9), E4 (`homepage-db.js:107`) | Product taxonomy — tier, agency, term, productType, loan_type, flags |
| `rate_prices` | db-writer | E9, E4 (`homepage-db.js:131`) | rate × price × lock_days per product |
| `rate_lenders` | manual / seed | E9, E4 | uwFee, compRate, compCap, fhaUfmip, priceFormat, status. **PR #82 bug-source** (LIMIT 1 on this table) |
| `adjustment_rules` | `scripts/seed-adjustment-rules.mjs`, `src/lib/rates/adj-writer.js` | E10 | All LLPA/SRP/risk/feature rows |
| `rate_history` | `scripts/rate-history-snapshot.js`, `src/app/api/cron/mnd-scrape/route.js`, `src/app/api/market/national-rates/scrape/route.js` | `src/app/api/rates/history/route.js`, `src/app/rate-watch/page.js:22,45` | Historical daily rate snapshots (MND + NetRate par) |
| `rate_alerts` | `src/app/api/strike-rate/route.js` | scenario-alerts cron | Strike-rate subscriptions |
| `nonqm_rate_sheets` | `src/lib/pricing-nonqm/ingest.js` | E11 | DSCR/Non-QM |
| `nonqm_rate_products` | ingest | E11 | |
| `nonqm_adjustment_rules` | ingest | E11 | |
| `fee_templates` | `scripts/seed-fee-templates.mjs` | `src/lib/quotes/fee-builder.js:37` | Closing-cost templates by state/county/purpose |
| `scenarios` + `scenario_rates` | MLO quote creation, saved-scenario, cron | my-rates, scenario-alerts | Persisted pricing snapshots |
| `fred_series_data` | `/api/cron/fred-snapshot` | `/api/rates/fred/route.js` | Economic indicators (not pricing, but rate-watch) |

**Not found:** no `rate_llpas`, `rate_adjustments`, or `homepage_rate_cache` table. Homepage caching is in-memory only (see §6).

### 2.2 Bundled data files

| File | Purpose | Consumer | Staleness |
|------|---------|---------|-----------|
| `src/data/county-loan-limits.js` | All 3,235 counties + 2026 conforming/FHA limits. Header: "Generated 2026-03-20" | E2 (`classifyLoan`, `getLoanLimits`) | **Annual** — FHFA announces Nov, effective Jan |
| `src/data/fhfa-loan-limits-2026.csv` | Source for above, committed to repo | Build-time via `scripts/parse-fhfa-csv.js` | Annual |
| `src/data/loan-limits-2025.json` | **Stale** — 2025 limits still in repo | none found | dead file |
| `src/data/county-tax-rates.js` | Effective property tax rates by county | Unknown (not grepped for pricer) | Annual |

### 2.3 Env vars affecting pricing

| Var | Effect |
|-----|--------|
| `DATABASE_URL` / `PC_DATABASE_URL` | Neon connection |
| `CRON_SECRET`, `CLAW_API_KEY` | Cron auth for scenario-alerts |
| `FRED_API_KEY` | Rate-watch series data (not pricing but adjacent) |

### 2.4 Hardcoded numeric constants in pricing code

| Constant | Where | Value | Risk |
|----------|-------|-------|------|
| FHA UFMIP rate | `src/lib/rates/pricing-v2.js:369` | `0.0175` default if `fhaUfmip` missing | **DRIFT** — duplicated below |
| FHA UFMIP rate | `src/lib/quotes/fee-builder.js:91` | `const FHA_UFMIP_RATE = 0.0175` | **DRIFT** |
| FHA UFMIP rate | `src/lib/hecm/constants.js:3` | `UFMIP_RATE = 0.02` (HECM is 2%, not 1.75%) | separate product — OK |
| FHA monthly MIP rates | `src/lib/quotes/fee-builder.js:82-89` | Hardcoded schedule (0.15–0.55 bps) | **Annual** — HUD updates |
| FHA high-balance threshold | `src/lib/quotes/fee-builder.js:83` | `726200` | **STALE** — conforming baseline is now 832,750 |
| FHA baseline limit | `src/lib/rates/defaults.js:12` | `832750 × 0.65 = 541288` | **Annual** |
| Comp cap purchase fallback | `src/lib/rates/pricing-v2.js:342` | `3595` | fallback if brokerConfig missing |
| Comp cap refi fallback | `src/lib/rates/pricing-v2.js:343` | `3595` | fallback if brokerConfig missing |
| Comp rate fallback | `src/lib/rates/pricing-v2.js:340` | `0.02` | fallback |
| Broker comp (DSCR calc) | `src/app/tools/dscr-calculator/page.js:6-8` | `COMP_RATE=0.02, COMP_CAP_PURCHASE=4595, COMP_CAP_REFI=3595` | **HARDCODED — client-side, not from DB** |
| Broker comp (sub-fin) | `src/lib/rates/sub-financing-comparison.js:47-48` | `COMP_RATE=0.02, COMP_CAP_REFI=3595` | **HARDCODED** |
| Homepage fallback comp cap | `src/lib/rates/homepage-db.js:93-94` | `|| 3595` | fallback |
| Price-scenario fallback comp cap | `src/lib/rates/price-scenario.js:142-143` | via brokerConfig, but comp caps come from `lenderData.compCap.{purchase,refinance}` — no fallback if missing (config warning instead) | policy gap |
| Default UW fee fallback | `src/lib/rates/homepage-db.js:146` | `|| 999` | if missing |
| Default UW fee fallback | `src/lib/rates/pricing-v2.js:606` | `|| 999` | if missing |
| FHA UFMIP as MCA | `src/lib/hecm/constants.js:3` | `0.02` | HECM only |
| Rate filter range (RateTool) | `src/components/RateTool/useApiPricing.js:106` | `rate >= 4 && rate <= 9` | hides results outside band |
| Near-par filter (RateTool) | `src/components/RateTool/useApiPricing.js:107` | `Math.abs(finalPrice - 100) <= 2.5` | hides discount/rebate beyond 2.5 pts |
| State third-party costs | `src/lib/rates/closing-costs.js:7-11` | CO 2800, TX 3200, OR 2600, CA 3500 | duplicated in `src/components/RefinanceCalc/shared.js:11-14` with `taxRate` attached |
| State tax rates | `src/components/RefinanceCalc/shared.js:11-14` | CO 0.55%, CA 0.75%, TX 1.80%, OR 0.98% | **DRIFT** — duplicates `src/data/county-tax-rates.js` coverage |
| Minimum loan amount validation | `src/app/api/pricing/route.js:33` | `50000` | API gate |
| Maximum loan amount | `src/app/api/pricing/route.js:33` | `10000000` | API gate |
| Purchase calc tax default | `src/app/tools/purchase-calculator/page.js:40` | `'0.6'` (% of value) | stale/generic |
| Purchase calc insurance default | `src/app/tools/purchase-calculator/page.js:41` | `'1200'` (annual) | stale/generic |
| Purchase calc rate default | `src/app/tools/purchase-calculator/page.js:38` | `'6.875'` | **STALE** — not synced to live rates |
| Refi analyzer rate defaults | `src/app/tools/refi-analyzer/page.js:40,42` | current 7.50, new 6.50 | **STALE** |
| `breakeven/page.js` example rates | `src/app/breakeven/page.js:43-44` | 5.750, 5.500 | marketing copy |
| `how-pricing-works/page.js` | `src/app/how-pricing-works/page.js:96` | 5.500 | marketing copy |
| `points-and-credits/page.js` | `src/app/points-and-credits/page.js:56` | 5.500 | marketing copy |
| Homepage fallback rates | `src/app/page.js:57-66` | 5.875/5.94, 5.250/5.38, 5.500/6.12, 5.375/5.52 | **STALE** fallback set |

---

## 3. Display surfaces

| # | Surface | Path | Engine | Caching |
|---|---------|------|--------|---------|
| D1 | Homepage hero rate card | `src/app/page.js:38,57-66` | E4 `getHomepageRatesFromDB` | ISR `revalidate=1800` + E4 in-memory 30-min + E10 5-min |
| D2 | Homepage sticky rate bar | `src/app/page.js:71` (`<StickyRateBar>`) | E4 (via `conv30Rate`) | inherits D1 |
| D3 | Homepage ticker | `src/app/page.js:86-105` | E4 | inherits D1 |
| D4 | `/rates` — public rate tool | `src/app/rates/page.js:48` → `<RateTool>` | Client calls API1 via `useApiPricing` hook | ISR `revalidate=1800` but client re-fetches on input |
| D5 | `/rate-watch` hero + grid | `src/app/rate-watch/page.js:236,302,322` | E4 `getHomepageRatesFromDB` | ISR `revalidate=1800` |
| D6 | `/rate-watch/[date]` | `src/app/rate-watch/[date]/page.js` | `rate_history` DB | ISR `revalidate=3600` |
| D7 | `/rate-watch/archive` | same | `rate_history` DB | ISR `revalidate=3600` |
| D8 | `/rates/dscr` | `src/app/rates/dscr/page.js:42` + `<DscrRateWidget>` | Client calls API2 | None |
| D9 | `/rates/heloc` | `src/app/rates/heloc/page.js` | **No live pricing** — static marketing copy | static |
| D10 | `/rates/non-qm` | `src/app/rates/non-qm/page.js` | **No live pricing** — static marketing copy | static |
| D11 | `/tools/purchase-calculator` | `src/app/tools/purchase-calculator/page.js` | **No live pricing** — user-entered rate; hardcoded `'6.875'` default | none |
| D12 | `/tools/refi-analyzer` | `src/app/tools/refi-analyzer/page.js` | **No live pricing** — user-entered rates | none |
| D13 | `/tools/cost-of-waiting` | `src/app/tools/cost-of-waiting/page.js` | unknown — not yet audited, likely user-entered | none |
| D14 | `/tools/dscr-calculator` | `src/app/tools/dscr-calculator/page.js:6-8` | Client calls API2, **applies broker comp client-side with HARDCODED constants** | none |
| D15 | `/tools/second-lien-comparison` | `src/app/tools/second-lien-comparison/page.js` | Possibly E6 (dead parallel engine) | none |
| D16 | `/tools/reverse-mortgage-calculator` | `src/app/tools/reverse-mortgage-calculator/page.js` | E17 HECM | none |
| D17 | `/tools/hecm-optimizer` | `src/app/tools/hecm-optimizer/page.js` | E17 HECM | none |
| D18 | `/refinance-calculator` | `src/app/refinance-calculator/page.js` → `<RefinanceCalc>` | Client calls API1 via `useRefinanceEngine` hook. Also has hardcoded STATE_DEFAULTS in `src/components/RefinanceCalc/shared.js:11-14` | none |
| D19 | `/breakeven` | `src/app/breakeven/page.js:43-44` | marketing copy — hardcoded 5.750, 5.500 | static |
| D20 | `/how-pricing-works` | `src/app/how-pricing-works/page.js:96` | marketing — hardcoded 5.500 | static |
| D21 | `/points-and-credits` | `src/app/points-and-credits/page.js:56` | marketing — hardcoded 5.500 | static |
| D22 | Portal: MLO Quote Generator | `src/app/portal/mlo/tools/quote-generator/page.js` → `<QuoteWizard>` → API5/API6 | API5 `POST /api/portal/mlo/quotes` → E2 | none |
| D23 | Portal: MLO Quote viewer | `src/app/portal/mlo/quotes/[id]/page.js` | reads saved `scenarios`+`scenario_rates` | DB snapshot — not live |
| D24 | Portal: Borrower Quote viewer | `src/app/portal/quote/[id]/page.js` | reads saved snapshot | DB snapshot |
| D25 | Portal: `my-rates` | `src/app/portal/my-rates/page.js` | API3 `GET /api/my-rates?token=` → saved `scenarios` table | DB snapshot + API3 reprice via API4 |
| D26 | Borrower email templates | `src/lib/email-templates/borrower.js` | Reads `scenario_rates` rows into HTML | no live pricing in template — pre-rendered values |
| D27 | Quote PDF | `src/components/Portal/QuoteGenerator/QuotePDF.js` | reads pricing result — does not re-price | DB snapshot |
| D28 | Rate widget on `/rates/dscr` | `src/components/DscrRateWidget.js` | Client calls API2 | none |
| D29 | MLO Pipeline rate column | `src/components/Portal/PipelineTable.js` | displays stored `interest_rate` on Loan | DB — not live |
| D30 | Lead pricing preview | `src/app/api/portal/mlo/leads/[id]/quote/route.js` | calls `priceScenario()` (E2) | none |

**Count: 30 surfaces. ~17 show a live rate; the remainder are static marketing copy with hardcoded numbers.**

---

## 4. APIs

| # | Route | Method | Inputs | Engine | Output | Auth | Cache-Control |
|---|-------|--------|--------|--------|--------|------|---------------|
| API1 | `/api/pricing/route.js` | POST | `loanAmount, loanPurpose, loanType, creditScore, propertyValue, term, state, county, productType, firstTimeBuyer, lockDays, borrowerPaid` | E2 | `{scenario, effectiveDate, loanClassification, countyLimits, resultCount, results[], configWarnings}` | **none — public** | `s-maxage=60, max-age=30, swr=60` |
| API2 | `/api/pricing/dscr/route.js` | POST | DSCR scenario | E11 | `{priced[], skipped, meta}` | **none — public** | `s-maxage=60, max-age=30, swr=120` |
| API3 | `/api/my-rates/route.js` | GET | `?token=` | reads `scenarios` table | borrower-shaped saved scenarios | token-based (view_token from `leads`) | none |
| API4 | `/api/my-rates/reprice/route.js` | POST | `{token, scenarioId}` | E2 | top-3 rates, saved to `scenario_rates` | token-based | none |
| API5 | `/api/my-rates/access/route.js` | POST | email or phone | issues `view_token` | token | rate-limit | none |
| API6 | `/api/portal/mlo/quotes/route.js` | GET/POST | full scenario | E2 via `priceScenario`, persists + picks top 3 via own `pickTopScenarios()` (see §5 divergence) | scenario record | MLO session | none |
| API7 | `/api/portal/mlo/quotes/[id]/price/route.js` | POST | re-price existing quote | E2 | pricing + fees + eligibility | MLO session | none |
| API8 | `/api/portal/mlo/quotes/[id]/route.js` | GET/PATCH/DELETE | | reads/writes `scenarios` | | MLO session | none |
| API9 | `/api/portal/mlo/quotes/[id]/send/route.js` | POST | | triggers email with stored snapshot | | MLO session | none |
| API10 | `/api/portal/mlo/leads/[id]/quote/route.js` | POST | lead-id → scenario | E2 | pricing | MLO session | none |
| API11 | `/api/strike-rate/route.js` | POST/GET | email, target rate, loan type | writes `rate_alerts`; no pricing | alert record | email double opt-in | none |
| API12 | `/api/rates/history/route.js` | GET | `loan_type, credit_score, days/period` | reads `rate_history` | historical series | public | 1-hour CDN |
| API13 | `/api/rates/fred/route.js` | GET | `series, days` | reads `fred_series_data` + live FRED fallback | series data | public | 1-hour CDN |
| API14 | `/api/market/national-rates/route.js` | GET | | reads `rate_history` WHERE source='mnd' | national rates | public | likely 1-hour |
| API15 | `/api/market/national-rates/scrape/route.js` | POST | | writes `rate_history` from MND | status | API key | none |
| API16 | `/api/cron/scenario-alerts/route.js` | GET | weekday morning cron | E2 — reprices every due scenario, writes `scenario_alert_queue` | summary | `CRON_SECRET` bearer or `CLAW_API_KEY` | none |
| API17 | `/api/cron/mnd-scrape/route.js` | GET | 2×/weekday cron | scrapes MND, writes `rate_history` | status | cron | none |
| API18 | `/api/cron/fred-snapshot/route.js` | GET | weekday cron | FRED API → `fred_series_data` | status | cron | none |
| API19 | `/api/cron/health-check/route.js` | GET | weekday cron | reads rate_sheets, reports freshness | status | cron | none |
| API20 | `/api/saved-scenario/route.js` | POST | rate-tool save | calls `priceScenario()` via `createScenario` | | public | none |
| API21 | `/api/portal/mlo/scenario-alerts/route.js` | GET/POST | | review queue | | MLO session | none |

---

## 5. Selection logic

### 5.1 `pickParRate()` — the canonical rule

**Defined:** `src/lib/rates/pick-par-rate.js:38-74`.

Rule:
1. Group ladder by rate, keep max `finalPrice` at each rate.
2. Filter to rates where best `finalPrice >= 100`.
3. Pick the **lowest** such rate (`reduce r.rate < best.rate`).
4. Fallback: closest to par, tiebreak by lower rate, tag `reason: 'fallback_closest'`.

### 5.2 Where it's applied — and where it isn't

| Surface | Uses `pickParRate()`? | What it does instead |
|---------|----------------------|----------------------|
| Homepage (E4) | ✅ Yes — `src/lib/rates/homepage-db.js:167` | — |
| `/rate-watch` | ✅ Yes (via E4) | — |
| `/api/pricing` → `priceScenario()` (E2) | ❌ **No** | Returns full sorted ladder (`price-scenario.js:231`). The caller picks. |
| RateTool hook (`useApiPricing`) | ❌ **No rule** | Groups by rate keeping best `finalPrice` (`useApiPricing.js:67-73`), filters rate 4–9 and ±2.5 from par (`:106-107`). Shows all — borrower picks. |
| MLO Quote POST (`pickTopScenarios`) | ❌ **DIFFERENT RULE** | `src/app/api/portal/mlo/quotes/route.js:320-353` — picks **best `finalPrice` per lender**, then `.sort((a,b) => a.rate - b.rate)`, takes top 3. This is "lowest rate across all lenders" — **not** gated on `finalPrice >= 100`. |
| Scenario Alerts cron | ❌ | `src/app/api/cron/scenario-alerts/route.js:89-101` — `sort((a,b) => a.rate - b.rate).slice(0,3)`. Same problem as MLO quote. |
| My-Rates reprice | ❌ | `src/app/api/my-rates/reprice/route.js:63-66` — same pattern: `.sort` by rate, `.slice(0,3)`. |

**This is the #1 divergence risk.** Four surfaces pick "top 3 by lowest rate" without the par gate. Homepage picks "lowest ≥ par." Saved scenarios show one rate, homepage shows a different one for the same inputs — by design.

### 5.3 LLPA application order (`priceRate`, pricing-v2.js:360-611)

1. Base price (`getBasePrice`, 100-based conversion if needed)
2. FICO/LTV from DB grids — **Elite Govt has a branched path** (`isEliteGovt`, lines 382-428)
3. SRP from DB
4. Risk-based LLPAs (Core conventional only)
5. Loan amount LLPA (Core only)
5a. Per-product loan amount (`productLoanAmount` rows)
5b. Purchase credit (`productFeatures` purposeAdj)
5c. Other product features (condo, manufactured, 2-4unit, investment, ARM, state, FICO band)
6. Investor-specific (FNMA/FHLMC 20/25/30yr)
6b. FHLMC special rules (`fhlmcSpecial`)
7. Broker comp

Everything except a couple of constants (§2.4) comes from `adjustment_rules` via `getDbLenderAdj`.

### 5.4 Comp handling

- `priceScenario()` sets `brokerConfig = { compRate: borrowerPaid ? 0 : lenderData.compRate, compCapPurchase: ..., compCapRefi: ..., fhaUfmip: ... }` (`price-scenario.js:140-145`).
- `homepage-db.js` **hardcodes `compRate: 0`** for public display (`homepage-db.js:91-95`) — comment explicitly says "homepage shows borrower-facing par rates from the sheet." This is intentional per the documented BRP philosophy.
- `borrowerPaid: true` from API1 callers → `compRate=0, compCapPurchase=0, compCapRefi=0`.
- DSCR calculator (`dscr-calculator/page.js:6-8`) **applies comp client-side with its own hardcoded constants** after receiving un-comped prices from API2. **DSCR path is inconsistent.**

---

## 6. Caching

| # | Location | TTL | Scope | Notes |
|---|----------|-----|-------|-------|
| C1 | `src/lib/rates/price-scenario.js:19-20` | 2 min | module-level (`rateCache`) | caches `loadRateDataFromDB()` result |
| C2 | `src/lib/rates/homepage-db.js:24-25` | 30 min, keyed on `effective_date` | module-level (`homepageCache`) | auto-busts on new sheet |
| C3 | `src/lib/rates/db-adj-loader.js:14-15` | 5 min | module-level Map per `lenderCode:loanType` | no bust on seed — requires redeploy or calling `clearAdjCache()` |
| C4 | `src/lib/quotes/fee-builder.js:21-22` | 10 min | module-level Map per `state|county|purpose` | fee template cache |
| C5 | `src/app/api/pricing/dscr/route.js:52-54` | 1 min | module-level sheet cache | |
| C6 | ISR — `src/app/page.js:14` | 30 min | page-level | |
| C7 | ISR — `src/app/rates/page.js:15` | 30 min | page-level (rate tool client re-fetches on interact) |
| C8 | ISR — `src/app/rate-watch/page.js:16` | 30 min | page-level |
| C9 | ISR — `src/app/rate-watch/[date]/page.js:5` | 1 hr | page |
| C10 | ISR — `src/app/rate-watch/archive/page.js:4` | 1 hr | page |
| C11 | API1 Cache-Control | `s-maxage=60, max-age=30, swr=60` | edge/CDN | |
| C12 | API2 Cache-Control | `s-maxage=60, max-age=30, swr=120` | edge/CDN | |

**Worst case total lag** before a rate change propagates from a rate-sheet parse to the homepage: C3 (5m) + C2 (30m) + C6 (30m) = **~65 min**. In practice the cache key on `effective_date` busts C2 instantly; C3 is the real stickler.

**Client-side caches:** none detected for pricing (no sessionStorage/localStorage in rate paths beyond BRP scenario persistence).

---

## 7. Hardcoded fallbacks

Rates that appear as **"if DB query fails"**:

| # | Location | Value | Activation |
|---|----------|-------|-----------|
| F1 | `src/app/page.js:57` | `'5.875%'` (conv30 rate) | when `getHomepageRatesFromDB()` returns null |
| F2 | `src/app/page.js:58` | `'5.94%'` (conv30 APR) | same |
| F3 | `src/app/page.js:59` | `'$2,366'` (conv30 payment) | same |
| F4 | `src/app/page.js:60` | `'Mar 24, 2026'` (effective date) | same |
| F5 | `src/app/page.js:64` | `'5.250%' / '5.38%'` (conv15) | |
| F6 | `src/app/page.js:65` | `'5.500%' / '6.12%'` (fha30) | |
| F7 | `src/app/page.js:66` | `'5.375%' / '5.52%'` (va30) | |
| F8 | `src/app/rate-watch/page.js:84-96` | `FRED_FALLBACK` object — 2026-03-26/27/28 snapshot | when FRED API key missing or down |
| F9 | `src/app/api/rates/fred/route.js:29` | `FALLBACK_DATA` with 2026-03-28 snapshot | when fred_series_data + live FRED both fail |

**Risk:** F1-F7 were last updated ~24 Mar. If `getHomepageRatesFromDB()` silently returns null (e.g., the `LIMIT 1` bug of PR #82), users see a 3-week-stale rate with no warning banner. No monitoring alerts on fallback activation.

---

## 8. Scenario input shape

**Canonical shape** (implicit — not a typed schema): the body accepted by `priceScenario()` (`price-scenario.js:66-81`):

```js
{
  loanAmount:     number,   // required, 50K-10M
  loanPurpose:    'purchase' | 'refinance' | 'cashout',
  loanType:       'conventional' | 'fha' | 'va' | 'usda',
  state:          string,   // 2-letter
  county:         string?,
  creditScore:    number,   // default DEFAULT_SCENARIO.fico = 780
  propertyValue:  number?,  // if set → LTV derived
  term:           number,   // default 30
  lockDays:       number,   // default 30
  firstTimeBuyer: boolean,
  productType:    'fixed' | 'arm',
  borrowerPaid:   boolean,  // affects comp
}
```

**Extended fields** consumed inside `priceRate()` but NOT documented in the API1 JSDoc:

- `propertyType` (`pricing-v2.js:488` — defaults 'sfr')
- `occupancy` (`pricing-v2.js:489` — defaults 'primary')

**Caller comparison:**

| Caller | Required fields passed | Notable gaps |
|--------|-----------------------|--------------|
| RateTool hook | all 12 + `vaFundingFeeExempt`, `vaSubsequentUse` | passes undocumented extras |
| RefinanceCalc hook | core fields | OK |
| DSCR calc client | uses API2, different shape | separate — OK |
| API4 my-rates reprice | only the columns read from `scenarios` table | **missing: firstTimeBuyer, propertyType, occupancy, productType** — stored scenarios can't round-trip to full pricing |
| API16 scenario-alerts cron | same as reprice | **same gap** — alerts drift from reprice |
| API6 MLO POST | full body | OK |
| API10 MLO lead-quote | derived from lead — partial | likely missing propertyType, occupancy |

**Risk:** reprice and cron read from the `scenarios` table which doesn't store `property_type`, `occupancy`, `product_type`, or `first_time_buyer` consistently (per PASS-5 notes). Subsequent reprices run with different assumptions than the original quote.

---

## 9. Hardcoded config / policy

| # | Policy | Location | Why it's a problem |
|---|--------|----------|---------------------|
| P1 | `DEFAULT_SCENARIO = {fico:780, loanAmount:400000, ltv:75, state:'CO', ...}` | `src/lib/rates/defaults.js:14-27` | Used everywhere; changing requires redeploy |
| P2 | Product filter on homepage | `src/lib/rates/homepage-db.js:113-117` — hardcodes `product_type='fixed', occupancy='primary', is_high_balance=false, is_streamline=false, is_buydown=false, is_interest_only=false` | Adding a new hero product (e.g. 7/6 ARM) requires code change |
| P3 | Product list shown on homepage | `src/app/page.js:62-67` — conv30, conv15, fha30, va30 | Hardcoded |
| P4 | Product filter in pricer | `src/lib/rates/price-scenario.js:181-194` — skips FastTrack, Buydown, non-matching purpose | Scattered filter rules |
| P5 | First-time buyer cross-type logic | `src/lib/rates/price-scenario.js:156-165, 218-222` — if FTHB + FHA/VA, also price HomeReady/HomePossible against conventional adjustments | Business rule buried in orchestration |
| P6 | Rate range filter on RateTool | `src/components/RateTool/useApiPricing.js:106` | hides rates <4 and >9 |
| P7 | Near-par filter on RateTool | `src/components/RateTool/useApiPricing.js:107` — `abs(finalPrice - 100) <= 2.5` | Customer sees at most ±2.5 pts around par; policy decision |
| P8 | Licensed states | `src/lib/rates/closing-costs.js:7-11` (CA/CO/TX/OR) | duplicated in RefinanceCalc |
| P9 | Rounding | `pricing-v2.js:599` rounds finalPrice to 3 decimals; `price-scenario.js:77` rounds LTV to 2 decimals using `Math.floor` | OK but undocumented |
| P10 | Hardcoded example rates in marketing | `/breakeven`, `/how-pricing-works`, `/points-and-credits` — all reference "5.500%" | stale-by-deploy |
| P11 | Homepage fallback rates | §7 F1-F7 | stale-by-deploy |
| P12 | Purchase calculator default rate `'6.875'` | `src/app/tools/purchase-calculator/page.js:38` | not synced to live rates |
| P13 | Refi analyzer default rates 7.50/6.50 | `src/app/tools/refi-analyzer/page.js:40,42` | not synced |
| P14 | DSCR calc broker comp (client-side) | `src/app/tools/dscr-calculator/page.js:6-8` | `COMP_RATE=0.02, COMP_CAP_PURCHASE=4595, COMP_CAP_REFI=3595` — one of only two places where comp caps aren't in the DB (`rate_lenders.max_comp_cap_purchase`) |
| P15 | Sub-fin comparison LLPA grid | `src/lib/rates/sub-financing-comparison.js:18-42` | Full hardcoded FNMA/FHLMC grid — stale the moment GSEs publish new LLPAs |
| P16 | FHA MIP schedule | `src/lib/quotes/fee-builder.js:82-89` | annual HUD update |
| P17 | FHA high-balance threshold `726200` | `src/lib/quotes/fee-builder.js:83` | **stale** — 2023 value |
| P18 | Default FHA UFMIP rate `0.0175` in pricing-v2 | `src/lib/rates/pricing-v2.js:369` | duplicates fee-builder; drift |
| P19 | HECM UFMIP 2%, ARM margins | `src/lib/hecm/*` | hardcoded ARM margin table updated manually from RMI sheets |
| P20 | `DEFAULT_STATE = 'CO'` | `src/lib/rates/closing-costs.js:13` | defaults leak into non-CO visits |

---

## 10. Test coverage

**Finding: zero automated tests exist for pricing.**

- No `*.test.js` or `*.spec.js` files anywhere in the repo (Glob found one false positive in a docs file).
- No Jest/Vitest config visible.
- Only `scripts/_test-price-dscr.mjs` — a single ad-hoc script for DSCR pricing, not a test.
- No CI hooks verify pricing math.
- No fixture snapshots of expected prices for the standard scenario ($400K/75LTV/780 FICO CO Conv30).
- `/api/cron/health-check` runs daily and reports rate-sheet freshness (not pricing correctness).
- No alert exists if `homepage` and `/api/pricing` diverge for the same inputs.

---

## 11. Gaps & Risks

### 11.1 Two surfaces can show different rates for the same scenario

**Drivers:**

1. **Selection rule divergence (§5.2)** — homepage uses `pickParRate()` (lowest ≥ par), MLO quote / cron / reprice use "lowest 3 by rate" without the par gate. The cheapest rate shown on the homepage may not be the first rate in a saved scenario for the same inputs.
2. **Comp differences** — homepage forces `compRate=0`; `/api/pricing` uses the lender's DB comp rate; DSCR calc applies comp client-side with hardcoded constants; sub-financing uses hardcoded 0.02/3595.
3. **Homepage in-memory cache lags** (§6 C2, 30 min) vs. API (§6 C1, 2 min) vs. adj-loader (§6 C3, 5 min) — mid-window, three surfaces may see three different versions of adjustment rules.
4. **Homepage reads `rate_sheets` directly** (`homepage-db.js:56-65`) while `/api/pricing` reads via `loadRateDataFromDB()` (different query, different lender-status filter — homepage filters `rl.status = 'active'`, loader filters `rl.status <> 'excluded'`). A lender with status=null is included by pricer, excluded by homepage.

### 11.2 DB changes can silently break a surface

- Adding a new LLPA `adjustment_type` — `db-adj-loader.js` switch (`:81-231`) silently drops unknown types. `priceRate()` doesn't know.
- Renaming a `product_group` value in `adjustment_rules` — `priceRate()` compares string values to `'condo', 'manufactured', '2to4unit', 'investment', 'arm', 'highBalArm'` (`:508-515`); any rename becomes a silent no-op.
- Dropping `rate_lenders.price_format` → defaults to `'100-based'` (`db-loader.js:87`); if a sheet is actually `discount`, the math inverts.
- Changing `tier` strings beyond `'core' | 'elite'` — the `resolveGrids` fn (`:34-69`) falls through to `fallbackGrids` with no warning.

### 11.3 Redeploy-required policy

All items in §9 P1–P20 require a PR + Vercel build. This includes: default scenario, product lists, filter rules, rate ranges, rounding, FHA MIP schedule, UFMIP rate, HECM margins, marketing example rates, hero fallback rates.

### 11.4 Unmonitored

- Nothing alerts if homepage rate ≠ `/api/pricing` rate for the same scenario.
- Nothing alerts when F1-F7 hardcoded fallbacks activate (homepage just silently renders the stale strings).
- Nothing alerts when `pickParRate` returns `reason: 'fallback_closest'` — only a `console.warn` that won't surface outside Vercel logs.
- Nothing alerts when `configWarnings[]` is non-empty in API1 response — it's returned but callers don't log it.
- `db-adj-loader` cache has no invalidation hook post-seed; running `seed-adjustment-rules.mjs` doesn't clear live server caches.

---

## 12. Punch list (prioritized)

### Critical

- **[CRITICAL C1] Kill the parallel homepage engine.** `src/lib/rates/homepage-db.js` duplicates ~250 lines of `priceScenario()` orchestration: own SQL query, own broker-config build, own product filter, own ladder build. Already leaked two bugs (PR #82 LIMIT 1; original hard-fail→hardcoded 5.875% from D3 re-audit). **Fix:** Replace `getHomepageRatesFromDB()` internals with a call to `priceScenario({ ...DEFAULT_SCENARIO, loanType, term, borrowerPaid: true })` + `pickParRate()` on the returned ladder. Delete the custom SQL + filter. Scope: medium (need to preserve `compRate=0` semantic via `borrowerPaid: true`; verify cache layer still works).
- **[CRITICAL C2] Unify the par-rule.** Four surfaces (§5.2) pick top-3-by-lowest-rate with no par gate; homepage picks lowest ≥ par. **Fix:** Apply `pickParRate()` inside `priceScenario()` (or expose a `{parPick, ladder}` shape) and refactor API6 `pickTopScenarios`, API4 my-rates reprice, API16 scenario-alerts, API10 lead-quote to use the shared rule. Homepage keeps its top-1; MLO surfaces get top-N-at-or-above-par. Scope: medium — touches 4 routes + matching UI expectations.
- **[CRITICAL C3] Delete or rewrite `sub-financing-comparison.js`.** Hardcoded FNMA/FHLMC LLPA grid (`:18-42`) — stale the day it was written. Hardcoded `COMP_RATE=0.02, COMP_CAP_REFI=3595` (`:47-48`). **Fix:** either delete (no imports found) or rewrite to run two `priceScenario()` calls and diff. Scope: small if deletion, medium if rewrite.

### High

- **[HIGH H1] `DEFAULT_SCENARIO` hardcoded in JS.** (`src/lib/rates/defaults.js:14-27`). Should be a DB row or at minimum a JSON file loaded at build-time so Admin can change without a deploy. Scope: small.
- **[HIGH H2] FHA UFMIP rate duplicated in 3 places** (`pricing-v2.js:369`, `fee-builder.js:91`, `hecm/constants.js:3`) and FHA MIP schedule hardcoded in `fee-builder.js:82-89`. **Fix:** move FHA params to `rate_lenders` (exists — `fha_ufmip`) and a new `fha_mip_schedule` table or `fee_templates` field. Retire the constants. Scope: medium.
- **[HIGH H3] FHA high-balance threshold `726200` stale** (`fee-builder.js:83`). Should be the 2026 FHA baseline (`541,288`) or per-county from `county-loan-limits.js`. Scope: small; touches one function.
- **[HIGH H4] DSCR calc applies broker comp client-side with hardcoded constants.** (`src/app/tools/dscr-calculator/page.js:6-8`). Comp should be server-side in `price-dscr.js` reading from a DSCR-lender config. Scope: medium.
- **[HIGH H5] Homepage fallback rates are stale strings.** (§7 F1-F7). **Fix:** if `getHomepageRatesFromDB()` returns null, render a "rates temporarily unavailable" state instead of stale numbers; log to Sentry / health-check endpoint. Scope: small UI change.
- **[HIGH H6] No divergence monitoring.** Add `/api/cron/health-check` check that prices `DEFAULT_SCENARIO` via both `priceScenario()` and `getHomepageRatesFromDB()` and alerts if they differ. Scope: small.
- **[HIGH H7] Stored scenarios drop `propertyType`, `occupancy`, `productType`, `firstTimeBuyer`.** (§8). Reprice and alerts produce different pricing than the original quote. **Fix:** extend the `scenarios` table + DAL write path. Scope: medium (DB migration + DAL).

### Medium

- **[MEDIUM M1] `db-adj-loader` cache has no seed-invalidation.** (§6 C3). After `scripts/seed-adjustment-rules.mjs` runs, live Vercel instances serve stale adj data for up to 5 min. **Fix:** cache key should include a `rate_sheets.updated_at` or `adjustment_rules.max(updated_at)` timestamp; or add `/api/admin/clear-rate-cache`. Scope: small.
- **[MEDIUM M2] Two `getFicoBand` functions disagree.** `src/lib/rates/engine.js:11-22` has `>=800`; `src/lib/rates/pricing-v2.js:168-179` has `>=780`. Both are in use. **Fix:** delete the `engine.js` one; if the 800 band is needed elsewhere, add it to pricing-v2. Scope: small.
- **[MEDIUM M3] `STATE_DEFAULTS` duplicated.** `src/lib/rates/closing-costs.js:7-11` (3 fields) vs. `src/components/RefinanceCalc/shared.js:11-14` (5 fields, includes taxRate). **Fix:** consolidate in one module; move to DB (tied to `fee_templates`). Scope: small.
- **[MEDIUM M4] Hero product list hardcoded.** (`src/app/page.js:62-67`). Moving to a `homepage_products` config table (or reading from `rate_lenders`/`rate_products` flag) unlocks marketing changes without deploy. Scope: small.
- **[MEDIUM M5] `priceScenario()` doesn't return the picked par rate — callers each redo the pick.** API1 response is a sorted ladder; every consumer then sorts and slices. **Fix:** add `result.parRate` and `result.topByLender` to the return shape. Scope: small, additive.
- **[MEDIUM M6] Public APIs (API1, API2) unauthenticated.** Anyone can call `/api/pricing` with any scenario. No rate limit. Not a pricing-correctness issue but a scraping/abuse surface. Scope: medium (add rate limit or require a signed nonce from the page). |
- **[MEDIUM M7] Marketing pages reference specific rates** (`/breakeven`, `/how-pricing-works`, `/points-and-credits`). Either caveat as "example only" or pull from `DEFAULT_SCENARIO` live. Scope: small.
- **[MEDIUM M8] Purchase-calc / Refi-analyzer seed rates** (`/tools/purchase-calculator` `'6.875'`, refi `'7.50'/'6.50'`). Should default to the live par rate for DEFAULT_SCENARIO. Scope: small.

### Low

- **[LOW L1] `loan-limits-2025.json`** is dead weight in `src/data/`. Delete.
- **[LOW L2] Configwarnings never surfaced to UI.** `priceScenario()` returns `configWarnings[]` but only MLO-POST logs them as eligibility warnings. API1 consumers silently drop. Scope: small.
- **[LOW L3] `pickParRate` fallback logs via `console.warn`.** No production visibility. Route through a logger that reaches Sentry. Scope: small.
- **[LOW L4] No unit tests anywhere.** (§10). At minimum: a jest snapshot for `priceRate()` on DEFAULT_SCENARIO across the 4 hero products. Prevents silent math changes. Scope: medium (first-test setup + fixtures).
- **[LOW L5] Rate-tool rate-range filter `4 ≤ rate ≤ 9`** (`useApiPricing.js:106`). Hardcoded band will hide results in high-rate or low-rate regimes. Make it `DEFAULT_SCENARIO.baseRate ± 3` or config-driven. Scope: small.

---

## Appendix A — File inventory cross-reference

All pricing-adjacent files touched in this audit (paths relative to repo root):

```
src/lib/rates/pricing-v2.js          E1  engine (core math)
src/lib/rates/price-scenario.js      E2  orchestrator
src/lib/rates/engine.js              E3  helpers (+ dup getFicoBand)
src/lib/rates/homepage-db.js         E4  parallel engine — kill
src/lib/rates/pick-par-rate.js       E5  par selector
src/lib/rates/sub-financing-comparison.js E6 parallel hardcoded — kill
src/lib/rates/empty-adj.js           E7  constant
src/lib/rates/defaults.js            E8  DEFAULT_SCENARIO
src/lib/rates/db-loader.js           E9  rate data loader
src/lib/rates/db-adj-loader.js       E10 adjustment loader
src/lib/rates/closing-costs.js       E12 state defaults
src/lib/rates/math.js                E13 re-export
src/lib/rates/config.js              E15 LO config
src/lib/rates/parsers/*              E16 ingest only
src/lib/mortgage-math.js             E14 canonical math
src/lib/pricing-nonqm/price-dscr.js  E11 DSCR engine
src/lib/hecm/*                       E17 HECM engine
src/lib/quotes/fee-builder.js            fee math + FHA MIP
src/lib/quotes/eligibility.js            eligibility checks
src/app/api/pricing/route.js         API1
src/app/api/pricing/dscr/route.js    API2
src/app/api/my-rates/*               API3,4,5
src/app/api/portal/mlo/quotes/*      API6,7,8,9
src/app/api/portal/mlo/leads/[id]/quote/route.js API10
src/app/api/strike-rate/route.js     API11
src/app/api/rates/history/route.js   API12
src/app/api/rates/fred/route.js      API13
src/app/api/market/national-rates/*  API14,15
src/app/api/cron/scenario-alerts/route.js API16
src/app/api/cron/mnd-scrape/route.js API17
src/app/api/cron/fred-snapshot/route.js API18
src/app/api/cron/health-check/route.js API19
src/app/api/saved-scenario/route.js  API20
src/app/page.js                      D1-D3  homepage hero
src/app/rates/page.js                D4     rates tool page
src/app/rate-watch/page.js           D5     rate watch
src/app/rates/dscr/page.js           D8
src/app/rates/heloc/page.js          D9     static
src/app/rates/non-qm/page.js         D10    static
src/app/tools/*                      D11-D17
src/app/refinance-calculator/page.js D18
src/app/breakeven/page.js            D19    static w/ hardcoded rates
src/app/how-pricing-works/page.js    D20    static w/ hardcoded rates
src/app/points-and-credits/page.js   D21    static w/ hardcoded rates
src/app/portal/mlo/tools/quote-generator/page.js D22
src/app/portal/mlo/quotes/[id]/page.js D23
src/app/portal/quote/[id]/page.js    D24
src/app/portal/my-rates/page.js      D25
src/components/RateTool/*            D4 glue
src/components/RateTool/useApiPricing.js client hook
src/components/RefinanceCalc/*       D18 glue (has STATE_DEFAULTS drift)
src/components/DscrRateWidget.js     D28
src/components/Portal/QuoteGenerator/* D22,27 glue
src/components/Portal/PipelineTable.js D29
src/lib/email-templates/borrower.js  D26
src/data/county-loan-limits.js       county data
src/data/county-tax-rates.js         tax rates
src/data/fhfa-loan-limits-2026.csv   source for counties
```

— end of audit —
