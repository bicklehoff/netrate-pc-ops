---
date: 2026-04-22
author: pc-dev
audit: D10 — MLO Portal Exercise Audit
scope: user-flow exercise of the MLO portal — catches bugs that only surface in real use
---

# D10 — MLO Portal Exercise Audit

Complement to D7 (which was **surface-scoped** — design tokens, component retheme, picklist unification). D10 is **user-flow scoped**: walk the MLO through real tasks end-to-end and catch bugs that only show up during use. First findings surfaced during the 2026-04-21 Payam Kavousi incident.

## Why this dimension exists

D7 closed the "the portal looks right" dimension. That's necessary but not sufficient. D7 cannot catch:

- Saved localStorage state that predates schema changes (user sees a stale UI)
- Server routes that work on a dev's laptop but crash for users with real data (column-family and request shape mismatches)
- Navigation dead ends ("the feature exists but no one can find it")
- Workflow gaps ("I clicked Save but nothing happened")

These are only caught by **exercising** the portal. The audit mechanism is: driver walks through the three highest-frequency MLO workflows (pipeline view → loan detail → generate quote → send borrower) and records every stall, broken state, or confusing UX.

## 1. Findings (from 2026-04-21 Payam incident)

### D10.1 — `/api/portal/mlo/contacts` returns 500 · Critical · LIVE BREAKAGE

**Impact:** Contacts page was unusable. `GET /api/portal/mlo/contacts` returned 500 for every MLO in the org.

**Root cause:** `src/app/api/portal/mlo/contacts/route.js:57` used the `sql(query, [params])` call-style API of `@neondatabase/serverless`, which the current client version rejects. The client exposes two patterns:

1. Tagged templates: `` sql`SELECT ... WHERE x = ${val}` ``
2. Explicit `sql.query(text, params)` — returns `{ rows }`

The raw `sql(text, [params])` call form is not supported. The route's route used it because the query needed a dynamic `ORDER BY ${sortCol} ${orderDir}`.

**Fix:** Convert to `sql.query(contactQuery, [params])` and read `.rows`. This matches the working pattern in `src/lib/scenarios/db.js:85` and `src/app/api/portal/mlo/loans/[id]/route.js:385`. `sortCol` and `orderDir` are safe to interpolate as literals because they're resolved against allowlist maps at lines 27–36.

### D10.2 — Pipeline columns silently hidden · High · LIVE UX BUG

**Impact:** MLOs with saved `netrate_pipeline_state` from before recent column additions don't see new columns — no notification, no reset option visible.

**Root cause:** `src/components/Portal/PipelineTable.js` persists `visibleColumns` as an array to localStorage. When new columns are added to the `COLUMNS` definition, the saved array doesn't include them, so they render hidden. No schema-version marker existed to detect this drift.

**Fix considered — auto-merge (naive):** on load, for every column in `DEFAULT_VISIBLE`, add to visible set if not already there. **Rejected** — this un-hides columns the user explicitly hid (can't distinguish "user hid" from "column didn't exist yet").

**Fix shipped — schema-versioned:** persist `knownColumns: COLUMNS.map(c => c.key)` alongside visibleColumns. On load, diff: any column that is currently `defaultVisible` AND wasn't in `knownColumns` at save time is treated as new → added to visible. Previously-hidden columns stay hidden. Missing `knownColumns` (pre-fix saved state) triggers a one-time migration sync.

### D10.3 — Prequal letter discoverability · Medium · UX DEBATE

**Impact:** David expected prequal generation to have a top-level "Tools" nav item; it lives only inside loan detail.

**Status:** Deferred to D7's IA redesign track (IA-2–IA-7). Not a bug — a navigation / information-architecture decision that needs a dedicated consultation session.

## 2. Cross-reference with D7

| Concern | D7 (surface-scoped) | D10 (user-flow scoped) |
|---|---|---|
| "The contacts page looks right" | ✅ covered | — |
| "The contacts page returns data" | — | ✅ covered (D10.1) |
| "Pipeline table styles match design" | ✅ covered | — |
| "Pipeline table shows all current columns" | — | ✅ covered (D10.2) |
| "Prequal button has correct brand colors" | ✅ covered | — |
| "Users can find Prequal from nav" | — | ✅ covered (D10.3, deferred to IA) |

D7 and D10 are complementary dimensions, not overlap. D7 asks "does it look right?" — D10 asks "does it work?"

## 3. Driver protocol for future D10 findings

Any pc-dev session that spots an MLO portal bug during real use (David reports it, or it surfaces during adjacent work) files a finding in this doc under §1, with:

- Severity: Critical / High / Medium / Low
- Live breakage vs. latent
- Root cause
- Proposed fix (or explicit "IA-deferred")

Findings marked Critical + Live ship on the §2c "actively harming users *right now*" exception — not batched. D10.1 and D10.2 both shipped in the same triage PR that filed this audit doc.

## 4. What this audit does NOT cover

- Performance of MLO portal under load (separate concern; no findings today)
- Mobile/responsive behavior (D7 scope)
- MLO portal security (D1 scope; D4 data-integrity scope)
- Pricing engine correctness behind the portal (D3 scope)
- Cross-org data leakage in MLO routes (D5 scope; covered for D4 as schema-integrity follow-up)

## 5. Relationship to other dimensions

- **D7 (MLO Portal UX)**: surface-scoped; ✅ core shipped. D10 picks up where D7 left off.
- **D1/D4 (Security + Data Integrity)**: parallel axes; D10 findings are UX/flow bugs, not security or data-integrity. Cross-reference if a D10 finding turns out to also be a data leak.
- **D9a (Identity model)**: D10.1's root cause involves the contacts table (now the canonical identity node post-D9a). D10.1 does not require schema changes — it's pure API fix.
