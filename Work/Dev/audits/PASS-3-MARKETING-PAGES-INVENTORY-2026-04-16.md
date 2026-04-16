# Marketing Pages — Static Data Inventory

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 3
**Date:** 2026-04-16
**Produced by:** resumed agent a5ecdce70436fa195
**Status:** Complete. Findings ready for cross-reference in `README.md §9` (Pass 3 section).
**Scope:** public marketing prose routes under `src/app/**/page.js` — state pages (`california`, `colorado`, `oregon`, `texas`), rate category pages (`rates/dscr`, `rates/heloc`, `rates/non-qm`), services/about/licensing/contact/why-netrate/resources/refinance-playbook/refinance-calculator, educational prose (`how-pricing-works`, `points-and-credits`, `breakeven`, `closing-costs`, `heloc-vs-cashout`, `equity-without-losing-rate`, `when-to-refinance`, `good-deal`, `refinance-playbook`), niche product pages (`reverse-mortgage`, `crypto-mortgage`, `airbnb-financing`, `adu-rental-income`, `condo-rules-changed`, `california-housing-update`), and tool prose shells (`tools/*`). Does **not** cover the pricer scenario flow (Pass 1), homepage rate surface (Pass 2), borrower portal (Pass 5), MLO portal (Pass 6), scheduled tasks (Pass 7), reference data tables (Pass 8), rate-watch daily archives, `[slug]`/`portal/*` routes, or component-level UI (covered in Pass 2).

---

## Seed findings validation

The parent session seeded three marketing-page concerns. All three confirmed:

| Seed | Status | Finding ID |
|---|---|---|
| Hardcoded illustrative rate examples in prose (e.g., `5.750% / 5.500% w/1pt`) | **CONFIRMED** — recurs across 3+ files with identical figures | **MKT-D1, MKT-D2, MKT-D3** |
| Stale brand references (Locus / Google Maps TODO / BBB slug) in marketing surfaces | **CONFIRMED** — `about/page.js:153`, two copies of Maps URL, BBB URL uses legacy slug | **MKT-B1, MKT-B2, MKT-B3** |
| Duplicated SEO/schema.org patterns across 40+ page.js files | **CONFIRMED** — 43 files emit their own canonical + 11 emit `openGraph` blocks; 4 inline JSON-LD graphs in marketing prose alone (Pass 2 found 23 total across the app) | **MKT-C1** |

Additional structural finding during sweep:

| New concern | Status | Finding ID |
|---|---|---|
| **Licensing page missing California disclosure** while `services`/`about`/`layout.js` schema.org all claim CA licensure | **CONFIRMED** — potential compliance exposure | **MKT-COMP-1** |
| `services/page.js:114` still says "Texas — LLC registration in progress for 2026" | **CONFIRMED** — stale; contradicts TX license #1111861 already in place | **MKT-B4** |

---

## Findings catalog

### Category A — Hardcoded illustrative rate ladders (stale-by-deploy prose)

These are pedagogical examples (not live quotes) but they bake 2025-era market rates into prose. Any future market shift makes them read wrong.

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-D1** | `src/app/how-pricing-works/page.js:95-96` | `5.750% → $2,334/mo`, `5.500% w/1pt → $2,271/mo` | LOW | Discount-point breakeven example. Three-file copy (see MKT-D2, MKT-D3). |
| **MKT-D2** | `src/app/points-and-credits/page.js:54-56` | Ladder: no points `5.750%/$2,334`, 0.5 points `5.625%/$2,302`, 1 point `5.500%/$2,271` | LOW | Same rate frame as MKT-D1. |
| **MKT-D2a** | `src/app/points-and-credits/page.js:72-73` | Lender credit ladder: `5.750% / $4,500 costs` vs `6.000% / $1,500 costs` | LOW | Third hardcoded pair. |
| **MKT-D3** | `src/app/breakeven/page.js:43-44` | `5.750% / $2,334` vs `5.500% + 1pt / $2,271` | LOW | Third verbatim copy. Three files edit-coupled. |
| **MKT-D4** | `src/app/equity-without-losing-rate/page.js:109, 115, 178-189` | "2020-2022 rate between 2.5% (2.869% APR) and 4%"; "today's rate is around 6.4% (6.769% APR)"; scenario table anchored on `$350K @ 3.25%` + `$425K @ 6.4%` | **MED** | Prose says "as of this writing, that's somewhere around 6.4%." Homepage currently shows ~5.875%. Page reads stale to visitors. Four separate numeric anchors in this file. |
| **MKT-D4a** | `src/app/equity-without-losing-rate/page.js:5, 8, 29` | Meta description + openGraph + twitter all hardcode `3% (3.369% APR)` | **MED** | Stale-by-deploy in meta tags — shows up in search snippets and social shares. |
| **MKT-D5** | `src/app/when-to-refinance/page.js:135-136` | Example `7.250% (7.619% APR) → 6.500% (6.869% APR)` | MED | Assumes original rate was 7.25%. Will read odd if rates land elsewhere. |
| **MKT-D6** | `src/app/heloc-vs-cashout/page.js:181, 205-225` | "locked at 3.25% (3.619% APR) or 3.50% (3.869% APR) during 2020-2021"; scenario `$400K @ 6.75% (7.119% APR)` + `$100K HELOC @ 8.50%`; monthly payments `~$2,594` and `~$1,939`; closing costs `~$8-12K` vs `~$500-1,500` | MED | Cash-out vs HELOC comparison with four anchored rates and derived monthlies. Payment figures will not age well. |
| **MKT-D7** | `src/app/equity-without-losing-rate/page.js:196` | Derived "Difference: ~$499/month. $5,988/year. $179,640 over 30 years." | LOW | Summary of scenario; will silently misalign if the inputs in MKT-D4 are updated separately. |

### Category B — Brand / org identity leaks (stale-by-deploy copy)

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-B1** | `src/app/about/page.js:82` | `"I started brokering mortgages in 2013 under the name Locus Mortgage."` | **LOW** | Legitimate historical reference — brand rule allows "Locus" for historical narrative context. Flag as tracked, not a violation. |
| **MKT-B2** | `src/app/about/page.js:151-153` | `{/* TODO: Update Google Maps link after GBP name change from Locus → NetRate */}` + URL `query=Locus+Mortgage&query_place_id=ChIJ…` | HIGH | Third copy of the same Locus-GBP TODO (Pass 2 found two in `page.js` + `layout.js`). Explicit self-documented debt. |
| **MKT-B3** | `src/app/about/page.js:39-40` | `"Loans Funded (2025)" / "50"` and `"Volume (2025)" / "$26.6M"` | **MED** | Annual metrics hardcoded. 2026-04-16 → metrics are 4 months stale and the label still says 2025. Two-edit drift: number *and* label. |
| **MKT-B3a** | `src/app/about/page.js:14` + `src/app/page.js:273` + `src/app/tools/page.js:14` | `"We shop across 11 lenders"` (three files) | MED | "11 lenders" count lives in 3 places. `constants/lenders.js` is the authoritative count — if lender roster changes, 3 edits or numbers diverge. |
| **MKT-B3b** | `src/app/about/page.js:41-42` | `"App-to-Fund Rate / 87.7%"` + `"Lending Partners / 11"` | LOW | Same pattern. Annual metric + lender count hardcoded in credentials array. |
| **MKT-B4** | `src/app/services/page.js:114` | `"Active and growing. LLC registration in progress for 2026."` (Texas) | **MED** | Contradicts the fact that Texas license #1111861 is already active per `licensing/page.js:17`. Stale copy left over from earlier expansion phase. |
| **MKT-B5** | `src/app/services/page.js:24, 93, 110` | `"Refinancing made up 54% of our loan volume in 2025"`, `"We funded loans up to $1.2M in 2025"`, `"92% of our 2025 volume"` | **MED** | Three hardcoded year-tagged metrics on one page. Silent staleness — in Dec 2026 these will still say "2025" unless manually touched. |
| **MKT-B6** | `src/app/california-housing-update/page.js:255` | Legislative cite: `"California SB 79 (signed October 10, 2025, effective July 1, 2026)"` | LOW | Legitimate citation of a law. Will read fine unless the law is amended. Tracked for the citation-staleness class. |
| **MKT-B7** | `src/app/rate-watch/page.js:217` | JSON-LD `temporalCoverage: '2025-12/..'` | LOW | Dataset schema cites start date. Correct today, evergreen (start never moves). |

### Category C — Schema.org / metadata / SEO duplication

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-C1** | Per-page `export const metadata` across 43 marketing page.js files | Each route builds its own `metadata`, most with `title`, `description`, `alternates.canonical`, plus 11 files with full `openGraph` / `twitter` blocks duplicating title + description | **MED (arch)** | No shared builder. Brand rule changes ("always 'NetRate Mortgage', never 'NetRate'") require 43 audits. Pass 2 flagged the JSON-LD side of this (HP-C4, 23 files). Combined: ~60+ edit points for any brand-wide SEO/metadata change. |
| **MKT-C2** | `src/app/rates/dscr/page.js:24-40` | Inline `const jsonLd = { '@context': 'https://schema.org', '@type': 'WebPage', … }` | LOW | No rate numbers inside. Four spots (publisher.name, author.name, page name, description) each hardcode "NetRate Mortgage". |
| **MKT-C2a** | `src/app/rates/non-qm/page.js:23-39` | Same inline `jsonLd` pattern as MKT-C2 | LOW | Copy of the pattern with slightly different wording. |
| **MKT-C2b** | `src/app/rates/heloc/page.js` | Same inline `jsonLd` pattern (not read in detail — grep confirmed) | LOW | Third rate-category JSON-LD graph. |
| **MKT-C3** | `src/app/rate-watch/page.js:211-227` | Dataset-type JSON-LD with `dateModified: new Date().toISOString()` | LOW | Correctly dynamic on `dateModified`; rest is hardcoded strings. |
| **MKT-C4** | `src/app/rate-watch/page.js:183-209` | `generateMetadata()` fetches live rate from DB and builds dynamic title/desc | OK | Good pattern — the one page that threads live data into SEO. Recommend extending this approach to state pages. |
| **MKT-C5** | All 43 marketing routes | `alternates.canonical: 'https://netratemortgage.com/<path>'` hardcoded | LOW | 43 copies of the origin string. A domain change = 43 edits. Centralizable to `src/lib/seo/canonical.js`. |
| **MKT-C6** | `src/app/rates/dscr/page.js:11, 20` + `rates/non-qm/page.js:11, 19-20` | `siteName: 'NetRate Mortgage'`, `url: 'https://netratemortgage.com/...'` hardcoded in openGraph | LOW | Same duplication class as MKT-C1. |

### Category D — State page duplication (four copies of the same shell)

All four state pages share a near-identical skeleton but hardcode the same concepts in divergent wording:

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-E1** | `california/page.js:35`, `colorado/page.js:35`, `oregon/page.js:36`, `texas/page.js:36` | Each has a "conforming loan limits vary by county" bullet | LOW | Four slightly different phrasings of the same fact. Drift-prone. |
| **MKT-E2** | Four state pages | Each lists `<CountyLoanLimits defaultState="CA" />` (or CO/OR/TX) — reads from `data/loan-limits-2025.json` | **HIGH** | Pass 2 HP-B9 already flagged the 2025 JSON file. Every state page inherits that staleness. Filename `loan-limits-2025.json` during 2026 is an embarrassing bug. |
| **MKT-E3** | Four state pages | Each has a bespoke "What We Offer in [State]" section hardcoded with the same seven loan types (Refinance, Purchase, Reverse, Jumbo, DSCR, Bank Statement, Seconds) | LOW | Copy-paste divergence risk. Adding a new product = 4 edits. Could derive from `constants/loan-types.js`. |
| **MKT-E4** | `texas/page.js` (implicit) | Texas page exists and claims TX service, but `services/page.js:114` still says "LLC registration in progress for 2026" | **MED** | Cross-file contradiction. See MKT-B4. |

### Category E — Compliance / regulatory gaps

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-COMP-1** | `src/app/licensing/page.js:14-18, 49-88` | Lists CO / OR / TX disclosures only. **No California disclosure.** Yet `about/page.js:37`, `services/page.js:5, 116-123`, `layout.js` schema.org `areaServed`, and `constants/lenders.js` all claim CA licensure. | **HIGH (compliance)** | If CA license is truly active, CA-specific disclosures (DFPI / CFL / NMLS #1111861) should appear on the licensing page. If not active, all CA-referencing pages need correction. Either way this is a discrepancy that survives to production. |
| **MKT-COMP-2** | `src/app/licensing/page.js:15` | `"Colorado — Mortgage Company Registration"` (no license number) | MED | CO/OR/TX get license numbers except CO. Likely just a display inconsistency. |
| **MKT-COMP-3** | `src/app/licensing/page.js` | No "Loan Originators" list — David is named via NMLS link but Jamie Cunningham (per root CLAUDE.md, the solo LO) is not named | LOW | Depending on state requirements, licensed LOs may need to be listed by name + NMLS on a public licensing page. |
| **MKT-COMP-4** | `src/app/about/page.js:37` + `services/page.js:5` | Order of states differs: `"CA, CO, TX, OR"` (about) vs `"California, Colorado, Oregon, and Texas"` (services) | LOW | Pass 2 HP-B2 already flagged licensed-states list as 6+-place duplicate. This adds two more. |

### Category F — Tool prose shells (not the calculators themselves)

The tool calculators are code and scope out to Pass 2 / later inventory; here we flag just the *prose/SEO shells*:

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-F1** | `src/app/tools/page.js:14` | `"Live mortgage rates across 11 lenders"` | MED | Third copy of the "11 lenders" count (see MKT-B3a). |
| **MKT-F2** | `src/app/tools/dscr-calculator/page.js` (shell) | Pass 2 HP-B6 flagged the hardcoded `COMP_RATE`, `COMP_CAP_PURCHASE`, `COMP_CAP_REFI` | HIGH | Referenced here for completeness — fix surface is in Pass 2's scope. |

### Category G — Niche product pages (single-concept stale content)

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-G1** | `src/app/reverse-mortgage/page.js:75` | `"paying $2,500/month on a traditional mortgage, that's $30,000 a year"` | LOW | Illustrative example payment. Decoupled from live data. |
| **MKT-G2** | `src/app/refinance-playbook/page.js:62, 72-74, 190` | Hardcoded closing cost dollar amounts (`$3,000`, `$8,000`, `~$4,000` refund) used as illustrative math | LOW | Same "illustrative example" pattern as MKT-D1-D3. |
| **MKT-G3** | `src/app/crypto-mortgage/page.js`, `airbnb-financing/page.js`, `adu-rental-income/page.js`, `condo-rules-changed/page.js`, `california-housing-update/page.js` | Each is a long-form article with fixed date/example framings | LOW | Not yet read in full. Flag as a category for a future content-refresh audit cycle rather than engineering fix. |
| **MKT-G4** | `src/app/rates/heloc/page.js:132-144` | Hardcoded scenario table: home value `$600K`, mortgage `$350K`, max CLTV `$480K`, available `$130K`, step-up example `$190K` | LOW | Illustrative. Not a live quote. |

### Category H — Cross-page URL / link consistency

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **MKT-H1** | `src/app/colorado/page.js:61` | `href="/rates?state=CO"` | OK | State-scoped deep link. Works. Confirms `rates/page.js` accepts `?state=` param. |
| **MKT-H2** | Marketing pages broadly | Many internal `<Link href="/refinance-playbook">`, `<Link href="/how-pricing-works">`, `<Link href="/reverse-mortgage">` | OK | All routes exist. No broken internal links detected by grep. |
| **MKT-H3** | Missing route | No `src/app/refinance-calculator/` prose — directory exists with `layout.js` + `page.js` but not inspected here | UNKNOWN | Deferred. |

---

## Ship-immediately candidates

In priority order:

1. **Fix `licensing/page.js` CA disclosure (MKT-COMP-1).** Either add CA-specific disclosure block (DFPI / NMLS filing) or pull CA from all the pages that claim licensure. **Compliance risk, not a cosmetic fix.**
2. **Remove "LLC registration in progress for 2026" on `services/page.js:114` (MKT-B4).** Already-live TX license per `licensing/page.js:17`.
3. **Update `about/page.js:39-40` stats** (MKT-B3). Either pull from a shared `constants/metrics.js` (best) or manually refresh to 2026 YTD figures with a "through [month]" qualifier.
4. **Fix the Google Maps / BBB URL debt (MKT-B2).** Pass 2 flagged the same issue. Three files now: `page.js`, `layout.js`, `about/page.js`. Single TODO, three sites.
5. **Collapse "11 lenders" literal (MKT-B3a, MKT-F1).** Derive from `constants/lenders.js` count. Three files, one source.
6. **Meta description fix on `equity-without-losing-rate/page.js` (MKT-D4a).** `3% (3.369% APR)` in meta tags propagates to search snippets and social shares — high visibility, one-line fix (use evergreen wording).

---

## Recommended refactor targets (priority order)

1. **Metadata builder helper.** Extract a `buildPageMetadata({ path, title, description, ogImage })` in `src/lib/seo/` — drops 43 hardcoded `https://netratemortgage.com/<path>` canonicals plus ~11 duplicated openGraph blobs to one. Same pattern Pass 2 recommended for JSON-LD (5 in the Pass 2 refactor list). Combined: ~60 surfaces to one builder.
2. **`constants/metrics.js`** — centralize annual business metrics (loans funded, volume, app-to-fund rate, lenders-count, licensed-states array). Touches `about/page.js:34-43`, `services/page.js`, homepage, tools page. 10+ references, one source.
3. **State-page shell abstraction.** Four state pages are 80% identical. Consider a single `StatePage` component parameterized by state abbrev + state-specific copy. Eliminates MKT-E1, MKT-E3 drift.
4. **Illustrative-rate freeze policy.** Content-ops decision, not engineering: either (a) add a "last-refreshed" timestamp to each prose page and a content-refresh cadence, or (b) replace hardcoded examples with dynamic pulls from the pricer (expensive, overkill for pedagogy). MKT-D1-D7 all stem from this same root.
5. **Brand-rule CI check.** Add a grep hook: `Locus` outside `/legacy/` or `docs/history/` fails CI (Pass 2 recommended the same). Current state has one legitimate narrative use (MKT-B1) — allowlist that file. Also check for bare `NetRate` not followed by ` Mortgage`, per memory rule.
6. **Compliance page gen.** Drive `licensing/page.js` from a `ref_state_disclosures` table (Pass 8 scope). Adding/removing a state = one row edit, not HTML surgery.

---

## Open questions

1. **Is California licensed or not?** `layout.js` schema.org, `about/page.js:37`, `services/page.js:5, 120-123`, and `constants/lenders.js` all say yes. `licensing/page.js` implies no. Which is ground truth? If yes → need CA disclosure. If no → need to correct 4+ pages. David's answer drives the remediation plan.
2. **Should 2025 metrics (MKT-B3, MKT-B5) be frozen or rolling?** "We funded $26.6M in 2025" is a durable achievement claim; "92% of our 2025 volume" implies "our most-recent-year volume." Are these intended as year-tagged historical facts or meant to roll forward? Content-strategy question, not engineering.
3. **Are illustrative rate ladders (MKT-D1-D3) timeless pedagogy or stale-by-market?** At 5.5-5.75% they read natural today. At 4% or 7%, they'll read off. Acceptable as eternal pedagogical anchors, or worth the churn to refresh quarterly?
4. **`equity-without-losing-rate` "today's rate is around 6.4%" (MKT-D4)** — should prose be barred from asserting live market levels, or is a quarterly refresh enough? Cheapest fix: rewrite the phrase as "in a ~6-7% market" (wide band, evergreen).
5. **`refinance-calculator` route exists but wasn't inspected.** Deferred to a follow-up pass or out of scope for prose inventory?
6. **`[slug]` dynamic route** (first-level slug catcher) wasn't inspected. It may render CMS content that warrants its own D8 pass.

---

**Scope note.** Pass 3 covers *public marketing prose pages* — the routes that render mostly static text + occasional rate examples. Not in scope: pricer flow (Pass 1), homepage rate surface (Pass 2), portal UIs (Pass 5-6), scheduled tasks (Pass 7), reference/lookup tables (Pass 8), rate-watch daily archive pages (`rate-watch/[date]`), blog-style `[slug]` route, legal pages (`privacy`, `terms`, `accessibility`, `do-not-sell`) — those are compliance-owned and follow a separate review cadence. The tool calculators (`tools/*/page.js`) are flagged here only for their prose shells; their data-model and calculation logic are Pass 2 / future-pass concerns.
