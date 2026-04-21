# FoH April — Audit + UAD Spec

**Status:** Active · D1 ✅ re-verified · D2 ✅ fully closed · D3 ✅ re-verified · D4 ✅ re-verified · D5 ✅ closed (absorbed into D9a) · D6 ✅ complete (PR 14 drop shipped 2026-04-21) · D7 ✅ core shipped (IA redesign deferred) · D8 ✅ inventory complete; remediations streamed into D7 + vocab audit · D9 🔄 D9a ✅ complete; D9b 7/13 shipped (.1–.7); D9c/d/e queued
**Name:** FoH April (Front-of-House April 2026) — the combined audit + UAD effort, David-named 2026-04-17. Formerly "Site Audit 2026"; audit (retrospective) + UAD (prospective) are one continuous effort.
**Current driver:** PC Dev (`zen-sammet-6cf8be` worktree)
**Last updated:** 2026-04-21 (v1.9 — D6 PR 14 shipped same day as v1.8 refresh. Migration 018 dropped `borrower_quotes` + `saved_scenarios`; `scenario_alert_queue` FK retargeted to `scenarios`. First live use of the Neon-branch rehearsal protocol documented in DEV-PLAYBOOK.md — rehearsal + prod runs both clean, 4/4 statements OK, 0 orphans.)
**Canonical location:** this file

> One audit. One spec. One driver at a time. Everything else defers to this doc.

---

## 1. Purpose

This is the single coordination point for the NetRate Mortgage site audit. It answers:

- What's been audited and remediated (the **completion ledger**)
- What dimensions of quality we're auditing against (the **dimensions**)
- What's left to do (the **queue**)
- Who's driving right now (the **driver rule**)
- How multiple agents / sessions coordinate without colliding
- When the audit is declared done (the **success criteria**)

The audit started April 14, 2026 as a comprehensive every-line-of-code pass on the portal modules. It has expanded since as new dimensions surfaced. It is one continuous effort — not two audits, not separate initiatives.

## 2. Vocabulary

- **Audit** — the umbrella activity. Covers everything in this spec. Produces both findings and remediations. "The audit" is not just cataloging.
- **Finding** — something the audit identifies as wrong, stale, duplicated, or risky. Findings do not imply fixes. An inventory pass produces findings.
- **Remediation** — a code change that resolves one or more findings. Remediations are part of the audit, not a separate activity. They ship as PRs.
- **Inventory pass** — a structured walk-through of a specific surface of the site that produces a durable catalog of findings. Inventory passes do not ship code.
- **Dimension** — a category of audit concern (e.g., security, static data). A dimension has its own completion state independent of the others.
- **Driver** — the one session with write authority over the audit at a given moment. See §4.
- **Surface** — a bounded set of files/pages (e.g., "homepage + hero rate card," "DSCR calculator," "/api/pricing route"). Inventory passes are scoped by surface.

## 2b. Interleave vs batch

**Default: interleave.** Inventory a surface, ship PRs against its findings, move on. This is how D1–D5 ran and it worked.

**Batch (catalog all passes before remediating) only when:**

1. The remediation requires a **schema decision** that benefits from cross-surface visibility (e.g., `ref_fha_ufmip` + `ref_county_loan_limits` — don't design the table around one pass's needs).
2. The remediation is a **duplicated rule** appearing in ≥2 surfaces; you want to see all copies before extracting a single source. (PR #73's `pick-par-rate.js` was premature precisely because of this — extracted without auditing the other consumers.)
3. The finding is **cosmetic or low-risk** and bundling it with higher-priority work in the same surface is cleaner.

**Ship immediately when:**
- Security hole
- Financial correctness bug
- Data integrity issue
- Silent borrower-facing fallback to stale data
- Any finding that only touches one surface and doesn't compete with an active remediation

In practice most D8 findings ship immediately. The batch candidates are called out explicitly in the queue (§7) and cross-reference table (§9).

## 2c. Re-architecture deference

Added 2026-04-16 after batch 1 D8 inventory surfaced mostly findings that D9 (UAD) will naturally absorb. This rule constrains §2b.

**Default: defer to D9 remediation when D9 (UAD) will naturally absorb a finding.**

Write the finding into its inventory doc with its proposed D9d table or D9-layer mapping. Do not patch hardcoded values that D9d will delete and replace with DB reads — the patch is throwaway work, and a few weeks of "continued wrongness" is usually cheaper than duplicate effort.

**Ship immediately anyway when ONE of these is true:**

1. **Security-critical** — data leak, auth bypass, credential exposure, injection. No exceptions.
2. **Actively harming real users *right now*** in a way that can't wait weeks for D9. Test: is this wrong output on *every* borrower hit, or is it fallback-path-only / edge-case-only? The former qualifies; the latter defers.
3. **Observability / tooling work that survives D9 intact** — health-check coverage, monitoring, logging. D9 doesn't touch these surfaces, so today's fix is not thrown away.

**Worked examples from 2026-04-16 triage:**

| Finding | Shipped now? | Reason |
|---|---|---|
| D4 cross-org SMS leak (PR #80) | ✅ ship | Security-critical |
| CRON-2 + CRON-12 health-check gaps | ✅ ship | Observability survives D9 |
| HP-B6 DSCR comp cap $4,595 vs $3,595 | ⏭ defer | Fallback-path only — D9d absorbs into `ref_comp_caps` |
| REF-1 stale $726,200 high-balance threshold | ⏭ defer | Live pricer bug, but D9d absorbs into `ref_county_loan_limits` — accept wrong-categorization cost vs throwaway fix cost |
| REF-9 HECM UFMIP hardcoded in 3 places | ⏭ defer | Consistency-only (all 3 sites agree today) — D9d absorbs into `ref_hecm_config` |

**Enforcement:** Every D8 inventory pass must, for each finding, propose its D9 resolution path. Ship-immediately candidates are called out explicitly in the pass's "Ship-immediately candidates" section, with the §2c justification (which of the three criteria applies).

## 3. Scope

**In scope:**

- All code under `src/` — app routes, components, libraries, API endpoints
- All static data under `src/data/` and hardcoded constants inside `.js`/`.jsx` that behave like reference data
- Rate-sheet parsing, ingest, pricing engine, and all surfaces that display rates or scenarios
- Borrower portal, MLO portal, public marketing pages
- Scheduled tasks / cron / GitHub Actions that drive the site
- Schema.org markup and SEO metadata
- Deploy pipeline and environment configuration

**Out of scope:**

- TrackerPortal (separate product, separate audit if needed)
- MCP knowledge-layer schema
- Mac-side ops tooling (governed by its own audit on Mac)
- CoreBot / processing-layer code (not yet built)
- Third-party integrations' own code (Twilio, Zoho, Google Maps)

## 4. Driver rule

> **Exactly one session is the audit driver at any given time.**

- The driver's identity is written at the top of this doc (§ header: "Current driver").
- Driver handoff is explicit: the outgoing driver edits this doc in a PR, the incoming driver acknowledges by shipping the next audit-related commit under their session ID.
- **Non-driver sessions may:** read this doc, run inventory passes in their own worktrees, produce inventory docs, capture findings in this doc. Inventory work does not deploy and cannot collide.
- **Non-driver sessions may NOT:** ship remediation PRs that modify files currently under active inventory, or change this spec doc without coordinating with the driver.
- **If a non-driver urgently needs to ship unrelated code** (e.g., a content-page publish, a bug fix outside audit scope), they may do so — but must not touch files listed in any active inventory pass's "Files" section.

This rule does not replace the deploy lock or the worktree rules in `CLAUDE.md`. It adds a semantic layer on top of the mechanical ones.

## 5. Deploy + collision rules

All three layers apply:

1. **Driver rule (this doc, §4)** — semantic single-ownership of audit work.
2. **Deploy lock** (`.claude/deploy.lock`, see root CLAUDE.md) — mechanical protection against concurrent deploys.
3. **Worktree rules** (root CLAUDE.md "Concurrent Sessions Protocol") — gates 5–6 (merge, production confirm) only from the main session or GitHub UI.

Under these rules: even with two sessions awake, at most one can deploy, and usually only one is doing audit work at all.

## 6. Dimensions

The audit covers eight dimensions. Each dimension has its own completion state, scope, and artifacts.

### D1 · Security — ✅ re-verified (2026-04-16)

Every-line review for OWASP-class vulnerabilities, credential exposure, unsafe deserialization, missing auth guards.

- **Shipped:** PR #52 (security audit — 8 vulnerabilities patched across 27 files)
- **D0 verification (2026-04-16):** re-audit at [`D0-VERIFICATION-D1-SECURITY-2026-04-16.md`](./D0-VERIFICATION-D1-SECURITY-2026-04-16.md). All 8 PR #52 patches held at HEAD. No regressions from PRs #53–#79.
- **Residual findings (batched for follow-up PR, lower priority):**
  - 7 public/unauth routes still leak raw `err.message` (`strike-rate`, `saved-scenario`, `saved-scenario/update`, `pricing/dscr` ×2, `market/national-rates` ×2, `my-rates`)
  - `/api/my-rates:26` leaks matched-lead count in auth error message
  - ~11 MLO-protected routes leak `err.message` to authenticated callers (lower risk)
  - No rate limiting on public POSTs (`strike-rate`, `saved-scenario`, `pricing`, both `pricing/dscr` endpoints)
- **Deferred:** full security audit (plaintext secrets in `~/.claude` skill files, API key rotation, `~/.netrate/auth.json` pattern, repo-wide scan) — tracked as PLATFORM-2026 backlog item #73, P=medium.

### D2 · camelCase / snake_case consistency — ✅ fully closed (2026-04-16)

Surfaced because the DB uses snake_case and JS uses camelCase; early refactors left 12+ dead features where row access mixed conventions.

- **Shipped:** PR #53 (camelCase/snake_case migration — 12 dead features restored).
- **D0 verification (2026-04-16):** re-audit at [`D0-VERIFICATION-D2-CAMELCASE-2026-04-16.md`](./D0-VERIFICATION-D2-CAMELCASE-2026-04-16.md). PR #53 holds. Audited all 14 files using `@neondatabase/serverless` + sampled 109 files using `await sql\`` templates. **Zero residual raw-SQL camelCase bugs found** — the "12 residual files" note from session `cmo05mtfia6lu8877` was a false alarm (every `row.camelCaseName` pattern was safe: transformed output, session/body/API response, or parser/computation output). D2 dimension is closed, no secondary pass needed.

### D3 · Pricing engine correctness — ✅ done (re-verified 2026-04-15)

Financial correctness of `priceRate()` and the surrounding ingest pipeline. Catches math bugs, wrong-product pickups, double-counting, parser errors.

- **Shipped:** #41 (unify pricing engine, delete legacy JSON — ~405k lines removed), #42 diagnostic lender labels, #43 parser fixes, #44 debug mode toggle, #46 GitHub Actions rate parsing cron, #50 GCS idempotent tracking, #51 filter Jumbo products, #54 pricing engine financial correctness (5 bugs), #57 sheetDate fallback for Keystone/AmWest, #61 consolidate duplicate P&I calculations.
- **D0 verification (2026-04-15):** re-audit at [`D0-VERIFICATION-D3-PRICING-2026-04-15.md`](./D0-VERIFICATION-D3-PRICING-2026-04-15.md). Confirmed D3-shipped math is correct. Found one gap: `homepage-db.js` hard-failed on null `lenderAdj` instead of using the `EMPTY_ADJ` fallback that `price-scenario.js` uses — cascaded silently to the hardcoded `'5.875%'` fallback in `src/app/page.js:56`. Resolved in PR #77 (shared `src/lib/rates/empty-adj.js` module, both callers import).
- **Residual finding (parked to D8 Pass 2):** even after PR #77, the homepage conv30 display still differs from what `/api/pricing` produces for the same DEFAULT_SCENARIO (homepage: 5.875% / APR 5.88% · /api/pricing: 5.990% / finalPrice 100.345). Root cause is architectural — `homepage-db.js::priceProduct` runs its own mini-pricing path (different product filter, different lender selection via `LIMIT 1 ORDER BY effective_date DESC`, different brokerConfig shape) in parallel to `priceScenario()`. Two parallel pricing paths diverge. See D8 Pass 2 seed findings.
- **Out of scope:** DSCR pricer (separate domain, see D6), non-QM parsers (same).
- **Note:** D3 audited the *computation*. It did not audit the *inputs* to the computation for staleness — that's D8.

### D4 · Data integrity — ✅ re-verified (2026-04-16)

Ownership checks, foreign key enforcement, transactional boundaries, PII handling, display-layer hygiene.

- **Shipped:** #55 (data integrity — 7 issues patched), #56 (hide product names from public rate tool — show only in debug mode).
- **D0 verification (2026-04-16):** re-audit at [`D0-VERIFICATION-D4-DATA-INTEGRITY-2026-04-16.md`](./D0-VERIFICATION-D4-DATA-INTEGRITY-2026-04-16.md). 5 PR #55 patches verified correct. **2 critical new findings surfaced and shipped in PR #80:** (a) `GET /api/dialer/sms/threads` had no `organization_id` filter — cross-org SMS PII leak including plaintext message bodies; (b) `PATCH /api/portal/mlo/pipeline` bulk-cap guard was unreachable dead code due to brace scoping.
- **Residual (flagged for follow-up pass):** other routes under `src/app/api/dialer/**` also do not scope by `organization_id`. Only `/threads` was in the D4 audit scope; remaining dialer routes need their own audit pass.

### D5 · Org scoping — 🔄 half-done (first half re-verified, second half unshipped)

Multi-tenant readiness. Two halves: (1) organization_id on existing tables + route scoping, (2) unified identity model (users/roles/loan_users → now superseded by D9 UAD).

- **First half — shipped and verified:**
  - #58 (Organization schema, org_id on 13 core tables), #59 (org-aware auth, organizationId in MLO session), #60 (scope all 42 MLO API routes by organization_id).
  - D0 verification (2026-04-15): re-audit at [`D0-VERIFICATION-D5-ORG-SCOPING-2026-04-15.md`](./D0-VERIFICATION-D5-ORG-SCOPING-2026-04-15.md). Full route inventory (44 routes checked). Found one critical regression: `GET /api/portal/mlo/scenario-alerts` was missing the org filter on its scenarios JOIN, leaking cross-org scenario-alert queue items including joined borrower PII. Introduced in PR #68 after #60's sweep had already run. Resolved in PR #76 — both GET default view and PATCH approve/decline inner SELECT upgraded to `INNER JOIN scenarios s ... AND s.organization_id = ${orgId}`. All other 43 routes verified clean.
- **Second half — superseded by D9:** Mac's UAB directive (unified users + roles + loan_users, session cmo04p434kxp16tv7) was never actioned by PC. This work is now absorbed into D9 (UAD), which expands the scope from identity-only to the full data architecture (contacts, staff, deals, service providers, pricing unification). D5 will be marked ✅ when D9 Layer 1 ships with org_id on all new tables.

### D6 · Unified pricing / scenarios — ✅ complete (2026-04-21)

Collapse the separate borrower_quotes, saved_scenarios, and MLO quote storage into one scenarios table with scoped visibility. Extend to non-QM (DSCR).

- **Shipped:**
  - #63 unified scenarios schema (scenarios, scenario_rates, scenario_fee_items)
  - #64 backfill scenarios from legacy tables
  - #65 scenario DAL (CRUD + backward-compat transforms)
  - #67 migrate MLO quote APIs (PR 12)
  - #68 migrate borrower scenario + alert APIs (PR 13)
  - #69 Non-QM pricing schema (PR 15a)
  - #70 Everstream rate CSV + LLPA XLSX parsers + ingest (PR 15b)
  - #71 DSCR pricer module (PR 15c)
  - #72 DSCR rate page + calculator wired to live API (PR 15d)
  - **PR 14 (2026-04-21)** — migration 018 drops `borrower_quotes` + `saved_scenarios`. `scenario_alert_queue.scenario_id` FK redirected from `saved_scenarios.id` → `scenarios.id` before drop. Rehearsed on Neon branch per DEV-PLAYBOOK.md protocol before prod run. 56 rows (43 borrower_quotes + 13 saved_scenarios) already in `scenarios` via backfill preserved UUIDs. 70 alert queue rows preserved, 0 orphans post-run. Prisma schema cleaned (BorrowerQuote + SavedScenario models deleted, ScenarioAlertQueue relation retargeted to Scenario). 8 src/ docstrings updated away from legacy table names.
- **Outstanding:**
  - Core Non-QM LLPA parser (DSCR Plus + Expanded Prime Plus core tier adjustments) — follow-up to PR 15c. Narrow scope, tracked under D6 but not blocking D6 completion.

### D7 · MLO Portal UX — ✅ core shipped (IA redesign deferred)

Audit doc: [`D7-MLO-PORTAL-AUDIT-2026-04-20.md`](./D7-MLO-PORTAL-AUDIT-2026-04-20.md) — supersedes the aspirational "PRs 16–19" framing. Grounded in post-D9a current-state, surface-scoped + risk-ordered. 6 core PRs planned + IA redesign deferred.

- **Shipped (6/6 core PRs, 2026-04-20):**
  - PR D7-1 (#117) — pipeline dead `primary` Tailwind classes → `brand` (live visual bug) + slate→ink migration + PT-1 avatar hex
  - PR D7-2 (#120) — loan detail: deleted 1,470 LOC dead code (LoanDetailView.js + LoanDetailViewLegacy.js + DocumentList.js), new `src/lib/constants/doc-statuses.js`, ApplicationSection.js full brand+ink+go+surface retheme
  - PR D7-3 (#122) — picklist consolidation: new `ref_licensed_states` + `ref_loan_types` DB tables (migration 012), `src/lib/constants/picklists.js`, `src/lib/picklists/db-loader.js` + client hook, `/api/picklists` route, `src/lib/dates/quote-defaults.js`. Closes Pass 6 MLO-2/3/6/9/10.
  - PR D7-4 (#118) — FHA UFMIP single-source (new `src/lib/constants/fha.js`, 3 consumers updated; regulatory correctness)
  - PR D7-5 (#121) — lead detail action bar hierarchy (Convert to Loan = `go-primary`, Run/Generate = brand-outlined ghost, Save = neutral ghost), emoji→SVG icons, responsive grid, contact stage badge palette retheme
  - PR D7-6 (#119) — both borrower-facing PDFs rethemed (QuotePDF + PrequalLetterPDF) + PrequalLetterPDF logo swap (D-variation → canonical equal-parallel-slashes mirror of `src/app/layout.js`); DESIGN-SYSTEM.md got new "PDF Templates" section
  - Also (#123) — D7 LD-4/5 consolidation + `loans.status` prospect→draft (migration 013, 16 rows). loan-statuses.js canonical, 3 duplicate STATUS_LABELS maps deleted, added STATUS_COLORS_SOFT palette variant
- **Deferred to dedicated IA consultation session with David (IA-2 through IA-7):** Quotes nav disambiguation; "Backlog" nav placement; "Today"/Tasks/Calendar landing; tools submenu grouping; call history in nav; dark nav rail decision. Per audit §8 "Deferred — nav/IA redesign".
- **Small residuals parked for a follow-up polish PR:**
  - LE-3 product UX call (merge Run Quote + Generate Quote?)
  - HECM optimizer retheme (~7 files, large cyan surface)
  - Quote list / quote detail (QL-*) retheme
  - API response rename `borrower_*` → `contact_*` on `/api/portal/mlo/pipeline` + `/api/portal/mlo/loans/[id]`
  - `loan-states.js` (long-form) vs `loan-statuses.js` (short-form) STATUS_LABELS harmonization
  - `docs_out` teal-500 design token followup (flagged in audit)

### D8 · Static data / stale-by-deploy — 🆕 inventory phase (batch 1 complete)

Catalogs data that is baked into the deploy and becomes stale without code intervention. Includes hardcoded reference values, bundled data files, duplicated business rules, and silent-fallback-to-stale patterns.

**Inventory passes complete (1/2/6/7/8):**

- **Pass 1 · Pricer scenario flow** — ✅ done. See [`PRICER-STATIC-DATA-INVENTORY-2026-04-15.md`](./PRICER-STATIC-DATA-INVENTORY-2026-04-15.md). 5 findings (A1, A2, B1, B2, B3). Cross-referenced in §9.
- **Pass 2 · Homepage + UI components** — ✅ done 2026-04-16. See [`PASS-2-HOMEPAGE-UI-INVENTORY-2026-04-16.md`](./PASS-2-HOMEPAGE-UI-INVENTORY-2026-04-16.md). Expanded scope: par-picker is duplicated in **4 callers with different semantics**, not 2. **Live pricing bug HP-B6** — DSCR comp cap $4,595 (dscr-calculator) vs $3,595 (homepage-db fallback). 6 marketing pages with outdated rate examples. 23 per-page JSON-LD blobs duplicating schema. 2 "Locus Mortgage" URL refs still live. Per §2c: HP-B6 deferred to D9b (fallback-path only, D9d absorbs comp caps into ref table).
- **Pass 6 · MLO portal** — ✅ done 2026-04-16 (blocks D7). See [`PASS-6-MLO-PORTAL-INVENTORY-2026-04-16.md`](./PASS-6-MLO-PORTAL-INVENTORY-2026-04-16.md). 15 findings (3 Critical, 4 High, 3 Medium, 5 Low). Status picklist duplicated in 5+ files with divergent color palettes (MLO-1/4/5). Loan type picklist diverges 3 ways (MLO-2/3/6). `HOUSE_FEE_RATE` hardcoded in 2 places (MLO-8/12). FHA UFMIP hardcoded in QuoteScenarioForm JSX (MLO-11) duplicating Pass 1 B3. Per §2c: ~60% absorbed by D9 Layer 1 (status lifecycle, deal model); loan type + UFMIP are cross-layer and need remediation regardless.
- **Pass 7 · Scheduled tasks / cron / ingest** — ✅ done 2026-04-16. See [`PASS-7-SCHEDULED-TASKS-INVENTORY-2026-04-16.md`](./PASS-7-SCHEDULED-TASKS-INVENTORY-2026-04-16.md). 13 findings (5 High, 6 Medium, 2 Low-med). Top risk: MND scraper fragile HTML regex (CRON-1). 6 scheduled jobs with no observability — common pattern: cron returns 200 OK on partial/complete failure. `parse-gcs-rates.mjs` filename-date regex (`MMDDYYYY`) could silently produce wrong dates. Per §2c: CRON-2 + CRON-12 shipped (health-check observability survives D9).
- **Pass 8 · Reference data files** — ✅ done 2026-04-16 (feeds D9d). See [`PASS-8-REFERENCE-DATA-INVENTORY-2026-04-16.md`](./PASS-8-REFERENCE-DATA-INVENTORY-2026-04-16.md). 18 findings (REF-1 through REF-18). **13 proposed new `ref_*` tables for D9d**, grouped into 5 domains: loan limits (2), govt insurance (5), HECM pricing (3), geographic/tax (4), business scope (1). Key REFs: stale $726,200 high-balance threshold (REF-1, 2 years out of date), HECM UFMIP hardcoded in 3 sites not importing the constant (REF-9), prose-only VA funding fee disclosure (REF-8). **Explicit enum-vs-reference-data line drawn** — answers D9d scoping: `LOAN_TYPES`, `CONDITION_STAGES`, `DOC_PREFIXES`, MCR enums, org constants stay in code; externally-authored cadence-driven values → DB. Per §2c: all REF findings deferred to D9d remediation (consolidated schema design).

**Inventory passes complete (3/4/5) — batch 2 done 2026-04-16 (discovered 2026-04-17):**

- **Pass 3 · Marketing pages** — ✅ done 2026-04-16. See [`PASS-3-MARKETING-PAGES-INVENTORY-2026-04-16.md`](./PASS-3-MARKETING-PAGES-INVENTORY-2026-04-16.md). 40+ findings (MKT-A/B/C/D/E/F/G/H series). Key: illustrative rate ladders repeat across 3 files (MKT-D1/D2/D3); 43 marketing routes each emit their own `metadata` export (MKT-C1); `loan-limits-2025.json` still referenced during 2026 (MKT-E2); **MKT-COMP-1** CA disclosure was missing → shipped in PR #83.
- **Pass 4 · Schema.org + SEO markup** — ✅ done 2026-04-16. See [`PASS-4-SCHEMA-SEO-INVENTORY-2026-04-16.md`](./PASS-4-SCHEMA-SEO-INVENTORY-2026-04-16.md). 29 findings (SEO-1–29). Key: 17 JSON-LD scripts across 16 routes + root layout; 9 pages hardcode `datePublished: '2026-03-27'` (March content batch); 47 canonical URLs hardcoded absolute (domain change = 47 edits); **SEO-20** aggregateRating was missing → shipped in PR #83; Ahrefs "7 sitemap 3xx URLs" traced to DB-driven `content_pages` entries, not `next.config.js` (which is empty).
- **Pass 5 · Borrower portal + app flow** — ✅ done 2026-04-16 + refreshed 2026-04-17. See [`PASS-5-BORROWER-PORTAL-INVENTORY-2026-04-17.md`](./PASS-5-BORROWER-PORTAL-INVENTORY-2026-04-17.md) (newer, with UAD §7 module mapping) and [`PASS-5-BORROWER-PORTAL-INVENTORY-2026-04-16.md`](./PASS-5-BORROWER-PORTAL-INVENTORY-2026-04-16.md) (original). 13 findings (BP-1–13). Key: **BP-9 LOAN_TYPES picklist divergence** across 3+ UI surfaces (needs DB audit before ship); LTV/property-type/occupancy enum duplication (BP-2/5/6); STATE_DEFAULTS closing costs hardcoded (BP-1). **Key validation for D9 Layer 1:** 100% coverage of Application LITE field list against current intake wizard — Layer 1 does not require new intake-form work, only schema rename + FK rewiring.

**Ship-immediately candidates shipped:**

- **PR #80** (2026-04-16) — D4 cross-org SMS leak + pipeline bulk-cap (from D0 re-audit)
- **PR #81** (2026-04-16) — CRON-2 + CRON-12 health-check observability
- **PR #83** (2026-04-16) — company/auth constants + CA licensing (MKT-COMP-1) + aggregateRating (SEO-20) + Texas stale prose (MKT-B4) + SMS OTP auth constants
- **Pending small PR (2026-04-17, this worktree)** — GBP rename Locus→NetRate URLs (MKT-B2/SEO-17; 3 page sites centralized through `GBP_REVIEW_URL` constant), `/rates/dscr` added to sitemap (SEO-15a), `equity-without-losing-rate` meta historical framing (MKT-D4a), about-page `(2025)` year-label consistency (MKT-B3)

**Ship-immediately candidates parked awaiting data/DB-audit:**

- **BP-9** — LOAN_TYPES picklist divergence. Needs `SELECT DISTINCT loan_type` query across `scenarios` + `rate_products` tables to confirm a product is missing from UI. Ship after DB audit.
- **MKT-B3 volume/loans-funded numbers** — needs fresh 2026-YTD numbers from David OR continues as 2025-labeled historical stats (current state post-PR).

### D9 · Unified Architecture Directive (UAD) — 🆕 spec drafted

**Added 2026-04-16.** The foundational data architecture redesign for all front-of-house systems. Replaces the fragmented identity model (separate borrowers, mlos, contacts, leads tables) with a unified Contact + Deal + Scenario architecture. Absorbs the second half of D5 (UAB identity model) and expands scope to include pricing unification, composable quotes, reference data migration, and application module design.

- **Spec:** [`UAD-SPEC.md`](../UAD-SPEC.md) — full architecture decisions, data model, lifecycle flows, build layers.
- **MCP decision:** UAB logged as decision `cmo1igp2enjnw46ef` (searchable: "uab", "unified-architecture-baseline").

**Sub-dimensions:**

| ID | Scope | Status |
|----|-------|--------|
| D9a · Identity model | Lead → Contact → Deal lifecycle, contact roles (borrower/realtor), staff separation, service provider accounts + contacts | ✅ **complete.** Layer-1a #86 + 1b1 #87 + 1b2a #88 + 1b3 #90 + 1c #91 + lead conversion #93 + inbound webhook #92 + auto-email #94. Borrower table dropped; loan_contacts/mlos view dropped; loans.borrower_id → contact_id; scenarios.contact_id canonical. Soak: drop deprecated scenarios.borrower_name/email/phone columns ~2026-05-01 (8 days). |
| D9b · Pricing unification | One API entry point, product router, retire homepage-db.js parallel path, all surfaces use same engine | 🟡 **10 of 13 shipped.** D9b.3 retire homepage-db (#107), D9b.4 par-rule unification (#112), D9b.5 site_scenarios + D9b.6 surface_pricing_config (#114), D9b.7 homepage_rate_cache (#115), **D9b.8 sub-financing-comparison** verified closed via #109 — `src/components/calculators/SubFinancingComparison.js` is standalone (user enters rates, pure math, no pricer calls, no invented LLPA adjustments). **D9b.9 pricer-integrated tool defaults** (#130) — purchase-calculator, refi-analyzer, cost-of-waiting now SSR the default rate from `homepage_rate_cache` via 2-file pattern; 10-min ISR. **D9b.13 getFicoBand de-dup** (#___) — clarified that the `engine.js:getFicoBand` (UI display, fine-grained `>=800`/`780-799`) and `pricing-v2.js` band utility (LLPA lookup key, coarse `>=780` bucket) serve intentionally different purposes. Renamed pricing-v2's private function to `ficoBandKey` to eliminate the name collision; added JSDoc on both + `db-adj-loader.js` explaining the distinction so they never get merged. **Remaining: D9b.10** FHA_BASELINE_LIMIT derivation (pending D9d), **D9b.11** state closing-cost map → DB table. |
| D9c · Scenario/quote model | Scenarios link to Contact + Deal, composable calc modules, Layer 3 Lite (shareable quote links), borrower scenario save | 📋 spec drafted — queued after D9b wrap |
| D9d · Reference data migration | County limits, closing costs, PLF tables, comp caps → DB tables. D8 inventory findings feed this. | ⏳ schema design still pending; unblocks D9b.10 |
| D9e · Application modules | Clean segment model for deal data (borrower identity, employment, assets, property, loan, co-borrower, declarations), clone deal, Application LITE | 📋 spec drafted — queued |

**Scenario Vocabulary Audit (2026-04-20):** cross-cutting follow-up surfaced during D7. Four canonical vocabularies unified: `property_type` on pricing-native (PR 1 #124), 3-level URLA `loan_purpose` hierarchy + new `cashout_reason` column (PR 2 #125), `loan_term` months→years (PR 3 #126). **PR 4 (NonQM parser + 6,840-row `nonqm_adjustment_rules` migration)** remaining. Audit doc: [`SCENARIO-VOCABULARY-AUDIT-2026-04-20.md`](./SCENARIO-VOCABULARY-AUDIT-2026-04-20.md).

**Build order:** D9a complete. D9b in progress. D9c/d/e queued. See UAD-SPEC.md §10 for full layer breakdown.

**Relationships:**
- D5 second half (UAB) → absorbed into D9a
- D8 remediation findings → feed D9d (reference data migration)
- D7 (MLO Portal UX) → blocked on D9 Layer 1 (portal should build on new schema)
- D6 (unified pricing) → extended by D9b (unified entry point) and D9c (composable quotes)

## 7. Queue

Ordered work list. Inventory passes and remediation PRs interleave by default (see §2b). Items at the same indent level may run in parallel per the multi-agent rules (§8).

### Done 2026-04-15 → 2026-04-16

1. ✅ Spec filed (PR #74)
2. ✅ D0 re-audit of D3 and D5 (docs in PR #75)
3. ✅ D5 remediation — cross-org leak in `scenario-alerts` closed (PR #76)
4. ✅ D3 remediation — homepage-db EMPTY_ADJ fallback (PR #77). Residual divergence parked to D8 Pass 2 (now: finding HP-B6 + parallel-path, deferred to D9b per §2c)
5. ✅ D9 UAD spec drafted ([`UAD-SPEC.md`](../UAD-SPEC.md)) — 16 architecture decisions, full data model, build layers
6. ✅ **D0 re-audits for D1, D2, D4** (2026-04-16) — all three completed. D1/D2 confirmed done (D2 fully closed — residual-files note was a false alarm). D4 surfaced 2 critical findings shipped in PR #80.
7. ✅ **D4 remediation** — PR #80 (2026-04-16) — cross-org SMS leak in `/api/dialer/sms/threads` + pipeline bulk-cap brace scoping bug
8. ✅ **D8 inventory batch 1** (2026-04-16) — Passes 2/6/7/8 complete. Docs filed. Triage run under new §2c re-architecture-deference principle.

### Done 2026-04-17

9. ✅ **D8 batch 2 inventory** (Passes 3/4/5) — all three filed 2026-04-16; Pass 5 refreshed 2026-04-17 with UAD §7 module mapping. Ship-immediate candidates triaged per §2c.
10. ✅ **PR #83 closures** — CA licensing (MKT-COMP-1), aggregateRating schema (SEO-20), Texas stale prose (MKT-B4), auth display constants, company constants module (`src/lib/constants/company.js`, `src/lib/constants/auth.js`).
11. ✅ **D9 Layer 1 migration plan** — drafted at [`Work/Dev/UAD-LAYER-1-MIGRATION-PLAN.md`](../UAD-LAYER-1-MIGRATION-PLAN.md). Maps current schema → UAD target; Option B (in-place rename + merge) recommended; 5 open decisions for David.
12. ✅ **FoH April rename** — combined audit + UAD effort named.
13. 🔄 **Small ship-now remediation PR** (2026-04-17 this worktree) — GBP rename URLs, sitemap `/rates/dscr`, equity meta framing, year-label consistency.
14. ✅ **UAD Layer-1c (PR #91)** — scenarios.contact_id discipline. DAL stops writing denormalized borrower_name/email/phone; reads LEFT JOIN contacts + leads; transform.js derives identity via 3-way COALESCE (contact → lead → legacy). Migration 009 idempotent bridge catchup. Shared `findOrCreateContactByEmail` util staged for CoreCRM #78. Designed to respect UAD AD-1/AD-2 (no aggressive contact creation from pre-conversion scenarios).

### Done 2026-04-18

15. ✅ **D9b.3 homepage-db retire** (#107) — homepage now routes through priceScenario; parallel path deleted.
16. ✅ **Tool calc hardening** — #109 sub-financing-comparison rewrite (remove fabricated GSE LLPA math, reframe as "don't lose your 3% rate"), #110 shared number formatters (`src/lib/formatters.js`), #111 HELOC mode on second-lien calculator.

### Done 2026-04-20 (D9b Pricing Unification + D7 Core + Vocabulary Audit)

17. ✅ **D9b.4 par-rule unification** (#112) — 4 MLO bypass surfaces aligned (mlo/quotes POST, my-rates/reprice, scenario-alerts cron, leads/[id]/quote). MLO quote fee-breakdown bug fixed.
18. ✅ **D8 Pass 6 status picklist + payroll consolidation** (#113) — `src/lib/constants/loan-statuses.js` + `HOUSE_FEE_RATE` extracted to `src/lib/payroll.js`.
19. ✅ **D9b.5 + D9b.6 DB-tunable scenarios + surface config** (#114) — `site_scenarios` + `surface_pricing_config` tables (migration 010). Homepage DEFAULT_SCENARIO + filter flags editable without a deploy.
20. ✅ **D9b.7 homepage_rate_cache** (#115) — migration 011. Retired hardcoded `5.875%` fallback literals. Last-known-good cache + graceful `—` null state.
21. ✅ **D7 audit filed** — [`D7-MLO-PORTAL-AUDIT-2026-04-20.md`](./D7-MLO-PORTAL-AUDIT-2026-04-20.md). 6 surface-scoped PRs + IA redesign deferred.
22. ✅ **D7-1 through D7-6 shipped** (#117 / #120 / #122 / #118 / #121 / #119) + status unification (#123). See D7 dimension above for per-PR detail.
23. ✅ **Scenario Vocabulary Audit filed** — [`SCENARIO-VOCABULARY-AUDIT-2026-04-20.md`](./SCENARIO-VOCABULARY-AUDIT-2026-04-20.md). 4 canonical vocabularies identified.
24. ✅ **Vocab audit PRs 1-3 shipped** — property_type (#124 + migration 015, 687 rows), loan_purpose URLA hierarchy + cashout_reason column (#125 + migration 016, 95 rows), loan_term months→years (#126 + migration 017, 777 rows; ordering bug caught mid-run, 659 rows restored manually, SQL rewritten for replay safety — DEV-PLAYBOOK.md now has Neon-branch rehearsal protocol).

### Done 2026-04-21 (this session)

25. ✅ **Claw→PC relay queue swept** — all 6 inbound Claw relays resolved. Backlog #75 (7 compliance fixes) + #77 (Strike Rate) + #78 (CoreCRM) marked done. 3 new backlog items filed (#86 related-articles widget, #87 Ahrefs re-crawl verification, #88 DSCR screening workflow).
26. ✅ **DEV-PLAYBOOK.md migration rehearsal protocol** — documented Neon-branch approach for data migrations.
27. ✅ **README v1.8 refresh** shipped (PR #127) — catches audit index up to ~42 PRs since v1.5.
28. ✅ **D6 PR 14 drop** — migration 018 retired legacy quote tables; first live exercise of the Neon-branch rehearsal protocol. Details under D6 dimension above.

### Next up

29. **Vocab audit PR 4 — NonQM parser realignment** — 6,840-row `nonqm_adjustment_rules` migration (noo→investment, second→secondary, co_refi→cashout, nco_refi→refinance) + pricing-v2.js:519 secondHome bug fix + `adjustment_rules.purpose='irrrl'` keep-vs-rename decision (753 VA IRRRL rows). **Needs DSCR regression test before/after.** ~1-2 hrs. Risk-concentrated — Neon-branch rehearsal mandatory.
30. **D9b.8 verify** — confirm #109 sub-financing-comparison rewrite fully closed D9b.8 scope (sub-financing-comparison.js was the original target; check for residual hardcoded GSE LLPA logic).
31. **D9b.9 pricer-integrated tool defaults** — purchase-calculator, refi-analyzer, cost-of-waiting. Unblocked. Clean scope.
32. **D9b.13 getFicoBand de-dup** — engine.js (>=800) vs pricing-v2.js (>=780). Decide canonical + consolidate.
33. **D9d ref-data schema design** — aggregate Pass 1/2/6/7/8 reference-data findings (13+ proposed tables from Pass 8 alone; MKT-E2 loan-limits-2025.json; BP-1 closing costs) into unified `ref_*` schema. Unblocks D9b.10 (FHA_BASELINE_LIMIT) and D9b.11 (state closing-cost map).
34. **D7 nav/IA redesign (IA-2 through IA-7)** — dedicated consultation session with David. Not a self-service PR.
35. **D7 small residuals PR** — LE-3 product call, HECM optimizer retheme, quote list/detail retheme, API response `borrower_*`→`contact_*` rename, STATUS_LABELS harmonization, docs_out teal-500 token. Bundle or split as convenient.
36. **Remaining Claw items** (new backlog #86/#87/#88 + pre-existing #76 /refinance + #79 sequence engine) — priority order TBD.

### Later (post-D9b wrap)

37. **D9c scenario/quote model** — composable calc modules, shareable quote links, borrower scenario save.
38. **D9e application modules** — clean segment model for deal data.
39. **D1 follow-up** — public-route `err.message` leaks + rate limiting (batched residuals from D1 D0 re-audit); later, broader security audit per backlog #73.
40. **D4 follow-up** — audit remaining `src/app/api/dialer/**` routes for `organization_id` scoping (only `/threads` was in D4 audit scope).
41. **BP-9 DB audit → ship** — largely addressed by D7-3 `ref_loan_types`, but verify borrower-portal application wizard reads from same source.
42. **MKT-B3 volume numbers** — needs fresh 2026-YTD numbers from David OR continues as 2025-labeled historical stats.

### Done criteria per item

A queue item is "done" when:
- Inventory passes: a dated doc exists in this folder and its "status" in §6 is ✅
- Remediation PRs: PR merged, production Ready, post-deploy smoke test passes (per standing rule)
- Dimensions: all listed items under that dimension are done and no new findings have been added in the last inventory pass that touched the dimension

## 8. Multi-agent coordination

The driver may spawn **explore / researcher agents** to run inventory passes in parallel. Each agent:

- Runs in its own agent context (not a separate Claude session)
- Targets a single surface (one pass) with a scoped prompt
- Produces exactly one dated inventory doc in `Work/Dev/audits/`
- Does not modify any code
- Returns findings to the driver, who files the doc

**Parallel inventory is safe** because passes target different surfaces. Two agents cataloging different files do not collide.

**Remediations run sequentially by default.** Two remediation PRs may run in parallel only if:
- Each is in its own worktree on its own branch
- Their file sets do not intersect
- Both go through the standard deploy lock + PR merge flow

When in doubt, serialize remediations. The cost of a 30-minute wait is less than the cost of a merge conflict on a pricing file.

**Non-driver sessions spawning agents:** permitted for inventory only. Any agent producing code changes is a driver action and requires the driver's go-ahead.

## 9. Pricer inventory — cross-references

The first D8 inventory pass cataloged the pricer scenario flow. Its findings (A1–B3) are cross-referenced here by dimension most likely to catch each:

| ID | Finding | Primary dimension | Resolvable by |
|---|---|---|---|
| A1 | `src/data/county-loan-limits.js` — 3,235 counties bundled | D8 | New `ref_county_loan_limits` table (D8 remediation, after Pass 8) |
| A2 | `FHA_BASELINE_LIMIT = Math.round(832750 × 0.65)` hardcoded | D8 | Same `ref_county_loan_limits` work as A1 — derivable at query time |
| B1 | `pricing-v2.js:340` comp rate fallback `0.02` | D3 + D8 | D1/D4 level: audit `rate_lenders.comp_rate` for nulls; if clean, delete fallback |
| B2 | `pricing-v2.js:342-343` comp cap fallback `$3,595` | D3 + D8 | Same as B1 — audit lender config for nulls |
| B3 | `pricing-v2.js:369` FHA UFMIP fallback `0.0175` | D8 (high risk) | New `ref_fha_ufmip` table; short-term: audit `rate_lenders.fha_ufmip` for nulls |

**Immediate check (no PR needed):**

```sql
SELECT code, fha_ufmip, comp_rate, max_comp_cap_purchase, max_comp_cap_refi, status
FROM rate_lenders
WHERE status = 'active';
```

If any active lender has a null in those columns, the corresponding fallback is firing in production. That single query resolves whether B1/B2/B3 are actively affecting borrower output or are dead-code fallbacks.

**Also flagged by Pass 1 but out of pricer scope:**

- `src/data/loan-limits-2025.json` — stale 2025-named file still in repo, imported by `CountyLoanLimits.js` UI component. Trivial cleanup PR when D8 pass 8 runs.

## 10. Success criteria

The audit is declared complete when:

1. All nine dimensions show status ✅ in §6.
2. Every D8 inventory pass has either (a) no outstanding findings or (b) an explicit "intentionally retained" annotation with rationale.
3. No borrower-facing surface silently falls back to a stale hardcoded number without an error path that alerts ops.
4. No business rule appears inline in more than one file (single-source principle).
5. `DEFAULT_SCENARIO` and other publishing anchors are documented as intentional, with rationale.
6. The queue (§7) is empty.

After completion, this doc moves to archive status and a fresh `SITE-AUDIT-2027.md` may be opened if/when new dimensions surface.

## 11. Change log

- **2026-04-15 (v1)** — initial spec filed. D1–D5 marked ✅ based on PRs #45–#60 shipped history. D6 marked 🔄 with 3 items pending. D7 marked ⏳. D8 marked 🆕 with Pass 1 (pricer) complete, Passes 2–8 queued. Pricer inventory folded in as cross-references in §9 and filed as sibling doc.
- **2026-04-15 (v1.1)** — clarified that remediation is part of the audit (not a separate phase), added §2b "Interleave vs batch" defaulting to interleave, reshaped the queue (§7) to interleave inventory + ship-immediately remediations with an explicit batched-remediation block for cross-surface schema design.
- **2026-04-15 (v1.2)** — post-D0-re-audit update. Ran D0 verification re-audits (§6 header distinguishes claimed-done from re-verified-done). D3 and D5 fully re-audited; D1/D2/D4 agents terminated mid-investigation and will be re-spawned. Two ship-immediately remediations landed: PR #76 (D5 cross-org scenario-alerts leak) and PR #77 (D3 homepage EMPTY_ADJ fallback + shared `empty-adj.js` module). D3 remediation was partial: closed the silent hardcoded-fallback cascade, but homepage-db still diverges from `/api/pricing` for the DEFAULT_SCENARIO (5.875% vs 5.990%). Divergence parked as a seed finding for D8 Pass 2 along with the existing page.js fallback and DSCR-widget inline-picker findings. Queue in §7 reshaped to reflect actual tonight-state and what's next.
- **2026-04-16 (v1.3)** — D9 (UAD) added as new dimension. Full architecture discussion with David produced 16 architecture decisions covering identity lifecycle (Lead → Contact → Deal), pricing unification, composable quote model, application modules, service provider directory, marketing lifecycle, and portal access. D5 downgraded from ✅ to 🔄 half-done — first half (org_id on existing tables) verified, second half (unified identity model) absorbed into D9. D7 blocked-on updated to include D9 Layer 1 dependency. Queue reshaped: D9 spec + D8 inventory passes are parallel tracks, D9 Layer 1 build (lead intake) is the primary goal, D7 redesigns on top of D9 schema. UAD spec filed at `Work/Dev/UAD-SPEC.md`. UAB MCP decision (`cmo1igp2enjnw46ef`) superseded by broader UAD scope.
- **2026-04-16 (v1.4)** — batch 1 D8 inventory complete (Passes 2/6/7/8). D0 re-audits for D1/D2/D4 also complete. **§2c "Re-architecture deference" added** — new triage principle stating that findings D9 will naturally absorb should be deferred rather than patched with throwaway fixes, unless the finding is (a) security-critical, (b) actively harming users *right now* in a non-fallback path, or (c) observability/tooling that survives D9. PR #80 shipped 2 critical D4 findings (SMS cross-org leak + pipeline bulk-cap). Pending PR ships CRON-2/CRON-12 (health-check observability). D1 re-verified with residual `err.message` leaks batched for follow-up. D2 fully closed — residual-files note was false alarm. D4 re-verified ✅ with other dialer routes flagged for a follow-up pass. Queue reshaped: batch 2 (Passes 3/4/5) is next; D9d reference-data schema design batches all inventory findings together after batch 2 converges.
- **2026-04-17 (v1.5)** — **FoH April rename** (combined audit + UAD). Discovered batch 2 D8 inventory (Passes 3/4/5) was already filed 2026-04-16; README stale. PR #83 (2026-04-16) landed: CA licensing (MKT-COMP-1), aggregateRating schema (SEO-20), Texas stale prose (MKT-B4), company+auth constants modules. Small ship-now PR in flight (vigorous-cartwright worktree): GBP rename URLs centralized through `GBP_REVIEW_URL` (MKT-B2/SEO-17 — GBP renamed Locus→NetRate 2026-04-17), `/rates/dscr` added to sitemap (SEO-15a), equity-page meta historical framing (MKT-D4a), about-page year-label consistency (MKT-B3). **D9 Layer 1 migration plan** drafted — current schema is much further along than UAD implied (application modules from `1003-BUILD-SPEC.md` are modeled); Layer 1 is rename + merge migration, not greenfield. Option B (in-place) recommended. 5 open decisions for David at [`UAD-LAYER-1-MIGRATION-PLAN.md`](../UAD-LAYER-1-MIGRATION-PLAN.md) §8. Pass 5 confirmed Application LITE field list has 100% coverage against current intake wizard.
- **2026-04-21 (v1.8)** — **4-day refresh catching up ~42 PRs** (#84–#126) that shipped after v1.5. Headline deltas: **D9a fully complete** — Layer 1a–1c + lead conversion (#93) + inbound webhook (#92) + auto-email (#94). **D9b 7/13 shipped** — homepage-db retired (#107), par-rule unified across 4 surfaces (#112), `site_scenarios` + `surface_pricing_config` + `homepage_rate_cache` DB-tunable (#114/#115). **D7 audit filed + 6 core PRs shipped** (#117-#122 + #123 status unification) — design system locked across MLO portal. **Scenario Vocabulary Audit filed** (2026-04-20) with 3 of 4 PRs shipped (#124/#125/#126); migration 017 ordering bug caught mid-run, 659 rows restored from Neon PITR, DEV-PLAYBOOK.md now has Neon-branch rehearsal protocol. **Claw→PC relay queue fully swept** — all 6 inbound relays resolved, backlogs #75/#77/#78 marked done, 3 new backlog items (#86/#87/#88) filed for genuinely-open remnants. Next pressure point: **D6 PR 14 soak ends 2026-04-29** (8 days) — drop `borrower_quotes` + `saved_scenarios`. D9c/d/e still queued.
- **2026-04-21 (v1.9)** — **D6 PR 14 shipped same day as v1.8 refresh.** Migration 018 retired `borrower_quotes` (43 rows) + `saved_scenarios` (13 rows); `scenario_alert_queue.scenario_id` FK retargeted from `saved_scenarios.id` → `scenarios.id`. First live exercise of the Neon-branch rehearsal protocol added in v1.8 — rehearsal + prod runs both clean (4/4 statements OK, 70 queue rows preserved, 0 orphans). Prisma `BorrowerQuote` + `SavedScenario` models deleted; 8 src/ docstrings updated away from legacy table names. D6 dimension now ✅ complete.

## 12. Appendix — where to find things

- This spec: `Work/Dev/audits/README.md`
- **UAD spec: `Work/Dev/UAD-SPEC.md`** — unified architecture directive (D9)
- Pricer inventory (Pass 1): `Work/Dev/audits/PRICER-STATIC-DATA-INVENTORY-2026-04-15.md`
- Future inventory passes: same folder, dated filenames `<SURFACE>-INVENTORY-<YYYY-MM-DD>.md`
- PR history: `git log main --oneline` — cross-reference with §6 for dimension mapping
- Tracker backlog (portal-rebuild): `https://tracker.netratemortgage.com/backlog?project=portal-rebuild`
- Deploy procedure + concurrent sessions protocol: root `CLAUDE.md`
