# Session Log — PC Operations

**Location:** `Work/SESSION-LOG.md`
**Device:** PC (Public Facing)

---

## 2026-03-25 (PM) — Dev — Rate Engine Calibration, LoanSifter Deep Dive, Architecture Decisions
**Actor:** pc-dev | **Time:** ~8:30 AM – 6:30 PM

### What Happened
1. **Parser rewrite completed** — SWMC, EverStream, TLS parsers done (Keystone, AmWest, Windsor done yesterday)
2. **LoanSifter calibration deep-dive (EverStream)** — hand-verified every adjustment layer:
   - Base CSV price: 99.239 (Core FNMA >375K<=400K, 6.124%, 30-day)
   - Core SRP (CO, Fixed 20/25/30yr): +1.830
   - Purchase adj: +0.100
   - Risk-Based (780-799, 70.01-75): +0.050 (already in FinalBasePrice)
   - Loan Amt >300K<=400K: -0.040
   - FNMA 21-30yr specific: -0.220
   - Broker comp (0.899%): -0.899
   - **Result: 100.010 = exact match to LoanSifter**
3. **Defaults centralized** — `src/lib/rates/defaults.js`: 780 FICO, 75% LTV, $400K/$533,334, Purchase, CO
4. **Credit score** — changed from dropdown range to numeric input (500-850)
5. **Rate tool unified to pricing API** — then reverted (product eligibility filtering not ready)
6. **Current state:** rate tool on old engine.js with +1.10 flat market adjustment

### Key Decisions (logged to MCP)
- Rate data to PC database, not flat JSON files
- Static lender adjustments hardcoded; only daily rates parsed dynamically
- Default scenario: 780/75LTV/Purchase per MND assumptions

### What's Broken / Not Ready
- Only EverStream has full adjustment stack mapped — 5 lenders still need scoring
- No product eligibility filtering — Conv/FHA/VA/DSCR all mixed together
- No product taxonomy — each lender names products differently
- No Product Type selector in rate tool UI
- Rate tool using +1.10 flat adjustment (temporary, not accurate per-lender)
- Dual pricing systems (engine.js + pricing.js) — need to unify

### Tomorrow's Priority
1. **Database split** — PC gets own DB
2. **Design rate DB schema** — RateSheet, RatePrice, LenderConfig, RateHistory
3. **Product taxonomy layer** — map lender product names to standard types
4. **Product eligibility filtering** — only show matching products for scenario
5. **Score remaining lenders** against LoanSifter (AmWest, Keystone, Windsor, TLS, SWMC)
6. **Unify rate tool** to pricing API once filtering works

### Files Modified
- `src/lib/rates/defaults.js` — centralized scenario defaults
- `src/lib/rates/engine.js` — +1.10 flat market adjustment
- `src/lib/rates/pricing.js` — static config integration (disabled)
- `src/lib/rates/parsers/everstream.js`, `swmc.js`, `tls.js` — parser rewrites
- `src/components/RateTool/RateResults.js` — reverted to engine.js, removed lender column
- `src/components/RateTool/index.js` — disabled API pricing
- `src/components/RateTool/ScenarioForm.js` — numeric credit score input
- `src/data/rates/lender-llpas/everstream-complete.json` — full static config

### EverStream Rate Sheet Reference (for next session)
- **CSV** (daily rates): `96573_*.csv` — filter to Commit Period 30
- **LLPA XLSX** (adjustments): `96596_*.xlsx` — tabs: Product Loan Amount LLPAs, Elite FNMA LLPA, Elite FHLMC LLPA, Core Conv LLPAs, Core/FNMA SRPs
- **Adjustment layers**: SRP → FICO/LTV → Risk-Based → Loan Amt → FNMA-specific → Purchase → Comp
- **David's LoanSifter files from today** in Downloads folder

---

## 2026-03-25 — Dev — Parser Rewrites, Pricing Engine Overhaul, LoanSifter Calibration

**Focus:** Complete all 6 parser rewrites, centralize default scenario, build static LLPA configs, wire pricing engine to match LoanSifter

**Key accomplishments:**
- Completed parser rewrites for Windsor, SWMC, EverStream, TLS (all 6 lenders now done)
- Parsed fresh rate sheets from GCS (OC ran morning + afternoon drops)
- Centralized DEFAULT_SCENARIO (780 FICO, 75% LTV, $400K, purchase, CO) — one constant, 6+ files updated
- Rate tool: credit score changed from dropdown to number input (500-850), defaults flow from DEFAULT_SCENARIO
- Rate tool: defaults to purchase (was refi), 25% down (was 20%)
- Deep LoanSifter calibration for EverStream Core FNMA — traced every adjustment:
  - SRP (+1.830 for CO, Fixed 20/25/30yr)
  - Risk-Based (+0.050 for 780-799 at 70.01-75%)
  - Loan Amount (-0.040 for >300K<=400K)
  - FNMA-specific (-0.220 for 21-30yr Primary)
  - Purchase adj (+0.100)
  - Total: +1.720 adjustments — matched LoanSifter within $200
- Built complete static LLPA configs for all 5 XLSX lenders (EverStream 2.5MB, Keystone 122KB, SWMC 75KB, AmWest 35KB, Windsor 31KB)
- Wired pricing engine to apply static configs (SRP, risk-based, loan amt, FNMA-specific, purchase adj)
- Fixed double-counting: old lenderLlpaData skipped when static config exists
- Comp cap: $3,595 for both purchase and refi (matches LoanSifter)
- Disabled stale rate-snapshot scheduled task (redundant — parse-rate-sheets already writes rate history)
- Resolved relay: prisma generate for scope field, misdirected Zoho email relays

**Architecture decision:** Static LLPA configs + dynamic rate parsing for all lenders. Rate grids change daily (parsed from CSV/XLSX). LLPAs, SRPs, and adjustment tables stored as static JSON — updated only when lenders send bulletins.

**Commits:** 4311aa5, c5051f8, 6064b2d, 512fd16, 8076d8c, ccbf7ce, 750440a, c21f12d, e4b9798, 8b5a3ab, 3cb27cb, 347ff68, ce545c8, 8de9759, b8c71ea

**Open items for next session:**
- EverStream product tier filtering — engine matches wrong loan amount tier (>400K instead of 375K-400K)
- Verify comp cap + pricing on live Vercel deploy
- Continue LoanSifter calibration for other lenders (Keystone, AmWest, Windsor, SWMC, TLS)
- Wire static configs for non-EverStream lenders (currently only EverStream uses new path)
- Add ARM toggle to rate tool UI
- EverStream static config incomplete: FNMA-specific adj has flat -0.14 instead of term-specific -0.22/-0.14 (hardcoded workaround in place)
- Rate tool "Price Adjustments Applied" UI doesn't show SRP/static adjustments (only FICO/LTV)
- Mac relay: Dev batch (Tickets API, contacts scope, email attachments, signing queue) — awaiting Mac response on ownership
- DSCR Scenario Builder + Income Calculator (Claw relay)
- CRM migration to TrackerPortal (Claw relay)

---

## 2026-03-24 — Dev (Session 2) — AmWest Parser Rewrite

**Focus:** Rewrite AmWest rate sheet parser to extract all adjustment data (following Keystone model)

**Key accomplishments:**
- Rewrote `src/lib/rates/parsers/amwest.js` (227 → 712 lines) to extract ALL adjustment sections from 12-sheet XLSX
- Parses FT_LLPAS + LLPAS sheets: FICO/LTV grids (10 FICO × 9 LTV for purchase/refi, 5 for cashout), additional adjustments (ARM, condo, 2-4 unit, NOO, 2nd home, sub financing, high balance, Baltimore County)
- Parses GOV sheet: 10 FICO tier adjustments, loan amount adj ($0-$100K: +1.0, $100K-$150K: +0.375), state adjusters (TX: -0.125, NJ: -0.25, FL: -0.15), VA IRRRL/USDA streamline purpose adj
- Parses JUMBO sheet: 6-band FICO/LTV grid × 8 LTV bands, occupancy adj (NOO, 2nd home), purpose adj (purchase credit, cashout hit), DTI adj, 12 loan amount adjusters ($900K-$3.5M)
- Conventional loan amount adj: $50K-$75K: +1.5, $75K-$100K: +0.75, $100K-$150K: +0.125
- State adj: TX = -0.125 (both terms)
- Lender fees: $1,295 conv/gov, $795 streamlines, $1,395 jumbo
- Comp caps: $4,595 purchase, $3,595 refi
- Fixed pricing engine LLPA priority: parsed data (normalized `>=800` keys) now preferred over static lender-llpas JSON (`≥800` keys causing silent lookup failures)
- Purpose-specific additional adjustments now flow correctly to pricing engine
- Updated `parse-gcs-rates.mjs` to pass all new fields for AmWest
- Updated `parsed-rates.json` with live data — verified 16 programs, 739 total across all lenders
- Verified: AmWest 760 FICO / 75% LTV / purchase = 0.250 LLPA, 6.250% = -$740 credit

**Decisions:**
- Pricing engine LLPA source priority changed: parsed rate sheet > static JSON > GSE defaults
- AmWest comp caps set to $4,595 purchase / $3,595 refi (matches OC)
- Additional adjustments selected by loan purpose (purchase/refi/cashout) not flat

**Open items (parser rewrite series):**
- Rewrite Windsor parser (Task 2 — 16 sheets, Conv LLPA + Gov LLPA)
- Rewrite SWMC parser (Task 3 — single sheet, 4400+ rows)
- Update EverStream parser (Task 4 — needs loan amt/state/comp)
- Update TLS parser (Task 5 — CSV only, may need separate LLPA source)
- Update parse-gcs-rates.mjs combined writer for remaining lenders (Task 6)
- Homepage rates may shift after remaining parser updates — verify after each

**Open items (from relay — not started):**
- Tickets API broken on Vercel (Mac relay — blocks David)
- Dashboard contacts scope filtering (Mac relay)
- Email attachments broken (Mac relay)
- Signing queue PDF flow (Mac relay)
- Relay scope prisma generate (Mac relay)
- DSCR Scenario Builder + Income Qualification Calculator (Claw relay)
- CRM migration to TrackerPortal (Claw relay)

**Commits:** 42fcb78

---

## 2026-03-24 — Dev (Session 1) — Keystone Parser Rewrite + Rate Watch + Homepage

**Focus:** Keystone parser rewrite, pricing engine overhaul, Rate Watch integration, homepage live rates

**Key accomplishments:**
- Rewrote Keystone parser to extract ALL adjustment sections (LLPAs, loan amount adj, state adj, spec payups, pricing specials, occupancy adj, comp cap, lender fee)
- Updated pricing engine to use lender-specific adjustments instead of GSE defaults
- Verified Keystone 6.250% matches OC exactly ($1,708 credit)
- Created detailed task templates for 5 remaining parsers (PARSER-REWRITE-TASKS.md)
- Updated parse-rate-sheet skill to require full sheet reading + adjustment extraction
- Wired homepage and Rate Watch to use real pricing engine data
- Added MND comparison grid (NetRate vs national average)
- Fixed fees-out display (lender fee excluded from costBeforeFees)
- Added market sentiment from Claw's commentary
- Rate history DB writer — real pricing engine rates daily
- National avg rates API + MND scraper scheduled task

**Decisions:**
- Pricing engine uses lender-specific LLPAs from parsed rate sheets (not GSE defaults)
- Fees-out display matches industry standard
- LTV rounding to 2 decimal places prevents floating-point band boundary errors
- LLPA sign convention: positive = cost in engine, parsers negate if rate sheet uses negative
- Comp caps per-lender from parsed data, not global
- MND used as national average comparison source (daily vs Freddie Mac weekly)

**Commits:** 00c8547, fbea639, d2ccf4c, 5c61c1d, d8eafb1, d7a0860, ac2ced3, d0f8e62, d5fbefa

---

## 2026-03-23 — Dev — Pricing Engine, Parsers, Strike Rate, Second Lien Comparison

**Focus:** Rate sheet pipeline, pricing engine architecture, lead capture, and new calculator

**Key accomplishments:**
- Analyzed 14 rate sheets from 11 wholesale lenders — identified lenders, compared par rates, ranked parseability
- Built parsers for all 5 core lenders: TLS (160 products), Keystone (18), SWMC (24), AmWest (16) + EverStream (already done)
- Rate comparison: TLS wins FHA/DSCR, AmWest ties Conv, EverStream wins Jumbo/VA. Rocket/Plains Commerce dropped (don't win anything)
- Final lender lineup: core 5 + niche 2 (Jet for ITIN/FN, Orion for doctor loans/40yr)
- Built pricing engine API (POST /api/pricing) with:
  - Broker comp: 2% lender-paid, capped at $3,595 refi / $4,595 purchase
  - Per-lender origination fees
  - Price format normalization (100-based ↔ discount)
  - GSE LLPA grids (FICO×LTV × purpose × property type × occupancy)
  - County loan limit classification (conforming/HB/jumbo)
  - Employment type (W-2/self-employed) for Fast Track eligibility
  - Sub financing + CLTV calculation
  - Best execution ranking per category
- Three rate portal pages spec'd: /rates (agency), /rates/non-qm, /rates/heloc — one engine, three views
- Strike Rate / Rate Alert system: DB table, API, signup form with two modes (strike + watch), wired to /rates page, GA4 event
- Second Lien Comparison calculator (/tools/second-lien-comparison): keep HELOC vs cash-out payoff with LLPA impact, sub fee, education section
- Relayed to Claw Marketing for rate portal content (3 pages)
- Relayed to Mac/Claw about missed EOD protocol

**Decisions:**
- One pricing engine serves all pages and calculators — no separate non-QM or HELOC pricer
- Employment type + sub financing are new scenario fields (default W-2, no sub)
- HELOC payment stays as borrower input (too many second lien types to model automatically)
- Sub fee ~$200 added to keep-second option costs
- CLTV used for LLPA lookup when sub financing exists (per GSE guidelines)
- Rate alerts: auto-confirm for now, Resend email integration Phase 2

**Open items:**
- OC needs to pull daily rate sheets for 5 lenders → GCS (David setting up with Claw)
- Build parse→upload script (raw from GCS → parse → write parsed JSON back to GCS)
- Wire Rate Tool UI to call pricing engine API (replace current single-lender logic)
- Strike Rate Phase 2: Resend confirmation email, daily cron check, hit/proximity/market-move notifications
- Extract AmWest Fast Track LLPA grids from FT_LLPAS sheet (lender-specific, not GSE)
- Build parser skill for streamlined rate sheet processing
- David's reminders: comp plan review, lender fees table, state-level average fees for purchases
- HELOC rate sheets (David has better lenders than Rocket for this)
- Niche parsers: Jet (ITIN, FN), Orion (doctor loans, Titan Flex)

**Commits:** 30052bf, e3ee098, 930cde9, ba042b5, 25fea3d, 804ab88, bd7d4e0

---

## 2026-03-20 — Dev — Calculator Batch, Pricing Engine Spec, Rate Sheet Parsers

**Focus:** Calculator UX improvements, pricing engine architecture, county data infrastructure, rate sheet analysis and parsing

**Key accomplishments:**
- Calculator UX batch: Compare button CTA upgrade, DSCR 5-tier explainer system, Reverse Mortgage rename (from HECM Optimizer) with co-borrower toggle + DOB tooltips + auto-CMT fetch, Save/Load removed, Cost of Waiting added to homepage grid
- Fixed 3 dead links: /cost-of-waiting, /refinance-calculator, /reverse-mortgage-calculator
- Built county loan limits module (FHFA 2026 data, 3,235 counties) + county tax rates (CO/CA/TX/OR)
- Analyzed 14 raw rate sheets from 11 wholesale lenders — assessed parseability and program coverage
- Built EverStream parser (first lender): CSV rate parser (403 products) + XLSX LLPA parser (19 sheets)
- Spec'd Pricing Engine (POST /api/pricing/scenario), Refi Scenario Modeler (4-option rebuild), Rate Sheet Pipeline (OC raw → PC parse)
- Designed reprice detection (tier boundary crossing → flag stale rate), shared borrower profile (localStorage), agency vs nonqm rate portal split

**Decisions:**
- Pricing engine is the foundation — all calcs call it
- /rates (agency) and /rates/non-qm (DSCR, bank stmt, etc.) for SEO
- Rate sheet parsing moves from Claw to PC — OC only uploads raw files
- Morning pull 6AM scheduled on OC, intraday reprices via Marketing + Cliq

**Open items:**
- Build parsers for AmWest, Keystone, Rocket Pro TPO, Orion (next priority)
- Wire pricing engine API endpoint
- Purchase calc rebuild (DTI, MI, program eligibility)
- Refi Scenario Modeler rebuild (sliders, graphs, 4 options)
- Cost of Waiting: opportunity cost layer (S&P, CDs, extra principal)
- Extra Payments / 15yr calc (backlog)
- Strike Rate alert system (highest priority from Claw)
- Awaiting Claw response on pipeline architecture + raw AmWest sheet

**Commits:** e980600, 86c43d4, 5a93378

---

## 2026-03-19 — Dev — Booking Page + Zoho API + Compliance Review

**Focus:** Custom booking page, Zoho Bookings API integration, Claw compliance relay

**Key accomplishments:**
- Built /book page with Zoho Bookings API — 4-step flow: date → time slots (live) → contact info → confirmation
- Created zoho-bookings.js API client, /api/bookings/slots and /api/bookings/book routes
- Replaced all book.netratemortgage.com links with internal /book route (4 files)
- Diagnosed Zoho Bookings custom domain SSL issue — missing domain authentication, needs Zoho support
- Replied to Claw compliance review relay: items 4,5,8,9 already done; 1-3 (calculators) scheduled for tomorrow

**Open items for tomorrow:**
- Booking post-confirmation: create Contact record + add Notification model to Prisma for MLO portal
- Build /cost-of-waiting, /refinance-calculator, /reverse-mortgage-calculator (Claw items 1-3)
- Add Jumbo Loans to OR/TX state pages (Claw item 6)
- Add rate disclaimers to educational pages (Claw item 7)
- Tunnel vision: redesign apply flow stepper to vertical sidebar
- Push 32 marketing skills to shared repo for Claw

---

## 2026-03-18 — Dev — Major Infrastructure + Launch Prep + Rate Watch Start

**Focus:** Market Watch Phase A, scheduled tasks, Devoe HECM analysis, launch readiness, FRED API integration

**Key accomplishments:**
- Built Market Watch Phase A: rate_history table, daily snapshot job, /api/rates/history endpoint
- Set up 3 Claude Code scheduled tasks (relay-check, build-deploy-monitor, rate-snapshot)
- Deep Devoe HECM analysis: identified credit duplicate ($819/mo), HomeSafe Intro product comparison ($49K available, $347/mo shortfall), created fact sheet saved to loan folder
- Added 4 CoreBot backlog tickets (MISMO XML import, guideline storage, FA calculator, call prep sheets)
- Fixed critical backlog bug: missing image_url column in ticket_entries (shared DB drift)
- Added sign-out button to floating MLO nav
- Extended MLO session from 60 min to 30 days
- Simplified backlog statuses to Open/Closed
- Completed full pre-launch audit — site declared launch-ready
- Tested all pages via Chrome browser automation (all passing, found Market 404)
- Installed Poppler for PDF rendering
- Built FRED API route (/api/rates/fred), got API key, tested live (30yr nat'l avg 6.11%)
- Installed Chart.js + plugins for Rate Watch chart
- Updated Locus Mortgage → NetRate Mortgage in all loans
- Updated sitemap (added 6 missing pages)
- Labeled placeholder rates with asterisks on homepage

**Compliance review received from Claw — 7 must-fix items:**
1. Rate Tool missing APR column (Reg Z)
2. "Federally Registered Broker" → "State-Licensed Mortgage Broker"
3. Homepage comparison chart uses fabricated data
4. Rate Tool lead forms need SMS consent checkbox
5. Contact form smsConsent not sent to API
6. Privacy policy needs Clarity disclosure
7. Privacy policy claims cookie banner that doesn't exist

**Decisions:**
- Processing engine: build data layer now (path A), standalone service later (path B)
- Chart.js chosen over recharts for Rate Watch (annotations/plugins require it)
- FRED terms require disclaimer on Rate Watch page
- Credit company FNMA XML is primary import source for CoreBot (not LDox)

**Open items:**
- [ ] Rate Watch page build (Steps 3-7 of plan — page shell, 6 components, nav link)
- [ ] 7 compliance fixes before password wall removal
- [ ] Devoe: Call borrowers about SS income ($347/mo needed)
- [ ] Mobile QA before launch
- [ ] Borrower portal notifications
- [ ] Rocket XLSX parser (need sample from David)
- [ ] Rate history backfill Jan-Mar 2026

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
- [x] ~~**David** — Update Claw's GitHub token scope from `netrate-mortgage-site` to `netrate-pc-ops`~~ (done — March 2 WebDev session)
- [ ] **David** — Confirm what to do with 3 loose files in `D:\PROJECTS\` root
- [ ] **David → Mac** — Relay: "PC completed one-repo migration. Code now lives in pc-ops/Work/Development/netrate-mortgage-site/. Matches Mac's pattern."

---

## Session: March 2, 2026 (cont'd) - GCS Cache Fix + Claw Token Update (WebDev)

**Chat focus:** Fixed stale rate data caused by Next.js fetch cache, updated Claw's GitHub token to include `netrate-pc-ops` repo.

**What was done:**

*GCS Cache Fix:*
- Claw reported uploading 3/2/2026 rates but website still showed 2/26/2026 data
- Investigated: Vercel CDN cache was NOT the issue this time (`x-vercel-cache: PRERENDER`, `Age: 0`)
- Root cause: Next.js 14 caches `fetch()` responses by default, even in route handlers. The `fetchGCSFile()` function in `src/lib/gcs.js` was missing `cache: 'no-store'`, so GCS API responses were cached in Next.js's internal data cache
- Fix: Added `cache: 'no-store'` to the fetch call in `fetchGCSFile()`
- Committed as `78cb007`, pushed to main, Vercel deployed
- Verified: API now returns 3/2/2026 rates with `x-vercel-cache: MISS`, `Age: 0`, `source: gcs`
- Also verified locally via dev server — `/api/rates` returns `effectiveDate: 3/2/2026`

*Claw GitHub Token Update:*
- Edited `ubuntu-agent-readonly` fine-grained token on GitHub
- Changed from "All repositories" → "Only select repositories"
- Added `bicklehoff/netrate-pc-ops` (now 2 repos: netrate-mortgage-site + netrate-pc-ops)
- Permissions unchanged: Contents Read-only, Metadata Read-only, no account permissions
- Token value unchanged — Claw's existing `github_pat_11B5B2KQ...` works immediately with the new repo
- Claw needs to re-point remote: `git remote set-url origin https://bicklehoff:<TOKEN>@github.com/bicklehoff/netrate-pc-ops.git`

**Commits (netrate-mortgage-site):**
- `78cb007` — Fix stale GCS data by disabling Next.js fetch cache

**Files modified:**
- `src/lib/gcs.js` — Added `cache: 'no-store'` to `fetchGCSFile()` fetch call

**Key decisions:**
- Two separate caching layers have now been fixed across two sessions: (1) Vercel CDN TTLs reduced on Feb 27 (`c64fc1e`), (2) Next.js internal fetch cache disabled on Mar 2 (`78cb007`). Rate pipeline worst-case staleness is now ~3 min.

**Open items:**
- [ ] **Claw** — Re-point git remote to `netrate-pc-ops` and pull (token already has access)
- [ ] **David** — Reconfigure Vercel: connect `netrate-pc-ops`, set root dir (carried forward)
- [x] ~~**David** — Archive `netrate-mortgage-site` on GitHub~~ (done)

---

## Session: March 2-3, 2026 - Twilio A2P, Legal Name Fix, DNS/Email Recovery (WebDev/Integrations)

**Chat focus:** Assisted David through Twilio A2P 10DLC registration, fixed legal entity name across all compliance pages (CA DFPI flagged DBA issue), recovered email by restoring missing MX records.

**What was done:**

*Twilio A2P 10DLC Registration (assisted David in Twilio Console):*
- Customer Profile: Approved (Primary, Bundle SID `BUdcf0050723a1627790403f09f5aec130`)
- Brand Registration: Registered (Low-Volume Standard, Locus Companies LLC — matches EIN, fine)
- Campaign: Submitted (Low Volume Mixed, SID `CMa9e8fdc352317db81ffa73648e9741a6`, $1.50/mo + $15 vetting)
- Messaging Service: "Low Volume Mixed A2P Messaging Service" — set use case to "Notify my users"
- Sender Pool: Added +17205731236 to correct messaging service
- A2P & Compliance: Campaign connected, status "In progress" — waiting for carrier approval (1-7 business days)
- Provided all campaign copy: description, 5 sample messages, consent language, privacy/terms URLs

*Legal Entity Name Fix (CA DFPI flagged):*
- CA DFPI found "Locus Companies, LLC d/b/a NetRate Mortgage" on the site — WRONG
- LLC name was changed to **NetRate Mortgage LLC** — there is NO DBA
- Removed all 11 instances of "Locus Companies, LLC d/b/a" across 5 files in monorepo
- Committed and pushed: `4f38a45`

*DNS/Email Recovery:*
- David reported not receiving emails at @locusmortgage.com
- Checked GoDaddy DNS — MX records were missing (wiped during redirect setup)
- David added 3 Zoho MX records (mx.zoho.com, mx2, mx3) + SPF TXT record
- Email should be flowing again; recent senders may still be retrying (1-3 day retry window)
- Older bounced emails are unrecoverable

*GBP Rename Checklist (from other dev session):*
- Committed GBP Rename Checklist page (`src/app/portal/mlo/gbp-checklist/page.js`) and link from MLO dashboard
- 26-directory, 6-phase citation seeding checklist for Google Business Profile rename

*Other:*
- Committed Twilio SMS StatusCallback hardcode to production URL (`d5bc493`)
- Updated MEMORY.md: project location → monorepo, entity name → NetRate Mortgage LLC
- Updated twilio.md: full A2P 10DLC status with SIDs and next steps
- Confirmed password wall is working (`SITE_PASSWORD` set in Vercel)

**Commits (netrate-pc-ops):**
- `4f38a45` — Fix legal entity name: NetRate Mortgage LLC (not a DBA)

**Commits (netrate-mortgage-site — old repo, before migration awareness):**
- `d5bc493` — Fix Twilio SMS StatusCallback to use production URL
- `4e305a6` — Add GBP Rename Checklist page and link from MLO dashboard
- `952e4f9` — Fix legal entity name (duplicate — also applied to monorepo)

**Key decisions:**
- Legal entity is **NetRate Mortgage LLC** — no DBA, no "Locus Companies" anywhere on site
- Twilio A2P uses Low Volume Mixed campaign ($1.50/mo) — covers all SMS use cases
- locusmortgage.com MX records restored — email flowing again
- Old `netrate-mortgage-site` repo is archived on GitHub (confirmed)

**Open items:**
- [ ] **Integrations** — Twilio A2P: waiting for carrier approval (1-7 business days). Once approved, register phone number to campaign, then update `sendSms()` to use MessagingServiceSid
- [ ] **Integrations** — Get full Messaging Service SID from Twilio Console (starts with `MG0eb6cca59bd54081d...`)
- [ ] **WebDev** — Rate date issue still open: "claw" says it fetched today's rates but site showed stale date. Need Claw session to update its logs so we can debug the pipeline.
- [ ] **David** — Verify locusmortgage.com email is working (send a test)
- [ ] **David** — Reconfigure Vercel: connect `netrate-pc-ops`, set root dir (carried forward)
- [ ] **WebDev** — Prisma schema has new Phase 1 models (LoanDates, Condition, LoanNote, LoanTask) but migration has NOT been run — do NOT run until reviewed
- [ ] **David** — Ask senders of important emails from past few days to resend (bounced emails are unrecoverable)

---

## Session: March 3, 2026 - GBP Rename Prep Checklist (Marketing)

**Chat focus:** Created a 26-directory, 6-phase citation seeding checklist for the eventual Google Business Profile rename, and added it to the marketing portal.

**What was done:**
- Researched top citation directories for mortgage/financial services businesses — identified the 4 core data aggregators (Data Axle, Neustar Localeze, Foursquare, Factual), 8 major directories, 7 industry-specific directories, and 9 secondary/social platforms
- Created `D:\netrate-gbp-rename-checklist.md` — master reference copy with full 6-phase plan:
  - Phase 0: Pre-work (signage, business registration, NMLS verification)
  - Phase 1: Core data aggregators (Week 1-2) — these feed 100+ downstream directories each
  - Phase 2: Major directories (Week 2-3) — BBB, Bing, Apple, Yelp, Facebook, LinkedIn, YP
  - Phase 3: Industry-specific (Week 3-4) — NMLS, Zillow, LendingTree, Bankrate, NerdWallet, Colorado MBA
  - Phase 4: Secondary & social (Week 4-5) — Manta, Hotfrog, YouTube, Twitter/X, Instagram, Trustpilot
  - Phase 5: GBP rename (Week 5-6) — only after 20+ directories seeded
  - Phase 6: Post-rename cleanup
- Includes: citation tracking table, key rules, NAP reference block, video verification guidance
- Created portal page at `/portal/mlo/gbp-checklist` (admin-only, same pattern as marketing playbook page)
- Added "GBP Rename →" link to MLO dashboard nav (next to "Marketing Playbook →")
- Updated marketing playbook (both D:\ master and portal copy) with cross-reference to the checklist
- All code changes were committed by a prior session (`4e305a6`) — this session authored the content and files

**Key decisions:**
- Strategy is "seed citations before touching GBP" — Google cross-references directories during verification
- Aggregators first (Data Axle + Neustar = highest leverage, feed 170+ downstream directories)
- Name-only change on GBP (never change name + address + phone simultaneously)
- No GBP edits for 2 weeks before the rename attempt
- If video verification triggered, request live video call (higher approval rate than recorded video)

**Files created:**
- `D:\netrate-gbp-rename-checklist.md` — Master copy (not in a repo, D:\ root reference file)
- `Work/Development/netrate-mortgage-site/src/data/gbp-rename-checklist.md` — Portal content (in monorepo)
- `Work/Development/netrate-mortgage-site/src/app/portal/mlo/gbp-checklist/page.js` — Portal page (in monorepo)

**Files modified:**
- `Work/Development/netrate-mortgage-site/src/app/portal/mlo/page.js` — Added GBP Rename nav link
- `Work/Development/netrate-mortgage-site/src/data/marketing-playbook.md` — Added cross-reference to checklist
- `D:\netrate-marketing-playbook.md` — Same cross-reference (master copy)

**Open items:**
- [ ] **David** — Order permanent "NetRate Mortgage" office plaque/sign (for video verification)
- [ ] **David** — When ready to rename: work through Phase 1-4 citation seeding (4-5 weeks), then Phase 5 GBP rename
- [x] **David** — Reconfigure Vercel: connect `netrate-pc-ops`, set root dir — **DONE** (March 5, Setup session)
- [ ] **Integrations** — Twilio A2P carrier approval still pending (carried forward)

---

## Session: March 5, 2026 - One-Repo Migration Completion + CORE Schema Foundation (Setup)

**Chat focus:** Completed one-repo migration housekeeping, removed retired Clerk infrastructure, acknowledged Mac's architecture update, designed and began implementing CORE schema expansion for loan processing, ran EOD protocol v2.

**What was done:**

*Vercel Reconfiguration (completed):*
- Root Directory set to `Work/Development/netrate-mortgage-site` — builds succeeding
- Ignored Build Step configured: `git diff --quiet HEAD^ HEAD -- Work/Development/netrate-mortgage-site/` — prevents rebuilds when non-site files change in monorepo
- Confirmed site live at netratemortgage.com deploying from `netrate-pc-ops`

*One-Repo Migration Housekeeping:*
- Archived `bicklehoff/netrate-mortgage-site` on GitHub (old standalone repo — all code now in `netrate-pc-ops/Work/Development/netrate-mortgage-site/`)
- Deleted 3 loose files from `D:\PROJECTS\`: `app_full_version.py`, `test_zoho_token.py`, `mostadvancedcoderequirements.txt`
- Created `Work/Integrations/CLAW-UBUNTU.md` — reference doc for Claw (Ubuntu rate-fetching agent): current setup, token scope, required post-migration updates, key file paths

*Mac Relay — Clerk Retirement + Architecture Update:*
- Mac sent relay: Clerk protocol retired, SQLite backend for all trackers, EOD protocol updated to 6 steps (new step 2: Check CLAUDE.md), Session protocol updated (step 1: check RELAY.md)
- **Removed all Clerk infrastructure from PC:**
  - Deleted `.claude/agents/clerk.md` (Clerk subagent definition)
  - Deleted `.claude/scripts/validate-tracker-write.sh` (write guard hook)
  - Removed PreToolUse hooks from `.claude/settings.local.json`
  - Updated root `CLAUDE.md`: removed Clerk Protocol section, updated Tracker Architecture to reference SQLite on Mac + TrackerPortal API, updated Cross-Device Data Flow
- Acknowledged Mac's relay in `RELAY.md` (governance repo)
- Confirmed: "All tracker data lives in SQLite on Mac. All departments write trackers via TrackerPortal API. David relays to Mac → Mac updates tracker via API."

*CORE Schema Expansion — Design:*
- David shared `CORE.ds` (Zoho Creator app schema, 37 forms, 500+ fields) — his complete loan processing system
- Analyzed all 37 forms and mapped to Prisma models
- Decided: **Stay on Neon Postgres** (SQLite doesn't work in Vercel serverless — each function gets fresh filesystem)
- Designed 3-phase schema expansion plan (saved to `C:\Users\bickl\.claude\plans\iterative-weaving-abelson.md`):
  - **Phase 1 (Foundation):** LoanDates, Condition, LoanNote, LoanTask + 6 new Loan fields
  - **Phase 2 (Team/Providers):** LoanBorrower, Role, LoanTeamMember, ServiceProvider, LoanProvider
  - **Phase 3 (Advanced):** LoanChecklist (JSONB), ConditionTemplate, BorrowerNeed, ParsedDocument
- Key architectural decisions: Conditions ≠ Documents (a condition *may* link to a doc), JSONB for checklists (not 100 columns), TypeScript constants for picklists (not DB enums)

*CORE Schema Expansion — Phase 1 Implementation (partial):*
- Updated `prisma/schema.prisma`:
  - Added 6 nullable fields to Loan: `loanType`, `lenderName`, `loanNumber`, `loanAmount` (Decimal 12,2), `interestRate` (Decimal 5,4), `loanTerm` (Int)
  - Added 4 new relation fields to Loan: `dates`, `conditions`, `loanNotes`, `tasks`
  - Added `conditions Condition[]` relation to Document model
  - Added 4 new models: `LoanDates` (~30 date fields, 1:1 with Loan), `Condition` (full lifecycle with stage/status/blocking/borrower-facing), `LoanNote` (operational notes, separate from LoanEvent audit trail), `LoanTask` (priority/assignment/due dates)
- Created `src/lib/constants/loan-types.js` — LOAN_TYPES, LOAN_TYPE_LABELS, LOAN_TERMS, LOAN_TERM_LABELS, LOAN_PURPOSES
- Created `src/lib/constants/lenders.js` — 18 wholesale lenders from CORE
- **Migration was NOT run by this session** — DEV-website session later ran migrations

*DEV-website Session Additions (after Setup EOD):*
- DEV-website session pulled forward `LoanBorrower` from Phase 2 and added: `HecmScenario`, `Lender`, `RateSheet`, `RateRow`, `numBorrowers` field on Loan
- Migrations were run: `add_co_borrower_support` (which may have included Phase 1 models)
- Current schema comment: `init → add_dialer_tables → add_loan_processing_foundation → add_co_borrower_support`

*EOD Protocol v2 Execution:*
- Step 1: Stopped new work
- Step 2: Updated project CLAUDE.md with Phase 1 models info + picklist constants
- Step 3: Committed all changes (`3526f65`)
- Step 4: Pushed to remote
- Step 5: SESSION-LOG included in commit
- Step 6: Reported out with full summary + paste-ready EOD prompts for 4 other sessions (DEV-CLAW, DEV-website, Files, MARKETING)

**Commits (netrate-pc-ops):**
- `ecfdd10` — Add Claw (Ubuntu agent) reference doc
- `192254e` — Update CLAW-UBUNTU.md — token scope update complete
- `3fe708e` — Remove retired Clerk infrastructure, update to TrackerPortal API
- `3526f65` — Add Phase 1 CORE schema foundation + cleanup stale Clerk refs

**Commits (netrate-governance):**
- `9d9585b` — PC → Mac: One-repo migration complete, EOD protocol active
- `64cad07` — PC → Mac: Acknowledge architecture update, Clerk refs removed

**Key decisions:**
- **Stay on Neon Postgres** — SQLite can't write in Vercel serverless; Neon is the right backend for multi-user deployed app
- **Conditions ≠ Documents** — A condition is a processing requirement that *may* link to a Document. "Appraisal must meet value" has no file; "Provide bank statement" links to a Document.
- **JSONB for checklists** — Different loan types need different sections (VA has COE/DD214, FHA has case number). Items change often. JSONB avoids a migration every time.
- **TypeScript constants for picklists** — Adding a lender or provider type shouldn't require a DB migration. Constants live in `src/lib/constants/`
- **Clerk protocol fully retired on PC** — All tracker writes now go through Mac's TrackerPortal API. No more JSON trackers, no more Clerk subagent.
- **EOD Protocol v2 adopted** — 6 steps (Stop → Check CLAUDE.md → Commit → Push → SESSION-LOG → Report)
- **Session Protocol updated** — Step 1 is now "Pull governance and check RELAY.md first"

**Files created:**
- `Work/Integrations/CLAW-UBUNTU.md` — Claw (Ubuntu agent) reference doc
- `Work/Development/netrate-mortgage-site/src/lib/constants/loan-types.js` — Loan type/term/purpose constants
- `Work/Development/netrate-mortgage-site/src/lib/constants/lenders.js` — 18 wholesale lender names
- `C:\Users\bickl\.claude\plans\iterative-weaving-abelson.md` — Full 3-phase CORE schema expansion plan

**Files modified:**
- `CLAUDE.md` (root) — Removed Clerk Protocol, updated Tracker Architecture to SQLite/TrackerPortal API, updated Cross-Device Data Flow, added EOD Protocol
- `Work/Development/netrate-mortgage-site/CLAUDE.md` — Added Phase 1 models + Picklist Constants sections
- `Work/Development/netrate-mortgage-site/prisma/schema.prisma` — 4 new models + 6 new Loan fields + Document relation
- `.claude/settings.local.json` — Removed PreToolUse hooks (Clerk write guard)

**Files deleted:**
- `.claude/agents/clerk.md` — Retired Clerk subagent
- `.claude/scripts/validate-tracker-write.sh` — Retired write guard hook

**Open items:**
- [ ] **WebDev** — Verify Phase 1 migration ran correctly (DEV-website session may have included it in `add_co_borrower_support`). Run `npx prisma migrate status` to confirm.
- [ ] **WebDev** — Remaining Phase 1 constants files not yet created: `condition-types.js`, `property-types.js` (Phase 2/3 deferred: `provider-types.js`)
- [ ] **WebDev** — Wire Phase 1 models into portal UI: conditions panel, dates card, notes tab, tasks tab on LoanDetailView
- [ ] **WebDev** — Phase 2 & 3 schema models designed but not yet written (see plan file). Note: LoanBorrower was pulled forward by DEV-website.
- [ ] **Marketing** — Marketing inbox still not built
- [ ] **Integrations** — Twilio A2P carrier approval still pending (carried forward)
- [ ] **Setup** — Governance v2.0 upgrade committed (`f7feac1`) — MCP knowledge layer + three-device architecture. New sessions should read updated root CLAUDE.md.

---

## Session: March 5, 2026 - Homepage Redesign Iteration — Hero, Ticker, Chart (Marketing / WebDev)

**Chat focus:** Continued iterative homepage redesign with David — focused on above-the-fold elements: trust strip, rate card philosophy, CTA copy, animated market ticker, and rate comparison chart. Spanned two context windows.

**What was done:**
- Updated TrustBar.js to dark theme (bg-gray-800) with 4 quantitative proof points: 11 Wholesale Lenders, 13 Years, $26.6M Funded, 87.7% App-to-Fund Rate
- Compacted hero trust strip badges to pill-style (Google 4.9★, BBB A+, NMLS) with links, fixed NMLS wrapping issue
- Replaced single big rate teaser with mini 4-row rate table (Product, Rate, APR) — transparency over teasing
- Added green checkmarks: "No application / No credit pull / Just rates"
- Iterated CTA copy through multiple rounds → landed on "Compare Your Options →"
- Added market ticker strip (bg-gray-950) with 10-Yr Treasury, UMBS 5.0, Nat'l Avg, NetRate 30-Yr, S&P 500
- Made ticker animate with CSS marquee scroll (30s loop, pauses on hover)
- Built dual-line SVG rate comparison chart (National Avg vs NetRate, 6-month trend) in dark-themed glassmorphic card, placed inside hero section (above the fold)
- Updated nav in layout.js: Rates, Tools (/#tools), Market (/#market), About
- Built full below-fold sections: rates table, rate trends + market updates, tools grid, featured reviews layout, credentials dark band, bottom CTA
- Created product marketing context framework (.agents/product-marketing-context.md)

**Key decisions:**
- **Transparency over teasing** — Don't show a single big rate number (anyone can do that). Show a mini rate table with Rate + APR, and tease the full math (points, credits, payment) behind the CTA
- **APR always accompanies rates** — compliance requirement, never show rate without APR
- **"Compare Your Options" CTA** — not "math" (intimidating), not "pay" (wrong framing), not "full breakdown" (vague) — "compare" is the right verb for what the rate tool does
- **Green checkmarks for differentiation** — "No application / No credit pull / Just rates" as proactive framing instead of negative ("No app required")
- **Market ticker with animation** — financial hub feel with real market data points, scrolls continuously, hover to pause
- **Chart placement above the fold** — inside hero section as a glassmorphic card, not alongside the rates table (that was "wonky")
- **National Avg vs NetRate framing** — dashed gray line for national average, solid teal for NetRate, shaded gap = savings. Green badge: "0.50% below the national average"

**Files modified:**
- `src/app/page.js` — Full homepage rewrite (hero, ticker, chart, rates table, trends, tools, reviews, credentials, CTA)
- `src/app/layout.js` — Nav link updates (Rates, Tools, Market, About)
- `src/app/globals.css` — Added ticker-scroll keyframes animation
- `src/components/TrustBar.js` — Dark theme with quantitative stats
- `.agents/product-marketing-context.md` — Created (brand voice, personas, positioning)

**Open items:**
- [ ] **WebDev** — Live rate data wiring (replace placeholder data in ticker, chart, rate tables with API/CMS data)
- [ ] **Marketing** — Duplicate CTA issue: hero "Check Today's Rates" and rate card "Compare Your Options" both go to /rates — consider differentiating destinations
- [ ] **Marketing** — David brainstormed MBS/Treasury chart ideas, inverted MBS chart, national rate tracker — capture for future market data section
- [ ] **Marketing** — Brand guide capture to MCP context layer still pending (from Mac)
- [x] ~~**WebDev** — Live rate data wiring~~ (done in WebDev Mar 5, commit b115091)
- [ ] **WebDev** — Mobile responsiveness pass needed (chart, ticker, hero grid stacking)
- [ ] **Marketing** — Marketing inbox still not built (carried forward)
- [ ] **Integrations** — Twilio A2P carrier approval still pending (carried forward)

---

## Session: March 5, 2026 - Live Rates Wired + Dev Launch Plan (WebDev / PC-Dev)

**Chat focus:** Wired live GCS rate data into homepage, then built comprehensive dev launch plan mapping Marketing's playbook to dev milestones. Captured all infrastructure config to MCP knowledge layer.

**What was done:**

### Live Rate Wiring (committed + pushed as `b115091`)
- Created `src/lib/rates/homepage.js` — server-side rate computation utility
  - Wraps pricing engine (`priceRates` + `calculatePI` from `engine.js`)
  - Reference scenario: 760+ FICO, $400K loan, 75% LTV, rate/term refi
  - Finds par rate (adjPrice closest to 0), computes APR via binary search
  - Exports: `computeHomepageRates(lenderData)`, `formatEffectiveDate()`, `formatEffectiveDateShort()`
- Converted `src/app/page.js` to async server component with ISR (`revalidate = 300`)
  - Fetches live data from GCS (live/manifest.json → live/amwest.json) with static fallback
  - Wired live data into: ticker, hero card, rates table, comparison chart, sparkline
  - Ticker format: "NetRate Mortgage 30-Yr X.XXX% APR X.XX%"
  - All 4 consumer-facing rate quotes use full "NetRate Mortgage" name + APR
  - Other products (15yr, FHA, VA, Jumbo, DSCR) remain as placeholders until pipeline supports them
  - Change column renders "—" when no historical data available

### Trademark/Compliance Decision (logged to MCP)
- Anywhere we quote a NetRate rate: must say "NetRate Mortgage" (full name) + always include APR
- APR compliance gap identified: current calc uses lender fees + points only, missing third-party fees (title, settlement, appraisal) per Reg Z §1026.24
- NetRate comp is lender-paid (baked into rate) — no originator fee gap
- RELAY sent to Mac compliance with 3 questions: (1) which fees for advertising APR, (2) disclaimer sufficiency, (3) dollar estimates for missing fees
- Fix when compliance responds: one number addition in `homepage.js` → `calculateAPR()`

### Dev Launch Plan (saved to `.claude/plans/silly-stirring-swan.md`)
- Reviewed Marketing PLAYBOOK.md (Batch 1-3) and DEV-BRIEF.md (Batch 1-2)
- Reviewed PORTAL-ARCHITECTURE-PLAN.md (borrower portal, MLO processing, auth, state machine)
- Reviewed full Prisma schema (23 models) and existing codebase inventory
- Built 6-milestone plan with 2 parallel tracks:
  - **Track A:** Public site + lead capture (Marketing Batch 1 items)
  - **Track B:** Borrower portal + MLO processing dashboard
  - **Shared foundation:** DB migration for pending schema models
  - **Go public** when both tracks ready
  - **Post-launch:** Marketing Batch 2 (AI discoverability, state pages, market data)

### Infrastructure Audit (all captured to MCP knowledge layer)
- **Configured:** DATABASE_URL, DIRECT_URL, PII_ENCRYPTION_KEY, NEXTAUTH_SECRET, GCS (bucket + service account), Twilio (full stack: account, verify, voice, SMS, phone +17205731236), Google Maps API, GA4, SITE_PASSWORD
- **Partially configured:** Zoho CRM (reportedly in Vercel but NOT in local .env — needs verification)
- **Not configured:** ZOHO_MAIL_REFRESH_TOKEN (empty), ZOHO_VOICE_REFRESH_TOKEN (empty), ZOHO_VOICE_SENDER_NUMBER (empty)
- **Note:** Twilio Verify is fully configured as alternative to Zoho Voice for borrower OTP

### Governance Decision (logged to MCP)
- All infrastructure config must be captured in MCP knowledge layer without exception

**Key decisions:**
- **Show both par + full spectrum** — par rate highlighted in hero card, full rate spectrum in rates table
- **"NetRate Mortgage" trademark rule** — full name + APR on every consumer-facing rate quote
- **Parallel build tracks** — lead capture + portal simultaneously, go public when both ready
- **No JSONB for new business values** — proper typed columns; existing JSONB fine as-is
- **Everything deterministic** — defined state machine, typed columns, predictable outcomes

**Files created/modified:**
- `src/lib/rates/homepage.js` (NEW) — rate computation utility
- `src/app/page.js` (MODIFIED) — async server component with live GCS data
- `.claude/plans/silly-stirring-swan.md` (NEW) — full dev launch plan

**Schema models NOT yet migrated (pending for Milestone 1):**
- LoanDates, Condition, LoanNote, LoanTask, LoanBorrower
- Lender, RateSheet, RateRow
- New Loan fields: loanType, lenderName, loanNumber, loanAmount, interestRate, loanTerm, numBorrowers

**What exists but needs end-to-end wiring (next session READ THESE):**
- Portal routes: `/portal/apply/*` (6-step wizard), `/portal/dashboard/*`, `/portal/mlo/*`
- Portal components: FormFields, StepIndicator, DocumentList, LoanDetailView, LoanTimeline, PipelineTable, LoanStatusCard, BorrowerTabs, CoBorrowerPrompt, ApplicationContext
- Auth: middleware.js (password wall + MLO NextAuth + borrower JWT), auth.js, borrower-session.js
- API routes: /api/portal/apply, /api/portal/loans/*, /api/portal/mlo/*, /api/portal/sms/*, /api/portal/auth/*
- Libraries: encryption.js, loan-states.js, zoho-voice.js, utm.js, validations/application.js
- RateTool: LeadCapture.js, RateQuoteModal.js, RateResults.js, ScenarioForm.js
- Dialer: Full Twilio integration (contacts, calls, SMS, voicemail, recording)
- HECM Optimizer: Full calculator with save/load and print view

**Open items:**
- [ ] **WebDev** — Run Milestone 1: `prisma migrate dev` for pending schema models
- [ ] **WebDev** — Seed MLO accounts: David (admin) + Jamie (MLO)
- [ ] **David** — Verify Zoho CRM env vars in Vercel dashboard
- [ ] **David** — Set up ZOHO_MAIL_REFRESH_TOKEN + portal@netratemortgage.com alias
- [ ] **David** — Set up ZOHO_VOICE vars (or confirm using Twilio Verify instead)
- [ ] **Compliance (Mac)** — APR fee review (RELAY sent, awaiting response)
- [ ] **WebDev** — Wire lead capture: "Get This Rate" → RateQuoteModal → /api/lead → Zoho CRM
- [ ] **WebDev** — Trust signals: checkmark bar, Google reviews section, BBB seal
- [ ] **WebDev** — Application wizard: harden 6-step form, validation, save/resume
- [ ] **WebDev** — MLO processing: pipeline view, status transitions, conditions
- [ ] **Marketing** — Mobile responsiveness pass (carried forward)
- [ ] **Integrations** — Twilio A2P carrier approval (carried forward)

**Critical files for next session to read:**
1. `.claude/plans/silly-stirring-swan.md` — full dev launch plan (6 milestones, all tasks, file refs)
2. `prisma/schema.prisma` — complete database schema (23 models)
3. `Work/WebDev/PORTAL-ARCHITECTURE-PLAN.md` — portal architecture, state machine, auth, routes
4. `Work/Marketing/DEV-BRIEF.md` — Marketing's dev tasks (Batch 1-3)
5. `Work/Marketing/PLAYBOOK.md` — full marketing playbook
6. `src/middleware.js` — auth + password wall logic
7. `src/lib/loan-states.js` — loan state machine transitions

---

## 2026-03-07 — Setup — PC Setup & Relay Handling

**Department:** Setup
**Actor:** pc-dev

**What was done:**
1. Checked relay — resolved 2 open messages from Mac:
   - Test message (info) — acknowledged and resolved
   - Governance pull action — pulled governance (commit 647a22b), verified PC CLAUDE.md has department table with folder ownership. Resolved.
2. Fixed excessive file permission prompts on PC:
   - **Root cause:** Department table in CLAUDE.md had vague folder definitions ("code in Development/") for Products, Integrations, Marketing. Combined with governance "refuse by default" rule, Claude couldn't determine ownership and asked David on every write.
   - **Fix 1:** Updated root CLAUDE.md department table — split into Docs Folder + Code Access columns, explicitly grants all code departments shared write access to `netrate-mortgage-site/`
   - **Fix 2:** Updated `Work/Development/CLAUDE.md` — added explicit note that all code files pass the refuse-by-default check; ownership boundaries only apply to docs folders
   - **Fix 3:** Deleted junk nested `.claude/.claude/settings.local.json`
3. Added SESSION-LOG.md reading to session start protocol (step 2 in root CLAUDE.md). Sent relay to Mac proposing governance-level addition.
4. Claw setup assist — provided SSH key setup instructions for GitHub on Lenovo Legion (Ubuntu). Claw cloning governance. Role: legal/biz planning (not taking over PC role). Dave is retired. MCP updates deferred.

**Files modified:**
- `CLAUDE.md` (root) — updated department table, ownership rules, session start protocol
- `Work/Development/CLAUDE.md` — added shared code access note for refuse-by-default rule
- Deleted `.claude/.claude/settings.local.json` (junk nested file)

**Key decisions:**
- All code departments share write access to `netrate-mortgage-site/` — ownership rules only gate docs folders
- SESSION-LOG.md reading added as mandatory session start step (proposed to governance via relay)
- Claw device architecture updates deferred until role solidifies

**Open items:**
- [ ] **Mac** — Review governance proposal: add SESSION-LOG.md reading to session start protocol (relay sent)
- [ ] **David** — Confirm Claw finishes cloning governance and gets SSH working
- [ ] **Setup** — Update device architecture in CLAUDE.md and MCP once Claw's role is defined

---

## 2026-03-09 — Setup — Core Architecture & Corebot Spec

**Department:** Setup
**Actor:** pc-setup

**What was done:**
1. Architecture decision with David: Core (PC) is the system of record for loans, CRM, borrower portal, origination. LDox stays as Jamie's workspace and compliance LOS. Corebot syncs LDox → Core. On fund/ship, Core pushes finance data one-way to Tracker (Mac). Decision logged in MCP: cmmjbv8w50001krp481fg99n3.
2. Received and analyzed real LDox JSON payload — mapped all fields to Core's Prisma schema. Identified what exists, what needs adding, what needs manual entry.
3. Received revised Tracker ingest spec from Mac (MCR FV7 compliant) — 39 fields total. Mapped field sources: ~18 from LDox auto, ~4 derivable, ~14 manual entry, ~3 system.
4. Wrote full Corebot integration brief: `Work/Integrations/COREBOT-INGEST-BRIEF.md`
5. Updated actor vocabulary: added `pc-setup`, replaced `dave` with `claw`. Relayed to Mac.
6. Flagged PII security review to Claw (legal) and Mac (compliance).

**Files modified:**
- `CLAUDE.md` (root) — actor vocabulary updated
- `Work/Integrations/COREBOT-INGEST-BRIEF.md` — **FULL COREBOT SPEC** (created + revised)
- `Work/Development/CLAUDE.md` — shared code access note (earlier in session)

**Key decisions:**
- Core is the system of record (MCP decision cmmjbv8w50001krp481fg99n3)
- LDox stays for compliance / Jamie — Core outgrows it by end of 2026
- One-way push: Core → Tracker (Mac) on status changes
- Actor vocab: pc-setup added, dave → claw

## 2026-03-10 — PC Dev Session (continued)
**Department:** Dev
**Focus:** Pipeline inline editing, archive, CD payroll bugfix

### What was done
- **Pipeline inline editing** — Zoho CRM-style click-to-edit for Status, LO, Lender, Loan # columns. Bulk selection with checkboxes + floating action bar for batch status changes and LO assignment. All edits create audit trail events.
- **Archive (soft delete)** — Added `archived` as terminal status. Bulk archive via action bar. Archived loans hidden from Active view, visible under Archived tab, recoverable via inline edit.
- **ballInCourt null fix** — `ballInCourt` is a required String but `getBallInCourt()` returns null for terminal statuses (funded/denied/archived). Added `|| 'none'` fallback in both pipeline and loan PATCH routes.
- **Bulk update error handling** — Added try/catch with alert to BulkActionBar so API errors surface to user.
- **David tested** — Archive, LO assignment, and CD upload all confirmed working.

### Files modified
- `src/app/portal/mlo/page.js` — BulkActionBar, MLO list fetch, selection state, archive tab
- `src/components/Portal/PipelineTable.js` — EditableText, EditableSelect, checkboxes, archived status
- `src/app/api/portal/mlo/pipeline/route.js` — PATCH bulk endpoint, ballInCourt fix
- `src/app/api/portal/mlo/loans/[id]/route.js` — lenderName/loanNumber inline support, ballInCourt fix
- `src/lib/loan-states.js` — Added archived status to state machine

### Commits pushed
- `e655599` — Add inline editing + bulk updates to Pipeline view
- `7605297` — Add soft-delete archive status for pipeline loans
- `731e78f` — Add error alert to bulk update action bar
- `0a61779` — Fix ballInCourt null crash for terminal statuses

### Open items
- [ ] **Mac** — Build payroll ingestion: query `payrollSentAt IS NOT NULL`, pull CD from WorkDrive, OCR, feed to payroll tracker
- [ ] **preview_start** — Doesn't work on PC (Windows spawn EINVAL + port 3000 conflict with Mac tracker). Pushing to Vercel for verification as workaround.

---

## ⚠️ NEXT DEV SESSION — READ THIS FIRST

**Corebot integration is ready to build.** Full spec at:
📄 **`Work/Integrations/COREBOT-INGEST-BRIEF.md`**

This brief contains:
- Part 1: Corebot Ingest endpoint (LDox → Core) — field mapping, merge logic
- Part 2: Tracker Push endpoint (Core → Mac) — full MCR FV7 payload spec
- Part 3: Schema migration — all new Prisma fields (copy-paste ready)
- Part 4: Security requirements
- Part 5: Build order (12 steps)
- Open questions for David (8 items — need answers during build)

**Build order starts with:** Schema migration → Ingest endpoint → Field mapping → Merge logic

**Open items:**
- [ ] **Integrations (Dev)** — Build Corebot ingest endpoint per brief
- [ ] **Integrations (Dev)** — Build Tracker push function per brief
- [ ] **Integrations (Dev)** — Schema migration: add ~30 new fields to Loan, LoanDates, Mlo
- [ ] **David** — Answer 8 open questions in brief (LDox statuses, Jamie's officer ID, webhook URL, etc.)
- [ ] **Claw (Legal)** — PII security review of Core's encryption model
- [ ] **Mac (Compliance)** — Compliance review of PII handling (relay sent)
- [ ] **Mac** — Build their side: `POST /api/loans/ingest` on Tracker
- [ ] **Mac** — Update actor vocabulary (relay sent)

---

## 2026-03-10 — Portal Redesign Waves + Pipeline Fix (Dev)
**Department:** Dev
**Focus:** Wave-based portal redesign deployment, debug and fix pipeline crash

### What was done
- **Wave strategy** — Broke massive portal update into deployable waves instead of one big push
- **Wave 1 (schema + API)** — Added MCR/HMDA fields (actionTaken, actionTakenDate, applicationMethod, lienStatus) and CRM fields (referralSource, leadSource, applicationChannel) to Loan model. Expanded loan detail API with 30+ editable fields, type coercion, MCR-aware auto-date capture. New `/api/portal/mlo/loans/[id]/dates` route. New `src/lib/constants/mcr-fields.js` constants.
- **Wave 2 (Core UI)** — Deployed full sidebar-based loan detail redesign: LoanDetailShell orchestrator, LoanSidebar (desktop + mobile), StatusHeader, EditableField (click-to-edit with type support), SectionCard, and all 6 sections (Overview, LoanInfo, Borrower, Processing, Documents, NotesActivity). Backed up old view as LoanDetailViewLegacy.js.
- **Pipeline crash fix** — After waves deployed, pipeline showed "Failed to load". Root cause: 5 columns in Prisma schema (work_drive_folder_id, work_drive_subfolders, cd_work_drive_file_id, cd_file_name, payroll_sent_at) had no migration — were added via `db push` but never migrated. Prisma client tried to SELECT non-existent columns. Created migration `20260310000001_add_workdrive_payroll_columns` to fix.
- **Build script fix** — Added `prisma migrate deploy` to build script: `prisma generate && (prisma migrate deploy || true) && next build`. Non-blocking with `|| true` since Vercel may not have direct DB access during build.
- **Dev playbook** — Wrote `Work/Development/DEV-PLAYBOOK.md` with rules for Prisma migrations, deployment verification, and wave deploys.
- **Skills + pending files** — Committed marketing skills, Corebot integration brief, homepage mockup, FAR form.

### Key decisions
- Wave deploys for big features (schema first, then UI)
- Never use `prisma db push` — migrations only (captured as MCP rule)
- Always use `IF NOT EXISTS` in manual migration SQL
- Build script must include `prisma migrate deploy`
- Check Vercel runtime Logs (not just deploy status) after schema changes

### Commits pushed
- `8e96982` — Wave 1: Add MCR/CRM schema fields, expand loan API, add dates route
- `ecdfe2e` — Wave 2: Core UI redesign — sidebar-based loan detail with all sections
- `cd747a1` — Add prisma migrate deploy to build script
- `5378488` — Fix build: make prisma migrate deploy non-blocking
- `9b1ff74` — Fix pipeline crash: add missing WorkDrive/Payroll columns
- `f9fc2e8` — Add dev playbook, skills, and pending work files

### Files created/modified
- `prisma/schema.prisma` — MCR/CRM fields added to Loan model
- `prisma/migrations/20260310000000_add_mcr_crm_fields/` — Migration for MCR/CRM columns
- `prisma/migrations/20260310000001_add_workdrive_payroll_columns/` — Migration for missing columns
- `src/app/api/portal/mlo/loans/[id]/route.js` — Expanded GET/PATCH with full field support
- `src/app/api/portal/mlo/loans/[id]/dates/route.js` — New dates API
- `src/lib/constants/mcr-fields.js` — MCR/HMDA/CRM field constants
- `src/app/portal/mlo/loans/[id]/page.js` — Switched to LoanDetailShell
- `src/components/Portal/Core/` — 12 new files (shell, sidebar, sections, widgets)
- `src/components/Portal/LoanDetailViewLegacy.js` — Backup of old view
- `package.json` — Build script updated
- `Work/Development/DEV-PLAYBOOK.md` — New dev playbook

### Open items
- [ ] **Dev** — Test new Core UI loan detail page end-to-end in production
- [ ] **Dev** — Verify all 6 Core sections render correctly with real loan data
- [x] ~~**Integrations** — Build Corebot ingest endpoint per brief~~ (done Mar 11)
- [ ] **Mac** — Build payroll ingestion + tracker push endpoints

---

## Session: March 11, 2026 — Corebot Integration Live + Zoho Flow Config (Integrations/pc-dev)

**Chat focus:** Built and deployed the Corebot ingest endpoint, configured Zoho Flow as a proxy to forward LDox webhook data to Core, fixed runtime errors, renamed "Draft" status to "Prospect".

### What was done
- Built `POST /api/corebot/ingest` endpoint — receives loan data from Zoho Flow, upserts into Core DB
- Created migration `20260310000002_add_ldox_integration_fields` — added ldoxLoanId, creditScore to Loan; ldoxOfficerId, nmls to Mlo
- Set MLO ldoxOfficerIds in production: David=641790, Jamie=180707
- Generated and deployed COREBOT_API_KEY to Vercel env vars
- Configured Zoho Flow: added Send Webhook step to existing LDox flow (original flow, not clone — LDox webhook URL is bound to original)
- Fixed runtime errors: ldoxOfficerId string→int parse, all numeric fields string→number parse (loanAmount, interestRate, loanTerm, purchasePrice, estimatedValue, numUnits, creditScore)
- Successfully ingested first loan (Pritchett, loan #0170485932) from LDox → Zoho Flow → Core
- Renamed "Draft" display label to "Prospect" across all UI components (8 files) to match LDox terminology
- Updated Jamie Cunningham's last name in production DB (was "NetRate")

### Key decisions
- Zoho Flow as proxy — LDox untouched, existing Flow forwards to Core as additional step
- Clone approach abandoned — LDox webhook URL is bound to original Flow, can't reuse across flows
- Display label "Prospect" instead of "Draft" — internal key stays `draft`, just UI rename
- LDox sends all values as strings — endpoint parses to correct types (parseInt/parseFloat)
- Architecture: LDox → Zoho Flow webhook → Send Webhook step → POST /api/corebot/ingest → Core DB

### Commits pushed
- `071c893` — Add Corebot ingest endpoint for Zoho Flow → Core pipeline
- `7e1e21b` — Redeploy: pick up COREBOT_API_KEY env var
- `da21e97` — Fix: parse ldoxOfficerId as int for Prisma query
- `c5b9ea0` — Fix: parse all numeric fields from LDox string values
- `fec87a5` — Rename 'Draft' status label to 'Prospect' across UI
- `2890ddb` — Fix launch.json: npm.cmd → npm for preview compatibility

### Files created/modified
- `src/app/api/corebot/ingest/route.js` — NEW: Corebot ingest endpoint (~280 lines)
- `prisma/schema.prisma` — Added ldoxLoanId, creditScore to Loan; ldoxOfficerId, nmls to Mlo
- `prisma/migrations/20260310000002_add_ldox_integration_fields/migration.sql` — New migration
- `src/lib/loan-states.js` — Draft → Prospect label
- `src/app/portal/mlo/page.js` — Draft → Prospect label
- `src/components/Portal/Core/StatusHeader.js` — Draft → Prospect label
- `src/components/Portal/LoanDetailView.js` — Draft → Prospect label
- `src/components/Portal/LoanDetailViewLegacy.js` — Draft → Prospect label
- `src/components/Portal/Core/sections/NotesActivitySection.js` — Draft → Prospect label
- `src/components/Portal/PipelineTable.js` — Draft → Prospect label
- `src/components/Portal/XmlImportModal.js` — Draft → Prospect label
- `.claude/launch.json` — Fixed npm.cmd → npm

### Open items
- [ ] **Integrations** — Monitor next few LDox webhook fires to confirm stability
- [ ] **Integrations** — Handle edge cases: missing borrower email, duplicate loan numbers
- [ ] **Mac** — Build payroll ingestion + tracker push endpoints
- [ ] **Dev** — Test Core UI loan detail page with real LDox-ingested loan data

---

## Session: March 11, 2026 — Reverse Mortgage Marketing Strategy + HECM Explorer Brief (Marketing)

**Chat focus:** Researched Bruce Simmons (ALM Denver) marketing model, analyzed reverse mortgage SEO landscape, identified content gaps, designed borrower-facing HECM Explorer tool, delivered dev brief.

### What was done
- **Competitive analysis:** Deep-dive on Bruce Simmons (NMLS #409914, ALM Denver) — his radio strategy, SEO approach, CE referral pipeline, "first CRMP in Colorado" positioning. Analyzed via web research, not for personal info — purely marketing/business model.
- **SEO gap analysis:** Researched reverse mortgage keyword landscape for Colorado. Key finding: nobody publishes cost-transparent content with real math. The "lower fees = more money" angle is completely unoccupied in search.
- **Content strategy:** Identified 5 blog post topics for capturing reverse mortgage search traffic (cost breakdown, fees impact, vs HELOC, scam debunking, local Louisville/Boulder). Multi-state angle (CO, TX, OR, CA pending) noted.
- **HECM Explorer product spec:** Designed a borrower-facing reverse mortgage calculator at `/tools/reverse-mortgage-calculator` — simplified inputs with sliders, auto-calculation via existing HECM engine, Recharts visualization (cost bar chart, LOC growth line chart), ARM vs Fixed comparison cards, educational tooltips, lead capture.
- **Dev brief delivered:** Full spec saved to `Work/Marketing/HECM-EXPLORER-DEV-BRIEF.md` — ready for Dev department pickup.
- **Relay acknowledged:** Two relays from Claw (EOD legal FYI + Bruce Simmons research target).

### Key decisions
- Borrower HECM tool is a NEW route (`/tools/reverse-mortgage-calculator`), not a modification of the MLO optimizer
- Existing HECM calculation engine (src/lib/hecm/) reused as-is — no new math, just a borrower-friendly wrapper
- Recharts added as visualization library (bar charts, line charts)
- Blog posts are Phase 3 — tool comes first (Phase 1), then content points to tool
- Multi-state play: CO first, then TX/OR versions of cost content (same math, different home values)
- David confirmed he can originate HECMs and his angle is identical to forward: collect less, borrower gets more

### Files created
- `Work/Marketing/HECM-EXPLORER-DEV-BRIEF.md` — Full dev brief for HECM Explorer tool

### Open items
- [ ] **Dev** — Execute HECM Explorer build per `Work/Marketing/HECM-EXPLORER-DEV-BRIEF.md`
- [ ] **David** — Answer 4 open questions in brief (origination fee, target comp, third-party costs default, state list)
- [ ] **Marketing** — Draft 5 reverse mortgage blog posts once blog infrastructure exists (Phase 3)
- [ ] **Marketing** — Brief Dev on Phase 2 (forward mortgage visualization) and Phase 3 (blog infrastructure)

---

## Session: March 11, 2026 — Rate Tool Engagement Layer Build (Dev)

**Chat focus:** Built the full Rate Tool engagement layer — charts, compare, print quote — per the approved dev brief and 3-wave build plan.

### What was done
- **Wave 1 (Foundation):** Created `closing-costs.js` with state-level third-party fee defaults (CO, TX, OR, CA). Added State dropdown and editable Third-Party Costs input to ScenarioForm. Updated RateResults recoup cost calc to include third-party costs.
- **Wave 2 (Charts):** Installed recharts 3.8.0. Created `chartHelpers.js` (shared colors, fonts, formatters). Built `RateCostChart.js` — AreaChart with dynamic green/red gradient for credit/cost zones, par reference line. Built `BreakEvenChart.js` — ComposedChart with cumulative savings line vs cost horizontal line, rate pill selector, hero stats, dynamic horizon.
- **Wave 3 (Print + Compare):** Added Compare toggle (max 3 rates) to RateResults. Built `RateQuotePrintView.js` — branded print layout with scenario summary, rate comparison table, LLPA breakdown, cost breakdown, break-even stats, disclaimer. Added "Print My Quote" button. Added print CSS max-width override to globals.css.
- **Build verification:** Lint clean, `npm run build` passes, all 58 pages generated.

### Key decisions
- Third-party fees use state-level defaults with user override (not per-county granularity)
- Break-even chart uses dynamic horizon (break-even × 1.5, min 12mo, max 120mo)
- Compare button max 3 rates; fallback to auto-pick (low rate / par / high credit)
- Print view pattern matches HECM PrintView.js (`hidden print:block`)
- creditDollars convention: negative = lender credit, positive = discount points

### Files created
- `src/lib/rates/closing-costs.js` — State defaults + getThirdPartyCosts helper
- `src/components/RateTool/chartHelpers.js` — Shared chart colors, fonts, formatters
- `src/components/RateTool/RateCostChart.js` — Rate vs. net cost AreaChart
- `src/components/RateTool/BreakEvenChart.js` — Break-even ComposedChart
- `src/components/RateTool/RateQuotePrintView.js` — Branded print quote view

### Files modified
- `src/components/RateTool/index.js` — State/thirdPartyCosts state, compareRates, Print button, RateQuotePrintView
- `src/components/RateTool/ScenarioForm.js` — State dropdown + third-party costs input
- `src/components/RateTool/RateResults.js` — Charts, compare toggle, updated recoup calc
- `src/app/globals.css` — Print max-width override
- `package.json` / `package-lock.json` — recharts 3.8.0

### Open items
- [ ] **Dev** — Test at /rates on production after Vercel deploy
- [ ] **Dev** — Verify print preview renders correctly on Chrome + Safari
- [ ] **Dev** — Test mobile responsiveness (charts at 375px)
- [ ] **Dev** — Execute HECM Explorer build per dev brief

---

## 2026-03-11 — WebDev — MLO Login Fix, Portal Payroll, Rate Tool Polish

**Department:** WebDev (pc-dev)
**Continued from:** Previous session (rate tool Wave 3 + MLO login debug)

### What was done

**1. MLO Login Fix (Critical)**
- Root cause: Prisma migration `20260310000002_add_ldox_integration_fields` was never applied to production Neon DB
- `ldox_officer_id` and `nmls` columns existed in Prisma schema but not in database — Prisma's `findUnique` tried to SELECT non-existent columns → "column not available" error
- Applied migration directly to Neon (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- Removed all temporary debug logging from `src/lib/auth.js` and login page
- Login error message now shows clean "Invalid email or password" instead of raw Prisma errors
- Deleted temp diagnostic scripts (check-mlo.cjs, check-mlo.mjs, check-columns.cjs, etc.)

**2. CD Upload + Payroll on Overview**
- PayrollSection was hidden behind Documents sidebar tab after Core UI redesign
- Added PayrollSection to OverviewSection for funded loans (renders at top)
- Passed `onRefresh` prop through LoanDetailShell → OverviewSection

**3. WorkDrive Auto-Create for Legacy Loans**
- Loans created before WorkDrive integration had no folder structure
- Payroll PUT handler now auto-creates full WorkDrive folder tree (LO/Year/Borrower_Purpose/SUBMITTED,EXTRA,CLOSING) on first CD upload
- Saves folder IDs to loan record for future use

**4. Payroll Snapshot Enhancement**
- Added `closingFolderId` and `workDriveSubfolders` to the `payroll_sent` audit event
- Mac/Tracker now gets exact folder location of the CD without navigating the tree

**5. Mac Relay**
- Sent relay to Mac with full CD pickup spec: query, audit event payload structure, WorkDrive fetch method
- Relay still open (unacknowledged) — David needs to tell Mac to check relay

### Key decisions
- Prisma migrations must be verified on production after schema changes (lesson learned)
- PayrollSection shows on Overview AND Documents for funded loans (primary action visibility)
- Legacy loans auto-create WorkDrive folders on first CD upload (no manual setup needed)

### Files modified
- `src/lib/auth.js` — Removed debug logging
- `src/app/portal/mlo/login/page.js` — Clean error message, removed debug console.log
- `src/components/Portal/Core/sections/OverviewSection.js` — Added PayrollSection for funded loans
- `src/components/Portal/Core/LoanDetailShell.js` — Pass onRefresh to OverviewSection
- `src/app/api/portal/mlo/loans/[id]/payroll/route.js` — Auto-create WorkDrive, closingFolderId in snapshot

### Open items
- [ ] **Mac** — Check relay: CD Upload + Send to Payroll spec (relay cmmmpi4ya0001krrc7xpy02mb)
- [ ] **Mac** — Build Tracker ingest endpoint to poll/receive payroll_sent events
- [ ] **Dev** — Continue Rate Tool Wave 1-3 plan (comparison report)

---

## 2026-03-11 — Setup — EOD: Relay, Tracker Spec, Actor Vocab, Process Cleanup

**Department:** Setup
**Actor:** pc-setup

**What was done:**
1. Checked relay — resolved test message, resolved governance pull action (verified PC CLAUDE.md compliant)
2. Fixed excessive file permission prompts: updated department table in root CLAUDE.md (split Docs/Code columns, explicit shared code access) and Work/Development/CLAUDE.md (refuse-by-default exemption for codebase)
3. Added SESSION-LOG.md reading as mandatory session start step 2. Relayed governance proposal to Mac.
4. Claw setup assist — SSH key instructions for GitHub, governance cloning. Dave retired.
5. Core architecture decision with David — Core is system of record, LDox stays for Jamie/compliance, one-way push to Tracker on fund. Decision logged in MCP (cmmjbv8w50001krp481fg99n3).
6. Analyzed real LDox JSON payload — mapped all fields to Core schema.
7. Received Mac's revised Tracker ingest spec (MCR FV7, 39 fields). Mapped sources: ~18 LDox auto, ~4 derivable, ~14 manual, ~3 system. Acknowledged with full breakdown.
8. Updated `Work/Integrations/COREBOT-INGEST-BRIEF.md` — now full 5-part spec (ingest + push + migration + security + build order).
9. Updated actor vocabulary: added pc-setup, replaced dave with claw. Relayed to Mac.
10. Killed 25 orphaned node processes from hung dev session.

**Files modified:**
- `CLAUDE.md` (root) — department table, ownership rules, session start protocol, actor vocabulary
- `Work/Development/CLAUDE.md` — shared code access note
- `Work/Integrations/COREBOT-INGEST-BRIEF.md` — full 5-part integration spec (created + revised)
- `Work/SESSION-LOG.md` — multiple entries

**Key decisions:**
- Core is system of record (MCP decision cmmjbv8w50001krp481fg99n3)
- All code departments share write access to netrate-mortgage-site — ownership rules only gate docs folders
- Mac's MCR FV7 spec accepted — Core will supply all 39 fields
- Actor vocab: pc-setup added, dave → claw
- SESSION-LOG.md reading added as mandatory session start step

**Open items:**
- [ ] **Integrations (Dev)** — Build Tracker push per `Work/Integrations/COREBOT-INGEST-BRIEF.md` Part 2
- [ ] **David** — Answer 8 open questions in brief
- [ ] **Mac** — Build `POST /api/loans/ingest` on Tracker side
- [ ] **Mac** — Review governance proposal: SESSION-LOG.md at startup
- [ ] **Mac** — Update actor vocabulary per relay
- [ ] **Claw (Legal)** — PII security review of Core encryption model

---

## Session: 2026-03-11 - Core UI Redesign Phase 1 Build (Dev / WebDev)

**Chat focus:** Implement the approved Core UI Redesign — new sidebar-based loan detail page replacing the old single-column LoanDetailView.

**What was done:**
1. Applied 7 MCR/CRM schema fields to Neon Postgres via raw SQL (`prisma db execute --stdin`) — `prisma migrate dev` and `prisma db push` both fail on the shared DB due to Mac's tables
2. Created `src/lib/constants/mcr-fields.js` — MCR/HMDA constants (action taken, application method, lien status, lead sources, channels)
3. Built Core component scaffolding in `src/components/Portal/Core/`:
   - `SectionCard.js` — collapsible card wrapper with badge/actions support
   - `EditableField.js` — generic click-to-edit (text, select, currency, date, textarea) with source badges
   - `StatusHeader.js` — compact top bar with status dropdown, BIC indicator, WorkDrive/XML links
   - `LoanSidebar.js` — desktop vertical sidebar (w-56) + mobile horizontal tab strip, query-param routing
   - `LoanDetailShell.js` — orchestrator: sidebar + header + section switching via `?section=` param
4. Built 6 section components in `src/components/Portal/Core/sections/`:
   - `OverviewSection.js` — milestone pipeline, quick stats grid, key dates, conditions summary
   - `LoanInfoSection.js` — editable fields: loan terms, property, purpose, lender, MCR/HMDA, CRM/source
   - `BorrowerSection.js` — identity (read-only), SSN reveal, co-borrower tabs, employment/income (editable)
   - `ProcessingSection.js` — task cards (credit, appraisal, title, flood, HOI) with click-to-edit dates + conditions by stage
   - `DocumentsSection.js` — migrated doc list/request form + WorkDrive + Payroll from old LoanDetailView
   - `NotesActivitySection.js` — migrated notes input + activity timeline
5. Expanded `src/app/api/portal/mlo/loans/[id]/route.js`:
   - GET now includes: dates, conditions, loanBorrowers, tasks
   - PATCH now accepts all editable fields (loan terms, property, MCR, CRM) with type coercion
   - Status changes auto-capture dates on LoanDates model (MCR-aware)
6. Created `src/app/api/portal/mlo/loans/[id]/dates/route.js` — GET/PATCH for processing checklist dates
7. Rewired `src/app/portal/mlo/loans/[id]/page.js` to render LoanDetailShell (wrapped in Suspense for useSearchParams)
8. Lint passes clean — no ESLint errors
9. Created migration record: `prisma/migrations/20260310000000_add_mcr_crm_fields/migration.sql`
10. Backed up old component: `LoanDetailViewLegacy.js`

**Key decisions:**
- Raw SQL via `prisma db execute --stdin` is the safe migration path for shared Neon DB
- Query-param routing (`?section=overview`) instead of nested file routes
- LoanDetailView replaced entirely — legacy backup kept at LoanDetailViewLegacy.js
- Status→date auto-capture: only sets date if LoanDates field is null (won't overwrite manual entries)
- MCR/HMDA section defaults to collapsed (not all users need it)

**Files created:**
- `src/lib/constants/mcr-fields.js`
- `src/components/Portal/Core/SectionCard.js`
- `src/components/Portal/Core/EditableField.js`
- `src/components/Portal/Core/StatusHeader.js`
- `src/components/Portal/Core/LoanSidebar.js`
- `src/components/Portal/Core/LoanDetailShell.js`
- `src/components/Portal/Core/sections/OverviewSection.js`
- `src/components/Portal/Core/sections/LoanInfoSection.js`
- `src/components/Portal/Core/sections/BorrowerSection.js`
- `src/components/Portal/Core/sections/ProcessingSection.js`
- `src/components/Portal/Core/sections/DocumentsSection.js`
- `src/components/Portal/Core/sections/NotesActivitySection.js`
- `src/app/api/portal/mlo/loans/[id]/dates/route.js`
- `prisma/migrations/20260310000000_add_mcr_crm_fields/migration.sql`
- `src/components/Portal/LoanDetailViewLegacy.js` (backup)

**Files modified:**
- `prisma/schema.prisma` — 7 MCR/CRM fields on Loan model
- `src/app/api/portal/mlo/loans/[id]/route.js` — expanded GET/PATCH
- `src/app/portal/mlo/loans/[id]/page.js` — rewired to LoanDetailShell

**Open items:**
- [ ] **Dev** — Run `next build` to verify production build passes (build was hanging — may need to kill stale node processes first)
- [ ] **Dev** — Test new loan detail UI in browser against real loan data
- [ ] **Dev** — David changed 'Draft' to 'Prospect' in NotesActivitySection STATUS_LABELS — propagate to other components if intentional
- [ ] **Dev** — Audit old LoanDetailView.js imports — anything still referencing it? (PipelineTable links should be fine since URL didn't change)
- [ ] **Dev** — Next phase: add condition CRUD, task CRUD, audit reconciliation layer

---

## Session: March 12, 2026 - Dev Backlog Fix + Commit (Dev)

**Chat focus:** Fixed Marketing's stuck backlog/tickets feature, committed and pushed to production.

**What was done:**
- Picked up Marketing's uncommitted Dev Backlog ticketing system (table view, filters, create form, comment threads)
- Fixed auth imports in all 3 ticket API routes (`@/app/api/auth/[...nextauth]/route` → `@/lib/auth`)
- Fixed ESLint errors: unused `PRIORITIES` const, unused `session` destructuring in both backlog pages
- Verified Ticket/TicketEntry models exist in schema, migration already applied to DB
- Regenerated Prisma client
- Lint passes clean, dev server starts without errors
- Committed as `6a358e8` and pushed to main — Vercel deploying

**Key decisions:**
- Backlog is shared across Website, Portal, and CoreBot products
- MLO portal login uses same Neon Postgres DB as production (same password)

**Files committed (new):**
- `prisma/migrations/20260311000001_add_tickets_backlog/migration.sql`
- `src/app/api/portal/mlo/tickets/route.js` — List + Create
- `src/app/api/portal/mlo/tickets/[id]/route.js` — GET, PATCH, DELETE
- `src/app/api/portal/mlo/tickets/[id]/entries/route.js` — POST comment
- `src/app/portal/mlo/backlog/page.js` — Backlog list view
- `src/app/portal/mlo/backlog/[id]/page.js` — Ticket detail view

**Files modified:**
- `prisma/schema.prisma` — Ticket + TicketEntry models added
- `src/app/portal/mlo/page.js` — "Dev Backlog →" link added to MLO dashboard

**Open items:**
- [ ] **Dev** — David needs to recover/reset MLO portal password to test backlog on live site
- [ ] **Dev** — Run `next build` to verify production build (was hanging in previous session)
- [ ] **Dev** — Test backlog CRUD against live data once logged in
- [ ] **Dev** — Core UI Redesign open items still pending (see March 11-12 session above)

---

## Session: March 12, 2026 - SHP Consensus + Startup Hooks (Setup)

**Chat focus:** Reached SHP consensus across 3 devices, solved startup protocol enforcement via SessionStart hooks, built REGISTRY.md.

**What was done:**

*SHP (Session Handoff Protocol) Finalization:*
- Reached consensus across Mac, PC, Claw on SHP via relay rounds
- Key resolved issues: SESSION-LOG stays EOD-only (Mac's position won), self-device relay dropped (PC conceded), git log -5 default, REGISTRY.md recent additions included
- Mac committed SHP to GOVERNANCE.md (commit b16366f)
- Addressed David's dormant session question — added date-awareness rule (automatic mini-briefing), "catch up" keyword (manual trigger), orphan detection for crash recovery

*Startup Protocol Enforcement (4 failures → hooks solution):*
- Attempt 1: Added governance pointer to CLAUDE.md — agent ignored
- Attempt 2: Added mandatory checklist to Development/CLAUDE.md + Root CLAUDE.md — agent ignored
- Attempt 3: Added STOP checklist to mortgage-site/CLAUDE.md (three-level coverage) — agent ignored
- Attempt 4: Just "You are Dev" with no task — agent said "Ready to work" without running checklist
- Root cause discovered: David was launching from `D:\PROJECTS\netrate-mortgage-site` (old standalone repo) instead of `D:\PROJECTS\netrate-pc-ops\Work\Development\netrate-mortgage-site`
- Solution: Claude Code **SessionStart hooks** — shell scripts that inject context into agent memory BEFORE the first user message. Cannot be skipped.
- Built hooks at both launch points (mortgage-site for Dev, repo root for Setup/Auditor)
- Tested successfully — agent found backlog feature, ran all startup steps

*REGISTRY.md:*
- Created full feature inventory for mortgage-site: 48 API routes, 25 UI pages, 22 database models, key integrations, scripts, recent additions
- Required by SHP spec — dev agents read it at startup to know what's been built

*CLAUDE.md Updates:*
- Root CLAUDE.md: Added governance pointer at top, stripped duplicated protocols, updated Dave → Claw, updated RELAY.md → MCP relay tools
- Development/CLAUDE.md: Added 8-step mandatory startup checklist
- mortgage-site/CLAUDE.md: Added STOP protocol at top

*Relay:*
- Relayed hooks breakthrough to all devices with full implementation details
- Received 2 requests from Mac re: TrackerPortal Vercel migration (unanswered — see open items)

**Files created:**
- `.gitignore` — repo root gitignore (protects local settings from commit)
- `.claude/hooks/startup-protocol.sh` — root SessionStart hook (Setup/Auditor)
- `.claude/settings.json` — root hook config
- `Work/Development/netrate-mortgage-site/.claude/hooks/startup-protocol.sh` — dev SessionStart hook
- `Work/Development/netrate-mortgage-site/.claude/settings.json` — dev hook config
- `Work/Development/netrate-mortgage-site/REGISTRY.md` — feature inventory (48 routes, 25 pages, 22 models)

**Files modified:**
- `CLAUDE.md` — governance pointer, stripped duplicates, Claw update
- `Work/Development/CLAUDE.md` — mandatory 8-step startup checklist
- `Work/Development/netrate-mortgage-site/CLAUDE.md` — STOP startup protocol at top

**Key decisions:**
- SessionStart hooks are the enforcement layer; CLAUDE.md is the instruction layer (MCP decision cmmnsg8mf000bkrjog6w9uhwz)
- CLAUDE.md alone cannot override agent's priority to respond to user's question
- Each launch directory needs its own hook (no cascade for hooks)
- Old `D:\PROJECTS\netrate-mortgage-site` directory should be removed/renamed

**Open items:**
- [ ] **Setup** — Commit and push all changes (CLAUDE.md files, REGISTRY.md, hooks, settings.json, .gitignore)
- [ ] **Setup** — Respond to Mac's 2 relay requests (Vercel setup context + file upload stack for TrackerPortal migration)
- [ ] **David** — Remove or rename old `D:\PROJECTS\netrate-mortgage-site` directory to prevent future wrong-directory launches
- [ ] **David** — Update launch cheat sheet with correct paths per department
- [ ] **Mac** — Build their own REGISTRY.md for TrackerPortal
- [ ] **Mac + Claw** — Add SessionStart hooks to their repos
- [ ] **Claw** — System visual (4-page PPTX) still in progress — waiting for compiled draft

---

## Session: March 12, 2026 — CoreBot Phases 4-6, WorkDrive Fixes, Doc Workspace (Dev)

**Chat focus:** Completed CoreBot Engine Phases 4-6, fixed WorkDrive duplicate folder bug, added manual folder creation, bulk upload, image-to-PDF conversion. Tested end-to-end on Devoe loan.

**Commits this session:**
- `d139c6d` — Add order-outs, doc workspace, and borrower checklist (Phases 4-6)
- `c149658` — Fix WorkDrive duplicate folders and add manual folder creation
- `49b8e73` — Add bulk file upload and auto image-to-PDF conversion
- `2d9bab9` — Fix upload error handling and add 4.5MB file size check

**What was done:**

*CoreBot Phase 4 — Order-Outs:*
- Email templates for title, appraisal, HOI, flood cert vendor orders
- API endpoint `/api/corebot/order-out` — sends via Resend, auto-updates LoanDates
- Inline order forms in ProcessingSection task cards

*CoreBot Phase 5 — Doc Workspace:*
- New `DocWorkspace.js` component replaces separate WorkDrivePanel + CoreBot card
- CoreBot section: Process Docs button, unprocessed count, checklist progress bar
- File browser: FLOOR/SUBMITTED/EXTRA/CLOSING tabs with upload, download, delete
- File move API `/api/portal/mlo/loans/:id/files/move`
- Conditions CRUD API `/api/portal/mlo/loans/:id/conditions`

*CoreBot Phase 6 — Borrower Checklist:*
- `BorrowerChecklist.js` — borrower-facing checklist combining doc requests + conditions
- API `/api/portal/loans/:id/checklist` — unified checklist for borrower dashboard
- Replaced DocumentList with BorrowerChecklist on borrower dashboard

*WorkDrive Duplicate Folder Fix:*
- Root cause: Zoho WorkDrive silently auto-renames duplicate folders (appends timestamp) instead of returning 409
- Fix: `ensureFolder()` now lists parent first, checks for existing match before creating
- All folder creation in `createLoanFolder` now uses `ensureFolder` for idempotency
- David cleaned up ~8 duplicate timestamped folders from WorkDrive

*Manual Folder Creation:*
- Added "Create WorkDrive Folder" button to DocWorkspace for loans missing folder links
- API endpoint `/api/portal/mlo/loans/:id/files/create-folder`
- Tested on Devoe loan — folder created successfully at `David Burson/2026/DEVOE-ALAN_Refi_2026-03/`

*Upload Improvements:*
- Bulk upload: file input accepts multiple files, uploads sequentially
- Image-to-PDF: server-side conversion via `pdf-lib` — PNG/JPG auto-converted to PDF
- File size check: client-side 4.5MB limit (Vercel serverless body limit) with clear error messages
- Per-file error handling with upload/fail counts

*Other:*
- MLO password reset for David (david@netratemortgage.com → netrate2026)
- Captured Facebook insight about automated doc chase reminders to MCP + backlog ticket
- All 6 CoreBot Engine phases now complete and deployed

**Files created:**
- `src/lib/email-templates/order-outs.js`
- `src/app/api/corebot/order-out/route.js`
- `src/components/Portal/Core/sections/DocWorkspace.js`
- `src/app/api/portal/mlo/loans/[id]/files/move/route.js`
- `src/app/api/portal/mlo/loans/[id]/conditions/route.js`
- `src/components/Portal/BorrowerChecklist.js`
- `src/app/api/portal/loans/[id]/checklist/route.js`
- `src/app/api/portal/mlo/loans/[id]/files/create-folder/route.js`

**Files modified:**
- `src/components/Portal/Core/sections/ProcessingSection.js` — order forms
- `src/components/Portal/Core/sections/DocumentsSection.js` — uses DocWorkspace
- `src/app/portal/dashboard/page.js` — uses BorrowerChecklist
- `src/lib/zoho-workdrive.js` — ensureFolder fix, idempotent createLoanFolder
- `src/app/api/portal/mlo/loans/[id]/files/route.js` — image-to-PDF, bulk upload, error handling
- `package.json` — added pdf-lib dependency

**Open items:**
- [ ] **Dev** — Large file upload (>4.5MB) needs direct-to-storage approach to bypass Vercel body limit
- [ ] **Dev** — Test CoreBot "Process Docs" end-to-end on Devoe loan (files uploaded, ready to process)
- [ ] **Dev** — Backlog: Automated doc chase reminders (ticket created in DB)
- [x] **Dev** — REGISTRY.md needs updating with new routes/components from Phases 4-6

---

## 2026-03-18 — PC Dev (EOD)

**Department:** Dev
**Focus:** Devoe HECM approval review, loan processing engine architecture, relay protocol fix

**Key decisions:**
- Processing engine should be its own service (not Next.js serverless) — needs background jobs, persistent connections, long-running operations
- Current Neon/Prisma foundation is correct for the database layer — extend existing models, don't replace
- HECM playbook approach: plan all conditions up front, execute in priority order (approval blockers → borrower docs → broker orders → title → post-appraisal)

**Devoe file review (HECM refi — FAR):**
- Reviewed full conditional approval from FOA (UW: Breanne Leivan)
- Identified approval blocker: Condition 101.1 — $2,803.66/mo RI shortfall
- Key finding: RI calculation includes two US Bank mortgage payments ($4,429/mo) being paid off at closing — may be an error. Post-payoff RI would be ~$2,559 vs $998 required (passes easily)
- Also flagged: $0 property taxes on $1M Jefferson County home seems wrong
- Also flagged: Condition asks for 2024 W2s but UW notes reference 2025 W2s
- Drafted FOA email with all 3 questions (saved to Work/Products/devoe-foa-email-draft.txt) — David sent
- Mapped all conditions into 4 parallel lanes: borrower, broker, title, lender
- Began condition-by-condition review (Gen1-Gen4, 100, 101 complete, 102-Fun3 remaining)

**Loan processing engine design notes (for future sessions):**
- 4-lane condition tracking: borrower, broker, title, lender
- Condition freshness/validity windows tied to closing date
- Borrower communication types: "need now" / "heads up" / "after X send Y"
- Minimize borrower touches — calculate optimal request timing from closing date backwards
- Conditions can cross-satisfy (credit report + mortgage statement + payoff = payment proof)
- Document metadata extraction needed: account numbers, statement dates, payment-through dates
- Vendor contacts at loan level: insurance agent, title co, appraiser, employers, lender contacts
- HECM financial assessment calculator: RI, LESA, asset dissipation
- Order-out emails should auto-populate from loan-level vendor contacts
- Borrower checklist status: upcoming → ready_to_collect → received → stale

**Relay protocol:**
- Pulled netrate-governance (a3c32ae) — relay bugs #8 and #9 fixed
- Added Ironclad Relay Protocol to CLAUDE.md (5 rules)
- Confirmed to Mac and Claw via relay

**Claw upgrade plan (acked, not yet executed):**
- Claude Code Feature Adoption Plan published by Claw
- Phase 1: Upgrade to v2.1.78+ (PC currently on v2.1.62)
- Phases 2-5: Scheduled tasks, custom skills, feature watch, backlog

**Commits:**
- `1cb9505` — Update REGISTRY.md with Phase 4-6, Market Watch, and recent additions
- `f5458ae` — Add Ironclad Relay Protocol to CLAUDE.md

**Files created:**
- `Work/Products/HECM-PROCESSING-PLAYBOOK.md` (draft — condition map from Devoe approval)
- `Work/Products/devoe-foa-email-draft.txt` (email to FOA re: RI shortfall questions)

**Open items:**
- [ ] **Dev** — Large file upload (>4.5MB) — needs resolution this week (website launch goal)
- [ ] **Dev** — Test CoreBot "Process Docs" end-to-end on Devoe loan
- [ ] **Dev** — Backlog: Automated doc chase reminders
- [ ] **Dev** — Devoe condition review: resume at condition 102 (tax cert) through Fun3
- [ ] **Dev** — HECM playbook: finalize after completing condition review
- [ ] **Dev** — Portal backend: HECM financial assessment calculator (RI/LESA)
- [ ] **Dev** — Portal backend: Condition model enrichment (freshness, borrowerMessage, dependencies, linked docs)
- [ ] **Dev** — Portal backend: Loan-level vendor contacts (LoanContact model)
- [ ] **Dev** — Portal backend: Borrower communication timeline engine
- [ ] **Dev** — Architecture decision: processing engine as standalone service (tech stack TBD)
- [ ] **Dev** — Upgrade Claude Code to v2.1.78+ (Claw adoption plan Phase 1)
- [ ] **Dev** — A2P/10DLC: Resubmit campaign with updated opt-in language (open from prior session)

---

## Session: 2026-03-18 - Market Watch Phase A (WebDev/Dev)

**Chat focus:** Acknowledge Claw Market Watch relay, build Phase A: rate_history database + daily snapshot job + API endpoint

**What was done:**
- Acknowledged Claw relay (cmmp8b70g0007y477ceekt15s) re: Market Watch dev brief
- Added `RateHistory` model to Prisma schema (autoincrement ID, matches Claw's SQL spec)
- Created `rate_history` table in Neon Postgres via raw SQL (can't use prisma push — shared DB drift)
- Built `scripts/create-rate-history-table.js` — one-time table creation script
- Built `scripts/rate-history-snapshot.js` — daily snapshot job:
  - Computes par rate per credit tier (760+, 740-759, 720-739, 700-719, 680-699)
  - Default scenario: $400K, 75% LTV, purchase, single family
  - Supports --dry-run, --date, --file flags
  - Duplicate protection (won't re-insert same date)
- Built `GET /api/rates/history` endpoint — query by loan_type, credit_score, days/period
- Stored today's data (2026-03-13 Sunwest rates): 5 rows across 5 credit tiers
- Build passed, committed, pushed

**Key decisions:**
- Use raw SQL via @neondatabase/serverless for table creation (Prisma push would destroy Mac's ops_* tables)
- Logged as architecture decision in MCP knowledge layer
- Rate date stored is 2026-03-13 (effective date of current Sunwest rate sheet, not today)

**Commits:**
- `6eb5623` — Add Market Watch Phase A: rate_history database + snapshot job + API

**Files created/modified:**
- `prisma/schema.prisma` (added RateHistory model)
- `scripts/create-rate-history-table.js` (new — one-time table setup)
- `scripts/rate-history-snapshot.js` (new — daily snapshot job)
- `src/app/api/rates/history/route.js` (new — API endpoint)

**Open items:**
- [ ] **David** — Run `node scripts/rate-history-snapshot.js` daily after pulling rate sheets
- [ ] **David** — Backfill Jan-Mar 2026 data using --date flag with historical rate files
- [ ] **Dev** — Market Watch Phase B: FRED API integration (Treasury yields)
- [ ] **Dev** — Market Watch Phase C: Rate History chart UI (Recharts)
- [ ] **Dev** — Market Watch Phase D: Economic calendar
- [ ] **Dev** — Homepage ticker: Review UMBS/S&P500 items per Claw's zero-third-party-data rule
- [ ] **Dev** — Large file upload (>4.5MB) — still open
- [ ] **Dev** — A2P/10DLC: Resubmit campaign
- [ ] **Dev** — Upgrade Claude Code to v2.1.78+
