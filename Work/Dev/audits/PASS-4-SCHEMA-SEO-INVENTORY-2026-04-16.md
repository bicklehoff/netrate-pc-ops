# Schema.org + SEO Markup Inventory

**Audit:** Site Audit 2026 · Dimension 8 (Static data / stale-by-deploy) · Pass 4
**Date:** 2026-04-16
**Produced by:** dev session (agent ad73aa50be33caf25)
**Status:** Complete. Expands Pass 2's HP-C4 placeholder (23 JSON-LD blobs) into a full catalog.
**Scope:** every `<script type="application/ld+json">` in the app, every `export const metadata` / `generateMetadata()` export, canonical URL tags, robots directives, sitemap, OpenGraph + Twitter card meta, and the Ahrefs-flagged "1 schema.org validation error" (relay `cmnyxd91f07kn6ro5`). Not in scope: email templates, PDF generation, Twilio/Zoho metadata — those are Pass 5/6 territory.

---

## Pipeline (SEO markup surface)

```
layout.js (root)
  ├── export const metadata        → site-wide title/description/keywords
  ├── jsonLd @graph (inline)       → Organization + FinancialService + WebSite
  └── inline <Script> tags         → GA4 (G-QPEE5ZSZ79), Clarity (vv85vtrn77), Maps

Per-route page.js / layout.js
  ├── export const metadata | generateMetadata()
  │     ├── title / description / keywords
  │     ├── openGraph { title, description, url, siteName, type, publishedTime, twitter }
  │     ├── alternates.canonical
  │     └── robots (portal pages only)
  └── const jsonLd = {...} or [...]  → injected via dangerouslySetInnerHTML

sitemap.js (App Router convention) → sitemap.xml on build
public/robots.txt                  → crawl directives + sitemap pointer
```

Three schema.org "layers" coexist:
1. **Site-layer graph** in `src/app/layout.js` (Organization + FinancialService + WebSite) — appears on every page.
2. **Page-layer type** per route (WebPage, Article, FAQPage, CollectionPage, Dataset) — appears once per page.
3. **Per-article FAQPage arrays** — 7 marketing pages ship `[Article, FAQPage]` pairs as a single jsonLd array.

---

## Inventory counts

| Category | Count | Notes |
|---|---|---|
| Files with `<script type="application/ld+json">` | **16** | Pass 2 grep said 23 — that count was loose (counted occurrences, not files). Corrected count: 16 distinct route files ship JSON-LD, plus root layout = 17 total script tags. |
| Files with `export const metadata` / `generateMetadata()` | **52** | Covers static + tools + portal + state landing + marketing pages. |
| Canonical URLs declared | **47** | Every public route has one; a few portal/apply routes do not (intentional — they inherit root or `noindex`). |
| Pages with `robots: 'noindex, nofollow'` | **3** | `portal/layout.js`, `portal/mlo/gbp-checklist/page.js`, `portal/mlo/marketing/page.js`. |
| Dynamic date fields (`new Date(...)`) in JSON-LD / metadata | **2** | `rate-watch/page.js` (Dataset `dateModified`), `[slug]/page.js` (Article from DB columns). |
| Hardcoded `datePublished` / `dateModified` | **9** | All pinned to `2026-03-27` — see SEO-5. |
| Pages hardcoding `Locus` slug | **3** | `page.js`, `about/page.js`, `layout.js` (2 copies of Maps URL, 1 about-body prose). |

---

## Seed findings validation

| Seed | Status | Finding ID |
|---|---|---|
| Pass 2 HP-C4: "23 JSON-LD blobs" — centralize candidate | **CONFIRMED but refined** — 17 total script tags across 16 files + root. Duplication pattern is worse than Pass 2 suggested: every Article page re-spells Organization/publisher/author nearly identically (4 identical `publisher` blocks, 7 near-identical `author` blocks). | **SEO-2** |
| Ahrefs relay `cmnyxd91f07kn6ro5`: "1 schema.org validation error" | **CONFIRMED as likely** — The site publishes "4.9 stars · 35 reviews" in `about/page.js:82+` and `layout.js:213` with no `aggregateRating`/`Review` schema backing it. Additionally, `about/page.js` renders 6 review quotes as HTML without `Review` nodes. Either the review UI is schema-less (safe but misses rich results), OR some other page has invalid structured data Ahrefs flagged. See SEO-20. | **SEO-20** |
| "23 JSON-LD blobs flagged in Pass 2" | See above. Corrected inventory below. | — |

---

## Findings catalog

### Category A — Site-level schema graph (layout.js)

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **SEO-1** | `src/app/layout.js:25-98` | Site-wide `@graph` with Organization + FinancialService + WebSite | LOW | Structurally clean, all three nodes linked via `@id`. Baked into every response body (inflates HTML ~2 KB × every page). |
| **SEO-1a** | `layout.js:35-44` | Hardcoded phone `303-444-5251`, email `david@netratemortgage.com`, street address, NMLS (via FinancialService description) | MED | Stale-by-deploy. Also duplicated in footer (L247-250), ContactBar, email templates, and PDF generators. |
| **SEO-1b** | `layout.js:45-50, 73-78` | `areaServed` state list hardcoded **twice** (Organization + FinancialService) — CO, CA, TX, OR | MED | Same list appears in `about/page.js:37`, `TrustBar.js:11`, `DscrRateWidget.js:13`, footer L285-290. Extending to a 5th state = 6+ edits. Pass 2 HP-B2 flagged this at the UI layer; here it's the schema layer. |
| **SEO-1c** | `layout.js:56` | `foundingDate: '2013'` | LOW | Evergreen. |
| **SEO-1d** | `layout.js:57` | `numberOfEmployees: { value: 2 }` | LOW | Stale-by-headcount. Same as Pass 2 HP-C2. |
| **SEO-1e** | `layout.js:66` | NMLS numbers embedded in FinancialService description prose: `NMLS #641790 (individual) | #1111861 (company)` | MED | NMLS change surface. If individual or company NMLS ever changes, 40+ touch points across repo (see count under "NMLS references" below). |
| **SEO-1f** | `layout.js:82-87` | `hasOfferCatalog`: 4 hardcoded Services (Conventional, FHA, VA, Jumbo) | LOW | Misses product lines live on site: HELOC, DSCR, Reverse, Non-QM, Crypto — schema doesn't advertise them. |

### Category B — Root-layout metadata

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **SEO-1g** | `layout.js:19-23` | `title: "NetRate Mortgage | Today's Rates, Zero Pitch"` + description + keywords string | LOW | Fine as default. No `alternates.canonical` at root level (handled per-page). `keywords` meta is ignored by Google but harmless. |
| **SEO-1h** | `layout.js:108-138` | Three `<Script>` tags: GA4 (G-QPEE5ZSZ79), Clarity (vv85vtrn77), Google Maps (conditional on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) | LOW | All three IDs hardcoded. Consent state set to `analytics_storage: granted, ad_storage: denied` in `ga4-init` — no cookie-banner gating before grant. |

### Category C — Per-page JSON-LD (WebPage / CollectionPage / Dataset)

The simpler case — single schema object per page, no Article/FAQ pair.

| ID | Location | Type | Content | Risk | Notes |
|---|---|---|---|---|---|
| **SEO-3a** | `src/app/rates/dscr/page.js:24-40` | WebPage | name, description, url, publisher+author (both Organization) | LOW | Duplicates Organization info from layout graph. Publisher+author identical. |
| **SEO-3b** | `src/app/rates/heloc/page.js:23-39` | WebPage | Same shape | LOW | Duplicated publisher+author. Same as 3a. |
| **SEO-3c** | `src/app/rates/non-qm/page.js:23-39` | WebPage | Same shape | LOW | Duplicated publisher+author. |
| **SEO-3d** | `src/app/resources/page.js:18-29` | CollectionPage | name, description, url, publisher | LOW | Only `publisher`, no author — differs from 3a-c inconsistently. |
| **SEO-3e** | `src/app/rate-watch/page.js:211-227` | Dataset | temporalCoverage `'2025-12/..'`, `dateModified: new Date().toISOString().split('T')[0]`, creator | **MED** | `temporalCoverage` hardcoded to start "2025-12"; will be misleading once historical window slides (e.g., by 2028 this still reads "since 2025-12" which is factually fine, but the label was clearly set at launch and never reviewed). `dateModified` is dynamic (good). |
| **SEO-3f** | `src/app/rate-watch/[date]/page.js:84-93` | Article | Dynamic — pulls from `commentary` DB row | LOW | `datePublished`/`dateModified` both set to `commentary.published_at || commentary.date` — both dates identical, so Google sees articles as never updated. Author defaults to `'David Burson'` if `commentary.author` is null. |
| **SEO-3g** | `src/app/[slug]/page.js:59-74` | Article | Dynamic — pulls from `content_pages` DB (`published_at`, `updated_at`, `author`) | LOW | This is the **only** dynamic Article schema on the site. Catches any slug not matched by a static route. Good shape; author type branches on `'NetRate Mortgage' ? Organization : Person'` — brittle equality check (if DB ever has `'NetRate Mortgage, LLC'` it silently becomes a `Person`). |

### Category D — Per-page JSON-LD arrays (Article + FAQPage pairs)

| ID | Location | Content | Risk | Notes |
|---|---|---|---|---|
| **SEO-4a** | `src/app/when-to-refinance/page.js:24-87` | `[Article, FAQPage]` — 4 FAQ Q&As | MED | `datePublished: '2026-03-27T00:00:00Z'` hardcoded. No `dateModified` field (Google defaults to datePublished). |
| **SEO-4b** | `src/app/airbnb-financing/page.js:24-84` | `[Article, FAQPage]` — 4 FAQ Q&As | MED | Hardcoded datePublished `2026-03-27T00:00:00Z`. No dateModified. No `mainEntityOfPage` on the FAQPage block (inconsistent with 4a/4d). |
| **SEO-4c** | `src/app/adu-rental-income/page.js:24-80` | `[Article, FAQPage]` — 4 FAQ Q&As | MED | Same hardcoded 2026-03-27. Article schema missing `mainEntityOfPage`. |
| **SEO-4d** | `src/app/crypto-mortgage/page.js:24-84` | `[Article, FAQPage]` — 4 FAQ Q&As | MED | Same hardcoded date. Includes `mainEntityOfPage`. |
| **SEO-4e** | `src/app/heloc-vs-cashout/page.js:24-80` | `[Article, FAQPage]` — N FAQs | MED | Hardcoded 2026-03-27. Article schema missing `mainEntityOfPage`. |
| **SEO-4f** | `src/app/equity-without-losing-rate/page.js:24-80` | `[Article, FAQPage]` | MED | Hardcoded `datePublished: '2026-03-27'` **and** `dateModified: '2026-03-27'` — explicit "never updated" signal. Article body at L109,115,181,185,188 contains `6.4%` / `6.769% APR` prose that's rate-moment-specific (see Pass 2 HP-D4). Fixing the prose without bumping `dateModified` leaves a misleading schema signal. |
| **SEO-4g** | `src/app/condo-rules-changed/page.js:25-86` | `[Article, FAQPage]` — 4 FAQ Q&As | MED | Same pattern. `datePublished: '2026-03-27'` + `dateModified: '2026-03-27'`. Includes `mainEntityOfPage`. |
| **SEO-4h** | `src/app/california-housing-update/page.js:24-80` | `[Article, FAQPage]` — 3 FAQ Q&As | MED | Hardcoded `datePublished: '2026-03-27T00:00:00Z'`. No dateModified. Article missing `mainEntityOfPage`. |

### Category E — Duplication patterns across D

| ID | Content | Count | Notes |
|---|---|---|---|
| **SEO-5** | `datePublished: '2026-03-27'` string literal in schema | **9 pages** | All seven Category D pages + `rate-watch` FAQ pages. Eight files were clearly authored in a single batch (March 27 content launch). None have been touched since. Google crawl signals: "content is frozen for 3+ weeks." After Pass 2 HP-D4 flagged stale rate prose on `equity-without-losing-rate`, the correct fix will require editing **both** the prose and the `dateModified` — neither is automated. |
| **SEO-6** | Identical `Organization` publisher block | **11 pages** | Every Category C-D page spells out `{ '@type': 'Organization', name: 'NetRate Mortgage', url: 'https://netratemortgage.com' }` inline. Brand-name change = 11-file grep-and-replace. NMLS baked into top-layer FinancialService description is a 12th place. |
| **SEO-7** | Identical `author: Organization` block | **7 pages** | Every Article page sets author == publisher. No byline variation, no `Person` author. Inconsistent with `[slug]/page.js` which branches to `Person` for non-"NetRate Mortgage" authors. |
| **SEO-8** | `mainEntityOfPage` inclusion | **3 of 7** Article pages | Only `when-to-refinance`, `crypto-mortgage`, and `condo-rules-changed` set it. The other 4 Articles omit it. Inconsistent structured data across the same content type. |

### Category F — Per-page metadata (openGraph, twitter, alternates.canonical)

| ID | Location | Risk | Notes |
|---|---|---|---|
| **SEO-9** | `src/app/page.js:6-10` | LOW | Homepage canonical `https://netratemortgage.com` only. No openGraph/twitter/description at page level — inherits from root layout. That means OG card for homepage uses the generic "Today's Rates, Zero Pitch" tagline, not a homepage-optimized description. |
| **SEO-10** | 47 per-route canonical declarations | LOW-MED | Every canonical URL is hardcoded as a full-absolute string: `'https://netratemortgage.com/<path>'`. Move to the subdomain, rename a route, or env-switch (staging vs prod) = 47 edits. A single `BASE_URL` constant (which exists in `[slug]/page.js:13` but is not exported) would collapse this to one file. |
| **SEO-11** | `src/app/rates/heloc/page.js:3-21` | LOW | Every openGraph + twitter card spells out title/description inline. Most of the pages have 3 copies of the same title string (metadata.title + openGraph.title + twitter.title). |
| **SEO-12** | `src/app/rate-watch/page.js:183-208` | LOW | **Only** page using `generateMetadata()` async to pull live data. Title becomes `"Rate Watch — 30yr Fixed at {rate}% Today | NetRate Mortgage"`. Good pattern — and the only one. Every other rate page ships a static title even though their hero shows a DB-sourced rate. Missed SEO lift on `/rates`, `/rates/dscr`, `/rates/heloc`, homepage, etc. |
| **SEO-13** | `src/app/[slug]/page.js:24-51` | LOW | Uses `generateMetadata({ params })` to read `page.meta_title`/`page.meta_description` from DB. Good. Templated suffix `| NetRate Mortgage` hardcoded in metadata.title assembly (L33) — breaks if DB rows already include the suffix. |
| **SEO-14** | All portal routes under `portal/` | LOW | `portal/layout.js:9` sets `robots: 'noindex, nofollow'`. Also applied individually to `portal/mlo/gbp-checklist` and `portal/mlo/marketing`. Belt-and-suspenders — the nested per-page ones are redundant but harmless. |

### Category G — Sitemap + robots.txt

| ID | Location | Risk | Notes |
|---|---|---|---|
| **SEO-15** | `src/app/sitemap.js:1-306` | **HIGH** | Catalogs **47 static routes** explicitly + DB-driven `content_pages`. `lastModified: new Date()` on **every entry** → every build regenerates lastmod to "now". Google observes "everything changed, every build" and deprioritizes the signal. The Ahrefs-flagged "7 redirect URLs in sitemap" per relay `cmnyxd91f07kn6ro5` is almost certainly sourced from here — entries like `/rates/non-qm` that may redirect or have casing drift. Need to diff sitemap URLs against actual 200-status final URLs. |
| **SEO-15a** | `sitemap.js` missing routes | MED | Inventory check: sitemap includes `/rates/non-qm`, `/rates/heloc` but **omits** `/rates/dscr` — a live route (`src/app/rates/dscr/page.js`) with its own metadata and schema. Missing from sitemap = missing from index. Also missing: `/contact`, `/why-netrate` (wait — `/why-netrate` IS listed at L89; `/contact` IS listed at L64; `/services` IS listed at L52). Re-audit: the clear gap is **`/rates/dscr`**. |
| **SEO-15b** | `sitemap.js:19-24` | LOW | DB-sourced `content_pages` dynamically added. Uses `p.updated_at` for lastModified (good). |
| **SEO-16** | `public/robots.txt:1-31` | LOW | Explicit AI-bot allow (GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Applebot-Extended, Google-Extended, GoogleOther). Sitemap URL present. No `Disallow: /portal/` — the `noindex` meta handles it, but a defense-in-depth Disallow for `/portal/` and `/api/` would block crawl budget waste. |

### Category H — Brand drift, NMLS, stale references

| ID | Location | Risk | Notes |
|---|---|---|---|
| **SEO-17** | `src/app/layout.js:214-216` + `src/app/page.js:119-122` + `src/app/about/page.js:151-153` | **HIGH** | Three copies of the Google Maps URL still referencing the old GBP name: `query=Locus+Mortgage&query_place_id=ChIJ…`. Explicit `TODO` comment in all three. Pass 2 HP-3 flagged the two `layout.js`/`page.js` copies; `about/page.js` is the third copy Pass 2 missed. Rendered URL-text says "35 reviews" but href points at `Locus Mortgage` search. Brand rule violation AND stale link. |
| **SEO-18** | `src/app/about/page.js:82` | MED | Prose "I started brokering mortgages in 2013 under the name Locus Mortgage." — intentional historical reference. OK as prose; flagged only so a future brand-linter doesn't false-flag it. |
| **SEO-19** | NMLS references across `src/` | MED | Grep: **59 files** reference NMLS / 641790 / 1111861. Breakdown: 39 JSX prose copies, 11 schema.org publisher descriptions, 4 email templates (`src/lib/email-templates/`), 3 PDF generators (`QuotePDF`, `PrequalLetterPDF`, `PrintView`), 2 MISMO/MCR builders. Centralize: `src/lib/brand/credentials.js` with exports `NMLS_INDIVIDUAL`, `NMLS_COMPANY`, `NMLS_INDIVIDUAL_URL`, etc. Changing individual NMLS post-license-renewal otherwise = 59-file edit. |
| **SEO-20** | `src/app/about/page.js:34-43` + `src/app/layout.js:213` | MED | "4.9 stars · 35 reviews" published as text/UI but **no `aggregateRating` schema** backing it anywhere in layout.js graph or about page. `REVIEWS` array at `about/page.js:45-70` lists 6 full testimonials, also no `Review` schema. This is almost certainly the Ahrefs-flagged schema validation error — OR the correct fix path. Rich-results eligibility: adding `aggregateRating: { ratingValue: 4.9, reviewCount: 35, bestRating: 5 }` to the FinancialService node in layout.js would enable review stars in SERPs. |
| **SEO-21** | `src/app/page.js:132` + `layout.js:371` (BBB) + `about/page.js:?` | MED | BBB URL slug `locus-mortgage-1296-90159653` — Pass 2 HP-3a. Second brand-drift surface. |

### Category I — Pages missing schema or metadata

Routes with `export const metadata` but **no JSON-LD**:

| ID | Location | Risk | Notes |
|---|---|---|---|
| **SEO-22** | `src/app/about/page.js` | MED | High-intent page (About + reviews) with metadata but no JSON-LD. Ideal candidate for `AboutPage` + `Person` (David Burson) + `aggregateRating` schema. |
| **SEO-23** | `src/app/colorado/`, `/california/`, `/texas/`, `/oregon/page.js` | MED | State landing pages. Metadata + canonical only, no schema. `Service` + `areaServed` per-state schema would differentiate from root graph. |
| **SEO-24** | `src/app/services/page.js`, `tools/page.js`, `refinance-playbook/page.js`, `reverse-mortgage/page.js`, `how-pricing-works/page.js`, `points-and-credits/page.js`, `closing-costs/page.js`, `breakeven/page.js`, `good-deal/page.js`, `why-netrate/page.js`, `contact/layout.js`, `licensing/page.js`, `privacy/page.js`, `terms/page.js`, `accessibility/page.js`, `do-not-sell/page.js`, `book/layout.js` | LOW-MED | Metadata + canonical only, no JSON-LD. Many could use simple `WebPage` or `Article` schema. |
| **SEO-25** | All `tools/*/layout.js` files (7 calculators) | LOW | `metadata` + canonical only. No schema. Could use `SoftwareApplication` or `WebApplication` for the calculators. |

### Category J — Validation / consistency gaps

| ID | Content | Risk | Notes |
|---|---|---|---|
| **SEO-26** | Inconsistent `type` in openGraph | LOW | `when-to-refinance`, `equity-without-losing-rate` use `type: 'article'`. `airbnb-financing`, `adu-rental-income`, `crypto-mortgage`, `heloc-vs-cashout`, `condo-rules-changed`, `california-housing-update` → no openGraph.type declared explicitly (defaults to website in some cases, type-mismatch with the Article JSON-LD). |
| **SEO-27** | `datePublished` format drift | LOW | Some pages use `'2026-03-27T00:00:00Z'` (ISO with time), others `'2026-03-27'` (date-only). Both valid per schema.org but inconsistent. |
| **SEO-28** | Homepage has no JSON-LD override | MED | `src/app/page.js` lists the most important commercial page and ships no page-level JSON-LD. The root layout's FinancialService node covers the brand but a `WebPage` or `Product` entity on the homepage could surface the rate tool as a product (Offer schema with rate ranges). |
| **SEO-29** | No `BreadcrumbList` schema anywhere | MED | Multiple pages render visual breadcrumbs (e.g., `rates/dscr/page.js:50-59` shows `Home / Rates / Non-QM / DSCR`) with no `BreadcrumbList` JSON-LD. Missed rich-result opportunity on 15+ pages. |

---

## Ahrefs validation-error analysis (relay `cmnyxd91f07kn6ro5`)

The relay lists six issues (43/100 Ahrefs score); the schema-specific one is: **"1 schema.org validation error"**. Candidates after inventory:

1. **Most likely:** `FinancialService` node in `layout.js` references `numberOfEmployees: { '@type': 'QuantitativeValue', value: 2 }` — `QuantitativeValue` requires `value` to be a Number wrapped in a property like `unitText`, or the `value` alone is accepted but some validators complain. Lower-risk candidate.
2. **Possible:** the `FAQPage` + `Article` pair is rendered as a single `<script>` with a JSON array (`jsonLd = [...]`). Most validators accept this but some (including Google's Rich Results Test in strict mode) expect `@context` on every item or a single `@graph`. This could be misparsed as "one validation error on the FAQPage node."
3. **Possible:** `publisher` in Article pages is an `Organization` without a `logo` property, which schema.org recommends (not requires) for Article publishers. Google Rich Results Test reports "missing recommended field: publisher.logo" as a warning, not an error — but Ahrefs may escalate to error severity.
4. **Possible:** `Dataset` on `rate-watch` has `temporalCoverage: '2025-12/..'` — the `/..` open-ended form is schema.org-valid but some validators reject it.

**Recommended triage:** Pipe each page through Google Rich Results Test (https://search.google.com/test/rich-results) individually. Ahrefs doesn't surface the offending URL in its free tier summary; the error could be on any one of 17 schema-bearing pages.

---

## Ship-immediately candidates

In priority order:

1. **Fix the 3 Locus Mortgage GBP URLs (SEO-17).** Explicit TODO. Two copies in `layout.js`/`page.js` were flagged in Pass 2; the third in `about/page.js` is new. Brand rule violation.
2. **Add `/rates/dscr` to `sitemap.js` (SEO-15a).** The page exists with its own canonical and schema but isn't in the sitemap — Google won't know to crawl it.
3. **Add `aggregateRating` to FinancialService node in `layout.js` (SEO-20).** `{ ratingValue: 4.9, reviewCount: 35, bestRating: 5 }` enables review stars sitewide. Matches what's already published in UI.
4. **Fix sitemap `lastModified: new Date()` (SEO-15).** Either (a) hardcode dates + update manually, (b) pull from DB/git last-commit for each path, or (c) set `lastModified: undefined` for routes without real change tracking. Current "everything changed on every build" signal hurts crawl budget — directly cited in relay as a probable cause of 0 organic traffic.
5. **Audit the 6 Ahrefs issues end-to-end (relay `cmnyxd91f07kn6ro5`).** 7 redirect URLs in sitemap, 11 of 14 internal URLs are 3xx, 1 canonical → redirect, 1 redirect chain, 2 HTTP→HTTPS, 1 schema validation error. Needs a focused redirect-audit pass (arguably D6 network / routing territory, not D8).
6. **Centralize Organization publisher (SEO-6).** Extract `src/lib/schema/organization.js` returning the same object all 11 pages copy-paste. One file to edit for brand/NMLS/address changes.

---

## Recommended DB-ification / refactor targets (priority order)

1. **`src/lib/brand/credentials.js`** — NMLS, address, phone, email, licensed-states array, founding year. Touched by 59+ files. Single-source-of-truth for brand data on the site. Eliminates SEO-1a, SEO-1b, SEO-1c, SEO-1d, SEO-19.
2. **`src/lib/schema/build-schema.js`** — page-schema factory. Accept `{ type, headline, url, slug, datePublished, dateModified, faqs?, ... }`, return a valid JSON-LD object. Collapses SEO-3a-g, SEO-4a-h to one call per page. Fixes SEO-6, SEO-7, SEO-8, SEO-26 automatically.
3. **`content_pages.seo_schema` column** — per-content-page schema config. For the 9 hardcoded `2026-03-27` dates, move those pages into `content_pages` (DB) as Claw-published content. The `[slug]/page.js` route already handles this shape. Retires SEO-4a-h and SEO-5.
4. **`src/lib/brand/base-url.js`** — single `BASE_URL` export. Used by canonicals, JSON-LD URLs, sitemap, email templates. Fixes SEO-10 (47 hardcoded origin URLs).
5. **`generateMetadata()` for rate-bearing pages** — extend the `rate-watch/page.js` pattern (SEO-12) to homepage, `/rates`, `/rates/dscr`. "30yr at 5.875% today" in the title is a significant SEO lift; only one page does it today.
6. **Per-build `Sitemap.xml` with real lastmod** — instead of `new Date()`, query git for last-commit-touching-this-route OR pin explicit dates. Would fix SEO-15 and probably improve Ahrefs score materially.
7. **`BreadcrumbList` schema** — add to the 15+ pages that render breadcrumbs visually. Almost free rich-result surface.

---

## Open questions

1. **Is the Ahrefs "1 schema.org validation error" resolvable from inventory, or does David need to pipe each page through Google Rich Results Test?** Current state: 4 plausible candidates (above). Ahrefs free tier doesn't cite the URL.
2. **Should the 7 Article pages (SEO-4a-h) migrate to `content_pages` (DB-managed)?** Claw is publishing content via the `[slug]` route pattern. These 7 are hardcoded into the app at `/airbnb-financing`, `/adu-rental-income`, etc. If they move to DB, `dateModified` becomes automatic (SEO-5 resolves) and Claw can re-publish without a deploy.
3. **Is `aggregateRating` on the site-wide Organization/FinancialService appropriate, or should it live on `about/page.js` only?** Google allows both; site-wide gets stars in more SERPs but has higher structured-data-fraud risk if reviewCount drifts from actual Google Reviews count.
4. **Does the 4 root schema `numberOfEmployees: 2` need to be dynamic (hires)?** Or just updated on policy — e.g., quarterly?
5. **Should `/rates/dscr` canonical be `/rates/dscr` or rolled into `/rates/non-qm`?** Currently both exist as peer routes; Google may see `dscr` as a subset of non-qm and pick one.
6. **Does the homepage need a `Product` + `Offer` schema for the rate tool?** Arguable — "today's rate" isn't a product offering in the retail sense, but treating it as one (with `priceSpecification` = rate, `validFrom`/`validThrough` = sheet dates) would be technically defensible and SEO-novel.

---

**Scope note.** Pass 4 covers the **schema.org + SEO markup surface** — every JSON-LD block, metadata export, canonical URL, robots directive, sitemap entry, and OpenGraph/Twitter card in the public site. Not in scope: email templates (Pass 5 — borrower email), PDF generation (`QuotePDF`, `PrequalLetterPDF`, `HecmOptimizer/PrintView`), MISMO XML (`mismo-builder.js`), MCR fields (`mcr-fields.js`), or portal UI text. Those surfaces carry their own brand-drift and stale-data risks and will be covered in later passes.
