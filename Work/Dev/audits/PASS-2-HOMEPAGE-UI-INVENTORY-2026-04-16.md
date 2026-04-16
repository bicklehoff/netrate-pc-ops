# Homepage + UI Components — Static Data Inventory

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 2
**Date:** 2026-04-16
**Produced by:** sibling session via explore-agent dispatch
**Status:** Complete. Findings ready for cross-reference in `README.md §9` (Pass 2 section).
**Scope:** homepage (`src/app/page.js`), rate-surfacing UI components (`src/components/**`), homepage rate computation (`src/lib/rates/homepage-db.js`), schema.org markup in `layout.js` and rate pages, inline par-picker duplicates. Does **not** cover the pricer scenario flow (Pass 1), marketing prose pages (deferred to later pass), or content-model data (county-tax-rates, closing-costs lookups).

---

## Pipeline (homepage rate surface)

```
page.js (RSC)
  ├── getHomepageRatesFromDB()   src/lib/rates/homepage-db.js
  │     ├── sql query → rate_sheets / rate_products / rate_prices (Neon)
  │     ├── getDbLenderAdj()     src/lib/rates/db-adj-loader.js
  │     ├── priceRate()          src/lib/rates/pricing-v2.js      ← SAME engine as Pass 1
  │     └── pickParRate()        src/lib/rates/pick-par-rate.js
  ├── getMarketSentiment()       → fetch /api/market/summary
  └── renders:
        • RATE TICKER   (inline in page.js)
        • Hero card     (inline in page.js — uses heroProducts array)
        • StickyRateBar (components/StickyRateBar.js — reads rate/apr props)
        • TrustBar      (components/TrustBar.js — static copy)
```

Parallel pricer paths discovered (see HP-6, HP-7 below):

```
/api/pricing       → priceScenario() → priceRate()      (Pass 1 pricer path)
page.js → homepage-db.js → priceRate() directly         (divergent pricing glue)
DscrRateWidget + dscr-calculator → /api/pricing/dscr    (DSCR pricer — separate)
```

---

## Seed findings validation

The parent session seeded three findings. All three confirmed in-situ; details and fix surface documented in the catalog below.

| Seed | Status | Finding ID |
|---|---|---|
| `src/app/page.js:56-58` hardcoded `5.875%` fallbacks (and siblings on L59, L63-65) | **CONFIRMED** — 4 rates + 4 APRs + payment + date all static | **HP-1** |
| `DscrRateWidget.js` + `dscr-calculator/page.js` inline par-picker duplicating `pick-par-rate.js` | **CONFIRMED — plus 2 additional callers** in RateTool/SaveScenarioModal + QuoteGenerator/QuoteRateResults | **HP-4** |
| `homepage-db.js` parallel pricing path diverging from `/api/pricing` | **CONFIRMED** — reassembles `priceRate()` + LLPA lookup + `pickParRate()` by hand rather than going through the API route. Comment at L63–67 explicitly calls out intentional divergence on comp (homepage sets `compRate: 0`, pricer uses DB value). | **HP-6** |

---

## Findings catalog

### Category A — Hardcoded literals in homepage JSX (stale-by-deploy prose)

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **HP-1** | `src/app/page.js:56` | `const conv30Rate = fmtRate(d?.conv30) \|\| '5.875%';` | **HIGH** | Fallback fires whenever `getHomepageRatesFromDB()` returns null or that product comes back null. Last set March 24 — the "live" hero visibly shows stale figures if the DB path fails. Site Audit D0 re-audit D3 (homepage EMPTY_ADJ fallback) fixed the silent cascade into this literal, but the literal itself remains. |
| **HP-1a** | `src/app/page.js:57` | `conv30Apr \|\| '5.94%'` | **HIGH** | Same failure mode. APR stale separately from rate — can diverge from fallback rate after a deploy. |
| **HP-1b** | `src/app/page.js:58` | `conv30Payment \|\| '$2,366'` | **HIGH** | P&I at $400K/5.875% = $2,366.28. Coupled to HP-1; if conv30 rate changes but payment constant stays, the ticker contradicts itself. |
| **HP-1c** | `src/app/page.js:59` | `effectiveDateShort \|\| 'Mar 24, 2026'` | **HIGH** | Date published on hero card + ticker. Month-old "today's rate" is a trust kill. |
| **HP-1d** | `src/app/page.js:63-65` | 15yr `5.250%/5.38%`, FHA 5.500%/6.12%, VA 5.375%/5.52% | **HIGH** | Same pattern across three other products. 8 hardcoded rate/APR pairs total in the fallback branch. |
| **HP-2** | `src/app/page.js:96-97` | `"780+ FICO · 75% LTV · Purchase"` (ticker) and `"780+ FICO · $400K · Purchase"` (hero card L233) | MED | These are the DEFAULT_SCENARIO values from `src/lib/rates/defaults.js`. They're "publishing anchors" (same class as Pass 1's `DEFAULT_SCENARIO`), not stale data — but they're **duplicated as strings** here, so if the anchor changes in `defaults.js` the display text silently drifts. |
| **HP-3** | `src/app/page.js:122` (+ layout.js L216) | Google Maps URL: `query=Locus+Mortgage&query_place_id=ChIJ…` | HIGH | Explicit `TODO: Update Google Maps link after GBP name change from Locus → NetRate`. Two copies (hero + footer-adjacent reviews banner). Brand rule violation surface (memory: "always 'NetRate Mortgage'"). |
| **HP-3a** | `src/app/page.js:132` (+ L371) | BBB profile URL contains `locus-mortgage-1296-90159653` | MED | Legacy slug from Locus era. BBB may still serve the right profile under that slug, but the slug is a brand-name reference baked into the HTML. Two copies. |

### Category B — Static copy literals baked into components

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **HP-B1** | `src/components/TrustBar.js:6` | `"2013"` (Licensed Since) | LOW | Founding year. Evergreen. Flag only because it's a hardcoded year-string; if brand ever changes the year/copy, two places to edit. |
| **HP-B2** | `src/components/TrustBar.js:11` | `"CA · CO · OR · TX"` | MED | Licensed states list. Duplicated in `page.js:357`, `layout.js` schema.org `areaServed` (L45-50, L73-78), `data/loan-limits-2025.json`, `constants/lenders.js` per-lender state configs. **Six+ places** reference the state set. |
| **HP-B3** | `src/components/TrustBar.js:20` | `"A+"` BBB rating | LOW | Evergreen unless BBB downgrades; worth a nominal "refresh before PR" checklist item. |
| **HP-B4** | `src/components/DscrRateWidget.js:13` | `const STATES = ['CO', 'CA', 'TX', 'OR']` | MED | Another copy of the licensed-states array. Adds to HP-B2's duplication count. |
| **HP-B5** | `src/components/DscrRateWidget.js:14-18` | `TIERS` = elite_1/2/5 | MED | Tier set is product truth (Everstream lender's tier ladder). Duplicated in `tools/dscr-calculator/page.js:352-356`. Change a tier label in one place, UIs disagree. |
| **HP-B6** | `src/app/tools/dscr-calculator/page.js:6-8` | `COMP_RATE = 0.02`, `COMP_CAP_PURCHASE = 4595`, `COMP_CAP_REFI = 3595` | **HIGH** | Broker comp is hardcoded client-side — **divergent from `rate_lenders.comp_rate` / `max_comp_cap_*`** that the pricer reads. Homepage-db.js L65-66 reads the lender columns; dscr-calculator inlines literals. Finding also: DSCR purchase cap is 4595 here but 3595 in `homepage-db.js` fallback at L65. That's a live inconsistency, not just duplication. |
| **HP-B7** | `src/app/tools/dscr-calculator/page.js:99-106` | Default state: `purchasePrice=380000`, `downPayment=95000`, `fico=760`, `monthlyRent=2600`, etc. | LOW | Publishing anchors per the Pass 1 pattern — flag only that they differ from `DEFAULT_SCENARIO`. No single "default scenario" across surfaces. |
| **HP-B8** | `src/components/StickyRateBar.js` | All copy is prop-driven — good | OK | No findings. |
| **HP-B9** | `src/components/CountyLoanLimits.js:4` | `import loanLimitData from '@/data/loan-limits-2025.json'` | **HIGH** | Pass 1 flagged this JSON as "embarrassing-stale" (2025 in the filename during 2026). Pass 2 confirms the consuming UI is still live. Component powers the county-loan-limits surface on marketing pages. |

### Category C — Schema.org / metadata / SEO

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **HP-C1** | `src/app/layout.js:25-98` | JSON-LD graph: Organization + FinancialService + WebSite | LOW | No rate data embedded in schema — good. Areas served, NMLS, address, phone, founding date are all hardcoded but semantically stable. |
| **HP-C2** | `src/app/layout.js:57` | `numberOfEmployees: 2` | LOW | Per CLAUDE.md David + Jamie Cunningham. Stale-by-headcount. |
| **HP-C3** | `src/app/rates/dscr/page.js:24-40` | Page-level JSON-LD (WebPage) | LOW | Short, no rate numbers. OK. |
| **HP-C4** | Multiple route `page.js` files (23 files hit by grep for `application/ld+json`) | Per-page JSON-LD blobs | MED | 23 pages each carry their own schema.org graphs. Any schema change (e.g., NMLS correction) = 23+ edits. Worth DB-ifying or centralizing (`lib/schema/build-json-ld.js` with page-scoped overrides). |
| **HP-C5** | `src/app/layout.js:20-22` (+ per-page `export const metadata`) | Meta titles, descriptions, OG tags | LOW | Static per deploy. No rate data — good. |
| **HP-C6** | `src/app/layout.js:131` | Microsoft Clarity project ID `vv85vtrn77` | LOW | Third-party config, not a rate/data concern. Stable. |

### Category D — Hardcoded rate numbers in marketing prose

Grep swept `src/app/**/page.js` for `X.YYY%` patterns. The prose surfaces that hardcode illustrative rates:

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **HP-D1** | `src/app/how-pricing-works/page.js:95-96` | `5.750% → $2,334/mo`, `5.500% w/1pt → $2,271/mo` | LOW | Pedagogical example, not a live quote. Reads fine today, reads weird if rates move 200bps — "example" scales badly with time. |
| **HP-D2** | `src/app/points-and-credits/page.js:54-56, 72-73` | Example rate ladder `5.750 / 5.625 / 5.500` + credit example `5.750 / 6.000` | LOW | Same pattern — illustrative. But these anchor near 2026 April rates; when rates drop to 4s, examples look outdated. |
| **HP-D3** | `src/app/breakeven/page.js:43-44` | Same `5.750% / 5.500% w/1pt` example | LOW | Third copy of the same illustrative ladder — three separate files. If the ladder ever gets refreshed, three edits. |
| **HP-D4** | `src/app/equity-without-losing-rate/page.js:109,115,181,185,188` | `2.5%–4%` pre-2022 rates and `6.4% / 6.769% APR` current | **MED** | Prose claims "today's rate is around 6.4%" — authored for a higher-rate moment. As of 2026-04-16, homepage shows 5.875% (or static fallback). Page reads incorrect to current visitors. |
| **HP-D5** | `src/app/when-to-refinance/page.js:135-136` | `7.250% → 6.500%` refinance savings example | MED | Similar — assumes original rate was 7.25%. Not timeless. |
| **HP-D6** | `src/app/heloc-vs-cashout/page.js:210` | `$400K at 6.75% (7.119% APR)` | MED | Cash-out refi baseline. |

### Category E — Parallel / duplicated rate-selection logic (the seed case)

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **HP-4** | `src/components/DscrRateWidget.js:87-93` | Inline par-picker: `priced.map(→ptsDiff).filter(abs<3).reduce(min abs ptsDiff)` | **MED** | Duplicates `pick-par-rate.js` algorithm with a subtly different rule (closest-to-par always, no "at/above par" preference). If the canonical picker changes, DSCR widget silently keeps the old rule. |
| **HP-4a** | `src/app/tools/dscr-calculator/page.js:202-206` | Same inline par-picker (`parRow = rows.reduce(… abs(netPrice-100) …)`) | **MED** | Second copy of the same hand-rolled picker, different inputs (netPrice vs final_price, after broker comp is client-side-applied). Cannot be swapped for `pickParRate()` without refactor because of the broker-comp-applied-client-side quirk. |
| **HP-4b** | `src/components/RateTool/SaveScenarioModal.js:40-66` | "Auto-pick: sweet spot below par, par, sweet spot above par" — its own three-pick algorithm anchored on 99.25/100/100.75 | **MED** | Third closest-to-par picker. Uses fixed "sweet spot" magic numbers (99.25, 100.75) not shared with any other surface. |
| **HP-4c** | `src/components/Portal/QuoteGenerator/QuoteRateResults.js:11-13, L75, L10-48` | `findSweetSpots()` + inline `parRate` reduce. Different sweet-spot math (cost-per-eighth) than HP-4b. | **MED** | Fourth par-selection implementation, again with its own rules. |
| **HP-5** | (Cross-reference) | Four surfaces × four different rules for "today's rate" / "par" | **HIGH (arch)** | Violates the `pick-par-rate.js` design intent ("every surface that needs to collapse a ladder to 'today's rate' uses the same rule"). Homepage uses `pickParRate()` correctly; DSCR widget, dscr-calculator, rate-tool save-modal, and quote-generator do not. |

### Category F — Divergent pricing paths

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **HP-6** | `src/lib/rates/homepage-db.js:34-174` | `priceProduct()` reassembles the pricer by hand — direct DB queries + `priceRate()` + `getDbLenderAdj()` + `pickParRate()` — rather than calling `/api/pricing` (Pass 1 entry point). | **MED** | Intentional, per comment at L63-67 (homepage sets `compRate: 0` because comp is internal). But it means: adding a pricer invariant (e.g., a new LLPA step in `price-scenario.js`) is a two-place edit or it silently diverges. Recent bug (fix at commit `881ec20`: homepage EMPTY_ADJ fallback) was caused by this exact divergence. |
| **HP-7** | `src/components/DscrRateWidget.js:48` and `tools/dscr-calculator/page.js:137` | Both call `/api/pricing/dscr` — a separate pricer endpoint from `/api/pricing` | LOW | Correctly split (DSCR ≠ conventional pricer), but the existence of two endpoints means invariants like "broker comp is subtracted in one place" are enforced twice. HP-B6 is the concrete leakage. |
| **HP-8** | `src/lib/rates/homepage-db.js:24` | Module-scoped cache `let homepageCache = { … }` | LOW | 30-min TTL + sheet-date cache key. Works but is per-serverless-instance — multiple Vercel workers each keep their own. On a new rate sheet, some workers serve old rates for up to 30 min. Not stale-by-deploy, but stale-by-cache. |
| **HP-9** | `src/components/StickyRateBar.js:20` | `fetch('/api/predictions/polymarket')` client-side | LOW | Third-party data (Polymarket) fetched every mount. Separate from rate pipeline. |

---

## Ship-immediately candidates

In priority order — low-risk fixes the auditor can pick up without design debate:

1. **Remove the hardcoded rate fallbacks (HP-1, HP-1a-d).** Better UX: render a "Rates loading…" skeleton or hide the hero card when `liveRates === null`. Silent stale numbers are worse than a transient loading state. Pattern: `if (!liveRates) return <RateCardSkeleton />`. Touches `src/app/page.js:56-66`.
2. **Fix the broker-comp inconsistency (HP-B6).** `$4,595` vs `$3,595` for DSCR purchase cap is a live pricing bug — the dscr-calculator will show a different final cost than `homepage-db.js`'s fallback. Centralize: pull from `rate_lenders.max_comp_cap_purchase` via API, never hardcode. Touches `src/app/tools/dscr-calculator/page.js:7`.
3. **Delete `src/data/loan-limits-2025.json` after replacing `CountyLoanLimits.js` import (HP-B9).** Pass 1 already flagged it; Pass 2 confirms it's still live. Either regenerate as `loan-limits-2026.json` or source from `ref_county_loan_limits` (recommended in Pass 1 finding #3).
4. **Update Google Maps + BBB URLs (HP-3, HP-3a).** Explicit TODO in code. Two copies each. Brand rule violation: "always 'NetRate Mortgage' — never 'Locus'".
5. **Collapse HP-4 / HP-4a / HP-4b / HP-4c to `pickParRate()`** — or, if they have materially different semantics (sweet-spot math, post-broker-comp selection), rename and commit those variants as first-class exports in `pick-par-rate.js`: `pickParRate`, `pickClosestToPar`, `pickSweetSpotBand`. Right now each inline copy is a tech-debt landmine.

---

## Recommended DB-ification / refactor targets (priority order)

1. **Hero rate fallback → skeleton state.** Highest consumer-visible risk. Fix once, done.
2. **`HOMEPAGE_DEFAULT_SCENARIO` → shared constant.** The "780+ FICO · $400K · 75 LTV · Purchase" string shows up in ticker (L97), hero card subcaption (L233), and implicitly in the price request (via `DEFAULT_SCENARIO` from `defaults.js`). Derive the subcaption from `DEFAULT_SCENARIO` so display always matches pricing anchor.
3. **Unify par-picker callers on `pickParRate()`.** Four callers today, four different rules. Plan: audit each call site for "what does this surface actually need?", add variant exports to `pick-par-rate.js`, migrate call sites.
4. **Route homepage rates through `/api/pricing`** (or formalize `homepage-db.js` as the canonical "pricer with zero comp" wrapper). Either direction works; the failure mode to avoid is "two pricer paths that silently diverge". The 2026-04-13 EMPTY_ADJ cascade bug is the warning shot — if no one consolidates, a second cascade is inevitable.
5. **Centralize schema.org builder.** 23 route files each spell out their own JSON-LD graph. Build once from constants + a per-page override map; drops 23 stale-by-deploy surfaces to one.
6. **Brand-rule linter.** Add a repo-level grep hook that fails CI if "Locus" appears outside `/legacy` folders or `docs/history/`.

---

## Open questions

1. **Is the DSCR comp-cap difference ($4,595 vs $3,595) a bug or a policy?** HP-B6 shows the dscr-calculator using `$4,595` as purchase cap while `homepage-db.js:65` defaults to `$3,595`. Is DSCR investor-property comp genuinely higher (common — lender allows a higher cap on NOO), and if so, where is the authoritative number? If `rate_lenders.max_comp_cap_purchase` is lender-specific, the dscr-calculator should read it, not hardcode.
2. **Should the homepage skeleton state be silent or noisy?** When `getHomepageRatesFromDB()` returns null, current behavior hardcodes 5.875%. Options: (a) skeleton UI (loading state), (b) render a "Rates updating — check back soon" banner, (c) fail the page (let Next.js 500). David's preference?
3. **Four par-pickers, four semantics — which is canonical?** `pick-par-rate.js` says "lowest rate ≥ par". `DscrRateWidget` says "closest to par". `SaveScenarioModal` picks three sweet-spots (99.25 / 100 / 100.75). `QuoteRateResults` picks par + cost-per-eighth below + credit-per-eighth above. Are these four products deliberately different (probable) or drifted (possible)?
4. **Do the prose examples (HP-D1-D6) belong in content ops, not dev ops?** A marketing copy refresh cycle that sweeps all `X.YYY%` examples quarterly would be cheaper than engineering a dynamic-example system.
5. **Should `HOMEPAGE_CACHE_TTL` be shorter?** 30 minutes is reasonable for a rate surface updated 4×/day, but per-worker. On a fleet of ~4 Vercel serverless instances, a new rate sheet can take up to 30 min to propagate to all of them. Is that acceptable, or do we want to invalidate cache on sheet-activation (webhook-style)?

---

**Scope note.** Pass 2 covers the *homepage rate surface, UI components that render rates, schema.org markup, and inline par-picker duplicates*. Not in scope: content-model data (county-tax-rates, closing-costs constants), portal/internal UI (LoanDetail, Dialer), email templates, SMS copy. Those will be later D8 passes.
