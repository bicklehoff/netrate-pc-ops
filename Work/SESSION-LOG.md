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
