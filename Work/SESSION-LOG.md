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
- [x] ~~**WebDev** — Phase 2 (later): Portal foundation~~ (done — Feb 23-24 sessions)

---

## Session: February 23, 2026 - Borrower Portal Architecture Planning (WebDev)

**Chat focus:** Full architecture planning session for the borrower portal. Analyzed 3 LendingDox BPMN workflows, designed the 6-step application form, database schema, loan state machine, auth model, and build plan.

**What was done:**
- Analyzed 3 LendingDox BPMN XML files (EZ, Standard, Pre-qual flows)
- Chose Flow 2 (Standard) as the base — more complete, better for MLO processing
- Designed 6-step application wizard (~32 fields) with purchase/refinance branching
- Designed database schema (5 tables: borrowers, mlos, loans, loan_events, documents)
- Designed loan state machine (10 states: draft → funded, with suspended/denied branches)
- Designed two-factor auth: magic link (email) + SMS verification (phone via Zoho Voice API)
- Designed AES-256-GCM encryption for SSN and DOB
- Designed XML export for wholesale lender submission
- Resolved all 7 architecture decisions through iterative discussion with David
- Wrote comprehensive PORTAL-ARCHITECTURE-PLAN.md

**Key decisions:**
- SSN/DOB collected in Step 1 — encrypted with AES-256-GCM at application level
- Borrower auth: magic link + SMS (no passwords). Zoho Voice for SMS (no Twilio)
- Database: Vercel Postgres (now Neon) + Prisma ORM
- File storage: Vercel Blob
- Path-based routing: `netratemortgage.com/portal/*`
- MLO accounts: hard-coded seed (David = admin, Jamie = MLO)
- Email sender: new alias `portal@netratemortgage.com` via Zoho Mail API
- XML export included in v1 scope (originally deferred to v2)
- Coborrower flow deferred to v2

**Files created (netrate-pc-ops):**
- `Work/WebDev/PORTAL-ARCHITECTURE-PLAN.md` — Full architecture document

---

## Session: February 24, 2026 - Portal Phase 2a Foundation Build (WebDev)

**Chat focus:** Phase 2a execution — installed all dependencies, created Prisma schema, set up NextAuth, built portal route group, connected Neon Postgres, ran first migration, seeded MLO accounts.

**What was done:**
- Installed 9 production deps: next-auth, @prisma/client, @neondatabase/serverless, @vercel/blob, react-hook-form, zod, @hookform/resolvers, bcrypt, dotenv
- Discovered `@vercel/postgres` is deprecated — replaced with `@neondatabase/serverless` (Neon is what Vercel Postgres became)
- Created Prisma schema with all 5 tables (borrowers, mlos, loans, loan_events, documents) with proper @map to snake_case columns
- Created `src/lib/prisma.js` — Prisma client singleton
- Created `src/lib/encryption.js` — AES-256-GCM encrypt/decrypt/ssnLastFour
- Created `src/lib/loan-states.js` — State machine, transitions, ball-in-court, email triggers, helper functions
- Created `src/lib/auth.js` — NextAuth config (CredentialsProvider for MLO), plus custom magic link + SMS verification helpers for borrowers
- Created `src/lib/validations/application.js` — Zod schemas for all 6 form steps
- Created `src/middleware.js` — Route protection for MLO and borrower dashboard routes
- Created `src/app/api/auth/[...nextauth]/route.js` — NextAuth API handler
- Created portal route group with 9 pages
- Walked David through Neon Postgres setup in Vercel Marketplace (free tier, US East)
- Connected Neon database to project, set up env vars
- Ran first Prisma migration — all 5 tables created in Neon
- Seeded MLO accounts: David (admin) + Jamie (MLO) with default passwords
- Build passes clean: 18 routes, zero errors

**Key decisions:**
- `@vercel/postgres` deprecated → use `@neondatabase/serverless` instead
- Neon Postgres free tier (0.5 GB) — sufficient for v1
- Prisma 6 generates TypeScript — seed script uses `npx tsx` to run
- `DIRECT_URL` manually added in Vercel (Neon creates `DATABASE_URL_UNPOOLED` but Prisma expects `DIRECT_URL`)

**Commits:** Not yet committed — all changes local, pending review before push.

**Environment variables set in Vercel:**
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DIRECT_URL`, `PII_ENCRYPTION_KEY`, `NEXTAUTH_SECRET`

**Open items:**
- [ ] **WebDev** — Commit and push Phase 2a foundation to main
- [ ] **WebDev** — Phase 2b: Build 6-step form fields with React Hook Form + Zod
- [ ] **WebDev** — Phase 2c: Borrower dashboard, doc uploads, Zoho Mail notifications
- [ ] **WebDev** — Phase 2d: MLO dashboard, status transitions, XML export
- [ ] **David** — Change default MLO passwords after first login
- [ ] **David** — Create `portal@netratemortgage.com` email alias in Zoho Mail (for Phase 2c)
- [ ] **David** — Generate Zoho Mail + Zoho Voice grant tokens (for Phase 2b/2c)
- [ ] **David → Mac** — Relay WEBSITE-2026 tracker update (carried forward)

---

## Session: February 25, 2026 - Project Roadmap Planning (Setup)

**Chat focus:** Design a PC project roadmap/tracker — David's equivalent of Mac's TrackerPortal, but for PC-side development projects. Decided to build it into the existing portal app rather than a separate tool.

**What was done:**
- Explored Mac's TrackerPortal architecture (localhost Next.js app reading flat JSON trackers)
- Explored PC portal codebase — discovered it's far more advanced than SESSION-LOG reflected (25+ commits, full application wizard, auth, MLO dashboard, Prisma/Neon, PII encryption all built and deployed)
- Evaluated 3 approaches: standalone tool (Mac style), separate Next.js app, or build into portal
- Chose "build into portal" — reuses existing Neon DB, NextAuth, and Tailwind patterns
- Wrote full plan for `/portal/mlo/roadmap` admin-only page
- Plan includes: 2 new Prisma models (Project + Milestone), 4 API routes, kanban board UI, seed data for 13 current projects
- Wrote WebDev handoff prompt

**Key decisions:**
- Roadmap lives at `/portal/mlo/roadmap` (not a separate `/portal/admin/` route group — follows existing pattern where admin features are role-gated within MLO routes)
- Two new Prisma models: `Project` and `Milestone` — independent of loan tables
- "Ball tracking" is the key UI principle — every project shows whose court it's in (dev / david / blocked / done)
- Kanban-style board grouped by status (Planned / In Progress / Completed) with department filter tabs
- Admin-only access (same auth pattern as existing MLO API guards)
- No new component libraries — raw Tailwind matching existing portal patterns
- 13 current projects seeded reflecting actual state of play

**Files created/modified:**
- `C:\Users\bickl\.claude\plans\iterative-weaving-abelson.md` — Full roadmap plan (replaces old strategy plan which is now complete)

**Open items:**
- [ ] **WebDev** — Build the roadmap feature per the plan (see WebDev prompt in plan file)
- [ ] **David** — Set up Google Maps API key for address autocomplete (carried forward)
- [ ] **David** — Set Twilio API keys in Vercel env vars (carried forward)
- [ ] **David → Mac** — Relay WEBSITE-2026 tracker update (carried forward)
- [ ] **David** — Delete 2 test leads from Zoho CRM (carried forward)

---

## Session: February 26-27, 2026 - Marketing Strategy & Website Trust Signals (Marketing)

**Chat focus:** Full marketing strategy session — lead capture design, trust signals spec, traffic generation plan, daily market content integration, analytics dashboard planning, site review, and dev handoff for Batch 1 website updates.

**Note:** This was a long multi-session conversation (ran out of context once, continued). Marketing is not a formal PC department — this session covered strategy, website review, and dev briefing across all consumer-facing marketing work.

**What was done:**

*Strategy & Planning:*
- Built comprehensive marketing playbook covering brand positioning, trust signals, lead capture, traffic generation (7 channels), analytics, and compliance
- Designed rate tool lead capture flow: "Get This Rate" buttons per row + on recoup cards → modal with pre-filled rate data + Name/Phone/Email → Zoho CRM
- Created interactive HTML mockup of the lead capture flow
- Planned 7-channel traffic generation strategy on ~$1K/mo budget (Google Ads, Bing Ads, GBP, AI/GEO, rate table leads, state landing pages, social/Reddit)
- Planned custom standalone marketing analytics dashboard (Google Ads API + Bing Ads API + Zoho CRM API)
- Planned MBS Live daily market data → agent-automated website content + social posts
- Researched Google Business Profile migration, AI search optimization (GEO), Bing Ads opportunity

*Brand Decisions (David's — documented in playbook):*
- NO personal photos (makes operation look small)
- NO application-to-funding rate (consumers don't have frame of reference)
- NO AI mentions on consumer-facing content (compliance risk, not a selling point)
- Size perception: straddle between call center and solo broker
- NO location-heavy branding (hurts out-of-state conversion)
- GBP rename from Locus → NetRate: DEFERRED (not blocking review display)

*Trust Signals Spec (for WebDev):*
- Trust checkmark bar: ✓ No application or credit pull · ✓ Real wholesale rates, updated daily · ✓ Compare multiple loan options
- Google Reviews: 4.9 stars, 35 reviews, 6 curated quotes, "Formerly Locus Mortgage" note, Place ID `ChIJa5-5jCXza4cRptwJxaP23eU`
- BBB A+ seal: Got actual embed code from David (static image seal, Business ID 90159653)
- NMLS Consumer Access logo + Equal Housing Opportunity icon
- BBB seal in email signatures (static image, Jamie to implement)
- Google Reviews footer banner (site-wide, dark background)

*Site Review (Feb 27):*
- Reviewed live homepage with password access
- Found: Google reviews section already built by dev (6 cards, looks great)
- Found: BBB/NMLS/Equal Housing icons present but BBB is generic, not real seal
- Missing: Trust checkmark bar, footer review banner, "Formerly Locus Mortgage" note, bottom CTA copy update, rate tool lead capture, favicon color mismatch
- Wrote detailed webdev log with punch list for all missing items

*Favicon Redesign:*
- Current favicon uses `#0d9488` (green-teal), site uses `#0891b2` (blue-teal) — mismatch
- Designed 3 options: color fix, logo-match split treatment, bold single "N"
- David chose Option C: Bold white "N" on brand teal `#0891b2`
- Created production SVG file ready for dev to drop in

**Key decisions:**
- GBP rename deferred — reviews display proceeds with "Formerly Locus Mortgage" note
- Lead capture via "Get This Rate" buttons → modal → Zoho CRM (not gating behind forms)
- Custom standalone dashboard over Zoho Analytics
- Google Ads / Bing Ads budget split: 70/30 starting point
- MBS Live market data via OpenClaw agent → daily website content
- Favicon: Bold "N" on teal (Option C)
- Email primary, PDF secondary for quote delivery
- Bottom CTA copy: "Not Sure Which Rate? Let Us Help."

**Files created/modified:**
- `D:\netrate-marketing-playbook.md` — Master marketing strategy document (created, updated multiple times)
- `D:\netrate-dev-brief.md` — Actionable dev brief, Batch 1 + Batch 2 (created, updated)
- `D:\netrate-webdev-log-2026-02-27.md` — Detailed site review + punch list for dev (created)
- `D:\mockup-rate-tool-lead-capture.html` — Interactive HTML mockup of lead capture flow (created)
- `D:\netrate-favicon.svg` — New favicon SVG (created)
- `D:\favicon-options.html` — Favicon comparison mockup (created, reference only)
- `D:\netrate-marketing-playbook.md` — Updated: GBP rename deferred, review data with Place ID, "Formerly Locus Mortgage" treatment, Channel 1 updated, BBB email signature spec
- `D:\netrate-dev-brief.md` — Updated: Concrete review specs (4.9 stars, 35 reviews, exact link URL, exact quotes), BBB actual embed code, fixed duplicate numbering, renumbered Batch 1 (1-6) and Batch 2 (7-12)

**Open items:**
- [ ] **WebDev** — Implement Batch 1 punch list per `D:\netrate-webdev-log-2026-02-27.md` (trust bar, real BBB seal, "formerly" note, footer review banner, bottom CTA copy, rate tool lead capture, UTM capture, favicon swap)
- [ ] **David** — Contact BBB Denver/Boulder to rename Locus → NetRate (when convenient, not blocking)
- [ ] **David** — Hand `D:\netrate-webdev-log-2026-02-27.md` + `D:\netrate-dev-brief.md` to dev
- [ ] **David/Jamie** — Add BBB static seal image to email signatures after BBB rename
- [ ] **David** — Verify MBS Live TOS allows summarized market commentary on website
- [ ] **Setup** — Configure OpenClaw agent to monitor MBS Live for daily market summaries
- [ ] **WebDev** — Batch 2 items after Batch 1 ships (AI crawler access, schema markup, FAQ expansion, state landing pages, Today's Market component)
- [ ] **David** — Launch Google Ads + Bing Ads campaigns after lead capture ships
- [ ] **David → Mac** — Relay: Marketing strategy complete. Playbook, dev brief, and site review ready. Batch 1 trust signals + lead capture spec'd for WebDev.

---

## Session: February 27, 2026 - Rate Pipeline & Site Hardening (WebDev)

**Chat focus:** GitHub token for Claw agent, site password wall, rate API cache fix, lender name stripping, marketing playbook portal page.

**What was done:**
- Created `ubuntu-agent-readonly` fine-grained GitHub token for Claw (Ubuntu agent) — scoped to `bicklehoff/netrate-mortgage-site` only, Contents + Metadata read-only, no expiration
- Activated site-wide password wall — `SITE_PASSWORD` env var in Vercel controls access at `/site-access`, API routes excluded so rate pipeline keeps working
- Fixed rate API caching that caused stale data (38+ min worst case). Reduced: function cache 15→2 min, CDN s-maxage 5→1 min, browser max-age 2→0.5 min, stale-while-revalidate 10→1 min. Worst-case staleness now ~3 min.
- Stripped wholesale lender name from consumer-facing pages and API
- Added admin-only Marketing Playbook page to MLO portal
- Verified rate pipeline end-to-end: Claw parses → uploads to GCS → API serves within ~3 min

**Commits (netrate-mortgage-site):**
- `c64fc1e` — Reduce rate API cache TTLs to prevent stale data
- `787b3c6` — Fix ESLint: use Object.entries filter instead of destructuring
- `4b73966` — Add site-wide password wall for pre-launch compliance
- `13c57f3` — Fix watcher to upload manifest.json after rate data
- `9c907ee` — Fix ESLint unused variable errors in lender name stripping
- `499c778` — Strip wholesale lender name from consumer-facing pages and API
- `192d505` — Add action item checklist to marketing playbook
- `70b70cc` — Add admin-only Marketing Playbook page to MLO portal

**Open items:**
- [ ] **Claw** — `git pull` and copy updated watcher: `cp ~/netrate-mortgage-site/agent/watcher.js ~/rates/watcher.js`
- [ ] **David** — Revoke old expired classic `ghp_` GitHub token
- [ ] **WebDev** — LoanSifter browser automation (Playwright-based skill for autonomous rate downloads)
- [ ] **WebDev** — Rate effective date monitoring — alert if rates are stale beyond 1 business day

---

## Session: March 2, 2026 - Twilio Account Migration (Integrations/WebDev)

**Chat focus:** Migrated all Twilio services from old locusmortgage trial account to cmglending pay-as-you-go account. First successful outbound call from MLO portal dialer.

**What was done:**
- Migrated Twilio from `ACdb8564fc...` (david@locusmortgage.com, trial, no console access) to `ACc65dbcde...` (david@cmglending.com, pay-as-you-go, ~$49 balance)
- Provisioned: API Key `SKc21bc57a...`, TwiML App `AP0916cc46...`, Phone Number (720) 573-1236 / +17205731236 (Denver, CO), Verify Service `VAb786cd9a...`
- Configured all webhook URLs (must use `www.netratemortgage.com`, not bare domain — Vercel redirects bare → www causing Twilio 405 errors):
  - TwiML App Voice/Status → `/api/dialer/voice`, `/api/dialer/status`
  - Phone Voice → `/api/dialer/incoming`
  - Phone SMS → `/api/dialer/sms/incoming`, `/api/dialer/sms/status`
- Updated local `.env` and 7 Vercel production env vars, redeployed
- First successful outbound call — dialer shows "Online", token fetch works, Twilio Device registers, call connected

**Commits:** None (all changes were Twilio API config + Vercel env vars)

**Key decisions:**
- All webhook URLs must use `www.netratemortgage.com` (not bare domain) to avoid 307 redirect → 405 error
- Old locusmortgage phone number (720) 292-2558 will expire (unpaid trial)

**Open items:**
- [ ] **Integrations** — A2P 10DLC SMS registration ($15-50, 10-15 day approval)
- [ ] **Integrations** — SMS testing — send/receive from dialer
- [ ] **David** — Set `NEXT_PUBLIC_APP_URL` env var in Vercel for SMS status callbacks
- [ ] **Integrations** — Inbound call testing — call (720) 573-1236 to test incoming call popup
- [ ] **WebDev** — Dialer UI polish — combine search/dial input, smoother contact flow

---

## Session: March 2, 2026 - Document Structure & EOD Protocol (Setup)

**Chat focus:** Design scalable PC doc structure, add EOD protocol to governance, plan project roadmap tracker for portal.

**What was done:**
- Investigated PC document landscape — found two SESSION-LOGs, 6 loose marketing files at D:\ root, no CLAUDE.md in mortgage-site repo, empty department folders
- Designed two-repo model: `netrate-pc-ops` = operations hub, `netrate-mortgage-site` = code + CLAUDE.md
- Designed EOD Protocol for governance — standardized "eod" command for wrapping up sessions
- Added EOD Protocol to `netrate-governance/GOVERNANCE.md`
- Posted EOD Protocol proposal to `netrate-governance/RELAY.md` for Mac approval
- Wrote comprehensive plan covering: doc structure consolidation, EOD protocol, roadmap tracker feature
- Merged mortgage-site SESSION-LOG entries into pc-ops SESSION-LOG (this entry)
- Educated David on: session scoping, launch directories, CLAUDE.md hierarchy, commit vs push, CLI vs desktop app

**Key decisions:**
- ONE SESSION-LOG for all PC work: `netrate-pc-ops/Work/SESSION-LOG.md`
- CLAUDE.md goes in `netrate-mortgage-site` (project context) but points to pc-ops for logging
- Session launch rules: Dev/Marketing from `netrate-mortgage-site`, Setup from `D:\`
- EOD protocol: "eod" = wrap up this session, "eod all" = wrap up + Setup generates prompts for others
- Roadmap tracker at `/portal/mlo/roadmap` — handed off to Dev

**Files created/modified:**
- `D:\PROJECTS\netrate-governance\GOVERNANCE.md` — Added EOD Protocol section
- `D:\PROJECTS\netrate-governance\RELAY.md` — Added EOD Protocol governance proposal
- `D:\PROJECTS\netrate-pc-ops\Work\SESSION-LOG.md` — Merged mortgage-site entries, added this entry
- `C:\Users\bickl\.claude\plans\iterative-weaving-abelson.md` — Full plan (doc structure + EOD + roadmap)

**Open items:**
- [x] ~~**Setup** — Move 6 loose D:\ marketing files into pc-ops department folders~~ (done — one-repo migration)
- [x] ~~**Setup** — Create department reference docs (Marketing/, Integrations/, WebDev/, Products/)~~ (done — TWILIO.md, ZOHO-CRM.md, plus marketing files moved)
- [x] ~~**Setup** — Update pc-ops CLAUDE.md with session launch rules~~ (done — one-repo migration)
- [x] ~~**David** — Tell Dev to create `netrate-mortgage-site/CLAUDE.md`~~ (done — Setup created it as part of migration)
- [ ] **David** — Confirm what to do with 3 loose files in `D:\PROJECTS\` root (app_full_version.py, test_zoho_token.py, mostadvancedcoderequirements.txt)
- [ ] **Mac** — Approve EOD Protocol governance change (pending via RELAY.md)
- [ ] **WebDev** — Build roadmap feature per plan (see WebDev prompt in plan file)

---

## Session: March 2, 2026 (cont'd) - One-Repo Migration (Setup)

**Chat focus:** Consolidated `netrate-mortgage-site` into `netrate-pc-ops` monorepo, matching Mac's pattern where code lives under `Work/Development/`.

**What was done:**
- Copied entire mortgage-site codebase into `Work/Development/netrate-mortgage-site/` (143 files, excluding .git, node_modules, .next, .env, stale docs)
- Moved 6 loose marketing files from `D:\` root into `Work/Marketing/` (PLAYBOOK.md, DEV-BRIEF.md, WEBDEV-LOG, favicon, mockup, brand options)
- Created CLAUDE.md cascade:
  - `Work/Development/CLAUDE.md` — Dev department rules, session protocol
  - `Work/Development/netrate-mortgage-site/CLAUDE.md` — Project tech stack, patterns, integrations
  - Updated root `CLAUDE.md` — new folder structure, session launch rules, Development/ department
- Created integration reference docs: `Work/Integrations/TWILIO.md`, `Work/Integrations/ZOHO-CRM.md`
- Verified: `npm install` + `npm run build` pass clean in new location (all routes compiled)
- Mac proposed this approach ("match how Mac organizes netrate-ops"), David approved

**Key decisions:**
- **One repo per device** — all PC code and docs live in `netrate-pc-ops`. Matches Mac's `netrate-ops` pattern.
- **CLAUDE.md cascade** — project → department → root. Every Dev session gets full context automatically.
- **Vercel reconfigured** — David will change connected repo and set root directory to `Work/Development/netrate-mortgage-site`
- **Old repo archived** — `bicklehoff/netrate-mortgage-site` on GitHub stays read-only for git history reference
- **Session launch rules** — all code sessions from `Work/Development/netrate-mortgage-site/`, Setup from repo root

**Files created:**
- `Work/Development/CLAUDE.md`
- `Work/Development/netrate-mortgage-site/CLAUDE.md`
- `Work/Development/netrate-mortgage-site/` (entire codebase — 143 tracked files)
- `Work/Integrations/TWILIO.md`
- `Work/Integrations/ZOHO-CRM.md`
- `Work/Marketing/PLAYBOOK.md`, `DEV-BRIEF.md`, `WEBDEV-LOG-2026-02-27.md`
- `Work/Marketing/brand/netrate-favicon.svg`, `favicon-options.html`
- `Work/Marketing/mockups/mockup-rate-tool-lead-capture.html`

**Files modified:**
- `CLAUDE.md` — Updated departments, folder structure, data flow, session launch rules
- `Work/SESSION-LOG.md` — Added this entry, marked prior open items complete

**Open items:**
- [ ] **David** — Reconfigure Vercel: connect `bicklehoff/netrate-pc-ops`, set root dir to `Work/Development/netrate-mortgage-site`, set ignored build step
- [ ] **David** — Archive `bicklehoff/netrate-mortgage-site` on GitHub (Settings → Archive)
- [ ] **David** — Update Claw's GitHub token scope from `netrate-mortgage-site` to `netrate-pc-ops`
- [ ] **David** — Confirm what to do with 3 loose files in `D:\PROJECTS\` root
- [ ] **David → Mac** — Relay: "PC completed one-repo migration. Code now lives in pc-ops/Work/Development/netrate-mortgage-site/. Matches Mac's pattern."
