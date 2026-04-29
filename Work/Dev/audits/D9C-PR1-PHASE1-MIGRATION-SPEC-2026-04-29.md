# D9c PR-1 / Phase 1 — Schema migration spec

**Date:** 2026-04-29
**Audit dimension:** D9 / D9c (UAD AD-10a)
**Driver:** PC Dev (`feature/d9c-phase1-prep` worktree)
**Status:** Spec drafted · awaiting David's review · pre-code · Neon rehearsal pending
**Tier:** T3 — schema-touching, multi-consumer, cross-cutting. Per CODING-PRINCIPLES.md: inventory done (✓), design (this doc), rehearsal mandatory, parity checks span all 14 consumers.

> Phase 1 of D9c PR-1 — additive schema migration that creates `rate_alerts` and `quotes` tables, adds `scenarios.purge_at`, and retargets `scenario_alert_queue` from `scenario_id` to `rate_alert_id`. **No columns dropped from `scenarios` in this phase.** Soak window mandatory (Phase 4 cleanup happens after consumer rewrites land in Phase 3).

---

## 1. Inputs to this spec

- **UAD-SPEC.md §2 AD-10a** (2026-04-24, PR #197) — the architectural mandate
- **UAD-SPEC.md §2 AD-12a** (2026-04-24, PR #197) — quote immutability rules
- **`D9C-PR1-PHASE0-NAMESPACE-INVENTORY-2026-04-27.md`** — namespace cleared via PR #240
- **`D9C-PR1-SCENARIOS-CONSUMER-INVENTORY-2026-04-26.md`** — 14 consumers + 5 risks
- **CODING-PRINCIPLES.md** — T3 rigor framework (inventory, design, rehearsal, reverse-callers including SQL-aliased forms)
- **HANDOFF-DISCIPLINE.md** — git_state verification on the rehearsal cycle
- David's product decisions on Q1–Q5 (this doc, §3)

---

## 2. Goals & non-goals

### Goals (Phase 1 only)

1. Create `rate_alerts` table with the borrower-subscription lifecycle.
2. Create `quotes` table with the MLO-deliverable lifecycle (immutable per AD-12a).
3. Add `scenarios.purge_at` for explicit retention semantics on anonymous pricing snapshots.
4. Retarget `scenario_alert_queue.scenario_id` → `scenario_alert_queue.rate_alert_id` (additive: add new column + backfill; old column survives this phase, drops in Phase 4).
5. Backfill `rate_alerts` and `quotes` from existing `scenarios` rows, lossless.
6. **Zero behavior change** to live consumers post-migration. Old code keeps reading from `scenarios.*` until Phase 2/3 lands.

### Non-goals (out of scope for Phase 1)

- Dropping any column from `scenarios` (deferred to Phase 4, after soak)
- DAL changes (`src/lib/scenarios/db.js` etc.) — Phase 2
- API route changes — Phase 3
- Calculator module registry / `quotes.attached_modules` population — AD-11a (separate work; column ships empty)
- Quote PDF snapshot persistence — Phase 3 (`pdf_url` column ships, populated when send-side moves)
- ResiCentral / pricing engine work — different dimension

---

## 3. David's product decisions (recorded 2026-04-29)

| ID | Decision | Status |
|---|---|---|
| **Q1** | `quotes.status` enum: `draft \| sent \| viewed \| accepted \| declined \| expired`. `scenarios.status` becomes vestigial (Phase 4 drops). | ✅ Accepted |
| **Q2** | `RESTRICT` on `scenarios` delete when any `quotes` or `rate_alerts` row references it. Matches AD-12a immutability. | ✅ Accepted |
| **Q3** | `quotes.attached_modules jsonb` ships in Phase 1 even though AD-11a registry isn't built. Column sits empty in interim. | ✅ Accepted |
| **Q4** | Two independent lineages: `quotes.parent_quote_id` (send-chain audit) + `scenarios.parent_scenario_id` (pricing-chain forensics). | ✅ Accepted |
| **Q5** | Cut a fresh `d9c-pr1-rehearsal-2026-04-29` Neon branch. Rehearsal mandatory — no skipping. | ✅ Accepted |

### 3.6 Pre-flight schema findings (2026-04-29)

The runner's dry-run pre-flight against current prod surfaced two schema realities that diverge from the consumer inventory's assumptions:

- **`scenarios.deal_id` does not exist** on prod. The inventory assumed it; reality says no.
- **`scenarios.share_token` does not exist** on prod. Same.
- **`deals` table does not exist** on prod yet (UAD AD-7's full identity model is not landed).

**Adaptations:**
- `quotes.deal_id` ships as `UUID` (nullable, **no FK constraint**). The constraint will be added by a follow-up migration when the `deals` table is created. Code that creates quotes can populate `deal_id` whenever a `deals.id` becomes available, without a schema change.
- `quotes.share_token` ships as defined; backfilled `NULL` for the 2 historical rows that come from scenarios. Phase 2 onward populates it via the new send-quote code path.
- Backfill INSERT writes `NULL` for both columns, since the source rows in `scenarios` don't carry the data.
- The runner's `requiredScenarioCols` list omits `deal_id` and `share_token` accordingly.

**Why this is fine** (and why the spec stays valid):
- AD-10a doesn't require `deals` to exist for the scenarios split. The split is about decomposing the four overloaded concerns currently on `scenarios`; `deals` integration is a separate UAD axis.
- Code paths that create quotes today don't write `deal_id` (they couldn't — the column didn't exist). Post-migration, they still don't write `deal_id`, but the column is reserved for when they can.

**Source counts (prod, 2026-04-29):**
- Total scenarios: 56
- Borrower scenarios with `alert_status` set → `rate_alerts` target: 13
- MLO scenarios with `sent_at` set → `quotes` target: 2
- `scenario_alert_queue` rows to retarget: 100

---

## 4. New table: `rate_alerts`

Borrower-initiated subscriptions to rate updates on a saved scenario. Mutable.

```sql
CREATE TABLE rate_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  scenario_id     UUID NOT NULL REFERENCES scenarios(id) ON DELETE RESTRICT,
  contact_id      UUID REFERENCES contacts(id),  -- nullable; legacy borrower scenarios may not have a contact yet
  lead_id         UUID REFERENCES leads(id),     -- nullable; set when alert was born from a lead capture

  alert_status    TEXT NOT NULL DEFAULT 'active'
                    CHECK (alert_status IN ('active','paused','triggered','unsubscribed')),
  alert_frequency TEXT
                    CHECK (alert_frequency IN ('daily','2x_week','weekly','manual') OR alert_frequency IS NULL),
  alert_days      TEXT[]                          -- e.g. ARRAY['mon','wed','fri']
                    DEFAULT NULL,

  last_priced_at  TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ,
  send_count      INT NOT NULL DEFAULT 0,
  unsub_token     TEXT UNIQUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- one alert subscription per scenario (a scenario is either an alert or it isn't)
  CONSTRAINT rate_alerts_unique_scenario UNIQUE (scenario_id)
);

CREATE INDEX idx_rate_alerts_org_status ON rate_alerts(organization_id, alert_status);
CREATE INDEX idx_rate_alerts_contact ON rate_alerts(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_rate_alerts_unsub_token ON rate_alerts(unsub_token) WHERE unsub_token IS NOT NULL;
CREATE INDEX idx_rate_alerts_lead ON rate_alerts(lead_id) WHERE lead_id IS NOT NULL;
```

**Notes:**

- `scenario_id UNIQUE` enforces one subscription per scenario. If a borrower wants alerts on three different rate ladders, that's three scenarios with three rate_alerts.
- `ON DELETE RESTRICT` on scenario_id per Q2.
- `unsub_token` is `UNIQUE` so a single token resolves to one row (current behavior).
- `alert_days TEXT[]` matches the existing `scenarios.alert_days` shape.

### Backfill source

```sql
INSERT INTO rate_alerts (
  id, organization_id, scenario_id, contact_id, lead_id,
  alert_status, alert_frequency, alert_days,
  last_priced_at, last_sent_at, send_count, unsub_token,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  s.organization_id,
  s.id,
  s.contact_id,
  s.lead_id,
  s.alert_status,
  s.alert_frequency,
  s.alert_days,
  s.last_priced_at,
  s.last_sent_at,
  COALESCE(s.send_count, 0),
  s.unsub_token,
  s.created_at,
  s.updated_at
FROM scenarios s
WHERE s.owner_type = 'borrower'
  AND s.alert_status IS NOT NULL;  -- excludes scenarios that were saved but never opted into alerts
```

**Verification query post-backfill:**

```sql
SELECT
  (SELECT count(*) FROM scenarios WHERE owner_type='borrower' AND alert_status IS NOT NULL) AS source,
  (SELECT count(*) FROM rate_alerts) AS target;
-- Must be equal.
```

---

## 5. New table: `quotes`

MLO deliverables. Snapshot-on-send immutable per AD-12a.

```sql
CREATE TABLE quotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  scenario_id       UUID NOT NULL REFERENCES scenarios(id) ON DELETE RESTRICT,
  mlo_id            UUID REFERENCES staff(id),                  -- the MLO who built/sent it
  contact_id        UUID REFERENCES contacts(id),               -- the borrower it's addressed to
  deal_id           UUID,                                       -- nullable; FK constraint deferred until `deals` table exists (UAD AD-7) — see §3.6

  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','viewed','accepted','declined','expired')),

  attached_modules  JSONB DEFAULT '[]'::jsonb,                  -- [{moduleId, version, config}, ...] — populated when AD-11a registry lands

  share_token       TEXT UNIQUE,                                -- the magic-link token for /portal/quote/[token]

  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  pdf_url           TEXT,
  pdf_generated_at  TIMESTAMPTZ,

  version           INT NOT NULL DEFAULT 1,
  parent_quote_id   UUID REFERENCES quotes(id) ON DELETE SET NULL,  -- send-chain (Q4 lineage A)

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_org_status ON quotes(organization_id, status);
CREATE INDEX idx_quotes_scenario ON quotes(scenario_id);
CREATE INDEX idx_quotes_contact ON quotes(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_quotes_deal ON quotes(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_quotes_share_token ON quotes(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_quotes_mlo ON quotes(mlo_id) WHERE mlo_id IS NOT NULL;
```

**Notes:**

- **No `UNIQUE` on `scenario_id`** — a scenario can be re-quoted (new send creates new quote row pointing at same scenario).
- `parent_quote_id` is the **send-chain** lineage (Q4-A). `scenarios.parent_scenario_id` continues to be the **pricing-chain** lineage. Two independent lineages by design.
- `attached_modules` ships empty; AD-11a populates it later. Default `'[]'::jsonb` keeps NOT-NULL semantics without forcing schema knowledge.
- `share_token` UNIQUE because `/portal/quote/[token]` resolves a single quote.
- Immutability is enforced at the **application layer** (DAL writes block UPDATEs except for the small list of mutable fields: `viewed_at`, `pdf_url`, `pdf_generated_at`, `status` transitions). DB-level immutability via trigger considered and rejected — too rigid for the legitimate viewed_at write path.

### Backfill source

The current `scenarios` table holds MLO sends in rows where `owner_type='mlo' AND sent_at IS NOT NULL`. Backfill these into `quotes`:

```sql
INSERT INTO quotes (
  id, organization_id, scenario_id, mlo_id, contact_id, deal_id,
  status, share_token,
  sent_at, viewed_at, expires_at, pdf_url, pdf_generated_at,
  version, parent_quote_id,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),                 -- new quote id (independent of scenario id)
  s.organization_id,
  s.id,                              -- scenario_id — preserves the snapshot link
  s.mlo_id,
  s.contact_id,
  s.deal_id,
  COALESCE(s.status, 'sent'),        -- existing status maps directly; null → 'sent' (we know it was sent)
  s.share_token,
  s.sent_at,
  s.viewed_at,
  s.expires_at,
  s.pdf_url,
  s.pdf_generated_at,
  COALESCE(s.version, 1),
  NULL,                              -- parent_quote_id: backfill in pass 2 (see below)
  s.created_at,
  s.updated_at
FROM scenarios s
WHERE s.owner_type = 'mlo'
  AND s.sent_at IS NOT NULL;
```

**Pass 2 — backfill `parent_quote_id` from `parent_scenario_id`:**

```sql
UPDATE quotes q SET parent_quote_id = (
  SELECT q2.id FROM quotes q2
  WHERE q2.scenario_id = (SELECT s.parent_scenario_id FROM scenarios s WHERE s.id = q.scenario_id)
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM scenarios s WHERE s.id = q.scenario_id AND s.parent_scenario_id IS NOT NULL);
```

**Verification queries:**

```sql
-- Row count parity
SELECT
  (SELECT count(*) FROM scenarios WHERE owner_type='mlo' AND sent_at IS NOT NULL) AS source,
  (SELECT count(*) FROM quotes) AS target;
-- Must be equal.

-- Status distribution parity
SELECT 'src' AS lbl, COALESCE(status,'sent') AS s, count(*) FROM scenarios
  WHERE owner_type='mlo' AND sent_at IS NOT NULL GROUP BY 2
UNION ALL
SELECT 'tgt' AS lbl, status, count(*) FROM quotes GROUP BY 2
ORDER BY s, lbl;
-- Counts per status should match.

-- parent_quote_id orphan check
SELECT count(*) FROM quotes q
WHERE q.parent_quote_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM quotes q2 WHERE q2.id = q.parent_quote_id);
-- Must be 0.
```

---

## 6. Schema additions to existing tables

### 6.1 `scenarios.purge_at`

```sql
ALTER TABLE scenarios ADD COLUMN purge_at TIMESTAMPTZ;
CREATE INDEX idx_scenarios_purge_at ON scenarios(purge_at) WHERE purge_at IS NOT NULL;
```

**Semantics:** Anonymous pricing snapshots get a TTL. The cleanup cron deletes scenarios where `purge_at < now() AND owner_type='anonymous'` AND there are no rate_alerts/quotes references. Backfill leaves `purge_at = NULL` (no auto-purge for existing rows; explicit migration TBD).

Phase 1 only **adds** the column. The cleanup cron is **not** in scope here — wire it in a Phase-3 sub-PR or a separate maintenance PR.

### 6.2 `scenario_alert_queue.rate_alert_id`

```sql
ALTER TABLE scenario_alert_queue ADD COLUMN rate_alert_id UUID REFERENCES rate_alerts(id) ON DELETE CASCADE;

UPDATE scenario_alert_queue saq
SET rate_alert_id = (SELECT ra.id FROM rate_alerts ra WHERE ra.scenario_id = saq.scenario_id LIMIT 1)
WHERE saq.scenario_id IS NOT NULL;

-- Make it NOT NULL after backfill (any orphans will fail this and surface the bug).
ALTER TABLE scenario_alert_queue ALTER COLUMN rate_alert_id SET NOT NULL;

-- DO NOT drop scenario_alert_queue.scenario_id in this PR — Phase 4 cleanup.

CREATE INDEX idx_scenario_alert_queue_rate_alert ON scenario_alert_queue(rate_alert_id);
```

**Verification:**

```sql
-- Zero orphans
SELECT count(*) FROM scenario_alert_queue WHERE rate_alert_id IS NULL;
-- Must be 0.

-- All retargets resolve to a real rate_alert
SELECT count(*) FROM scenario_alert_queue saq
WHERE NOT EXISTS (SELECT 1 FROM rate_alerts ra WHERE ra.id = saq.rate_alert_id);
-- Must be 0.
```

---

## 7. Migration file structure

```
migrations/053_d9c_scenarios_split_phase1.sql        — idempotent SQL, top-to-bottom transactional where possible
scripts/_run-migration-053.mjs                       — runner with hard pre-flights
```

### 7.1 Pre-flight assertions (in `_run-migration-053.mjs`, fail loudly)

Per the namespace lessons from Phase 0 (CODING-PRINCIPLES.md "Inventory must include reverse-callers" + the IF-NOT-EXISTS-masks-conflicts lesson):

1. **Phase 0 invariant:** assert legacy `rate_alerts` (the dropped table) does NOT exist. If it exists, abort — Phase 0 wasn't applied to this DB.
2. **Quotes namespace clean:** assert `quotes` table does NOT exist. If it exists, abort — namespace conflict, investigate.
3. **`scenarios` shape sanity:** assert columns we depend on exist with expected types (`alert_status`, `alert_frequency`, `alert_days`, `last_priced_at`, `last_sent_at`, `send_count`, `unsub_token`, `sent_at`, `viewed_at`, `expires_at`, `pdf_url`, `pdf_generated_at`, `version`, `parent_scenario_id`, `share_token`, `mlo_id`, `contact_id`, `deal_id`, `owner_type`, `status`).
4. **Reverse-caller paranoia:** before run, the runner prints a count of distinct `mlo_id`/`contact_id`/`deal_id` values referenced — anything that resolves to a non-existent FK target during INSERT will fail loudly (no silent NULL fallback).
5. **Empty-target check:** `rate_alerts`, `quotes` row counts both 0 before INSERT (so the migration is restartable from a clean state, not from a partial run).

### 7.2 Transactional wrapping

All steps run inside a single `BEGIN; ... COMMIT;` block where Postgres allows. The two `ALTER TABLE` calls on `scenario_alert_queue` (ADD COLUMN, then SET NOT NULL after backfill) are inside the same transaction — if any verification query fails, the whole migration rolls back.

### 7.3 Post-migration verification (in runner, exit non-zero on any failure)

Runner executes the verification queries from §4, §5, §6.2 and the cross-checks below, fails the migration if any returns a mismatched count.

```sql
-- Cross-check: scenarios that became rate_alerts have matching org/contact/lead
SELECT count(*) FROM rate_alerts ra
JOIN scenarios s ON s.id = ra.scenario_id
WHERE ra.organization_id != s.organization_id
   OR (ra.contact_id IS DISTINCT FROM s.contact_id)
   OR (ra.lead_id IS DISTINCT FROM s.lead_id);
-- Must be 0.

-- Cross-check: scenarios that became quotes have matching org/mlo/contact/deal
SELECT count(*) FROM quotes q
JOIN scenarios s ON s.id = q.scenario_id
WHERE q.organization_id != s.organization_id
   OR (q.mlo_id IS DISTINCT FROM s.mlo_id)
   OR (q.contact_id IS DISTINCT FROM s.contact_id)
   OR (q.deal_id IS DISTINCT FROM s.deal_id);
-- Must be 0.
```

---

## 8. Risks & mitigations

Cross-references the inventory `D9C-PR1-SCENARIOS-CONSUMER-INVENTORY-2026-04-26.md §5`.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | `scenario_alert_queue` FK retarget orphans | LOW | CRITICAL | Pre-flight assertion #4 + post-migration verification §6.2 |
| 2 | `parent_quote_id` backfill misses (multiple scenarios with same parent) | MEDIUM | LOW | Pass-2 uses `LIMIT 1` deliberately — first-quote-per-scenario chain is acceptable; anomalies surface as backlog item |
| 3 | `updateScenario()` allowlist still permits alert/quote keys post-migration | HIGH | MEDIUM | Out of scope for Phase 1 — Phase 2 tightens the allowlist + adds runtime guard. **Document explicitly:** writes via the old DAL path keep working in interim because all columns still exist on `scenarios` |
| 4 | Transform function compat | LOW | LOW | Out of scope for Phase 1 — Phase 2 adapts signatures |
| 5 | `scenarios.status` overlap | LOW | LOW | Out of scope for Phase 1 — `scenarios.status` keeps its current values; Phase 4 drops the column |
| 6 | New table FK constraints prevent legacy delete-by-id paths | **NONE (verified)** | — | Reverse-caller grep run 2026-04-29 — see §8.1 below |
| 7 | Concurrent writes during migration | MEDIUM | LOW | Production migration runs during low-traffic window; transactional wrapping holds DB-level consistency. Risk is borrower scenario writes during the ~30-second backfill — accept and verify post-migration counts |

### 8.1 Risk 6 — verified clean (2026-04-29)

Per CODING-PRINCIPLES.md reverse-caller protocol, ran the full grep matrix:

```bash
# JS/SQL forms
grep -rnE "DELETE FROM scenarios\b|DELETE FROM \"scenarios\"" src/
grep -rnE "(sql|db|client)\.\`?DELETE.+FROM scenarios\b" src/
grep -rnE 'sql\`[^`]*DELETE[^`]*FROM\s+scenarios\b' src/

# Reverse-caller: HTTP DELETE handlers
grep -rnE "export async function DELETE" src/app/api/ | grep scenario

# Reverse-caller: client-side fetch DELETE
grep -rnE "method:\s*['\"]DELETE['\"]" src/

# Dynamic dispatch
grep -rniE "deleteScenario|scenario.*\.delete|delete.*scenario" src/
```

**Findings:**

- One direct DELETE: `src/lib/scenarios/db.js:387` — function `deleteScenario(id, orgId)`. **Dead code — zero callers across the codebase.**
- Zero HTTP DELETE handlers for any `/api/.../scenarios/[id]` path (not in `saved-scenario`, not in `mlo/quotes`, not anywhere).
- Fetch DELETE calls in components all target other resources (`/api/portal/mlo/hecm-scenarios/[id]`, docs, push subs, Zoho WorkDrive). `hecm_scenarios` is a separate table unaffected by D9c.
- The `deleteScenario()` function relies on DB-level CASCADE on `scenario_rates` / `scenario_fee_items` — those FK relationships are unchanged in Phase 1.

**Conclusion:** Phase 1 ships safely. The dead `deleteScenario()` function is a Phase-2 cleanup target (along with the rest of the DAL split); marking it deprecated mid-migration would just add noise to a migration-only PR. Captured as a Phase 2 done-criterion.

---

## 9. Reverse-caller verification (CODING-PRINCIPLES.md, backlog #115)

Per the SQL-aliased / rename-chain rule, before any Phase 4 column drop:

```bash
# JS-style property access
grep -rnE "scenarios?\.(alert_status|alert_frequency|alert_days|last_priced_at|last_sent_at|send_count|unsub_token|sent_at|viewed_at|expires_at|pdf_url|pdf_generated_at|version|parent_scenario_id|share_token|status)\b" src/

# SQL aliased forms
grep -rnE "(s|sc|scen)\.(alert_status|alert_frequency|alert_days|last_priced_at|last_sent_at|send_count|unsub_token|sent_at|viewed_at|expires_at|pdf_url|pdf_generated_at|version|parent_scenario_id|share_token|status)\b" src/

# AS aliases
grep -rnE "AS\s+(alert_status|alert_frequency|alert_days|last_priced_at|last_sent_at|send_count|unsub_token|sent_at|viewed_at|expires_at|pdf_url|pdf_generated_at|version|parent_scenario_id|share_token)" src/
```

Run pre-Phase-4 (not Phase 1). Phase 1 is additive — no drops yet. Captured here so the spec is complete and the next session has the verification protocol pre-written.

---

## 10. Rehearsal protocol (mandatory per Q5)

1. **Cut Neon branch** named `d9c-pr1-rehearsal-2026-04-29` from current prod.
2. **Apply migration** via `node scripts/_run-migration-053.mjs --connection-string=<rehearsal-url>`.
3. **Verify** all post-migration queries (§4, §5, §6.2, §7.3) return expected counts.
4. **Smoke test** (read-only against rehearsal DB):
   - `SELECT count(*) FROM rate_alerts` matches expected
   - `SELECT count(*) FROM quotes` matches expected
   - `SELECT count(*) FROM scenario_alert_queue WHERE rate_alert_id IS NULL` = 0
   - One sample `SELECT * FROM rate_alerts JOIN scenarios USING (id)` produces no errors (sanity on FK)
   - One sample `SELECT * FROM quotes JOIN scenarios ON quotes.scenario_id = scenarios.id` produces a row with non-null `sent_at`
5. **Tear down** the rehearsal Neon branch only after verification logs are captured to `Work/Dev/audits/D9C-PR1-PHASE1-REHEARSAL-LOG-2026-04-29.md`.
6. **Production migration** is a separate run — same script, prod connection string, during low-traffic window.

---

## 11. Done criteria for Phase 1 PR

- [ ] Migration file `migrations/053_d9c_scenarios_split_phase1.sql` exists and is idempotent
- [ ] Runner `scripts/_run-migration-053.mjs` exists with all pre-flights from §7.1
- [ ] Spec doc this file exists and is referenced from PR description
- [ ] Rehearsal log file exists with all §10 verification outputs
- [ ] Production migration applied; post-migration verification queries all green
- [ ] No code changes outside `migrations/`, `scripts/`, and `Work/Dev/audits/` (Phase 2/3 are separate PRs)
- [ ] Build green, no ESLint errors
- [ ] Vercel preview deploys successfully (no schema-dependent runtime breakage)
- [ ] Production smoke: existing borrower saved-scenario flow still works (writes go to scenarios via old DAL — Phase 2 hasn't moved them yet, but the migration must not break the existing flow)
- [ ] Production smoke: existing MLO quote send flow still works (same logic — old DAL writes to scenarios, new tables get populated only on next backfill run)

---

## 12. Phase 1 vertical-slice notes (forward-looking)

David called for vertical-slices architecture for future-proofing. Phase 1's data layer is the substrate; Phase 2/3 implementation should organize as:

```
src/lib/scenarios/        — pricing snapshot DAL (immutable post-insert)
  db.js                     — createScenario, getScenarioById, listScenarios
  transform.js              — rateRowToQuoteShape, feeItemsToBreakdownShape, deriveIdentity

src/lib/rate-alerts/      — subscription DAL (mutable)
  db.js                     — createRateAlert, getRateAlertByToken, updateRateAlert
  transform.js              — scenarioToSavedShape (now takes scenario + rate_alert)

src/lib/quotes/           — MLO deliverable DAL (immutable post-send)
  db.js                     — createQuote, getQuoteByShareToken, sendQuote (snapshot-on-send)
  transform.js              — scenarioToQuoteShape (now takes scenario + quote)
```

API surfaces follow the same vertical-slice pattern (Phase 3 PRs grouped by slice, not by file count).

This is captured here so the Phase 2 spec doesn't need to re-derive the organizing principle — it's a UAD-aligned structural decision, not a Phase-2-time invention.

---

## 13. Post-Phase-1 follow-ups (filed before Phase 1 PR ships)

- **Backlog item:** Phase 2 DAL split — depends on Phase 1 schema. Spec separately when Phase 1 lands.
- **Backlog item:** Phase 3 consumer rewrites — 3 sub-PRs grouped by slice (A: rate-alerts, B: quotes, C: shared cron).
- **Backlog item:** Phase 4 column drops on `scenarios` — only after Phase 3 lands and one full week of soak.
- **Backlog item:** `scenarios.purge_at` cleanup cron — wire when Phase 3 lands.

These get filed via TrackerPortal `/api/backlog` before Phase 1 PR opens, with explicit done-criteria each (per CODING-PRINCIPLES.md "Follow-ups need dates and criteria").

---

*End of Phase 1 spec. Awaiting David's review on the SQL specifics + rehearsal go-ahead. No SQL files written yet.*
