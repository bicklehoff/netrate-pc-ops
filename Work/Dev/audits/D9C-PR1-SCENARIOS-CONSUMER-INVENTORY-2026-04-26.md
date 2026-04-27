# D9c PR-1 — Scenarios Consumer Inventory

**Date:** 2026-04-26
**Audit dimension:** D9 / D9c (UAD AD-10a)
**Driver:** PC Dev (`gracious-hellman-9f2b17` worktree)
**Status:** Inventory complete · pre-code · ready for migration design

> Inventory pass for the AD-10a scenarios table split. Per UAD-SPEC §2 AD-10a, the overloaded `scenarios` table is splitting into three: `scenarios` (immutable pricing snapshots) + `rate_alerts` (subscriptions) + `quotes` (MLO deliverables, snapshot-on-send per AD-12a). This doc enumerates every consumer of the current `scenarios` table, classifies each by post-split bucket, and surfaces migration risks.

---

## 1. Bucket definitions (post-split)

| Bucket | New table | Lifecycle | Mutability |
|---|---|---|---|
| **scenario** | `scenarios` | Pure pricing snapshot (inputs + scenario_rates + scenario_fee_items) | Immutable post-insert; re-pricing produces a new row |
| **rate_alert** | `rate_alerts` | Borrower subscription (`alert_frequency`, `alert_days`, `alert_status`, `last_priced_at`, `last_sent_at`, `send_count`, `unsub_token`) — references a scenario | Mutable (pause / resume / edit cadence) |
| **quote** | `quotes` | MLO deliverable (`sent_at`, `viewed_at`, `expires_at`, `pdf_url`, `pdf_generated_at`, `version`, `parent_quote_id`, `status`) — references a scenario, snapshot-on-send | Immutable post-insert (per AD-12a) |
| **mixed** | — | Touches multiple buckets in a single read or write | Requires decomposition |

---

## 2. DAL surface (`src/lib/scenarios/`)

### `db.js` — exported functions

| Function | Bucket impact | Action post-split |
|---|---|---|
| `createScenario(data, rates[], feeBreakdown)` | mixed | Caller branches on intent: always INSERT scenarios; conditionally INSERT rate_alerts (borrower) or quotes (MLO send). |
| `createScenarioRates(scenarioId, rates[])` | scenario | No change — `scenario_rates` table persists. |
| `createScenarioFeeItems(scenarioId, feeBreakdown)` | scenario | No change — `scenario_fee_items` table persists. |
| `getScenarioById(id, orgId)` | mixed | Either decompose into `getScenarioById` + sibling fetches for quote/alert metadata, or LEFT JOIN both new tables in one query. |
| `listScenarios(filters{})` | mixed | Filter inputs (`status`, `mloId`, `contactId`) currently hit alert/quote columns on scenarios. Move to `rate_alerts` / `quotes` joins. |
| `updateScenario(id, orgId, fields{})` | mixed | **Tighten allowlist** to scenario columns only. Add `updateRateAlert()` and `updateQuote()` siblings. Block alert / quote-lifecycle keys from this function. |
| `replaceScenarioRates(scenarioId, rates[])` | scenario | No change. |
| `replaceScenarioFeeItems(scenarioId, feeBreakdown)` | scenario | No change. |
| `deleteScenario(id, orgId)` | mixed | Scenarios may be referenced by quotes (immutable!) or rate_alerts. Decide: cascade vs. block delete when references exist. |

### `transform.js` — exported functions

| Function | Bucket impact | Action post-split |
|---|---|---|
| `deriveIdentity(scenario)` | scenario | No change — reads `contact_id` FK which survives. |
| `rateRowToQuoteShape(rate)` | scenario | No change — `scenario_rates` table persists. |
| `feeItemsToBreakdownShape(feeItems[], scenario)` | scenario | No change — `scenario_fee_items` table persists. |
| `scenarioToQuoteShape(scenario)` | mixed | Output includes `sent_at` / `viewed_at` / `expires_at` / `pdf_url` / `parent_quote_id`. Source from `quotes` row (added param) instead of scenario. |
| `scenarioToSavedShape(scenario)` | mixed | Output includes alert fields. Source from `rate_alerts` row (added param) instead of scenario. |

Transform functions are API-surface adapters — they stay; they just accept a richer input post-split.

---

## 3. Consumer inventory

| File | Op | Bucket | Notes |
|---|---|---|---|
| [api/saved-scenario/route.js](src/app/api/saved-scenario/route.js) | C | mixed | Borrower saves scenario + alert subscription. **Split:** INSERT scenarios + INSERT rate_alerts. |
| [api/saved-scenario/update/route.js](src/app/api/saved-scenario/update/route.js) | RW | mixed | Borrower edits scenario + cadence. **Split:** UPDATE scenarios + UPDATE rate_alerts. |
| [api/saved-scenario/unsubscribe/route.js](src/app/api/saved-scenario/unsubscribe/route.js) | W | rate_alert | `unsub_token` lookup. Move to `rate_alerts` table. |
| [api/my-rates/route.js](src/app/api/my-rates/route.js) | R | mixed | Borrower My Rates dashboard. **JOIN** scenarios ⋈ rate_alerts (LEFT) ⋈ scenario_rates (subquery). |
| [api/my-rates/reprice/route.js](src/app/api/my-rates/reprice/route.js) | RW | mixed | Re-price + bump `last_priced_at`. **Split:** scenarios + rate_alerts UPDATE. |
| [api/my-rates/access/route.js](src/app/api/my-rates/access/route.js) | R | rate_alert | Token-less access — existence check on lead's saved scenarios. Reads `owner_type`. |
| [api/cron/scenario-alerts/route.js](src/app/api/cron/scenario-alerts/route.js) | RW | mixed | Daily re-price cron. **Major rewrite:** WHERE rate_alerts.alert_status='active' (not scenarios), JOIN scenarios for inputs, INSERT scenario_alert_queue with `rate_alert_id`. |
| [api/portal/mlo/scenario-alerts/route.js](src/app/api/portal/mlo/scenario-alerts/route.js) | RW | mixed | MLO alert queue management (approve / decline / pause / resume). JOIN scenarios ⋈ rate_alerts. |
| [api/portal/mlo/quotes/route.js](src/app/api/portal/mlo/quotes/route.js) | CR | mixed | MLO quote list + create. **Split create:** scenarios + (if sending) quotes. |
| [api/portal/mlo/quotes/[id]/route.js](src/app/api/portal/mlo/quotes/[id]/route.js) | RW | mixed | GET / PATCH single quote. PATCH allowlist needs to route lifecycle fields to quotes. |
| [api/portal/mlo/quotes/[id]/price/route.js](src/app/api/portal/mlo/quotes/[id]/price/route.js) | R | quote | Re-price preview (no DB save). No change beyond getScenarioById's join shape. |
| [api/portal/mlo/quotes/[id]/send/route.js](src/app/api/portal/mlo/quotes/[id]/send/route.js) | W | quote | "Send to borrower" — currently UPDATE scenarios.sent_at/pdf_url. **Move to:** INSERT quotes (snapshot-on-send per AD-12a). |
| [api/portal/quotes/[id]/route.js](src/app/api/portal/quotes/[id]/route.js) | RW | quote | Borrower opens quote magic link — UPDATE viewed_at on first view. **Move to:** UPDATE quotes.viewed_at. |
| [api/portal/mlo/leads/[id]/convert/route.js](src/app/api/portal/mlo/leads/[id]/convert/route.js) | W | scenario | Lead conversion CTE backfills scenarios.contact_id. Benign — `contact_id` survives split. No change needed. |
| [components/Portal/ScenarioAlertTable.js](src/components/Portal/ScenarioAlertTable.js) | R | rate_alert | UI only — consumes API response. No direct DB. |
| [app/portal/my-rates/page.js](src/app/portal/my-rates/page.js) | R | rate_alert | UI only — consumes `/api/my-rates` response. No direct DB. |

**Total:** 14 server-side files (12 API routes + 2 UI files reading from APIs) + 1 cron entry point.

---

## 4. Cross-cutting consumer groups (mixed — require decomposition)

### Group A — Borrower saved scenarios (rate alerts)
**Files:** `api/saved-scenario/*`, `api/my-rates/*`, `api/cron/scenario-alerts/route.js`

**Current shape:**
```sql
SELECT s.*, sr.* FROM scenarios s
LEFT JOIN scenario_rates sr ...
WHERE s.owner_type = 'borrower'
  AND s.alert_status = 'active'
  AND s.alert_frequency = '2x_week'
  AND s.alert_days @> ARRAY['mon']
```

**Post-split shape:**
```sql
SELECT s.*, ra.*, sr.* FROM scenarios s
JOIN rate_alerts ra ON ra.scenario_id = s.id
LEFT JOIN scenario_rates sr ...
WHERE ra.alert_status = 'active'
  AND ra.alert_frequency = '2x_week'
  AND ra.alert_days @> ARRAY['mon']
```

### Group B — MLO quotes
**Files:** `api/portal/mlo/quotes/*`, `api/portal/quotes/[id]/route.js`

**Current shape:**
```sql
SELECT s.* FROM scenarios s
WHERE s.owner_type = 'mlo'
  AND s.status IN ('draft','sent','viewed')
```

**Post-split shape:**
```sql
SELECT s.*, q.* FROM scenarios s
JOIN quotes q ON q.scenario_id = s.id
WHERE q.status IN ('draft','sent','viewed')
```

### Group C — Alert queue integration
**Files:** `api/cron/scenario-alerts/route.js` (writes), `api/portal/mlo/scenario-alerts/route.js` (reads/updates)

**Schema change required:** `scenario_alert_queue.scenario_id` → `scenario_alert_queue.rate_alert_id`. FK retargets from `scenarios(id)` to `rate_alerts(id)`.

---

## 5. Migration risks

### Risk 1 — `scenario_alert_queue` FK retarget (CRITICAL)
Current FK points at the alert subscription (today: same row as the scenario). Post-split, the subscription lives on `rate_alerts`. If we don't retarget the FK, queue rows orphan from the alert metadata they need.

**Mitigation:** In Phase 1 migration, add new `rate_alert_id` column, backfill via `(SELECT id FROM rate_alerts WHERE scenario_id = scenario_alert_queue.scenario_id LIMIT 1)`, drop old `scenario_id` column in a later cleanup PR. Same shape as the PR 14 (D6 #34) drop-pattern from 2026-04-21.

### Risk 2 — `parent_scenario_id` semantics (HIGH)
Today `scenarios.parent_scenario_id` chains re-pricings. Post-split, the chain that matters for *quotes* is between quote rows (a re-priced quote has a new pricing snapshot but lineage on the quote). We need `quotes.parent_quote_id`. Pricing-snapshot lineage on `scenarios.parent_scenario_id` becomes vestigial — keep the column nullable for rollback safety but stop populating it for MLO sends.

**Mitigation:** Phase 1 backfill `quotes.parent_quote_id` from `scenarios.parent_scenario_id` where a sibling quotes row exists.

### Risk 3 — `updateScenario()` allowlist (HIGH)
Current allowlist includes pricing fields, alert fields, AND quote-lifecycle fields. Post-split, alert / quote keys must be rejected here and routed to `updateRateAlert()` / `updateQuote()`.

**Mitigation:** Tighten allowlist + grep all callers + add a runtime guard that throws on disallowed keys (catches anything we missed in static review).

### Risk 4 — Transform function compat (MEDIUM)
`scenarioToQuoteShape()` and `scenarioToSavedShape()` consume single rows today. Post-split they need a JOINed row (or two parameters).

**Mitigation:** Update transform signatures to accept an optional second param (the quote / rate_alert row). DAL pre-JOINs and passes both. Backward-compatible during migration window — fields fall back to scenario row if second param missing.

### Risk 5 — Pricing-result `status` field overlap (MEDIUM)
Today `scenarios.status` runs `draft → priced → sent → viewed → accepted → declined → expired`. The first two values are pricing-lifecycle; the rest are quote-lifecycle. Post-split, `quotes.status` carries the latter five; `scenarios` becomes immutable so status either disappears or trims to `priced` only.

**Mitigation:** Drop `status` from scenarios; backfill `quotes.status` from `scenarios.status` where `owner_type='mlo'`.

---

## 6. Migration history (scenarios-relevant)

| Migration | Purpose |
|---|---|
| `002_unified_scenarios.sql` | Created scenarios + scenario_rates + scenario_fee_items. The original overloaded shape this PR-1 is undoing. |
| `003_backfill_scenarios.sql` | Backfilled from `borrower_quotes` + `saved_scenarios`. |
| `009_layer1c_scenarios_contact_fill.sql` | Backfilled `contact_id`; stopped writing `borrower_name/email/phone`. |
| `036_layer1c_denorm_drop.sql` | Dropped `borrower_name/email/phone` columns from scenarios. |

Migrations 004–035 / 037+ touch unrelated surfaces.

---

## 7. Estimated PR sequence

**Phase 1 — Schema migration (1 PR)**
- Create `rate_alerts` + `quotes` tables.
- Backfill `rate_alerts` from `scenarios WHERE owner_type='borrower'`.
- Backfill `quotes` from `scenarios WHERE owner_type='mlo' AND sent_at IS NOT NULL`.
- Add `scenario_alert_queue.rate_alert_id` + backfill + (later) drop `scenario_id`.
- **Do not** drop columns from `scenarios` yet — soak window mandatory.

**Phase 2 — DAL split (1 PR)**
- New `updateRateAlert()` / `updateQuote()` / `createRateAlert()` / `createQuote()` helpers.
- Tighten `updateScenario()` allowlist + runtime guard.
- Adapt `scenarioToQuoteShape()` / `scenarioToSavedShape()` to optional secondary input.

**Phase 3 — Consumer rewrites (3 PRs grouped by surface)**
- PR-3a: Borrower saved scenarios + my-rates + unsubscribe + cron (Group A + Group C).
- PR-3b: MLO quotes (Group B) — list, create, PATCH, send, borrower view.
- PR-3c: MLO scenario-alerts queue route + ScenarioAlertTable shape verification.

**Phase 4 — Cleanup (1 PR after soak)**
- Drop `alert_*` / `sent_at` / `viewed_at` / `expires_at` / `pdf_url` / `pdf_generated_at` / `version` / `parent_scenario_id` / `status` columns from `scenarios`.
- Verify zero callers via grep + production smoke.

**Total estimate: 6 PRs across 4 phases. ~3-4 sessions.**

---

## 8. Pre-build checklist before Phase 1

- [ ] Confirm `quotes.status` enum values with David (subset of current `scenarios.status`)
- [ ] Decide cascade behavior on `deleteScenario()` when quotes / rate_alerts reference it (block vs. cascade)
- [ ] Decide whether `quotes.attached_modules jsonb` ships with this PR or with AD-11a registry work
- [ ] Confirm `parent_quote_id` chaining semantics (re-send vs. re-price branching)
- [ ] Neon-branch rehearsal mandatory for Phase 1 per DEV-PLAYBOOK.md (data migration with cross-table backfills)

---

## 9. Coordination notes

- **In-flight conflicts:** Another session is doing D6 #34 (ResiCentral DSCR) + DSCR calculator MLO-split (early AD-11a application). That work is in the calc-module + parser layer, not the data layer — no surface overlap with this PR-1.
- **Driver rule (audit §4):** PC Dev (this session) is currently FoH-April driver. Phase 1 migration is the next driver action.
- **Deploy-lock impact:** Phase 1 migration needs deploy lock (schema-touching). Plan around the in-flight session's PR cadence.

---

*End of inventory. Migration design (Phase 1 spec) is the next driver artifact.*
