# D9c PR-2 / Phase 2 — DAL split spec

**Date:** 2026-04-29
**Audit dimension:** D9 / D9c (UAD AD-10a)
**Driver:** PC Dev (`feature/d9c-phase2-dal-split` worktree)
**Status:** Spec drafted · awaiting David's review · pre-code · no rehearsal needed (no DB changes)
**Tier:** T3 — cross-cutting library refactor, multi-consumer surface (5 API routes immediately, ~17 files in Phase 3 horizon)

> Phase 2 of D9c PR-1 — split the monolithic `src/lib/scenarios/` DAL into three vertical slices (`scenarios`, `rate-alerts`, `quotes`) per the AD-10a decomposition Phase 1 already shipped on the schema side. Purely additive at the API/behavior level: new helpers exist, old `updateScenario()` still works, soft deprecation logs surface stale callers. **No production behavior changes.** Phase 3 retrofits consumers; Phase 4 hard-tightens + drops columns.

---

## 1. Methodology note (lessons applied from Phase 1)

The Phase 1 spec leaned on the 04-26 consumer inventory without re-grounding against current code. David flagged this 2026-04-29: *"are we working off of a current understanding of the entire code, or off of the original audit? we have iterated, we will continue to iterate."*

**Fix going forward:** Every T3 session begins with a fresh-state check against `origin/main`, even if a prior inventory exists. The check is cheap (`git log --since=<inventory-date> -- <paths>` + reverse-caller grep); the cost of designing on stale state is rework. This spec begins with the check below; future specs do the same.

**Fresh inventory (run 2026-04-29 against `origin/main`):**

```bash
git log --oneline --since="2026-04-26" -- \
  src/lib/scenarios/ \
  src/app/api/saved-scenario/ \
  src/app/api/my-rates/ \
  src/app/api/portal/mlo/quotes/ \
  src/app/api/portal/quotes/ \
  src/app/api/portal/mlo/scenario-alerts/ \
  src/app/api/cron/scenario-alerts/

# Result: 0 commits since 04-26.
# All adjacent churn (PRs #245-#262: dialer/PWA/dock/SMS/favicon) was orthogonal.
```

The 04-26 consumer inventory remains the authoritative consumer list. Phase 1 (PR #264) added the schema; nothing else has touched the affected paths.

**Forward-import + reverse-caller surface (verified 2026-04-29):**

| Concern | Files |
|---|---|
| `import { … } from '@/lib/scenarios/db'` | 8 routes |
| `import { … } from '@/lib/scenarios/transform'` | 5 routes |
| Direct SQL on `scenarios` / `scenario_rates` / `scenario_fee_items` (bypassing DAL) | 6 routes |
| Direct SQL on `scenario_alert_queue` | 2 routes (cron + MLO scenario-alerts) |
| Direct SQL on new `rate_alerts` / `quotes` tables | 0 (no consumer rewrites yet — Phase 3) |

Phase 2 only updates the **5 transform-importing routes** (purely path changes — see §7). All other surfaces are deferred to Phase 3.

---

## 2. Goals & non-goals

### Goals (Phase 2)

1. Create the `src/lib/rate-alerts/` slice — `db.js`, `transform.js`, `index.js`. Exports the helpers Phase 3 callers will need.
2. Create the `src/lib/quotes/` slice — same shape. Includes `sendQuote()` with snapshot-on-send semantics per AD-12a.
3. Move `scenarioToSavedShape` and `scenarioToQuoteShape` from `src/lib/scenarios/transform.js` to their proper slice. The function lives where the *output* shape it produces lives.
4. Add `src/lib/scenarios/index.js` for symmetric import surface.
5. Update the 5 API routes whose imports moved (purely path changes; no logic change).
6. Add soft-deprecation logger to `updateScenario()` — logs (does NOT throw) when alert/quote keys are passed, so stale callers surface in production logs without breaking.
7. Mark `deleteScenario()` `@deprecated` (it's dead code; reverse-caller grep was clean — see Phase 1 spec §8.1).
8. **Zero behavior change at any API surface.** Existing flows continue to work via the same paths they use today.

### Non-goals (out of scope for Phase 2)

- Consumer rewrites — Phase 3 (3 sub-PRs grouped by slice: borrower / quotes / cron-and-shared)
- Hard-tightening `updateScenario()` allowlist — Phase 4 (after Phase 3 soak)
- Column drops on `scenarios` — Phase 4
- New API endpoints for rate-alerts or quotes (e.g., a `POST /api/quotes`) — those land alongside Phase 3 consumer rewrites if needed
- Calculator module registry / `quotes.attached_modules` population — AD-11a (separate axis)
- Tests / test framework — none currently in repo for this surface; introducing a framework here is over-reach
- Validation layer (zod) — defer until Phase 3 surfaces a real need (per coding spec second-time-factor-out)

---

## 3. The vertical-slice principle (concrete)

Each slice is a self-contained directory. The slice owns:

- **DB operations** on its own table(s) (`db.js`)
- **Shape adapters** that produce the slice's domain output (`transform.js`)
- **A single import surface** via `index.js` re-exports — callers write `from '@/lib/quotes'`, never `from '@/lib/quotes/db'`

A function lives in the slice that *owns the output shape it produces*, not the slice it *reads from*. So:

- `scenarioToQuoteShape(scenario, quote?)` — produces a quote-shaped output → lives in `src/lib/quotes/transform.js` (even though it reads scenario fields)
- `scenarioToSavedShape(scenario, rateAlert?)` — produces a saved-scenario API shape that's a borrower's rate-alert view → lives in `src/lib/rate-alerts/transform.js`
- `deriveIdentity(scenario)` — produces an identity descriptor of the scenario itself → stays in `src/lib/scenarios/transform.js`
- `rateRowToQuoteShape(rate)`, `feeItemsToBreakdownShape(feeItems, scenario)` — produce sub-shapes embedded in scenarios; stay in `src/lib/scenarios/transform.js`

**The hard rule:** when adding a new function, ask *"what shape does this produce?"* and put it in that slice. When modifying an existing function, if the answer migrated, move the function.

**Slice independence:** a change in `quotes/transform.js` should never require editing `rate-alerts/` or `scenarios/`. Today's monolithic `transform.js` violates this — quote callers and rate-alert callers both depend on the same file. Phase 2 fixes that.

---

## 4. New slice: `src/lib/rate-alerts/`

### 4.1 `db.js` — exported functions

```js
// Create a rate alert subscription on an existing scenario.
// Throws if scenario doesn't exist or already has a rate_alerts row.
export async function createRateAlert({
  scenarioId,
  organizationId,
  contactId = null,
  leadId = null,
  alertStatus = 'active',
  alertFrequency = null,
  alertDays = null,
  unsubToken = null,
}) { /* INSERT INTO rate_alerts ... */ }

// Get by primary key (scoped to org).
export async function getRateAlertById(id, orgId) { /* ... */ }

// Get by unsub token (used by /api/saved-scenario/unsubscribe).
// Org-unscoped because token is the auth.
export async function getRateAlertByUnsubToken(token) { /* ... */ }

// Get the rate_alert row for a given scenario_id (or null if none).
// Useful during the Phase 3 transition window.
export async function getRateAlertByScenarioId(scenarioId, orgId) { /* ... */ }

// Update mutable fields. Allowlist: alert_status, alert_frequency, alert_days,
// last_priced_at, last_sent_at, send_count.
// Throws on disallowed keys (this is a NEW function; no soft-deprecation grace
// period needed here — callers know what they're calling).
export async function updateRateAlert(id, orgId, fields) { /* UPDATE rate_alerts ... */ }

// List for borrower portal — JOIN scenarios for the input snapshot.
export async function listRateAlerts({ orgId, contactId, alertStatus }) { /* ... */ }
```

### 4.2 `transform.js` — exported functions

```js
// Compose a borrower-facing "saved scenario" shape from scenario + rate_alert.
// Backward-compat: rateAlert arg is optional. When omitted, falls back to
// reading alert fields off the scenario row (the Phase 1 columns still exist
// on scenarios until Phase 4). This keeps Phase 2 purely additive.
export function scenarioToSavedShape(scenario, rateAlert = null) {
  const alert = rateAlert || scenario;  // graceful fallback
  return {
    id: scenario.id,
    // ... scenario inputs (loan_amount, fico, etc.)
    alertStatus: alert.alert_status,
    alertFrequency: alert.alert_frequency,
    alertDays: alert.alert_days,
    lastPricedAt: alert.last_priced_at,
    lastSentAt: alert.last_sent_at,
    sendCount: alert.send_count || 0,
  };
}
```

### 4.3 `index.js`

```js
export * from './db.js';
export * from './transform.js';
```

---

## 5. New slice: `src/lib/quotes/`

### 5.1 `db.js` — exported functions

```js
// Create a draft quote (not yet sent — visible only to the MLO).
export async function createQuote({
  scenarioId,
  organizationId,
  mloId,
  contactId = null,
  dealId = null,
  attachedModules = [],
}) { /* INSERT INTO quotes ... status='draft' */ }

// Get by primary key (scoped to org).
export async function getQuoteById(id, orgId) { /* ... */ }

// Get by share token — the borrower's magic-link entry point.
// Org-unscoped because the token is the auth.
export async function getQuoteByShareToken(token) { /* ... */ }

// Update mutable fields ONLY. Per AD-12a, sent quotes are immutable except for:
//   - status (transitions: draft→sent, sent→viewed, viewed→accepted/declined,
//     any→expired)
//   - viewed_at (set on first borrower open)
//   - pdf_url, pdf_generated_at (set when PDF is generated)
// Throws on disallowed keys. Throws on attempted edits to sent_at, scenario_id,
// attached_modules, expires_at, share_token, version, parent_quote_id once
// status != 'draft'.
export async function updateQuote(id, orgId, fields) { /* ... */ }

// The snapshot-on-send operation per AD-12a §128:
// MLO clicks Send → freezes the current scenario + attached modules + rate
// snapshot + fees + MLO branding into the quote row. Status: draft → sent.
// Generates share_token. Sets sent_at. Returns the quote row.
//
// Snapshot semantics: this function reads the SCENARIO at this exact moment,
// reads the SCENARIO_RATES at this exact moment, reads the SCENARIO_FEE_ITEMS
// at this exact moment, and writes the quote with all the data needed to
// re-render the deliverable later WITHOUT consulting current rate sheets.
//
// In Phase 2 we save references (the scenario_id is sufficient since the
// scenario is itself immutable per AD-10a). When AD-11a adds attached_modules
// content, that JSONB shape is what gets frozen.
export async function sendQuote(id, orgId, { expiresAt, attachedModules } = {}) {
  /* 1. Validate status='draft'
   * 2. Generate share_token (cryptographically random, 32 bytes hex)
   * 3. UPDATE quotes SET status='sent', sent_at=NOW(), expires_at, attached_modules,
   *    share_token RETURNING *
   * 4. Return the row
   */
}

// List quotes for an MLO's pipeline.
export async function listQuotes({ orgId, mloId, status, contactId }) { /* ... */ }
```

### 5.2 `transform.js` — exported functions

```js
// Compose a quote-shaped output from scenario + quote.
// Backward-compat: quote arg is optional. When omitted, falls back to the
// quote-lifecycle fields that still exist on scenarios (sent_at, viewed_at,
// expires_at, pdf_url, pdf_generated_at, version, share_token).
// This is what keeps Phase 2 purely additive — Phase 3 consumer rewrites
// pass the quote arg explicitly; until then, callers get the same data they
// did before the split.
export function scenarioToQuoteShape(scenario, quote = null) {
  const q = quote || scenario;
  return {
    id: quote?.id || scenario.id,
    scenarioId: scenario.id,
    // ... scenario inputs
    sentAt: q.sent_at,
    viewedAt: q.viewed_at,
    expiresAt: q.expires_at,
    pdfUrl: q.pdf_url,
    pdfGeneratedAt: q.pdf_generated_at,
    version: q.version || 1,
    parentQuoteId: q.parent_quote_id || null,  // only on quotes table
    shareToken: q.share_token || null,
    status: q.status || scenario.status,
  };
}
```

### 5.3 `index.js`

```js
export * from './db.js';
export * from './transform.js';
```

---

## 6. Changes to `src/lib/scenarios/`

### 6.1 `db.js`

**Add soft deprecation logger to `updateScenario()`.** When alert/quote keys are passed, log a warning identifying the caller (use `new Error().stack` to capture the call site) and the keys, then continue with the update as today. Allowlist is unchanged in Phase 2 — those keys still apply. Phase 4 removes them.

```js
const DEPRECATED_ALERT_KEYS = new Set([
  'alert_status', 'alert_frequency', 'alert_days',
  'last_priced_at', 'last_sent_at', 'send_count',
]);
const DEPRECATED_QUOTE_KEYS = new Set([
  'sent_at', 'viewed_at', 'expires_at',
  'pdf_url', 'pdf_generated_at', 'version',
]);

export async function updateScenario(id, orgId, fields) {
  // Soft deprecation surveillance — Phase 2 only logs; Phase 4 will reject.
  const deprecatedKeysPresent = Object.keys(fields).filter(
    (k) => DEPRECATED_ALERT_KEYS.has(k) || DEPRECATED_QUOTE_KEYS.has(k),
  );
  if (deprecatedKeysPresent.length > 0) {
    const callsite = (new Error().stack || '').split('\n').slice(2, 5).join(' | ');
    console.warn(
      `[d9c-deprecation] updateScenario() called with alert/quote keys ` +
      `[${deprecatedKeysPresent.join(', ')}] — callers should migrate to ` +
      `updateRateAlert() or updateQuote() per UAD AD-10a. callsite: ${callsite}`,
    );
  }

  // ... rest of function unchanged ...
}
```

This produces a Vercel log entry every time a stale caller fires. Phase 3 sub-PRs land when their slice's logs go quiet.

**Mark `deleteScenario()` `@deprecated`** with a JSDoc comment pointing at the (currently dead) replacement in `src/lib/scenarios/db.js`. Function remains callable; no behavior change. Phase 4 removes it.

### 6.2 `transform.js`

**Remove** `scenarioToQuoteShape` and `scenarioToSavedShape` (moved to slices).
**Keep** `deriveIdentity`, `rateRowToQuoteShape`, `feeItemsToBreakdownShape` — these stay scenario-scoped.

### 6.3 `index.js` (NEW)

```js
export * from './db.js';
export * from './transform.js';
```

Allows `from '@/lib/scenarios'` style imports going forward, symmetric with the new slices.

---

## 7. API route import path updates

Five files. **Purely import-path changes — no logic, no behavior, no signature.** Each file's diff is 1-2 lines.

| File | Change |
|---|---|
| `src/app/api/my-rates/route.js:10` | `scenarioToSavedShape` from `@/lib/scenarios/transform` → `@/lib/rate-alerts` |
| `src/app/api/portal/mlo/quotes/route.js:21` | `scenarioToQuoteShape` from `@/lib/scenarios/transform` → `@/lib/quotes`. `deriveIdentity` stays at `@/lib/scenarios`. Split into two import statements. |
| `src/app/api/portal/mlo/quotes/[id]/route.js:19` | `scenarioToQuoteShape` from `@/lib/scenarios/transform` → `@/lib/quotes` |
| `src/app/api/portal/mlo/quotes/[id]/send/route.js:22` | `scenarioToQuoteShape` from `@/lib/scenarios/transform` → `@/lib/quotes` |
| `src/app/api/portal/quotes/[id]/route.js:16` | `scenarioToQuoteShape` from `@/lib/scenarios/transform` → `@/lib/quotes`. `deriveIdentity` stays at `@/lib/scenarios`. Split into two imports. |

The 8 routes that import from `@/lib/scenarios/db` are **untouched** in Phase 2 — they keep using `getScenarioById`, `createScenario`, `listScenarios`, `updateScenario`, etc. Phase 3 introduces the new helpers at those call sites.

---

## 8. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | A consumer's behavior changes because a transform now lives elsewhere | LOW | LOW | Pure file-move + import update. No function signature changes. Build verifies the imports resolve. |
| 2 | `scenarioToQuoteShape(scenario)` 1-arg callers break because the function now expects 2 args | NONE | — | Optional 2nd param with graceful fallback (§5.2). 1-arg call still works identically to today. |
| 3 | Soft deprecation logger floods Vercel logs and blows quota | LOW | LOW | One log line per stale call. With ~13 borrower scenarios + 2 MLO quotes today, expected load is <100 entries/day. Phase 3 lands within ~1-2 sessions and silences them. |
| 4 | `sendQuote()` ships in Phase 2 but no consumer calls it yet → dead code on prod | NONE | — | Intentional. Phase 3 wires `/api/portal/mlo/quotes/[id]/send/route.js` to call it. Until then, the existing code path that writes `sent_at` to scenarios still works (those columns still exist). |
| 5 | New helpers with bugs that nobody catches because no caller exercises them | LOW | MEDIUM | Phase 3 sub-PRs are the parity tests. Each slice's helpers get exercised by their first consumer rewrite. **Mitigation:** if a Phase 3 PR fails because a Phase 2 helper has a bug, fix in Phase 3 — don't add speculative tests in Phase 2. |
| 6 | The Phase 2 PR introduces a circular import between slices | LOW | MEDIUM | Mitigation: each slice's `db.js` imports ONLY from `@/lib/db` (the shared sql client). Each slice's `transform.js` imports nothing from other slices — pure functions over inputs. The `index.js` re-exports stay one-way. Static check during code review. |

### 8.1 Reverse-caller grep on `scenarioToQuoteShape` and `scenarioToSavedShape` (verified 2026-04-29)

```bash
# scenarioToQuoteShape callers
grep -rn "scenarioToQuoteShape" src/ | grep -v "src/lib/scenarios/"
```

Expected: 4 routes (mlo/quotes/route, mlo/quotes/[id]/route, mlo/quotes/[id]/send/route, portal/quotes/[id]/route). Already enumerated in §7. **No dynamic dispatch** (no string-based function lookup). Move-and-update-imports is mechanical.

```bash
# scenarioToSavedShape callers
grep -rn "scenarioToSavedShape" src/ | grep -v "src/lib/scenarios/"
```

Expected: 1 route (my-rates/route.js). Same.

---

## 9. Done criteria for Phase 2 PR

- [ ] `src/lib/rate-alerts/{db.js,transform.js,index.js}` exist with all §4 exports
- [ ] `src/lib/quotes/{db.js,transform.js,index.js}` exist with all §5 exports
- [ ] `src/lib/scenarios/transform.js` no longer exports `scenarioToQuoteShape` or `scenarioToSavedShape`
- [ ] `src/lib/scenarios/index.js` exists and re-exports remaining surface
- [ ] `updateScenario()` logs deprecation warning on alert/quote keys; **still applies the update** (allowlist unchanged in Phase 2)
- [ ] `deleteScenario()` has `@deprecated` JSDoc
- [ ] 5 API route imports updated (purely path changes)
- [ ] Build green, no ESLint errors
- [ ] Vercel preview build green
- [ ] Public site smoke: homepage 200, /rates 200
- [ ] Authenticated smoke: borrower saved-scenario flow + MLO quote send flow exercise the affected routes — both should produce identical output to before this PR (transforms now have a 2nd optional param but 1-arg call returns the same shape)
- [ ] No deprecation logs in Vercel preview build output (build-time render of routes shouldn't trigger updateScenario)
- [ ] **No DB schema changes** — Phase 1 already shipped them; verify this PR's migration count is 0

---

## 10. Phase 3 forward-look

Each Phase 3 sub-PR converts one slice's consumers to call the new helpers and removes alert/quote keys from `updateScenario()` calls in that slice's routes. As each sub-PR lands, the corresponding deprecation logs go quiet.

| Sub-PR | Files | Goal |
|---|---|---|
| 3a — Borrower / rate-alerts | `api/saved-scenario/*`, `api/my-rates/*`, `api/portal/my-rates/page.js` | New helper calls; `scenarioToSavedShape(scenario, rateAlert)` 2-arg call |
| 3b — MLO quotes | `api/portal/mlo/quotes/*`, `api/portal/quotes/[id]/route.js` | `createQuote`, `sendQuote`, `getQuoteByShareToken`; `scenarioToQuoteShape(scenario, quote)` 2-arg call |
| 3c — Cron + shared | `api/cron/scenario-alerts/route.js`, `api/portal/mlo/scenario-alerts/route.js` | Cron writes `scenario_alert_queue.rate_alert_id`; reads JOIN rate_alerts |

Phase 4 (after Phase 3 + 1-week soak):
- Hard-tighten `updateScenario()` allowlist to scenario columns only
- Drop alert/quote columns from `scenarios`
- Drop `scenario_alert_queue.scenario_id` (only `rate_alert_id` remains)
- Remove `deleteScenario()` (truly dead)

---

## 11. Methodology checkpoints captured (for next session)

Lessons from Phase 1 → Phase 2 transition:

1. **Re-ground at session start.** `git log --since=<inventory-date> -- <relevant-paths>` is the first command, not the second. Captured in §1.
2. **Vertical slicing means "function lives where its output shape lives,"** not just "directory per concept." Captured in §3.
3. **Soft deprecation logger > hard rejection** during transitional windows. Logs surface stale callers; hard rejection breaks production until every consumer is converted. Captured in §6.1.
4. **Optional-param backward compat** is the cleanest way to extend transform signatures without breaking 1-arg callers. Captured in §4.2 / §5.2.

---

*End of Phase 2 spec. Awaiting David's review on the slice contracts (§4, §5) and the soft-deprecation strategy (§6.1) before code is written. No SQL files, no new migrations.*
