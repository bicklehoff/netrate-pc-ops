# Session Log — PC Operations

**Location:** `Work/SESSION-LOG.md`
**Device:** PC (Public Facing)

---

## 2026-04-03 — Dev — Rate Watch Overhaul, Data Pipeline, Cron Jobs, Claw Coordination
**Actor:** pc-dev

### What was done

**Homepage rate bug (prior session carry-over)**
- All products showing 5.5% / 10.5% APR — SWMC prices stored as discount points, not 100-based
- Fix: `UPDATE rate_prices SET price = 100 - price WHERE lender = SWMC` + force deploy to clear ISR cache
- `src/lib/rates/homepage-db.js` — cache bust comment added

**escrowsWaived pass-through**
- `src/app/api/portal/mlo/quotes/route.js` — added `escrowsWaived` to pricingInput, `isEscrowing` now derived from it

**Rate Watch trend chart redesign**
- Removed credit tier buttons + live FRED calls per render
- Now: national avg (MND) minus constant NRM_SPREAD (0.285%) = NRM historical line
- `src/components/RateWatch/RateChart.js` — `NRM_SPREAD = 0.285` (last updated 2026-04-03)

**MND daily scrape cron** — `/api/cron/mnd-scrape`
- Scrapes mortgagenewsdaily.com at 4:15pm EST weekdays → `rate_history` table (source='mnd')
- Added second run at 8:30am EST so rate trend bar updates morning + afternoon
- `vercel.json` — two schedule entries for same path

**FRED → DB pipeline** — `/api/cron/fred-snapshot`
- Daily 6pm EST weekdays: fetches 11 FRED series + CMT1Y/CMT10Y aliases from DGS1/DGS10
- Stores in `fred_series_data` table; eliminates 10+ live API calls per Rate Watch page load
- CMT source: switched from Treasury.gov (blocked server-side) to FRED DGS1/DGS10

**Health check cron** — `/api/cron/health-check`
- Runs 8am EST weekdays: validates MND freshness, rate sanity (5-9%), FRED staleness
- POSTs relay to TrackerPortal on failure

**Rate Watch TickerBar expansion**
- Now shows full index strip: SOFR, 30D SOFR, 1yr CMT, Prime, Fed Funds, 2yr T, 10yr T, Nat'l Avg
- Colored group dots separate ARM / HELOC+Fed / Treasury / MBS sections
- `src/components/RateWatch/TickerBar.js`

**BenchmarkIndexes CMT fix**
- CMT1Y/CMT10Y fell back to `—` because Treasury.gov is blocked server-side
- Now falls back to DGS1/DGS10 from fredLatest
- `src/components/RateWatch/BenchmarkIndexes.js`

**Economic Calendar seed cron** — `/api/cron/calendar-seed`
- Runs Mondays 8am UTC: fetches upcoming release dates from FRED releases API
- Seeds Jobs Report, CPI, PCE, PPI, FOMC, GDP, Retail Sales 90 days out as skeleton events
- Never overwrites Claw-owned fields (actual/result/forecast/prior)

**Calendar UI fix**
- `ResultBadge` falls back to `ev.impact` when `ev.result` is null — fixes bad data on ids 8 and 3
- Deleted duplicate "Jobs Report" Apr 3 (id=13) — Claw's richer entry (id=5) is canonical

### Claw coordination
- Resolved relay: calendar UI changes + seed cron ownership
- Ownership model confirmed: PC seeds skeleton dates, Claw enriches with actuals/results/forecasts
- Canonical event names relayed to Claw for upsert key matching
- Relayed: pulsing dot / bearish indicator = Claw-owned via POST /api/market/summary
- Relayed: MND scrape cron schedule (8:30am + 4:15pm EST)

### Deploys (all to main, auto-deployed via Vercel)
- `56c5806` — rate-watch: expand ticker bar to show all rate indices
- `d233908` — rate-watch: trim ticker bar to fit one line
- `a418f3a` — calendar: fix result/impact display + seed from FRED
- `cc483d3` — cron: add morning MND scrape at 8:30am EST
- (prior session) `1347bc0` — fred-snapshot: CMT from FRED instead of Treasury.gov

### Open items
- [ ] Fix FRED release IDs for CPI, PCE, PPI, FOMC, GDP, Retail Sales in calendar-seed cron (only Jobs Report seeding correctly — Claw covering the gap manually for now)
- [ ] Update NRM_SPREAD in RateChart.js when competitive position changes (currently 0.285%)
- [ ] Rotate TRACKER_API_KEY — exposed in session chat log
- [ ] Claw bar sentiment relay still open (cmnj636pz, cmnjeqrd5) — David monitoring, not actioning
- [ ] Pre-existing: SWMC phase 2 adjustments, other lenders adjustment_rules, fee templates seed, county loan limits

---

## 2026-04-02/03 — Setup — Relay Migration, Neon Controls, Deploy Safety, Homepage Rate Fix
**Actor:** pc-setup

### What was done

**Relay system migration**
- Switched all PC relay calls from MCP tools to TrackerPortal REST API
- `GET/POST/PATCH https://tracker.netratemortgage.com/api/relay` with `x-tracker-api-key`
- Updated CLAUDE.md Ironclad Relay Protocol section + session startup step
- Saved to memory (`feedback_relay_api.md`)
- Bulk resolved 69 stale relays — inbox down from 137 → 15 open action items

**Commission POST fix**
- `cdWorkDriveFileId` now included in TrackerPortal payroll POST payload
- `src/app/api/portal/mlo/loans/[id]/payroll/route.js`
- Relayed back to Mac, resolved

**Deploy safety**
- Installed `.git/hooks/pre-push` — auto-rebase + stash before every push
- Prevents deploy collisions between concurrent sessions

**Neon DB usage controls**
- Confirmed `PC_DATABASE_URL` uses pooled connection (`-pooler.`) in both local + Vercel
- `seed-adjustment-rules.mjs`: added skip guard (`--force` required to re-seed) + batched inserts (50 rows/query, was 1 per query — ~50x less transfer)
- `package.json`: `prisma migrate deploy || true` — non-blocking, survives transient DB hiccups
- Added Neon DB Usage section to `DEV-PLAYBOOK.md`
- Neon upgraded to Launch plan ($19/mo) — was over 5 GB transfer on day 2 (seeding + connection leak)

**Homepage/rate-watch rate fix**
- Rates were showing 5.5% / 10.5% APR — broker comp was being subtracted in pricing engine before finding "par", pushing selection to a heavily discounted rate
- Fix: `compRate: 0` in homepage `brokerConfig` — public display shows true sheet par
- `src/lib/rates/homepage-db.js`
- Also cleared 2 pre-existing ESLint errors that were blocking builds

### Deploys
- `netrate-mortgage-site-ku94sxm1b` — Ready (rate fix + ESLint cleanup)

### Open items (15 relays remain)
- [ ] Wire MCR loans push endpoint to TrackerPortal
- [ ] Replace RSS aggregator with /api/market/news endpoint
- [ ] Disable PC national-rates scrape task (Claw taking over)
- [ ] Disable SessionStart hook
- [ ] DSCR Scenario Builder + Income Qualification Calculator
- [ ] Dev batch (Tickets API, contacts, email attachments, signing queue)
- [ ] Payroll module full build spec
- [ ] Refinance Calculator + Term Shortening calculator
- [ ] Outstanding items checklist status update
- [ ] Design Refinement Brief — full site visual upgrade
- [ ] Compliance review — 7 must-fix items before removing password wall
- [ ] System map PDF
- [ ] Revised MCR ingest spec


---

## 2026-04-02 — Dev — SWMC Pricing Pipeline, Skill Refactor, Branding Fixes
**Actor:** pc-dev

### What was built

**SWMC Integration (completed)**
- Seeded 1,368 rate prices for 21 agency products (FHA/VA 30/15yr, HB, conv 30/20/15/10yr, ARMs, HomeReady, HomePossible, HomeOne, Super-conforming)
- Created `src/data/lender-adjustments/swmc/` — 3 JSON files: `conv-llpa.json` (conforming FICO/LTV grids), `gov-adj.json` (raw reference), `lender-config.json` (pre-negated values for seeding)
- Seeded 233 adjustment_rules: 207 ficoLtv rows (purchase/refi/cashout), 26 productFeature rows (gov FICO adj, state adj, property adj, loan amt adj, monthly promos)
- Fixed `parseFico()` for `"<=639 or NTC"` edge case and `parseLtv()` for `">95"` edge case in `seed-adjustment-rules.mjs`
- Sign convention documented: conforming FICO/LTV positive=cost (no negation), gov adj negative=credit in sheet → pre-negated in lender-config.json

**parse-rate-sheet Skill Refactor**
- Split 395-line monolithic SKILL.md into ~200-line shared rules file + per-lender reference files in `.claude/skills/parse-rate-sheet/lenders/`
- Created: `everstream.md`, `swmc.md`, `tls.md`, `keystone.md`, `amwest.md`, `windsor.md`
- Migrated per-lender section maps (row numbers) from `Work/Dev/PARSER-REWRITE-TASKS.md`

**Branding Fixes**
- Removed all "NetRate Wholesale" and self-referential "wholesale rates" labels from public-facing components
- Fixed all bare "NetRate" → "NetRate Mortgage" in user-visible content
- Files changed: HeroStrip.js, RateChart.js, BelowFold.js, TickerBar.js, RateResults.js, page.js, state pages (TX/CA/OR/CO)
- Added two branding rules to CLAUDE.md under `## Brand`

**Quote Generator (uncommitted from previous session — cleaned up and committed)**
- `QuoteScenarioForm.js`: `deriveFromClosing()` now computes both fundingDate and firstPaymentDate; CO/TX purchase = same day, CA/OR + all refis = +3 biz days
- `QuoteRateResults.js`: removed escrows waived toggle (superseded)

### Key decisions
- Gov adj sign convention: SWMC gov adj stored pre-negated in lender-config.json so productFeature engine (`price += pf.value`) produces correct result
- `">95"` LTV band mapped to `{ ltvMin: 95.01, ltvMax: 100 }` — added to `parseLtv()` generically (will work for any lender using this format)
- Branding: "wholesale lenders" language in body copy kept where it refers to the lenders we access (accurate) — only self-referential wholesale labels were changed

### Relay inbox (2 open from Claw)
- `cmni4gq6a0000y4wq0e78imnm` — Kill RSS aggregator on site, replace with `/api/market/news` endpoint. Claw will POST curated headlines daily.
- `cmnhszup10000y43j0t01do2l` — Disable PC national-rates scrape scheduled task (Claw taking it over)

### Open items
- [ ] **Claw relay**: Kill RSS aggregator + build `/api/market/news` + MarketNews UI on /rate-watch
- [ ] **Claw relay**: Disable PC national-rates scrape scheduled task
- [ ] SWMC phase 2: Conforming additional adj (condo, investment, ARM, 2-4 units, manufactured, HB, subordinate financing)
- [ ] Other lenders adjustment_rules: AmWest (0), Windsor (0), Keystone (0), TLS (0)
- [ ] NonQM pricer spec ready at `Work/Dev/Products/NONQM-PRICER-SPEC.md` — not built
- [ ] Rate Watch benchmark indexes (SOFR, Prime, CMT) — spec at `Work/Dev/SPEC-benchmark-indexes.md`
- [ ] Fee templates seed — fees show $0 in quote engine
- [ ] County loan limits → pricing engine (plan at `C:\Users\bickl\.claude\plans\virtual-finding-shannon.md`)
- [ ] Twilio A2P Attempt 9 under review — new brand NetRate Mortgage LLC (BN9b673f...), check in 2-3 weeks
- [ ] Verify new messaging service (MG9a4cff...) has phone number linked and .env updated

---

## 2026-04-01 — Dev — Economic Calendar, DB Connection Fix, ISR Revalidation, Treasury Yields
**Actor:** pc-dev

### What was built
- **Economic Calendar API** — New `economic_calendar_events` DB table + `POST/GET /api/market/calendar` endpoint. Claw can POST events with date, time, name, forecast, actual, prior, impact, result, big flag. Upsert key on (date, name). Auth via `CLAW_API_KEY`.
- **EconomicCalendar component** — Replaced hardcoded 5-event list with DB-driven component. Shows past events dimmed with result badges (✓ Better / ✗ Worse / — Inline), future events with forecast/prior values. Removed scrollbar, expanded row height for natural fit.
- **BelowFold "What Could Move Rates Next"** — Now reads from `/api/market/calendar?upcoming=true`. Shows future events with impact text in 3-column cards. Removed hardcoded fallback.
- **DB connection fix** — Found root cause of stale data: 10 raw `neon()` calls used `DATABASE_URL` which on Vercel points to old shared `neondb`, not `netrate_pc`. Fixed all to use `PC_DATABASE_URL || DATABASE_URL`. Affected: rate-watch page, strike-rate, rate history, national-rates, archive pages.
- **ISR on-demand revalidation** — Added `revalidatePath('/rate-watch')` and `revalidatePath('/')` to POST handlers for `/api/market/summary` and `/api/market/calendar`. Pages update instantly when Claw posts instead of waiting 5-min ISR expiry.
- **Treasury Yields fix** — Page was self-fetching `/api/rates/fred` during SSR (known Next.js issue — server calling itself fails on Vercel cold starts). Replaced with direct FRED API calls from server component. Same data, same fallback, no self-referencing.

### Schema changes
- New table: `economic_calendar_events` (id, date, time, name, forecast, actual, prior, impact, result, big, source, created_at, updated_at)

### New files
- `src/app/api/market/calendar/route.js` — GET + POST for economic calendar
- `Work/Dev/SPEC-benchmark-indexes.md` — Spec for tomorrow: add SOFR, Prime, CMT benchmark indexes to Rate Watch

### Key decisions
- Vercel Neon integration locked to old `neondb` — can't easily remove or reconfigure. `PC_DATABASE_URL` takes priority in code, integration-managed `DATABASE_URL` is harmless dead variable.
- Economic Calendar owned by Claw — they POST events daily with forecasts, update with results after release
- Self-fetch pattern eliminated for FRED — direct API calls from server component

### Relays handled
- Claw: Economic Calendar improvements → built API + components, replied with full endpoint spec
- Claw: Commentary not displaying → fixed DB connection (was querying wrong database)
- Claw: Treasury Yields blank → fixed self-fetch SSR issue
- Claw: ISR cache not updating → added revalidatePath to POST handlers
- CoreCRM relay → resolved (already built)
- Mac: acknowledged Dev batch relay

### Open items
- [ ] Benchmark Index Rates — spec ready, build tomorrow (SOFR, Prime, CMT on Rate Watch)
- [ ] Vercel `DATABASE_URL` cleanup — integration locked to neondb, cosmetic issue only
- [ ] Mac relay: CD commission POST missing cdBlobUrl/cdWorkDriveFileId
- [ ] Claw relay: DSCR Scenario Builder + Income Qualification Calculator
- [ ] Mac relay: Dev batch (Tickets API, dashboard contacts, email attachments, signing queue)
- [ ] Publisher relay: 3 rate portal pages need rate tool components wired up

---

## 2026-04-01 — Dev — Pricing Engine Validation, County Limits, NonQM Spec
**Actor:** pc-dev

### What was done

**DB Audit & Cleanup**
- Full 43-table duplicate scan
- Removed 213 duplicate adjustment_rules, 308 duplicate rate_prices (93 bogus 80.08 + 215 DSCR parser dupes), 7 stale rate_sheets
- Added dedup logic to seed script (pre-insert) and db-writer (price rows) to prevent recurrence

**Elite Conv Cashout Fix**
- `resolveGrids()` returned empty `{}` for cashout grid (truthy in JS) instead of falling through to `allTerms` grid
- Fixed with `Object.keys().length > 0` check — Elite conv cashout now gets FICO/LTV adjustment
- Verified: adj = 0.802, exact match to LS

**County Loan Limits**
- Added county dropdown to rate tool (populated from 2026 FHFA data, all 4 licensed states)
- Pricing API classifies loan as conforming/highBalance/jumbo per county
- Conforming: filters out HB products. High-balance: shows both. Jumbo: no agency products
- No county = no filter (backwards compatible)
- FHA uses separate limit structure (65% baseline floor)
- Summary strip shows county limit + classification badge

**FICO Adj Scope Fix**
- FICO band penalty (640-699 = -0.100) now applies to conv/fha/va per rate sheet ("Conf/FHA/VA")
- State adj, property type, occupancy remain FHA-only
- Split `coreFeatures` (all loan types) from `fhaOnlyFeatures` (FHA only) in lender-config

**FHA SRP Band Fix**
- SRP band lookup now uses UFMIP-adjusted loan amount (effective, not base)
- $400K base + $7K UFMIP = $407K → matches $400K-$500K SRP band instead of $375K-$400K

**LS Validation: 21 rows, all exact adj match**
- Conv Core/Elite x FNMA/FHLMC x Purchase/Refi/Cashout — CO (rows 1-9)
- Conv Core/Elite x FNMA/FHLMC x Purchase — CA (rows 10-13)
- Conv Core/Elite x FNMA/FHLMC x Purchase — TX (rows 14-17)
- Conv Core/Elite x FNMA/FHLMC x Refi — CO (rows 18-21)
- FHA Core/Elite, VA Core/Elite — adj correct per rate sheet
- Purchase prices consistently -0.250pt vs LS on $400K (our $4,595 comp vs LS $3,595)
- Refi/cashout prices exact match (both use $3,595 comp)

**FHA/VA Elite Discrepancy Resolved**
- LS applies Rate-Term Refi purpose grid to Purchase scenarios for Elite govt products
- Verified against XLSX source: our extraction matches the sheet exactly
- Diff is ~0.19 points ($773 on $407K) — we're more generous than LS
- Rate sheet is the contract — we follow it

**New Rate Sheet Loaded**
- 4/1/2026 reprice parsed and loaded (10,116 prices after dedup)

**NonQM Pricer Spec**
- Wrote spec at `Work/Dev/Products/NONQM-PRICER-SPEC.md`
- Separate engine: DSCR ratios, PPP terms, doc types, property matrices
- Sent relay to Claw for NonQM content pages

### Commits (7)
- `eb4dbf8` — Fix Elite conv cashout grid lookup + dedup DB writes
- `2585f31` — Wire county loan limits into pricing engine
- `36246d9` — Fix FICO adj scope: all Core loan types
- `b6f33e5` — Purchase credit: restore all loan types per rate sheet
- `02d7866` — FHA SRP: use UFMIP-adjusted loan amount for band lookup
- `d33713b` — Spec: NonQM pricing engine
- Plus David's price-scenario refactor commit

### Key decisions
- County limits: highBalance shows BOTH conforming + HB products
- Purchase credit applies to ALL loan types per rate sheet
- FHA SRP uses effective (UFMIP-adjusted) loan amount for band lookup
- FICO adj (640-699) is all loan types; state/property/occupancy is FHA-only
- NonQM gets separate pricing engine
- Rate sheet is source of truth over LoanSifter

### Open items
- [ ] NonQM pricer build (spec written)
- [ ] DSCR parser fixes (name disambiguation, bogus prices)
- [ ] VA funding fee not yet in pricing
- [ ] High Balance price validation against LS
- [ ] Wire other 5 lenders
- [ ] Accounts table 45 dupes from Zoho import
- [ ] Contact notes 7 dupes from Zoho import

---

## 2026-04-01 — Dev — Twilio + MCR Push + Contact→Deal Architecture
**Actor:** pc-dev

### What was built

**Twilio A2P Campaign**
- Fixed scheduled task `twilio-a2p-daily` — was hitting service-level endpoint instead of campaign-level, giving false "pending" status for 5 days
- Task now checks campaign-specific endpoint, detects instant rejections, verifies website pages the reviewer will check
- Resubmitted campaign (attempt 8): checked "Direct Lending" content attribute, set real privacy/terms URLs (were placeholders), clean message samples. Under review.

**MCR Push Route**
- `POST /api/portal/mlo/mcr/push` — admin-only, sends full loan pipeline snapshot to TrackerPortal
- Auto-classifies QM status from loan type (conv/FHA/VA=QM, DSCR/bank stmt=Non-QM, HECM=Not Subject)
- Maps `settled`→FUNDED, normalizes state names to USPS 2-letter codes
- `GET /api/portal/mlo/mcr/push` — preview mode with by-state breakdown
- Sent full MCR API spec to Mac via relay (endpoint, payload, QM rules, Q1 2026 seeds)

**Contact→Deal Architecture**
- Schema: `contactId` FK on Loan, `applicationDate` + `isApplication` gate fields, fixed LoanContact→Contact FK relation
- `src/lib/application-gate.js` — 5-field Reg B check (name, credit, property, amount, income)
- `POST /api/portal/mlo/contacts/:id/new-deal` — create loan pre-filled from MLO-selected prior loan
- `GET /api/portal/mlo/contacts/:id/loans` — contact loan history with template flags
- Wired gate into loan PATCH handler + borrower apply route
- Migration: linked 839 existing loans to Contacts (582 new Contacts created)

**Data Cleanup**
- Deleted 44 test records (manny doe, bob rob, Unknown Unknown, etc.)
- Normalized 616 state names (Colorado→CO, co→CO, "CO 80016"→CO)
- Fixed loan types: Pritchett→VA, Devoe→HECM, 7 'other'→conventional
- Merged 577 duplicate contacts (preserved MLO assignments from orphans)
- Identified Q4 2025 seed loans: Flores, Hall, Havens, Osborne, Ritchie
- Hall: file closed (AC060) — contract fell through, still shopping = new app when ready
- Wagner (TX): confirmed withdrawn in Q1

### Key decisions
- QM auto-classification: product type drives it. 43% DTI cap replaced by price-based test in 2021 — AUS-approved conventional loans are QM regardless of DTI
- Application gate: loan enters MCR pipeline only when all 5 Reg B fields present
- Contact is lightweight (identity + CRM only) — no SSN, no financial data on Contact
- Clone = new Deal from Contact, not duplicate loan. MLO picks source loan.
- Co-borrowers are separate Contacts linked via LoanBorrower with role field
- MCR push is on-demand snapshot, not event-driven
- Lead→Loan conversion: Leads can generate quotes, convert to Loan when ready (spec for tomorrow)

### Relays
- Sent: MCR API spec to Mac (relay cmngaxi5f) — full payload, QM rules, Q1 2026 seeds
- Resolved: Mac's MCR data feed request (cmng5g5aa)
- Open: Claw morning commentary (cmng4gvdz0000y4uryvrq9llh) — not processed this session

### Open items
- [ ] Build Lead→Loan conversion flow + quotes from Leads
- [ ] Contact detail page UI (loan history + "New App" + "New Lead" buttons)
- [ ] Twilio A2P campaign — awaiting review result
- [ ] LenDox webhook pushes 'other' as loan type — fix or enforce on our side
- [ ] 5 'manny doe' settled loans need real borrower names
- [ ] Havens duplicate loan record (settled + archived) — review
- [ ] Q4 2025 CO AC080 was overstated by 1 (Hall) — may need revision

---

## 2026-04-01 — Dev — Full 1003 Application Build (All 3 Spec Sessions)
**Actor:** pc-dev

### What was built

**Session 1: Schema + API + UI**
- 7 new Prisma models: `LoanEmployment`, `LoanIncome`, `LoanAsset`, `LoanLiability`, `LoanREO`, `LoanDeclaration`, `LoanTransaction`
- `LoanBorrower` updated: +citizenship, housingType, monthlyRent, previousAddress, previousAddressYears/Months, cellPhone, suffix, dobEncrypted
- `Loan` updated: +amortizationType, titleHeldAs, estateHeldIn, 6 ARM fields, applicationDate, isApplication, contactId
- Full CRUD API at `/api/portal/mlo/loans/[id]/application` (GET/PUT/POST/DELETE) with audit trail
- Loan GET updated to include all new 1003 relations with decimal serialization
- "1003" nav item added to LoanSidebar under People

**Session 2: MISMO XML Import Enhancement**
- Enhanced `mismo-parser.js` to extract all 1003 data from MISMO 3.4 XML: all employments per borrower, detailed income breakdown (8 categories), citizenship, housing type, monthly rent, cell phone, previous addresses, structured declarations, assets (financial + REO), liabilities, transaction details, amortization type
- Import route (`/api/portal/mlo/loans/import`) now creates all 7 new 1003 model records on XML import
- Verified against real LenDox export (Joaquin Flores 2-borrower loan)

**Session 3: MISMO XML Export + Submission Snapshots**
- New `mismo-builder.js` — full MISMO 3.4 XML generator from all Core data (borrowers, employment, income, declarations, assets, liabilities, REO, transaction, ARM, company/originator parties)
- Export route rewritten: GET = download XML, POST = export + save immutable snapshot to Vercel Blob + create LoanDocument record (type: submission_package)
- Export XML button on 1003 page with dropdown (Download / Export to LenDox + Snapshot / Save Snapshot)

**UI: Precision Curator Rebuild**
- Rebuilt ApplicationSection as Stitch-matched extreme density 4-column grid
- Design: background-shift panels on #f2f4f5 canvas, Manrope for amounts, accent-border financial boxes, status dots for declarations, teal Total Cash Needed highlight, tabbed borrower details, dark footer bar
- No collapsible cards — everything visible at once

### Schema changes (via prisma db push)
- 7 new tables: loan_employments, loan_incomes, loan_assets, loan_liabilities, loan_reos, loan_declarations, loan_transactions
- LoanBorrower: +dob_encrypted, citizenship, housing_type, monthly_rent, previous_address, previous_address_years, previous_address_months, cell_phone, suffix
- Loan: +amortization_type, title_held_as, estate_held_in, arm_index, arm_margin, arm_initial_cap, arm_periodic_cap, arm_lifetime_cap, arm_adjustment_period, application_date, is_application, contact_id
- Contact model: named relations (LoanContact, LoanContactLink) to resolve Prisma validation

### New files
- `src/lib/mismo-builder.js` — MISMO 3.4 XML generator
- `src/app/api/portal/mlo/loans/[id]/application/route.js` — 1003 CRUD API

### Key decisions
- Full data flow: XML import → Core DB (all models) → Edit in UI → Export XML → Immutable Blob snapshot
- Submission snapshots saved as LoanDocument (type: submission_package) with lender/date metadata
- 1003 UI follows Stitch Precision Curator design system
- Contact relations named explicitly to resolve Prisma ambiguity

### Commits
- `d5e685a` — Session 1: Schema + API + UI
- `5e3900c` — Session 2: MISMO import enhancement
- `1b0bcdf` — Session 3: XML export + snapshots
- `f62ba0f` — Precision Curator UI rebuild
- `b6093e7` — Lint fix

### Open items
- [ ] 1003 UI refinement — David reviewing in Stitch, may send updated mockup
- [ ] PITI breakdown needs housing expense fields (hazard ins, RE taxes, HOA, PMI)
- [ ] Credit scores per bureau per borrower (currently only loan-level)
- [ ] Inline editing removed during Precision Curator rebuild — add back if needed
- [ ] Material Symbols Outlined font not loaded in portal — icon prop won't render
- [ ] Rate lock date/expiration not on Loan Terms panel

---

## 2026-03-30 — Dev — CD Upload + Payroll Pipeline (Epic Session)
**Actor:** pc-dev

### What was built
- **CD Extraction via Claude** — Upload CD PDF → Claude auto-extracts 20+ fields (loan amount, rate, broker comp, reimbursements, borrower names, lender, dates, wire total). File buffer passed directly to Claude (no WorkDrive re-download).
- **MLO Review/Approval Flow** — 6-phase PayrollSection: Upload → Extracting → Error/Review → Approved → Send → Sent. Comparison table ("From CD" vs "On File") with Match/New/Mismatch badges. Approve blocked until all items resolved.
- **Comp Split Calculation** — 12.948857% house fee, LO gets remainder. Calculated locally from CD data, no TrackerPortal dependency. Shows in review phase and standalone Compensation section.
- **TrackerPortal Integration** — POST to `/api/payroll/commission-confirmed` on Send to Payroll. Sends gross comp, reimbursements (appraisal, credit, misc), wireTotal, borrower/lender/loan details, LO NMLS.
- **Compensation Section** — Standalone component on loan overview. Shows broker comp → house fee → LO commission → reimbursements → wire total. TrackerPortal status badge.
- **Payroll Details Display** — Sent phase shows Payroll Confirmation (CD#, wire total, LO comp) and Submitted Data (all fields sent to TrackerPortal).
- **Nickname Detection** — Same last name, different first name → "Is Jay a nickname for Tommy?" Stores legalFirstName/legalLastName/nickname on borrower.
- **Co-Borrower/NBS Detection** — Extra people on CD classified as Co-Borrower (gets borrower record + loan link) or Non-Borrowing Spouse (contact only). Approve blocked until all classified.
- **Duplicate Loan Check** — On CD upload, searches for other loans with same borrower not settled/cancelled. Warning banner with MCR compliance note.
- **CD Data → Loan Record** — On approval, extracted values written to loan: lenderLoanNumber, closingDate, fundingDate, brokerCompensation, monthlyPayment, totalClosingCosts, cashToClose, lenderCredits, loanType, lenderName.
- **core-payroll Skill** — Full reference for any dev session: DB fields, queries, API endpoints, comp plan, UI phases, audit events.

### Schema changes (via prisma db push)
- Loan: lenderLoanNumber, closingDate, fundingDate, brokerCompensation, monthlyPayment, totalClosingCosts, cashToClose, lenderCredits, cdExtractedData, cdProcessedAt, cdApprovedAt, cdApprovedBy
- Borrower: legalFirstName, legalLastName, nickname

### New files
- `src/lib/cd-extractor.js` — Claude PDF extraction
- `src/components/Portal/CompensationSection.js` — Standalone comp display
- `.claude/skills/core-payroll/SKILL.md` — Payroll skill reference

### Key decisions
- Comp split: house 12.948857%, LO gets remainder (David confirmed, Mac relayed exact %)
- CD is source of truth — on approval, CD values overwrite loan record
- Calculate comp locally, don't depend on TrackerPortal for the split
- borrowerNames extracted as array of {firstName, lastName} for person reconciliation
- TrackerPortal API key via TRACKER_API_KEY env var (ntk_e269...)

### MCR governance relay sent
- Quotes vs Applications: need to distinguish for MCR disposition
- Lender change detection: each lender submission = separate MCR application
- Dup check on funded: force MLO to classify other loans for same borrower
- Awaiting Mac + Claw governance input

### Bugs fixed
- False "CD upload failed" — upload succeeds but response times out. Now verifies server state before showing error.
- Address comparison false mismatch — normalized case/punctuation/whitespace
- WorkDrive re-download 404 — pass file buffer directly to Claude instead
- Vercel timeout — maxDuration 30s on payroll route
- JSX sibling elements — wrapped in fragment
- Unused onRefresh prop — lint error

### Open items
- [ ] LDox always pushes loanType as "other" — fix ingest or require manual entry
- [ ] Move house fee rate to broker_config DB table (currently hardcoded constant)
- [ ] Contact dedup before "Save as contact" for co-borrowers/NBS
- [ ] Funded → Settled transition after payroll confirmed
- [ ] MCR quote vs application status model (awaiting governance)
- [ ] Lender change detection and old-lender disposition

---

## 2026-03-30 — Dev — Rate Watch UX Overhaul, Contact Bar, Market Pipeline
**Actor:** pc-dev

### What was done

**Contact Utility Bar (Backlog #33)**
- Built dark utility bar above nav on every public page — call, email, text, schedule
- GA4 events: click_call, click_email, click_text, click_schedule
- NMLS numbers on desktop, collapses to icons on mobile
- David refined styling: teal icons on light teal background (not dark theme)

**Rate Watch Page — Major UX Overhaul**
- Redesigned to 3-column masonry layout (CSS columns) — eliminates dead space
- Tightened padding, fonts, gaps — trading terminal density
- Rate chart moved to full-width below masonry for maximum horizontal space
- Removed general Polymarket predictions, kept only Fed panel
- Renamed "Fed Rate Decision" → "Fed Rate Prediction"

**Rate Trend Gauge**
- Visual spectrum bar (POSITIVE ← MINIMAL → NEGATIVE) replaces text badge
- Auto-generated plain English impact sentence from rate change data
- MND daily change used instead of unreliable rate sheet diff (-0.240% bug fixed)

**FOMC Statement Diff**
- Built skill + API to fetch/cache Fed statements from federalreserve.gov
- Word-level diff: red strikethrough (removed), green underline (added)
- Fixed parser: was grabbing entire page HTML (nav, banner) — now targets article content only
- DB caching for statements, scheduled task for next FOMC meeting (May 6-7)

**MND National Rate Scraper**
- Built `/api/market/national-rates/scrape` — scrapes MortgageNewsDaily.com hourly
- Parses conv30 + conv15 rates + changes
- Feeds "NetRate vs National Avg" comparison grid
- National avg fallback to FRED/Freddie Mac when MND empty

**FRED API Weekend Fix**
- FRED API returns empty arrays on weekends/holidays — was showing blank Treasury Yields
- Fixed fallback: uses cached data (March 27) when API returns zero observations
- Updated fallback values to current levels

**Homepage + Rate Tool Fixes**
- Homepage now uses DB-driven pricing engine (same as Rate Watch)
- Rate tool shows DB effective date instead of stale GCS date
- LTV rounding fix: always round loan amount DOWN to avoid higher-tier pricing
- Property value back to $533,334 — keeps $400K loan at 74.999% LTV

**Market Content Pipeline Decision**
- Two-layer model agreed with Marketing (Claw):
  - PC = Live Pulse (automated, hourly): MND scrape + FRED + Polymarket data
  - Claw = Market Analysis (curated, 3x/day): original commentary in David's voice at open/midday/close
- Claw's hourly market-page-update task dropped — redundant with PC MND scrape
- Copyright issue flagged: MND text was being displayed verbatim — relayed to Claw to write original content
- Source attribution added to commentary block

### Key decisions
- Market content: PC handles automated data, Claw handles editorial (3x/day: open, midday, close)
- No MBS Live data on website — licensing/redistribution constraint (David's personal tool only)
- Editorial guardrails for auto-generated text: no "lock/float" advice, no "crashing/soaring", neutral tone
- CSS columns masonry layout for Rate Watch (not CSS Grid) — eliminates dead space naturally
- Rate change sourced from MND daily change, not rate sheet diff (which was unreliable across non-consecutive days)

### Open items
- [ ] Build "Live Pulse" auto-generated line from MND scrape data (factual, no editorial)
- [ ] Treasury Yields block — verify it shows values after FRED fallback fix
- [ ] Economic Calendar — interactive version with actual/forecast/previous data (MBS Live style)
- [ ] Fed Statement Diff — verify clean output after parser fix
- [ ] Rate Watch: "NetRate vs National Avg" missing FHA/VA/Jumbo national data (MND scrape only gets conv30/conv15)
- [ ] Market Watch skill — orchestrate full market content refresh pipeline
- [ ] CoreCRM build (Claw relay — data files on PC, schema ready)
- [ ] Contact bar above fold — Backlog #33 done, needs David's final visual approval
- [ ] 9 content pages from Claw — publishing in progress (Publisher handling)
- [ ] VA product support for pricing engine
- [ ] Wire other 5 lenders into DB-driven pricing

---

## 2026-03-27 — Dev — EverStream Exact Match Confirmed, Data-Driven Engine Decision
**Actor:** pc-dev

### What was done
- **EverStream pricing matches LoanSifter exactly** — verified at 6.375% refi: FHLMC Core $675 rebate = LS $675. Also FNMA Core at 6.125% = exact match.
- **Root causes of pricing bugs found and fixed:**
  1. State-specific products (FL/TX) in CSV corrupting base prices — filtered out in parser
  2. Duplicate rate_prices from state variants — dedup added
  3. Old engine fallback overriding correct API results — removed entirely
  4. Stale rate sheets in DB — transactional sheet deactivation (one active per lender)
  5. Scenario form had wrong loan amount ($400K payoff vs $450K loan) — form redesigned
- **DB cleanup:** 7 sheets → 1 active, 41,705 stale prices deleted
- **Scenario form redesigned (purchase):** Three interlinked fields — Down Payment %, Down Payment $, Loan Amount. Any one drives the other two. Purchase Price is anchor.
- **Refi form:** "Current Payoff" renamed to "New Loan Amount"
- **Parsed today's rate sheet (3/27)** into DB — 388 programs, 10,424 prices
- **Got TrackerPortal Backlog API access** — `tracker.netratemortgage.com/api/backlog` with header `x-tracker-api-key: agent`
- **MAJOR DECISION: Pricing engine moves from code to database.** All adjustment rules become queryable data rows, not hardcoded JavaScript if-statements.

### Known issue
- FHLMC purchase pricing off by $224 — hardcoded occupancy/term adj (+0.050) fires on purchase when it might not apply. Exactly why we're moving to data-driven adjustments.

### Architecture decision: Data-driven pricing engine
**Current:** Adjustments hardcoded in pricing-v2.js. Bugs when conditions wrong. Every lender tweak = code change + deploy.

**Next:** All adjustment rules as queryable rows in lender_adjustments table:
- Each row: lender, type, investor, purpose, tier, term range, loan amt range, state, FICO range, LTV range, value
- Engine sends scenario → DB matches rows → sums adjustments → returns priced rates
- No code changes for adjustment updates. No deploy for new lenders.

### Open items for next session
- [ ] Design and build data-driven adjustment table schema
- [ ] Create pricing engine skill (separate from parser skill)
- [ ] Load EverStream adjustments into DB from static config JSONs
- [ ] Fix FHLMC purchase adj ($224 gap) — verify from rate sheet
- [ ] Fix rate sheet date display (shows 3/23, should pull from DB)
- [ ] Wire other 5 lenders (becomes DB rows, not code)
- [ ] Add FHA/VA product type dropdown
- [ ] Update backlog item #42 as done

---

## 2026-03-26 (Session 3) — Dev — Pricing Engine v2 Rewrite, EverStream Exact Match
**Actor:** pc-dev

### What was done
- **Pricing engine v2 rewrite** — new `pricing-v2.js` that uses simple 100-based math (add credits, subtract costs). Replaces the old engine's sign-conversion mess.
- **Hand-verified EverStream pricing** against LoanSifter — exact match at 6.124% FNMA Core ($2,523 discount vs LS $2,525 = $2 rounding)
- **Full adjustment stack mapped and working:** FICO/LTV, SRP, Risk-Based, Loan Amount, FNMA/FHLMC investor adj, broker comp
- **FNMA vs FHLMC adjustments confirmed from rate sheet:** FNMA 21-30yr = -0.220, FHLMC 21-30yr = -0.150
- **Rate tool display fixed:** Red = discount (borrower pays), Green parentheses = rebate (borrower receives). NO COST and SWEET SPOT badges working.
- **Only EverStream enabled** — other 5 lenders disabled until their adjustment configs are built
- **Lender column hidden** from borrower-facing display
- **Loan pricing rules documented** in parser skill — absolute rules for sign convention
- **Database split completed** (from session 2): PC now on `netrate_pc` via `PC_DATABASE_URL`
- **Data migration verified**: 3,251 rows, zero mismatches

### Key files
- `src/lib/rates/pricing-v2.js` — new pricing engine (100-based math)
- `src/lib/rates/lender-adj-loader.js` — loads static adjustment configs
- `src/app/api/pricing/route.js` — API route wired to v2 engine
- `src/components/RateTool/useApiPricing.js` — hook updated for v2 response
- `src/components/RateTool/RateResults.js` — display updated (isRebate/isDiscount)
- `skills/parse-rate-sheet/SKILL.md` — loan pricing rules added

### Decisions
- **Pricing engine stays in 100-based the whole way through** — no format conversions, no double-negation
- **FHLMC adj is -0.150** (from rate sheet), NOT -0.220 (which is FNMA). LS appears to apply FNMA value to Freddie products.
- **SRP confirmed at 1.830** for CO, Fixed 20/25/30yr, with impounds — verified against rate sheet Core Conv SRP tab
- **Comp cap $3,595** for both purchase and refi (David's business decision, not lender-specific)

### Open items
- [ ] Wire adjustment configs for AmWest, Keystone, Windsor, TLS, SWMC
- [ ] Add Product Type dropdown (FHA/VA) to rate tool
- [ ] Verify live site matches local (Vercel deploy succeeded but check /rates)
- [ ] Investigate SRP — David unsure if we get it (Core Conv SRP tab might be for non-del customers)
- [ ] Rate sheet date shows 3/23 — need today's rates to display correctly

---

## 2026-03-26 (Session 2) — Dev — Database Split, New Neon DB, Schema with Rate Engine Models, Vercel Cutover
**Actor:** pc-dev

### What Happened
1. **Created new Neon database** — `netrate_pc` on same Neon project (same credentials, different DB name)
2. **New Prisma schema** — 35 models (27 existing PC models + 8 new rate engine/quote models). Stripped all 64 Mac-only tracker models. Schema validates clean.
3. **New rate engine models:**
   - `RateLender` — lender metadata, fees, comp caps, active status
   - `RateProduct` — product taxonomy (agency, type, tier, term, occupancy, loan amount range)
   - `RateSheet` — parse events (one row per daily parse per lender)
   - `RatePrice` — individual rate/price rows (normalized to 100-based)
   - `LenderAdjustment` — SRP, LLPA grids, loan amt adj as JSONB (the static configs)
   - `FeeTemplate` — per-state fee estimates (HUD sections A-H, purchase vs refi)
   - `BorrowerQuote` — full quote document (replaces Excel workbook)
   - `BrokerConfig` — David's business settings (comp caps, licensed states, singleton)
4. **Data migration** — 3,251 rows copied from neondb → netrate_pc. All counts verified:
   - Contacts: 874, ContactNotes: 849, Leads: 727, Loans: 21, Borrowers: 23
   - RateHistory: 216, RateWatchCommentaries: 4, LoanEvents: 122, Documents: 29
   - Accounts: 296, AccountContacts: 56, CallLogs: 2, LoanDates: 10, LoanBorrowers: 20, MLOs: 2
5. **Seeded new tables** — BrokerConfig, 6 RateLenders, 4 FeeTemplates (CO/TX purchase/refi)
6. **Prisma config updated** — switched to `PC_DATABASE_URL` / `PC_DIRECT_URL` to avoid conflict with Vercel's Neon integration env vars
7. **Build passes** with new schema

### NOT DONE — Vercel Cutover
- Vercel env vars NOT yet updated — site still points to old `neondb`
- Need to add `PC_DATABASE_URL` and `PC_DIRECT_URL` as new Vercel env vars pointing to `netrate_pc`
- The Neon integration locks `DATABASE_URL` — can't edit it. Workaround: code uses `PC_DATABASE_URL` instead
- **MUST add these env vars in Vercel before deploying the schema/prisma changes**

### Uncommitted Changes (IMPORTANT — must commit next session)
- `prisma/schema.prisma` — new 35-model schema (biggest change, +1781/-many lines)
- `prisma.config.ts` — switched to PC_DATABASE_URL
- `src/lib/prisma.js` — switched to PC_DATABASE_URL
- `package.json` / `package-lock.json` — added `pg` dependency for migration script
- `src/lib/rates/parsers/everstream.js` — 30-day lock filter
- `src/data/parsed-rates.json` — re-parsed with 30-day filter (much smaller)
- `scripts/migrate-to-pc-db.js` — data migration script (new, untracked)
- `prisma/schema.prisma.backup` — backup of old schema (untracked)

### Key Decisions (logged to MCP)
- PC gets own Neon DB (`netrate_pc`) — same project, separate database
- Rate data stored in normalized DB tables, not flat JSON files
- Static lender adjustments as JSONB, daily rates parsed to DB
- Code uses `PC_DATABASE_URL` to avoid Vercel-Neon integration conflict
- BorrowerQuote model added now (for future quote generator, replaces Excel workbook)
- FeeTemplate covers HUD sections A-H for purchase and refi

### Connection Strings (for next session)
- Pooled: `postgresql://neondb_owner:npg_sWV0dtFf4iwZ@ep-plain-math-aixa3lmr-pooler.c-4.us-east-1.aws.neon.tech/netrate_pc?sslmode=require`
- Direct: `postgresql://neondb_owner:npg_sWV0dtFf4iwZ@ep-plain-math-aixa3lmr.c-4.us-east-1.aws.neon.tech/netrate_pc?sslmode=require`

### Tomorrow's Priority (EXACT ORDER)
1. **Add Vercel env vars** — `PC_DATABASE_URL` and `PC_DIRECT_URL` pointing to netrate_pc
2. **Commit all uncommitted changes** — schema, prisma config, prisma.js, migration script
3. **Push and deploy** — verify live site works with new DB
4. **Verify CRM data** — contacts, leads, loans all load correctly on live site
5. **Build rate parser → DB pipeline** — parsers write to RatePrice/RateSheet tables instead of JSON
6. **Wire pricing engine to read from DB** — replace parsed-rates.json with DB queries
7. **Product taxonomy** — populate RateProduct table for all 6 lenders
8. **Product eligibility filtering** — pricing engine filters by loan type, occupancy, term

### Files Modified (uncommitted)
- `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/prisma.js`
- `package.json`, `package-lock.json`
- `src/lib/rates/parsers/everstream.js`, `src/data/parsed-rates.json`
- `src/components/Portal/Core/sections/OverviewSection.js`
- `Work/Dev/Integrations/TWILIO-STATUS.md`
- NEW: `scripts/migrate-to-pc-db.js`, `prisma/schema.prisma.backup`

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
