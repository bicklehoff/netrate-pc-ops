# Session Log — PC Operations

**Location:** `Work/SESSION-LOG.md`
**Device:** PC (Public Facing)

Use this file to coordinate across PC work chats. Each session should read this first and add notes at the end.

---

## How to Use This File

**At the START of a new chat:**
1. Read this file: `Work/SESSION-LOG.md`
2. Reference recent sessions for context
3. Check Mac's SESSION-LOG (via netrate-ops repo) for cross-device updates

**DURING a session — update immediately if:**
- Another department would need to know this to do their job
- Paths, folders, or file structures changed
- A major or permanent decision was made
- Something was created that other chats will reference

**At the END of a chat:**
1. Update this log with what was done
2. Include: chat focus, key decisions, files created/modified, open items
3. Use the template below

---

## Template

```
## Session: [DATE] - [TITLE] ([DEPARTMENT])

**Chat focus:** [One line summary]

**What was done:**
- [Bullet points]

**Key decisions:**
- [Bullet points]

**Files created/modified:**
- [File paths]

**Open items:**
- [ ] [For which department/device] — [What needs doing]
```

---

## Session: February 20, 2026 - PC Ops Repo Created (Setup — via Mac)

**Chat focus:** Mac Setup created the PC ops repo structure as part of the two-device governance architecture.

**What was done:**
- Created `netrate-pc-ops` repo on GitHub (private)
- Built folder structure: WebDev, Products, Integrations, Admin
- Wrote CLAUDE.md with PC-specific departments and rules
- Created this SESSION-LOG
- PC references `netrate-governance` repo for shared rules

**Key decisions:**
- PC = public facing (website, products, integrations)
- Mac = back office (processing, compliance, trackers)
- ALL trackers live on Mac — PC is read-only via TrackerPortal
- Governance changes require both devices to approve
- PC departments: WebDev, Products, Integrations, Admin, Setup, Auditor

**Cross-device notes:**
- See Mac SESSION-LOG Feb 20 entries for full Phase A website plan
- See Mac SESSION-LOG Feb 20 for two-device architecture design
- Website repo: `netrate-mortgage-site` (separate from ops repos)
- GA4 Measurement ID: G-QPEE5ZSZ79
- GSC: Verified

**Open items:**
- [x] ~~WebDev — Clone netrate-mortgage-site repo and start building~~ (done in Setup Feb 23)
- [x] ~~Setup — Clone netrate-governance repo for shared rules reference~~ (done in Setup Feb 23)
- [ ] WebDev — Read Mac's Marketing copy files for website content

---

## Session: February 23, 2026 - PC Bootstrap + Vercel Check (Setup)

**Chat focus:** First PC-native Setup session. Cloned all repos, verified Vercel deployment, confirmed GA4 status, prepped handoff to WebDev.

**What was done:**
- Cloned `netrate-governance` to `D:\PROJECTS\netrate-governance`
- Cloned `netrate-pc-ops` to `D:\PROJECTS\netrate-pc-ops`
- Cloned `netrate-mortgage-site` to `D:\PROJECTS\netrate-mortgage-site`
- Verified Vercel is connected and auto-deploying from `main` branch (deployed 3 days ago, live at netrate-mortgage-site.vercel.app)
- Confirmed GA4 (`G-QPEE5ZSZ79`) is NOT yet in layout.js — still needs adding
- Started GA4 edit in layout.js (added `next/script` import + gtag snippet) but **not committed** — handing off to WebDev to review and commit

**Key decisions:**
- All 3 repos live at `D:\PROJECTS/` on PC
- Dev work on `netrate-mortgage-site` belongs to WebDev department, not Setup
- Setup session stays for architecture/coordination only

**Files modified (uncommitted, in netrate-mortgage-site):**
- `src/app/layout.js` — GA4 script tags added but NOT committed

**Open items:**
- [ ] **WebDev** — Review and commit the GA4 addition in layout.js, push to deploy
- [ ] **WebDev** — Integrate marketing copy into 4 pages (homepage, about, services, contact). Copy is in `netrate-ops` at `Work/Marketing/Website/copy/`
- [ ] **WebDev** — Wire lead capture form to Zoho CRM API
- [ ] **David → Mac** — Relay that PC is bootstrapped and WebDev is ready to pick up work

### ⚠️ Architecture Proposal: Borrower Portal Infrastructure (needs Mac approval)

**Proposed by:** PC Setup, Feb 23

**Context:** The mortgage site (`netrate-mortgage-site`) will eventually become a borrower-facing portal with its own tracked data (loan status, documents, milestones). That portal will need a read path from Mac's back-end trackers to display borrower-facing details.

**Proposal:** Set up `netrate-mortgage-site` with full `.claude/` infrastructure mirroring Mac's pattern:
- `.claude/agents/clerk.md` — customized for front-end portal data (dormant until portal exists)
- `.claude/scripts/validate-tracker-write.sh` — write guard for future portal data files
- `.claude/settings.local.json` — permissions + hook wiring
- `CLAUDE.md` — WebDev department rules, references governance

**Why now:** Easier to build on the right foundation than to retrofit later. The scaffolding is dormant — no functional impact until portal data exists.

**Needs agreement on:**
1. Does Mac approve mirroring the `.claude/` structure for the site repo?
2. How will portal data sync from Mac trackers? (read-only API? JSON push? Vercel serverless function?)
3. Should portal data live in the site repo or in a separate data repo?

**Status:** ✅ Resolved — Mac approved. See `netrate-governance/BORROWER-PORTAL-BRIEF.md` for full design brief. Shelved for now — website first.

---

## Session: February 23, 2026 - Marketing Copy Integration + Zoho Lead API (WebDev)

**Chat focus:** Integrated all marketing copy into the 4 content pages, added GA4 tracking, built contact form with Zoho CRM lead capture API.

**What was done:**
- Reviewed and committed GA4 tracking (Setup had added it but left uncommitted). Moved `<Script>` tags from `<head>` to `<body>` per Next.js App Router best practice — `afterInteractive` strategy is documented as a body-level child, placing it in `<head>` risks breakage on future Next.js upgrades.
- Installed `node_modules` (were missing — repo was cloned but `npm install` never ran)
- Integrated all 4 marketing copy files into pages:
  - **Homepage** (`page.js`): New hero with Marketing headline, rate teaser section, 3 "why us" cards, 3 service overview cards, credibility section, teal bottom CTA band
  - **About** (`about/page.js`): David's first-person story, direct-to-consumer section, rate tool section, credentials card with stats
  - **Services** (`services/page.js`): Refinance and purchase sections with `id` anchors for deep linking (`#refinance`, `#purchase`), loan programs grid (Conventional/FHA/VA/Jumbo), licensed states grid, bottom CTA
  - **Contact** (`contact/page.js`): Full lead capture form (name, email, phone, loan type dropdown, message) with loading/error/success states. Matches Marketing's field spec exactly.
- Created `contact/layout.js` for metadata (page.js is `'use client'` so can't export metadata)
- Created `/api/lead` route (`src/app/api/lead/route.js`) — server-side Zoho CRM integration:
  - Refreshes OAuth access token via `ZOHO_REFRESH_TOKEN`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` env vars
  - Creates a Lead in Zoho CRM with name, email, phone, lead source "Website", description with loan type + message
  - Returns lead ID on success, proper error responses on failure
- Both commits pushed to `main` → Vercel auto-deploying

**Key decisions:**
- GA4 `<Script>` placed in `<body>` not `<head>` — follows Next.js documented pattern, more upgrade-resilient
- Contact page is a client component (`'use client'`) for form state — metadata moved to `layout.js`
- Zoho CRM credentials use environment variables (not hardcoded) — need to be set in Vercel dashboard
- Lead form POSTs to `/api/lead` (Next.js API route, runs server-side on Vercel)

**Commits (netrate-mortgage-site):**
- `ecb7f5e` — Add GA4 tracking (G-QPEE5ZSZ79) to root layout
- `c60c6b4` — Integrate marketing copy into all pages, add Zoho CRM lead API

**Files created/modified (netrate-mortgage-site):**
- `src/app/layout.js` — GA4 script tags (modified)
- `src/app/page.js` — Full homepage with marketing copy (modified)
- `src/app/about/page.js` — Full about page (modified)
- `src/app/services/page.js` — Full services page (modified)
- `src/app/contact/page.js` — Lead capture form with Zoho integration (modified)
- `src/app/contact/layout.js` — Contact page metadata (created)
- `src/app/api/lead/route.js` — Zoho CRM lead API route (created)

**Open items:**
- [ ] **David** — Add Zoho env vars to Vercel: `ZOHO_REFRESH_TOKEN`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` (lead form will 500 until these are set)
- [ ] **David → Mac** — Relay: "clerk: WEBSITE-2026 — GA4 deployed, all 4 content pages live with marketing copy, contact form wired to Zoho CRM API (pending env vars)"
- [ ] **WebDev** — Test contact form end-to-end after Zoho env vars are set in Vercel
- [ ] **WebDev** — Read Mac's Marketing copy files for website content ~~(DONE — completed this session)~~

---

## Session: February 23, 2026 (cont'd) - Website Strategy + AI Search + Portal Planning (Setup)

**Chat focus:** Strategic planning session — AI search optimization, portal architecture, Zoho CRM direction. Defined next phase of PC Dev work.

**What was done:**
- Researched `llms.txt` — emerging standard for AI agent search optimization. Markdown file at site root that tells AI models where to find key content. ~10% adoption, endorsed by Anthropic and Vercel. Zero-risk, high-value for our "rates today" use case.
- Defined three-phase product strategy: (1) AI search optimization, (2) portal architecture, (3) Zoho CRM transition
- Designed portal architecture: one Next.js app, two zones — public at `/`, private at `/portal/*` behind auth
- Settled Zoho question: keep existing lead→CRM flow, transition to portal DB as primary store when built, Zoho becomes secondary
- Wrote full strategy plan to `.claude/plans/iterative-weaving-abelson.md`
- Prepared WebDev prompt for Phase 1 (AI search tasks)

**Key decisions:**
- `llms.txt` is first priority for Dev — positions rate tool as AI-citable source for rate queries
- Portal is one app with public/private zones, NOT a separate repo or deployment
- Database: Vercel Postgres or Supabase (not JSON files) — decision for Dev to make
- Auth: NextAuth.js with magic links for borrowers — decision for Dev to confirm
- Zoho CRM: keep near-term, transition mid-term, evaluate long-term
- Mac's BORROWER-PORTAL-BRIEF.md is the design brief for portal — Dev designs schema/states from scratch

**Open items:**
- [x] ~~**WebDev** — Phase 1: Create `llms.txt`, Schema.org structured data, `robots.txt`, `sitemap.xml`~~ (done in WebDev Feb 23 cont'd)
- [ ] **WebDev** — Phase 2 (later): Portal foundation — auth, database, borrower schema, route group
- [ ] **David** — Still need Zoho env vars in Vercel (carried forward)
- [ ] **David → Mac** — Relay WEBSITE-2026 tracker update (carried forward)

---

## Session: February 23, 2026 (cont'd) - AI Search Optimization (WebDev)

**Chat focus:** Phase 1 execution — created llms.txt, Schema.org JSON-LD, robots.txt, and dynamic sitemap for AI and traditional search discoverability.

**What was done:**
- Created `public/llms.txt` per llmstxt.org spec — describes NetRate Mortgage, emphasizes rate tool as live wholesale pricing source AI models can cite. Includes key pages with one-line summaries. Homepage in Optional section (skippable for shorter context).
- Added Schema.org JSON-LD to `layout.js` — `@graph` with three entities:
  - `Organization`: name, address, phone, email, founder, foundingDate, areaServed (CO/TX/OR), numberOfEmployees
  - `FinancialService`: serviceType array, loan program OfferCatalog (Conventional/FHA/VA/Jumbo), NMLS numbers in description, linked to Organization via provider
  - `WebSite`: canonical URL, publisher link to Organization
- Created `public/robots.txt` — allows all crawlers, explicitly names AI bots (GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Applebot-Extended, GoogleOther), points to /sitemap.xml
- Created `src/app/sitemap.js` — Next.js dynamic sitemap for all 5 public pages. `/rates` at daily changeFrequency (it's the live data page), homepage weekly, services/about/contact monthly. Priority: homepage 1.0, rates 0.9, services/contact 0.8, about 0.7.
- Build passes clean (11 routes, including /sitemap.xml as static)
- Pushed to main → Vercel auto-deploying

**Key decisions:**
- `llms.txt` keeps it simple — describe + link, no API details. Rate tool is client-side JS with no public API for bots to call directly. Can add `llms-full.txt` later if we build a rates API.
- Schema.org uses `FinancialService` (no official `MortgageBroker` type exists). Google supports it for rich results / Knowledge Panel path.
- robots.txt explicitly welcomes AI bots rather than just relying on the default `Allow: /` — signals intent and future-proofs against bot-specific defaults.
- Sitemap uses Next.js `sitemap.js` convention (generates /sitemap.xml dynamically) rather than a static XML file — easier to maintain as pages are added.

**Commit (netrate-mortgage-site):**
- `469f3a8` — Add AI search optimization: llms.txt, Schema.org, robots.txt, sitemap

**Files created/modified (netrate-mortgage-site):**
- `public/llms.txt` — AI agent discovery file (created)
- `public/robots.txt` — Crawler permissions (created)
- `src/app/sitemap.js` — Dynamic sitemap generator (created)
- `src/app/layout.js` — Schema.org JSON-LD added (modified)

**Open items:**
- [ ] **WebDev** — Phase 2 (later): Portal foundation — auth, database, borrower schema, route group
- [x] ~~**David** — Still need Zoho env vars in Vercel~~ (done — new CRM-scoped refresh token set)
- [ ] **David → Mac** — Relay WEBSITE-2026 tracker update (carried forward)
- [ ] **WebDev** — Validate structured data with Google Rich Results Test after deploy
- [ ] **WebDev** — Submit sitemap to GSC (Google Search Console) after deploy

---

## Session: February 23, 2026 (cont'd) - Zoho CRM Fix + End-to-End Test (WebDev)

**Chat focus:** Fixed Zoho OAuth scope (was Creator, needed CRM), tested live contact form end-to-end, added Google-Extended to robots.txt.

**What was done:**
- Discovered existing Zoho refresh token had **Zoho Creator** scope, not **Zoho CRM** scope — that's why the lead API was returning 502
- Walked David through generating a new grant token in Zoho API Console Self Client with scope `ZohoCRM.modules.leads.CREATE,ZohoCRM.modules.leads.READ`
- Exchanged grant token for new CRM-scoped refresh token
- Tested Zoho CRM lead creation directly — confirmed working (test lead created)
- David updated `ZOHO_REFRESH_TOKEN` in Vercel with the new value and redeployed
- Tested live site end-to-end: `POST https://netratemortgage.com/api/lead` → **200 OK**, lead created in Zoho CRM
- Added `Google-Extended` (Gemini) user-agent to robots.txt (was missing from initial version)

**Key decisions:**
- Zoho Self Client reused (same client_id/client_secret), only the refresh token changed
- Old Creator-scoped token is now stale — only the CRM-scoped token is in use

**Commits (netrate-mortgage-site):**
- `e2100c7` — Add Google-Extended (Gemini) to robots.txt AI bot allowlist

**Open items:**
- [ ] **David** — Delete 2 test leads from Zoho CRM ("Test Lead - Delete Me" and "Website Test 2 - Delete Me")
- [ ] **David → Mac** — Relay: "clerk: WEBSITE-2026 — All Phase 1 complete. GA4 live, all content pages deployed, contact form creating leads in Zoho CRM, AI search optimization shipped (llms.txt, Schema.org, robots.txt, sitemap). Ready for Phase 2 (portal)."
- [ ] **WebDev** — Validate structured data with Google Rich Results Test
- [ ] **WebDev** — Submit sitemap to GSC
- [ ] **WebDev** — Phase 2 (later): Portal foundation
