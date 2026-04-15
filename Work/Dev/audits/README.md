# Site Audit 2026 — Spec

**Status:** Active · D1–D5 ✅ done (D3 + D5 re-verified tonight) · D6 🔄 · D7 ⏳ · D8 🆕 Pass 1 done
**Current driver:** PC Dev (`silly-montalcini` worktree, session cmo0jf6dum0ktbler)
**Last updated:** 2026-04-15 (v1.2 — post-D0-re-audit remediations)
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

### D1 · Security — ✅ done

Every-line review for OWASP-class vulnerabilities, credential exposure, unsafe deserialization, missing auth guards.

- **Shipped:** PR #52 (security audit — 8 vulnerabilities patched across 27 files)
- **Deferred:** full security audit (plaintext secrets in `~/.claude` skill files, API key rotation, `~/.netrate/auth.json` pattern, repo-wide scan) — tracked as PLATFORM-2026 backlog item #73, P=medium.

### D2 · camelCase / snake_case consistency — ✅ done (with follow-up noted)

Surfaced because the DB uses snake_case and JS uses camelCase; early refactors left 12+ dead features where row access mixed conventions.

- **Shipped:** PR #53 (camelCase/snake_case migration — 12 dead features restored).
- **Follow-up:** 12 files with residual `row.camelCase` patterns noted in session `cmo05mtfia6lu8877` for a secondary pass. Not urgent.

### D3 · Pricing engine correctness — ✅ done (re-verified 2026-04-15)

Financial correctness of `priceRate()` and the surrounding ingest pipeline. Catches math bugs, wrong-product pickups, double-counting, parser errors.

- **Shipped:** #41 (unify pricing engine, delete legacy JSON — ~405k lines removed), #42 diagnostic lender labels, #43 parser fixes, #44 debug mode toggle, #46 GitHub Actions rate parsing cron, #50 GCS idempotent tracking, #51 filter Jumbo products, #54 pricing engine financial correctness (5 bugs), #57 sheetDate fallback for Keystone/AmWest, #61 consolidate duplicate P&I calculations.
- **D0 verification (2026-04-15):** re-audit at [`D0-VERIFICATION-D3-PRICING-2026-04-15.md`](./D0-VERIFICATION-D3-PRICING-2026-04-15.md). Confirmed D3-shipped math is correct. Found one gap: `homepage-db.js` hard-failed on null `lenderAdj` instead of using the `EMPTY_ADJ` fallback that `price-scenario.js` uses — cascaded silently to the hardcoded `'5.875%'` fallback in `src/app/page.js:56`. Resolved in PR #77 (shared `src/lib/rates/empty-adj.js` module, both callers import).
- **Residual finding (parked to D8 Pass 2):** even after PR #77, the homepage conv30 display still differs from what `/api/pricing` produces for the same DEFAULT_SCENARIO (homepage: 5.875% / APR 5.88% · /api/pricing: 5.990% / finalPrice 100.345). Root cause is architectural — `homepage-db.js::priceProduct` runs its own mini-pricing path (different product filter, different lender selection via `LIMIT 1 ORDER BY effective_date DESC`, different brokerConfig shape) in parallel to `priceScenario()`. Two parallel pricing paths diverge. See D8 Pass 2 seed findings.
- **Out of scope:** DSCR pricer (separate domain, see D6), non-QM parsers (same).
- **Note:** D3 audited the *computation*. It did not audit the *inputs* to the computation for staleness — that's D8.

### D4 · Data integrity — ✅ done

Ownership checks, foreign key enforcement, transactional boundaries, PII handling, display-layer hygiene.

- **Shipped:** #55 (data integrity — 7 issues patched), #56 (hide product names from public rate tool — show only in debug mode).

### D5 · Org scoping — ✅ done (re-verified 2026-04-15)

Multi-tenant readiness. Adding `organization_id` to core tables, scoping every MLO API route by org, shared `requireMloSession()` helper.

- **Shipped:** #58 (Organization schema, org_id on 13 core tables), #59 (org-aware auth, organizationId in MLO session), #60 (scope all 42 MLO API routes by organization_id).
- **D0 verification (2026-04-15):** re-audit at [`D0-VERIFICATION-D5-ORG-SCOPING-2026-04-15.md`](./D0-VERIFICATION-D5-ORG-SCOPING-2026-04-15.md). Full route inventory (44 routes checked). Found one critical regression: `GET /api/portal/mlo/scenario-alerts` was missing the org filter on its scenarios JOIN, leaking cross-org scenario-alert queue items including joined borrower PII. Introduced in PR #68 after #60's sweep had already run. Resolved in PR #76 — both GET default view and PATCH approve/decline inner SELECT upgraded to `INNER JOIN scenarios s ... AND s.organization_id = ${orgId}`. All other 43 routes verified clean.

### D6 · Unified pricing / scenarios — 🔄 in progress

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
- **Outstanding:**
  - **PR 14** — drop `borrower_quotes` + `saved_scenarios` tables after 2-week soak (soak ends ~2026-04-29)
  - Core Non-QM LLPA parser (DSCR Plus + Expanded Prime Plus core tier adjustments) — follow-up to PR 15c
- **Note:** #73 (homepage par picker) produced a shared `src/lib/rates/pick-par-rate.js`. Production behavior unverified — see D8.

### D7 · MLO Portal UX — ⏳ pending

Phase 6 of the original Apr 14 plan. Four PRs (16–19) refreshing pipeline views, lead detail, quote builder, and dashboard cards to match the new design system.

- **Blocked on:** D8 inventory passes covering the MLO portal surface (dim 8 pass #6). Executing D7 PRs before that pass means some D7 changes will be re-touched by D8 remediations. Better to catalog first, remediate once.
- **Original scope:** PRs 16–19 per portal-rebuild backlog. Specs to be confirmed once D8 pass 6 completes.

### D8 · Static data / stale-by-deploy — 🆕 inventory phase

**The dimension added tonight.** Catalogs data that is baked into the deploy and becomes stale without code intervention. Includes hardcoded reference values, bundled data files, duplicated business rules, and silent-fallback-to-stale patterns.

- **Pass 1 · Pricer scenario flow** — ✅ done. See [`PRICER-STATIC-DATA-INVENTORY-2026-04-15.md`](./PRICER-STATIC-DATA-INVENTORY-2026-04-15.md). Findings cross-referenced in §9.
- **Pass 2 · Homepage + UI components** — ⏳ not started. Seed findings from tonight:
  - `src/app/page.js:56-58` — hardcoded `'5.875%' / '5.94%' / '$2,366'` fallbacks for conv30/conv15/fha30/va30 hero rates. Silent borrower-facing stale-data fallback. **NOTE:** cascade closed by PR #77 (D3 fix); fallbacks still exist as a belt-and-suspenders but should now rarely fire. Pass 2 should decide: keep as last-resort with loud error logging, or remove entirely and fail loud if pricer returns null.
  - `src/components/DscrRateWidget.js` + `src/app/tools/dscr-calculator/page.js` — inline par-picker logic. `src/lib/rates/pick-par-rate.js` (shipped in PR #73) should be the single source.
  - **`src/lib/rates/homepage-db.js` runs a parallel pricing path that diverges from `/api/pricing`** — same DEFAULT_SCENARIO, same Everstream data, two different answers (homepage: 5.875% par · /api/pricing: 5.990% par). Candidates for the divergence: (a) homepage-db's `LIMIT 1 ORDER BY effective_date DESC` picks a single lender's sheet rather than the best-across-all-lenders par; (b) homepage-db's SQL-level `is_* = false` product filter differs from /api/pricing's in-memory filter; (c) brokerConfig shape differs (homepage-db doesn't thread `fhaUfmip`). Root fix likely: have `getHomepageRatesFromDB()` call `priceScenario()` for the 4 default scenarios and pick from its output, retiring the parallel path entirely.
  - `src/lib/rates/homepage-db.js` — file name misleading (consumed by rate-watch too). Rename candidate.
  - `DEFAULT_SCENARIO` (defaults.js) — intentional publishing anchor. Document as such so future passes don't mistake it for stale data.
- **Pass 3 · Marketing pages** — ⏳ not started. Surfaces: `/rates/*`, `/services/*`, state pages (TX, CA, CO, OR), `/refinance-*`, `/tools/*` prose and numeric examples.
- **Pass 4 · Schema.org + SEO markup** — ⏳ not started. JSON-LD blocks and meta descriptions with numeric claims.
- **Pass 5 · Borrower portal + application flow** — ⏳ not started. Fee defaults, loan amount bounds, state-specific copy.
- **Pass 6 · MLO portal** — ⏳ not started. Pipeline widgets, dashboard KPIs, payroll calc. Blocks D7.
- **Pass 7 · Scheduled tasks / cron** — ⏳ not started. Rate-sheet parsers, FRED snapshotter, any hardcoded assumptions baked into ingest.
- **Pass 8 · Reference data files** — ⏳ not started. `src/data/*`, `scripts/seed-*`, anything baked into the deploy.

Passes 2–8 may run in parallel (see §8). Inventory work does not deploy.

## 7. Queue

Ordered work list. Inventory passes and remediation PRs interleave by default (see §2b). Items at the same indent level may run in parallel per the multi-agent rules (§8).

### Done tonight (2026-04-15)

1. ✅ Spec filed (PR #74)
2. ✅ D0 re-audit of D3 and D5 (docs in PR #75) — both dimensions confirmed done but with one critical finding each
3. ✅ D5 remediation — cross-org leak in `scenario-alerts` closed (PR #76)
4. ✅ D3 remediation — homepage-db EMPTY_ADJ fallback (PR #77). Partial fix: closes the silent cascade, but homepage still shows a different par rate than `/api/pricing`. Residual parked to D8 Pass 2.
5. ❌ D1 / D2 / D4 D0 re-audits — agents hit tool-use budget mid-investigation and terminated without final reports. Need to re-spawn with narrower prompts.

### Next (any session)

1. **Re-spawn D0 re-audits for D1, D2, D4** — narrower per-dimension prompts so each fits in the researcher agent's tool budget. Output: three more `D0-VERIFICATION-*.md` docs alongside D3 and D5's.
2. **D8 inventory Pass 2 · Homepage + UI components** — now carries three seed findings (see §6 D8). Root-cause candidate: retire `homepage-db.js`'s parallel pricing path and have it call `priceScenario()` like `/api/pricing` does.
3. **D8 inventory Passes 3–4** — may run in parallel with Pass 2 (different surfaces):
   - Pass 3 · Marketing pages
   - Pass 4 · Schema.org + SEO markup
   - Ship-immediately remediations land as they surface; batch candidates get queued.

### Next (still interleaving)

5. **D8 inventory Passes 5–8** — may run in parallel:
   - Pass 5 · Borrower portal
   - Pass 6 · MLO portal
   - Pass 7 · Scheduled tasks / cron
   - Pass 8 · Reference data files
   - Remediations ship as they qualify for the ship-immediately bucket.

### Batched remediations (after all D8 passes cataloged)

6. **Schema design round** — design `ref_fha_ufmip`, `ref_county_loan_limits`, `ref_comp_defaults` (if needed) against the full set of D8 findings, not just the pricer's. Ship migrations + code wiring as a small number of PRs.
7. **Single-source rule consolidation** — par-picker consumers, any other duplicated business rules found across passes. Refactor all consumers to use the single source.

### After D8 converges

8. **D7 — MLO Portal UX (Phase 6, PRs 16–19)** — now informed by D8 Pass 6 findings.
9. **D6 wrap-up** — PR 14 (drop old tables, after soak ends ~2026-04-29), Core Non-QM LLPA parser.
10. **D2 secondary pass** — 12 residual row.camelCase files.
11. **D1 follow-up** — security audit (plaintext secrets, API key rotation).

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

1. All eight dimensions show status ✅ in §6.
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

## 12. Appendix — where to find things

- This spec: `Work/Dev/audits/README.md`
- Pricer inventory (Pass 1): `Work/Dev/audits/PRICER-STATIC-DATA-INVENTORY-2026-04-15.md`
- Future inventory passes: same folder, dated filenames `<SURFACE>-INVENTORY-<YYYY-MM-DD>.md`
- PR history: `git log main --oneline` — cross-reference with §6 for dimension mapping
- Tracker backlog (portal-rebuild): `https://tracker.netratemortgage.com/backlog?project=portal-rebuild`
- Deploy procedure + concurrent sessions protocol: root `CLAUDE.md`
