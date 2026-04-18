---
date: 2026-04-17
author: pc-dev
doc: Pricing Architecture — target state + migration plan
source_commit: d6cfb4d5715e3a8ee1c3a6de01a087263c0338d7
companion_doc: Work/Dev/audits/D9b-PRICING-AUDIT.md (current-state inventory)
status: spec — pending David's review of Open Questions (§8)
---

# NetRate Mortgage — Pricing Architecture

> *"Database is source of truth, as little finicky code between the source and the result. All 'NetRate Mortgage' rates pull from the pricer. If we need to re-architect that's fine."* — David, 2026-04-17

This doc is the target architecture for all NetRate Mortgage pricing data flow. Its companion ([D9b-PRICING-AUDIT.md](./audits/D9b-PRICING-AUDIT.md)) is the current-state inventory. This doc answers: **what does it look like when it's right, and what's the shortest path from here to there?**

Pricing-drift bugs have leaked to prod repeatedly (PR #82 LIMIT-1, homepage parallel engine, jumbo-leak on PR #103 that we just reverted). The common cause is multiple codepaths that each compute a rate "mostly the same way." This document retires that pattern.

---

## 1. The North Star

Two independent pipelines. Both land in the DB, but **they never cross**. Market context (FRED/MND/Treasury) is never displayed as a NetRate Mortgage rate and never fed into the pricer.

### 1.A — NetRate pricing pipeline (THE rate when we show "our rate")

```
Rate sheet files ──▶ parsers ──▶ DB ──▶ priceScenario() ──▶ pickParRate ──▶ surfaces
(CSV, XLSX)                      │                                            │
                                 │         rate_sheets                        ├─ Homepage (§3.A)
Manual admin    ─────────────────┤         rate_products                      ├─ Rate-Watch hero (§3.B)
(rate_lenders,                   │         rate_prices                        ├─ Tool pages (§3.C)
 LLPA seed)                      │         rate_lenders                       ├─ MLO pricer (§3.D)
                                 │         adjustment_rules                   ├─ Email / PDF (§3.E)
                                 │         nonqm_rate_*                       └─ Rate alerts (§3.F)
                                 │         site_scenarios      (NEW)
                                 │         surface_pricing_config (NEW)
                                 │         homepage_rate_cache  (NEW)
                                 ▼
                          ONE PRICER per product family:
                            priceScenario() — forward (conv/FHA/VA)
                            priceDscrScenario() — NonQM
                            hecm — reverse
```

### 1.B — Market context pipeline (independent — not "our rate")

```
FRED API           ──▶ fred-snapshot cron ──▶ fred_series_data ──┐
MND scrape         ──▶ mnd-scrape cron    ──▶ rate_history       │
Treasury CSV       ──▶ getTreasuryCMT (on-demand fetch)          ├──▶ /rate-watch chart + sidebar
National rates     ──▶ national-rates/scrape ──▶ rate_history    │    (market narrative only)
```

**These sources are never consumed by `priceScenario()` and never displayed as a NetRate rate.** They exist to provide market context on `/rate-watch` (Freddie Mac 30yr average, 10yr Treasury, Fed Funds, MND daily benchmark). When the site shows "the market is trending higher," this is where that comes from. When it shows "our par is 5.875%," that comes from 1.A.

### Principles (enforced, not aspirational)

1. **DB is truth.** Rates, LLPAs, lender config, scenario defaults, surface filters — all live in DB tables. Nothing consumer-visible is derived from a hardcoded literal in code.
2. **One pricer per family.** `priceScenario()` for forward mortgages (conventional/FHA/VA). `priceDscrScenario()` for Non-QM. `hecm` for reverse. No parallel implementations within a family.
3. **Fallbacks are last-known-good, not literals.** If live pricing fails, surfaces read a cache row that the pricer wrote on its last success. Not `'5.875%'` compiled into JSX.
4. **Surface differences are config, not code.** "Homepage excludes buydowns" is a row in `surface_pricing_config`, not a branch in homepage.js.
5. **Parsers write to DB only.** They never return values consumed elsewhere. If you need a number a parser extracted, read it from the DB.
6. **Every user-visible total traces to DB columns.** Derivations are documented (§5); no undocumented math leaks.
7. **Market context is independent.** FRED, MND, Treasury, and any other external market-data source writes to its own tables (`fred_series_data`, `rate_history`) and is read only by /rate-watch chart/sidebar. It is never consumed by `priceScenario()`, never labeled as a NetRate rate, and never shown interchangeably with our pricer's output.

---

## 2. Writes — how data gets into the DB

### 2.1 Rate sheet ingestion

Files flow: **GCS bucket → parser → db-writer → Postgres**.

| Writer | File | Writes to | Trigger |
|---|---|---|---|
| Parser driver | `scripts/parse-gcs-rates.mjs` ✅ exists | — | Manual: `node scripts/parse-gcs-rates.mjs` |
| Lender parsers | `src/lib/rates/parsers/{amwest,everstream,keystone,swmc,tls,windsor}.js` ✅ 6 files | returns parsed product+price arrays (not DB) | Called by `index.js` dispatcher |
| DB writer | `src/lib/rates/db-writer.js` ✅ | `rate_products` (`:64`), `rate_sheets` (`:142 UPDATE status='superseded'`, `:159 INSERT`), `rate_prices` (`:221`) | Called at end of parser driver |

**Known fragility:**
- Six parsers, each with lender-specific logic. A lender changing their sheet format silently breaks ingestion. Parser output is not validated against a schema.
- Parser hardcoded-values audit: **grep for top-level numeric constants in `src/lib/rates/parsers/*.js` returned zero hits**. Values appear to flow through lender config. A deeper audit (inline numeric literals inside parse functions) is still an open item — flagged for future work, not blocking D9b.
- Supersede logic exists (`db-writer.js:142` marks prior active sheet as `'superseded'` before inserting new one) — **correcting earlier claim that no state machine existed**. Potential race: two concurrent parses for the same lender could still deadlock or both mark themselves active. Low risk given manual trigger.
- No automated checksum / dry-run mode; the only validation is "did parse-gcs-rates crash."

### 2.2 Adjustment rule seeding

| Writer | File | Writes to | Trigger |
|---|---|---|---|
| Seed script | `scripts/seed-adjustment-rules.mjs` | `adjustment_rules` | Manual after LLPA grid changes |
| Adj writer lib | `src/lib/rates/adj-writer.js` | `adjustment_rules` | Called by seed script |

**Known fragility:**
- Seeding is manual and rarely run. When GSEs publish new LLPAs, there's no automated ingest.
- No versioning — changes overwrite in place.

### 2.3 Non-QM / DSCR ingestion

| Writer | File | Writes to | Trigger |
|---|---|---|---|
| NonQM ingest | `src/lib/pricing-nonqm/ingest.js` | `nonqm_rate_sheets`, `nonqm_rate_products`, `nonqm_adjustment_rules` | Manual |

### 2.4 Market context (independent of pricing pipeline 1.A)

These writers feed `/rate-watch` chart and sidebar — Freddie Mac weekly rates, MND daily benchmark, Treasury yield curve, Fed Funds, SOFR. They **never** feed the pricer and never get labeled as a NetRate rate. Listed here for completeness of the write-inventory, but §1.B is the authoritative description of this pipeline.

| Writer | File | Writes to | Source | Schedule |
|---|---|---|---|---|
| MND scrape | `src/app/api/cron/mnd-scrape/route.js` | `rate_history` (source='mnd') | Mortgage News Daily | Vercel cron |
| FRED snapshot | `src/app/api/cron/fred-snapshot/route.js` | `fred_series_data` | FRED API (Freddie Mac 30yr/15yr, Treasuries, SOFR, Prime, Fed Funds) | Vercel cron |
| National rates scrape | `src/app/api/market/national-rates/scrape/route.js` | `rate_history` | MND product variants | Manual / cron |
| Treasury CMT | (fetched inline by `/rate-watch/page.js:getTreasuryCMT`, not written to DB) | — | home.treasury.gov CSV | Per-request |
| NetRate par snapshot | `scripts/rate-history-snapshot.js` | `rate_history` (source='netrate') | Our own pricer output (snapshots our par for historical chart) | Manual; **should be cron** |
| Backfill | `scripts/backfill-rate-history.mjs`, `scripts/ingest-rate-watch.mjs`, `scripts/write-rate-history.mjs` | `rate_history` | One-shot historical import | — |

Note: the "NetRate par snapshot" row is a bridge — it takes the current day's par output from the pricing pipeline (1.A) and writes a point into `rate_history` so the /rate-watch chart can plot our par alongside MND. That's a read from 1.A and a write into the 1.B-shaped table. This is the only sanctioned crossover: pricer → market-context table for historical charting. It is **not** a round-trip — the chart reads `rate_history` but never shows that as a "live NetRate rate" to a borrower.

### 2.5 `rate_lenders` — seeded, not actively written

Verified: seeded one-shot via `scripts/migrate-to-pc-db.js:176`. After migration, the only way to update comp rates, comp caps, UW fees, or FHA UFMIP is direct DB edit. No admin UI, no re-import script that's safe to re-run. This is a known gap — a lender changes their comp contract and there's no workflow to update it in our system. Out of scope for D9b but should become a post-migration feature.

### 2.6 What's NOT currently written (and should be)

- **`homepage_rate_cache`** (proposed): `priceScenario()` for the 4 homepage scenarios should write the last-known-good result here on every successful ISR revalidation. Homepage falls back to this row when the live call fails. No more hardcoded `'5.875%'` in page.js.
- **`site_scenarios`** (proposed): the 4 default homepage scenarios + any other "this is what we display by default" scenarios. Currently `DEFAULT_SCENARIO` is hardcoded in `src/lib/rates/defaults.js`.
- **`surface_pricing_config`** (proposed): per-surface filter flags (e.g. homepage excludes buydowns, MLO pricer includes everything). Currently lives as boolean kwargs to the new (reverted) `priceScenario({excludeStreamline, ...})` call.

---

## 3. Reads — who pulls what

### 3.A Homepage (`src/app/page.js`)

- **Source (current):** `getHomepageRatesFromDB()` in `src/lib/rates/homepage-db.js` — **parallel engine** (~246 lines) that reimplements `priceScenario` orchestration.
- **Source (target):** thin `getHomepageLiveRates()` wrapper that calls `priceScenario()` with the homepage scenario + homepage surface config, then `pickParRate()`. Reads `site_scenarios['homepage_default']` + `surface_pricing_config['homepage']`. If live call fails, reads `homepage_rate_cache` for last-known-good. No hardcoded fallback.
- **Blocker to target:** jumbo-leak bug in `priceScenario` (PR #103 revert). Fix queued as D9b.3-v2.

### 3.B Rate-Watch (`src/app/rate-watch/page.js`)

- Multiple reads: `getHomepageRatesFromDB()` (current) for hero strip + generateMetadata; `getMndHistory()`, `getFredData()`, `getTreasuryCMT()` for chart/sidebar.
- Target: hero strip goes through same `getHomepageLiveRates()` wrapper as homepage — single source.
- Rate-history (MND chart) stays as-is; that's time-series, not a pricing consumer.

### 3.C Tool pages

| Tool | File | Currently pulls from pricer? |
|---|---|---|
| Purchase calculator | `src/app/tools/purchase-calculator/page.js` | ❌ **Verified** — user-entered rate with hardcoded default `'6.875'` (`:41`). Uses local `pmt()` function (`:10`) duplicating `calculateMonthlyPI`. No `priceScenario` call. |
| Refi analyzer | `src/app/tools/refi-analyzer/page.js` | ❌ **Verified** — user-entered rates with hardcoded defaults `currentRate='7.50'` (`:40`), `newRate='6.50'` (`:42`). No `priceScenario` call. |
| Cost of waiting | `src/app/tools/cost-of-waiting/page.js` | ❌ **Verified** — hardcoded defaults `currentRate='7.25'` (`:39`), `newRate='6.50'` (`:40`). No `priceScenario` call. |
| Refinance calculator (full) | `src/app/refinance-calculator/page.js` → `src/components/RefinanceCalc/useRefinanceEngine.js:71` | ✅ **Verified** — calls `/api/pricing` via fetch. Canonical. |
| Second-lien comparison | `src/components/calculators/SubFinancingComparison.js` → `src/lib/rates/sub-financing-comparison.js` | ❌ **Verified** — hardcoded GSE LLPA grid (`sub-financing-comparison.js:18-42`) + hardcoded `COMP_RATE=0.02`, `COMP_CAP_REFI=3595` (`:47-48`). Live page (prod 200). |
| DSCR calculator | `src/app/tools/dscr-calculator/page.js:137` | ✅ **Verified** — calls `/api/pricing/dscr` → `priceDscrScenario()`. Canonical. |
| Breakeven page | `src/app/breakeven/page.js` | ✅ **Verified** — marketing/educational page, no live rates computed. Links to `/rates`. |
| HECM optimizer | `src/app/tools/hecm-optimizer/*` | Own HECM engine (separate family). Not audited in this pass. |
| Reverse mortgage | `src/app/tools/reverse-mortgage-calculator/*` | HECM engine. Not audited in this pass. |

**Per David's vision:** every calculator that shows or uses a conventional/FHA/VA rate must call `priceScenario()` for that rate — not a hardcoded assumption.

### 3.D MLO pricer

- RateTool UI: `src/components/RateTool/*` → calls `/api/pricing` → `priceScenario()` ✓ (canonical)
- Quote generator: `src/app/api/portal/mlo/quotes/route.js:14,135` imports and calls `priceScenario()` directly ✓ (canonical engine)
- **Par-rule divergence confirmed here:** after `priceScenario()` returns the ladder, the route groups by lender and keeps the highest-`finalPrice` per lender (`:326`) — NOT `pickParRate()`. Caller picks a different row than the homepage's par. This IS one of the "4 bypassing surfaces" flagged in the D9b audit (C2 finding) and drives a real borrower-experience inconsistency (lead sees one rate in saved scenario, different rate in MLO quote).
- Quote persistence: saves the selected row to `scenarios` / `scenario_rates` for later re-pricing.

### 3.E Email / PDF

- Quote email (`src/lib/email-templates/borrower.js :quoteTemplate`) — receives rates from caller; caller is MLO quote gen (canonical).
- Rate alert emails (`scenarioAlertTemplate`) — receives rates from the cron that re-prices saved scenarios.
- Lead alert (`inbound-lead-alert.js`) — shows borrower-submitted rate, not our pricer's.
- PDF generation (via `@react-pdf/renderer`) — driven by MLO quote gen.

### 3.F Rate alerts / saved scenarios

- Saved scenario re-pricer (cron): calls `priceScenario()` for each saved scenario ✓
- Strike-rate MVP (`src/app/api/strike-rate/route.js`): captures borrower's strike preference, prices against `priceScenario()` ✓

### 3.G APIs

| Route | Reads from | Canonical? |
|---|---|---|
| `POST /api/pricing` | `priceScenario()` | ✓ |
| `POST /api/pricing/dscr` | `priceDscrScenario()` | ✓ (DSCR family) |
| `GET  /api/my-rates` | `scenarios` + live re-price via `priceScenario` | ✓ |
| `POST /api/my-rates/reprice` | `priceScenario()` | ✓ |
| `POST /api/strike-rate` | `priceScenario()` | ✓ |
| `POST /api/portal/mlo/quotes` | `priceScenario()` | ✓ |
| `GET  /api/rates/history` | `rate_history` table | time-series, not pricing |
| `GET  /api/rates/fred` | `fred_series_data` | time-series |
| `GET  /api/market/national-rates` | `rate_history` (source='mnd') | time-series |

**The API layer is already canonical.** The problem is in the page-level reads that bypass it.

---

## 4. Calcs — how `priceRate()` walks the model

Source: `src/lib/rates/pricing-v2.js` (612 lines), function `priceRate(rateEntry, product, scenario, lenderAdj, brokerConfig, llpaGrids)` at line 360.

All math is **100-based**. `finalPrice = 100` is par. `> 100` is rebate (credit to borrower). `< 100` is discount (borrower pays points).

```
Step 1: Base price
  getBasePrice(rateEntry, product.priceFormat)              [pricing-v2.js:20]
  ← If parser emitted discount format, convert to 100-based.

Step 2: FICO/LTV LLPA
  resolveGrids(tier, investor, term, lenderAdj, fallback)   [pricing-v2.js:34]
  getFicoLtvAdjustment(fico, ltv, purpose, grids)           [pricing-v2.js:77]
  ← Conventional: subtract cost. Core FHA: signed add.
  ← Elite FHA/VA: different path — FICO/Amount grid +
    Purpose/State/FICO/LTV grid (eliteFhaFicoLoanAmt,
    eliteFhaPurposeLtv from lenderAdj).                     [pricing-v2.js:404]

Step 3: SRP (state/term/productType/loanType premium)
  getSRP(state, term, productType, tier, lenderAdj, amt, type)  [pricing-v2.js:192]
  ← Credit → add to price.

Step 4: Risk-based (Core conventional only)
  getRiskBasedAdjustment(fico, ltv, lenderAdj)              [pricing-v2.js:243]
  ← Credit → add.

Step 5: Loan amount adjustment (Core)
  getLoanAmountAdjustment(effectiveAmount, lenderAdj)       [pricing-v2.js:281]
  ← Credit → add.

Step 5a: Per-product loan amount adjustment
  Iterate lenderAdj.productLoanAmount matching tier/agency/
  productType/term/loan-amount-range. First match wins.      [pricing-v2.js:457]

Step 5b: Purchase credit
  Iterate lenderAdj.productFeatures matching purpose=purchase.  [pricing-v2.js:473+]

Step 6: Investor adjustment (FNMA/FHLMC/GNMA tweaks)
  getInvestorAdjustment(investor, term, productType, lenderAdj)  [pricing-v2.js:317]

Step 7: Broker comp deducted from price
  getBrokerComp(loanAmount, purpose, brokerConfig)          [pricing-v2.js:339]
  ← Negative to price. With borrowerPaid=true, compRate=0
    so the percentage arm is zero — but compCap* still apply
    as a flat deduction. See §8 Open Q for whether this is
    intentional.

Final:
  finalPrice (100-based)
  netCost = (100 - finalPrice) * loanAmount / 100
    netCost > 0 → borrower pays $netCost (discount)
    netCost < 0 → borrower receives $|netCost| (rebate)
```

`pickParRate(ladder)` in `src/lib/rates/pick-par-rate.js` selects: **lowest rate with `finalPrice ≥ 100` across all lender/product/rate combos.** Fallback to closest-to-par if none above par.

---

## 5. Derivations — every user-visible total traced

### 5.1 Homepage hero

| Displayed | Rendered at | Source chain |
|---|---|---|
| 30-yr rate `5.875%` | `src/app/page.js:87` | `liveRates.conv30.rate` → `getHomepageRatesFromDB()` → `priceProduct('conventional', 30)` → `pickParRate(ladder).rate` → `rate_prices.rate` (a specific row) |
| 30-yr APR `5.94%` | `src/app/page.js:88` | `liveRates.conv30.apr` → `calculateAPR(rate, loanAmount, financeCharges, term)` in `src/lib/mortgage-math.js`. Binary search for APR where PV of payments = `loanAmount − financeCharges`. `financeCharges = Math.max(0, netCost)` |
| 30-yr P&I `$2,366` | `src/app/page.js:93` | `calculateMonthlyPI(rate, loanAmount, termYears)` in `mortgage-math.js`. Standard amortization formula. |
| "Apr 17, 2026" | `src/app/page.js:105` | `liveRates.dateShort` ← `getHomepageRatesFromDB()` reads the max `rate_sheets.effective_date WHERE status='active'` |
| Conv15 / FHA30 / VA30 rows | `src/app/page.js:64-66` | Same chain, different product/term combos |

**Fragility flags:**
- `'5.875%' / '5.94%' / '$2,366' / 'Mar 24, 2026'` **hardcoded as fallback literals** in `page.js:57-60`. Reached when `getHomepageRatesFromDB()` returns null. Must move to `homepage_rate_cache` table, last-known-good pattern.

### 5.2 Rate-Watch

- Hero rate (`src/app/rate-watch/page.js:302`): same chain as homepage.
- Chart (`src/components/RateWatch/RateChart.js`): reads `rate_history` via `getMndHistory()` — time-series, not live pricing.
- Sidebar Treasury/SOFR/Prime/Fed Funds: FRED data via `getFredData()` — time-series.
- **Fallback date `2026-03-26` hardcoded** in `FRED_FALLBACK` (`src/app/rate-watch/page.js:84-96`). Same anti-pattern.

### 5.3 Purchase calculator (verified)

- Monthly payment: **local `pmt()` function** (`src/app/tools/purchase-calculator/page.js:10`) duplicating `calculateMonthlyPI` math — two sources for the same formula.
- Rate: user-entered with hardcoded default `'6.875'` (`:41`). Not tied to pricer output at all.
- Problem: the default rate is stale and doesn't reflect today's par. If a borrower lands on this calculator via a /rates CTA they'll key their own rate in; if they just open the tool cold they see the stale default.
- Fix: on page load (or ISR render), pull par rate from the pricer into the `useState` default. Replace local `pmt()` with the canonical `calculateMonthlyPI` import.

### 5.4 Refi analyzer (verified)

- Same shape: hardcoded defaults `currentRate='7.50'` (`:40`), `newRate='6.50'` (`:42`).
- Breakeven math (closing costs / monthly savings) is local. Closing costs user-entered with default `'4000'` (`:44`) — not tied to `fee_templates`.
- Fix: default `newRate` = pricer par; closing costs default = `fee_templates` lookup by state.

### 5.5 DSCR calculator

DSCR ratio = monthly rent / PITI. PITI → pulls mortgage payment from DSCR pricer output ✓. Already canonical.

### 5.6 Second-lien comparison

Two scenarios (keep-second refi first-only vs cash-out combine). **Currently uses hardcoded GSE LLPA grid** in `sub-financing-comparison.js:18-42`. Derivations downstream of hardcoded data are unreliable by construction.

### 5.7 MLO quote PDF

- Rate + points + closing costs + P&I + APR: all come from `priceScenario()` ladder selection.
- Fees: `fee_templates` table via `fee-builder.js`.
- Clean derivation chain already ✓.

### 5.8 Rate alert email

- Current rate vs previous rate: both from `priceScenario()` at different times (cron-stored).
- Delta in basis points: pure math on the two numbers.
- Clean ✓.

---

## 6. Target architecture

### 6.1 DB schema additions

**`site_scenarios`** — named default scenarios for surfaces.

```sql
CREATE TABLE site_scenarios (
  slug           TEXT PRIMARY KEY,          -- 'homepage_default', 'rate_watch_default'
  description    TEXT,
  loan_amount    NUMERIC NOT NULL,
  property_value NUMERIC NOT NULL,
  fico           INT NOT NULL,
  loan_purpose   TEXT NOT NULL,             -- 'purchase' | 'refinance' | 'cashout'
  property_type  TEXT NOT NULL,
  state          TEXT NOT NULL,
  lock_days      INT NOT NULL DEFAULT 30,
  -- add more fields as surfaces demand; default via homepage seeding
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

Seed row: `('homepage_default', 'Homepage hero default', 400000, 533334, 780, 'purchase', 'sfr', 'CO', 30)`.

Retires `DEFAULT_SCENARIO` constant in `src/lib/rates/defaults.js`.

**`surface_pricing_config`** — per-surface filter flags.

```sql
CREATE TABLE surface_pricing_config (
  surface              TEXT PRIMARY KEY,    -- 'homepage', 'rate_watch', 'mlo_pricer', 'tool_purchase'
  borrower_paid        BOOLEAN NOT NULL DEFAULT TRUE,
  exclude_streamline   BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_interest_only BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_high_balance BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_buydowns     BOOLEAN NOT NULL DEFAULT FALSE,
  exclude_jumbo        BOOLEAN NOT NULL DEFAULT FALSE,
  product_types        TEXT[] NOT NULL DEFAULT ARRAY['fixed'],  -- or NULL for all
  occupancies          TEXT[] NOT NULL DEFAULT ARRAY['primary'],
  tiers_allowed        TEXT[],              -- NULL = all
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
```

Seed row for `homepage`: `borrower_paid=true, exclude_streamline=true, exclude_interest_only=true, exclude_high_balance=true, exclude_buydowns=true, exclude_jumbo=true, product_types=['fixed'], occupancies=['primary']`.

Retires the hardcoded SQL filter list in `homepage-db.js`, and the future `excludeStreamline` kwargs to `priceScenario()`.

**`homepage_rate_cache`** — last-known-good per (site_scenario × loan_type × term).

```sql
CREATE TABLE homepage_rate_cache (
  scenario_slug   TEXT NOT NULL REFERENCES site_scenarios(slug),
  loan_type       TEXT NOT NULL,            -- 'conventional', 'fha', 'va'
  term            INT  NOT NULL,
  rate            NUMERIC NOT NULL,
  apr             NUMERIC,
  monthly_pi      INT,
  final_price     NUMERIC,
  lender          TEXT,
  effective_date  DATE NOT NULL,            -- rate_sheets.effective_date at time of write
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (scenario_slug, loan_type, term)
);
```

Written by the homepage wrapper on every successful ISR revalidation. Read when live call fails. Retires the `'5.875%'` literal fallbacks in `page.js`.

### 6.2 Code shape (target)

```js
// src/lib/rates/homepage.js — ~30 lines, no logic
import sql from '@/lib/db';
import { priceScenario } from './price-scenario';
import { pickParRate } from './pick-par-rate';

export async function getHomepageLiveRates() {
  const scenario = await loadSiteScenario('homepage_default');
  const config   = await loadSurfaceConfig('homepage');

  try {
    const result = await Promise.all([
      priceOne(scenario, config, 'conventional', 30),
      priceOne(scenario, config, 'conventional', 15),
      priceOne(scenario, config, 'fha', 30),
      priceOne(scenario, config, 'va', 30),
    ]);
    await writeCache('homepage_default', result);
    return result;
  } catch (err) {
    console.error('[homepage] live pricing failed, reading cache:', err.message);
    return await readCache('homepage_default');
  }
}

async function priceOne(scenario, config, loanType, term) {
  const r = await priceScenario({ ...scenario, ...config, loanType, term });
  const par = pickParRate(r.results.map(x => ({rate:x.rate, finalPrice:x.finalPrice})));
  return deriveDisplayFields(par, scenario.loanAmount, term);
}
```

Homepage page.js reads `getHomepageLiveRates()` and renders. No fallback literals.

Tool calculators: same pattern, different scenario + config slug.

MLO pricer: uses `mlo_pricer` surface config (all filters off, show full ladder).

### 6.3 Invariants

1. **No JSX rate string literal.** Grep for `\b\d\.\d{3}%\b` in `src/` — any match outside a sample/example context is a defect.
2. **No hardcoded scenario values.** Grep for `loanAmount: 400000` etc. in `src/` — all such values must come from `site_scenarios`.
3. **No surface-specific pricing branch.** `priceScenario()` takes scenario + config; surfaces just pass their slug pair.
4. **Parser output does not bypass DB.** Parsers write, never return values for downstream consumption.
5. **Every on-site rate is reachable via `priceScenario()`.** (HECM is a documented peer, not a bypass.)

---

## 7. Migration path — PRs in order

Numbered against D9b.x continuation. Each PR: shippable alone, small review surface, safety-net coverage via `npm run test:pricing`.

| # | PR | Scope | Risk | Pre-req |
|---|---|---|---|---|
| **D9b.2** | **Verify jumbo leak via diagnostic** — new script `scripts/pricing-diagnose-jumbo.mjs` that queries DB for the Everstream "Jumbo 30yr Fixed Core" product flags, prints what filter set produces homepage-db's 5.875% answer. Commit script + findings to audit doc. | Low | — |
| **D9b.3-v2** | **Re-ship homepage kill** with verified filter set. Includes the new `excludeJumbo` flag on `priceScenario`, jumbo detection via DB column (not name regex if possible), post-deploy `test:pricing:compare` parity check. | Medium | D9b.2 |
| **D9b.4** | **Unify par-rule across 4 bypassing surfaces** (MLO quote POST, my-rates reprice, scenario-alerts cron, lead-quote) — all of them currently pick "top 3 by lowest rate" instead of `pickParRate`. | Medium | D9b.3-v2 (so baseline reflects correct par) |
| **D9b.5** | **Schema: `site_scenarios` table + migration + seed row.** Backfill from `DEFAULT_SCENARIO`; readers get a `loadSiteScenario(slug)` helper. `DEFAULT_SCENARIO` export kept as deprecated passthrough until D9b.8. | Low | D9b.4 |
| **D9b.6** | **Schema: `surface_pricing_config` table + seed rows + reader.** `priceScenario` accepts a `surface` slug (alt to individual kwargs). | Low | D9b.5 |
| **D9b.7** | **Schema: `homepage_rate_cache` + write-on-success + read-on-failure.** Remove hardcoded `'5.875%' / '5.94%' / '$2,366' / 'Mar 24, 2026'` fallback literals from page.js. Same pattern extended to `rate-watch/page.js` FRED fallbacks. | Low | D9b.6 |
| **D9b.8** | **Rewrite `sub-financing-comparison.js`** — delete the hardcoded GSE LLPA grid and hardcoded COMP_RATE/CAP. Function calls `priceScenario()` twice (keep-second first-only vs pay-off combined) and diffs. | Medium | D9b.3-v2, D9b.6 |
| **D9b.9** | **Tool calculator audit + wire-through** — one PR per calculator (purchase, refi, cost-of-waiting). Any hardcoded rate becomes a `priceScenario` call at build/ISR. | Medium | D9b.5, D9b.6 |
| **D9b.10** | **Consolidate `FHA_BASELINE_LIMIT`** — stop deriving from hardcoded `832750 × 0.65`. Read from `county_loan_limits` or a `pricing_policy` table. | Low | — |
| **D9b.11** | **State closing-cost map → DB.** Move `src/lib/rates/closing-costs.js` state defaults into a `state_default_costs` table. RateTool reads from DB. | Low | — |
| **D9b.12** | **Pricing snapshot coverage per surface.** Extend `scripts/pricing-baseline.mjs` to check each tool page + MLO pricer + email quote output, not just homepage. | Low | all above |
| **D9b.13** | **Eliminate duplicate `getFicoBand` / `calculatePI` re-exports** (`src/lib/rates/engine.js` has a rival `getFicoBand` that disagrees with `pricing-v2.js`'s). Keep one, delete the rest. | Low | — |

**Done criterion for D9b as a whole:** every rate displayed by the website is output of `priceScenario()` (or its Non-QM / HECM peers), fed by DB-resident scenario + config, with DB-resident last-known-good fallback. Grepping `src/` for hardcoded rate literals returns zero matches outside test fixtures.

---

## 8. Open Questions (need David's call)

1. **Jumbo detection:** `isJumbo` in the loader uses `/\bjumbo\b/i.test(display_name)` — fragile (relies on parsers putting "jumbo" in the name). Should we add an explicit `is_jumbo` column to `rate_products`, or is the name-regex acceptable? Name-regex is simpler; explicit column is more principled.

2. **Comp-cap semantics when `borrowerPaid=true`:** `priceScenario` sets `compRate=0` AND `compCap*=0`. Old `homepage-db` set `compRate=0` but kept `compCap*=max_from_lender`. The former produces materially different prices. Which is correct for public display? (Suspect it's why some products' par rates differ by 1/8.)

3. **Site_scenarios key style:** slug (`'homepage_default'`) or UUID? Slug is friendlier in code; UUID is safer for renames/joins. Slug is my default.

4. **Non-QM / HECM integration depth:** Should `priceScenario` become polymorphic (one entry point dispatches to forward/NonQM/HECM), or do surfaces call the right family directly? Staying with 3 peer functions avoids an abstraction that only three callers need.

5. **Last-known-good cache scope:** Just homepage, or every surface? I'd start with homepage (§6.1 `homepage_rate_cache`). If rate-watch wants the same pattern, rename the table to `site_rate_cache` and key by `(surface, scenario_slug, loan_type, term)`.

6. **Migration sequencing:** the schedule above assumes we block D9b.3-v2 on D9b.2 (diagnostic). Alternative: ship D9b.3-v2 with a conservative `excludeJumbo=true` flag today, pending a later principled fix if diagnostic reveals nuance. Faster to value, slightly higher risk. Your call.

7. **Contract with Claw:** Claw publishes articles via `/api/content`. Those articles sometimes mention rates. Should the article authoring tooling get read-only access to `priceScenario` so Claw can cite live rates in copy, or do we want articles to stay rate-agnostic? (Relates to the broader "no hardcoded rate in JSX" invariant.)

8. **Parser hardening:** out of scope for D9b but worth flagging — current parsers (`src/lib/rates/parsers/*.js`) are brittle to format changes. Future project: schema-validate each parser's output, fail loudly on unexpected shapes, instead of silently importing bad data.

---

## 9. Verification log

Per the "never assume, always verify" rule, this log tracks which claims in this doc have been independently verified against source code / DB / live prod, which are inferences, and which are explicitly pending.

### ✅ Verified (file:line cited in the body)

| Claim | Evidence |
|---|---|
| `db-writer.js` writes `rate_sheets`, `rate_products`, `rate_prices` | grep: lines `:64`, `:142`, `:159`, `:221` |
| `adj-writer.js` writes `adjustment_rules` | grep: `:375 INSERT INTO adjustment_rules` |
| `parse-gcs-rates.mjs`, `seed-adjustment-rules.mjs`, `src/lib/pricing-nonqm/ingest.js` exist | `ls` |
| 6 parser files (amwest/everstream/keystone/swmc/tls/windsor) | `ls src/lib/rates/parsers/` |
| Parsers have no top-level numeric constants for fees/caps/UFMIP | `grep -nE "^\s*(const\|let)\s+[A-Z_]+\s*=\s*[0-9]" src/lib/rates/parsers/*.js` returned 0 matches |
| Homepage parallel engine at `homepage-db.js` ~246 lines | read in-session, reverted on PR #104 |
| Purchase calculator has hardcoded `'6.875'` default + local `pmt()` | grep: `page.js:10,41` |
| Refi analyzer has `'7.50' / '6.50'` defaults | grep: `page.js:40,42` |
| Cost-of-waiting has `'7.25' / '6.50'` defaults | grep: `page.js:39,40` |
| Refinance calculator (`/refinance-calculator`) uses `/api/pricing` | grep: `useRefinanceEngine.js:71` |
| DSCR calculator uses `/api/pricing/dscr` | grep: `page.js:137` |
| MLO quote POST uses `priceScenario` but NOT `pickParRate` | grep: `route.js:14,135,326` (groups by lender, keeps highest finalPrice per lender) |
| `my-rates/reprice` does `.sort((a,b)=>a.rate-b.rate)` instead of par | grep: `route.js:63` |
| `scenario-alerts` cron does `.sort().slice(0,3)` | grep: `route.js:90-91` |
| `lead-quote` uses `results.results[0]` after priceScenario's sort | grep: `route.js:63` |
| Duplicate `getFicoBand` in `engine.js:11` AND `pricing-v2.js:168` | grep |
| `closing-costs.js` hardcoded state map (CO/TX/OR/CA) | read in-session |
| Homepage fallback literals at `page.js:57-60` | read in-session, verified during the 1/8 diagnosis |
| `DEFAULT_SCENARIO` hardcoded in `src/lib/rates/defaults.js` | read in-session |
| Post-revert homepage serves `5.875% / 5.000% / 5.375% / 4.875%` | `curl` in-session |

### ⚠️ Inference (flagged, not directly verified)

| Claim | What would verify it |
|---|---|
| Second-lien calculator is the only live caller of `sub-financing-comparison.js` | Grep done for imports; a dynamic `import()` elsewhere would evade the grep |
| `priceDscrScenario()` is the only DSCR entry point | Not re-greped this session; inherited from earlier audit |
| `/api/pricing/dscr` is the DSCR API (no parallel DSCR route) | Not re-greped; inherited |
| The 3 tool calculators (purchase, refi-analyzer, cost-of-waiting) ONLY take user-entered rates — no pricer fallback exists anywhere in their render tree | Partial read; full render-tree grep not done |

### ❌ Corrected (claim was wrong on first pass)

| Original claim | Corrected |
|---|---|
| "No state machine preventing two sheets for the same lender from both being active" | Supersede logic EXISTS at `db-writer.js:142`: `UPDATE rate_sheets SET status='superseded'` before new insert. Kept a narrower concern (race under concurrent parses). |
| North Star diagram (first pass) showed FRED / MND / Treasury feeding the same DB → pricer flow as rate sheets | Corrected 2026-04-17 per David's feedback: these are two independent pipelines. §1 split into 1.A (pricing) and 1.B (market context). Principle #7 added: market context never feeds the pricer and never displays as a NetRate rate. §2.4 retitled to "Market context" and explicitly scoped out of the pricing pipeline. |

### 🕳️ Explicitly not audited (out of scope this pass)

- HECM engine (`src/lib/hecm/*`) — separate product family, intentionally left alone.
- Per-parser numeric literals inline in parse functions (not top-level constants).
- Email templates' rate-handling beyond the `quoteTemplate` review done earlier in the session.
- Rate-history cron actual payload shape (we only checked file existence).
- `rate_lenders` table write path — **now verified**: seeded one-shot via `scripts/migrate-to-pc-db.js:176 INSERT INTO rate_lenders`. No ongoing writer. Post-migration edits are effectively manual DB updates. Moved to §2 below as a known gap; not a D9b blocker but a real config-drift risk.

### Verification policy for this document

Any future edit to this doc must either:
1. Cite file:line evidence for new claims, OR
2. Mark the claim with ⚠️ in-line and add a row to §9.⚠️.

Claims removed or revised belong in §9.❌ so the audit trail is complete.
