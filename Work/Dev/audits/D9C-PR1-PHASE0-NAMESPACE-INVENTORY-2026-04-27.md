# D9c PR-1 / Phase 0 — Namespace inventory + legacy disposition

**Date:** 2026-04-27
**Audit dimension:** D9c (UAD AD-10a)
**Driver:** PC Dev (`gracious-hellman-9f2b17` worktree)
**Status:** Inventory complete · disposition recommendation pending David's approval

> Phase 0 of D9c PR-1 — added 2026-04-27 after the rehearsal of migration 050 caught a pre-existing `rate_alerts` table that the scenarios-only inventory missed. Per Coding Principles (Tier 3 rigor, second-time-factor-out), this Phase 0 widens the inventory to the full namespace before any code lands. Findings + disposition recommendation below.

---

## 1. Why this Phase 0 exists

The original PR-1 inventory was scoped to consumers of the `scenarios` table. It did not check whether tables / routes / components named `rate_alert*` or `quote*` already existed. They do.

The migration 050 rehearsal caught it:

```
[1/27] CREATE TABLE IF NOT EXISTS rate_alerts (...)  → silently skipped (table existed)
[2/27] CREATE INDEX … ON rate_alerts(scenario_id)    → ERROR: column "scenario_id" does not exist
```

Per the Coding Principles framework added 2026-04-24, this should have been caught at inventory time, not at rehearsal time. Phase 0 is the corrective inventory.

---

## 2. Namespace inventory

### 2.1 Tables in the relevant namespace

| Table | Status | Purpose | Conflict with new design? |
|---|---|---|---|
| `scenarios` | live | Pricing snapshots + (overloaded) alert config + (overloaded) quote lifecycle | Source of AD-10a split |
| `scenario_rates` | live | Per-rate child of scenarios | Stays |
| `scenario_fee_items` | live | Per-fee child of scenarios | Stays |
| `scenario_alert_queue` | live | MLO review queue for re-priced borrower scenarios | FK retarget needed (already in mig 050 plan) |
| **`rate_alerts`** | **live · 9 rows · LEGACY** | **Email-only "set a rate alert" intake from `/rates` page. Write-only — nothing reads it.** | **Direct name collision.** |
| `lead_quotes` | live | (D9a-era artifact, separate from MLO quotes) | No conflict — different namespace |
| `push_subscriptions` | live | Web Push registrations for MLO PWA | No conflict |

**Quotes namespace:** clean. No pre-existing `quotes` table — the legacy `borrower_quotes` and `saved_scenarios` tables were dropped in migration 018 (D6 PR 14, 2026-04-21).

### 2.2 Columns named `purge_at`

None exist anywhere in the schema. Safe to add to `scenarios`.

### 2.3 Other relevant existing columns

- `scenarios.expires_at` — currently means "this quote expires on this date" (quote-lifecycle). Will move to `quotes.expires_at` in Phase 4 cleanup.
- `rate_alerts.confirm_token`, `rate_alerts.confirmed_at`, `rate_alerts.target_rate`, `rate_alerts.triggered_rate`, `rate_alerts.triggered_at` — all on the legacy table only.

---

## 3. Legacy `rate_alerts` — what it is

### 3.1 Schema (existing, prod)

23 columns on the legacy `rate_alerts` table:

```
id uuid (PK)
email text
type text                    -- always 'watch' (the 'strike'/target mode was retired)
loan_type text               -- e.g. 'conventional', nullable
target_rate numeric          -- vestigial — retired concept, not used
status text                  -- 'active' / 'paused'
last_notified_at timestamptz -- always NULL across all 9 rows
created_at, updated_at timestamptz
loan_amount numeric          -- nullable, never populated in current rows
state text                   -- nullable, never populated
term integer                 -- nullable, never populated
rate_alerts boolean          -- legacy opt-in flag
newsletter boolean
confirmed_at timestamptz     -- auto-set by route handler 0-5s after creation
confirm_token text
last_checked_at timestamptz  -- always NULL
notify_count integer         -- always 0
triggered_at timestamptz     -- always NULL
triggered_rate numeric       -- always NULL
contact_id text              -- text, not UUID — does NOT join to contacts table cleanly
source text                  -- always 'rate-tool' across all 9 rows
ga_client_id text            -- never populated
```

### 3.2 Code wiring

| File | Role | Notes |
|---|---|---|
| [src/app/api/rate-alert/route.js](src/app/api/rate-alert/route.js) | POST handler | Accepts `{email, loanType?, newsletter?, source?}`. UPSERTs into `rate_alerts`. Auto-sets `confirmed_at` immediately (TODO comment line 97 says "Send confirmation email via Resend"). Has rate-limit (5/min). No honeypot. No Turnstile. |
| [src/components/RateTool/RateAlertForm.js](src/components/RateTool/RateAlertForm.js) | UI component | Email-only form. Posts to `/api/rate-alert`. Fires `gtag('rate_alert_signup', …)`. |
| [src/app/rates/page.js](src/app/rates/page.js) | Page | Embeds `<RateAlertForm>` below the rate tool with copy "Not ready yet? Set a Rate Alert." Linked from public navigation. |

**No reader.** No cron, no API route, no MLO portal surface, no email send path queries this table. `vercel.json` only has a cron for `/api/cron/scenario-alerts` (the NEW system that reads `scenarios.alert_status='active'`, not `rate_alerts`).

The legacy `rate_alerts` table is **write-only**.

### 3.3 Activity (rehearsal-branch snapshot, 2026-04-27)

- 9 rows total
- All 9 confirmed within ≤5 seconds of creation (no human reads + clicks an email that fast — 100% bot signal)
- All `last_notified_at`, `triggered_at`, `notify_count` = NULL/0 — confirms nothing has ever been sent to any of these subscribers
- All sources = `'rate-tool'`, all types = `'watch'`
- Most recent: 2026-04-27, oldest: 2026-04-25
- Email patterns include classic Gmail-with-dots bot pattern, `admin@lakecountyca.gov`-style government addresses being spoofed, etc.

The auto-confirm path (route.js:97-101) is the bot vector. Line 97 has a TODO to wire Resend confirmation email. Until that lands, this form is a 100% pass-through to a write-only table.

### 3.4 Verdict

**Functionally dead.** Intake works → auto-confirmed → table grows → no one reads → no one notifies. It's a public-facing form that does nothing useful and provides a free spam vector against the database.

David's earlier statement (2026-04-26): *"a rate alert is only a notice of where rates are now. We retired, for now, the idea of a target rate for the borrower."* The legacy `rate_alerts.target_rate` column is exactly the retired concept. The route comment lines 14-17 confirm this in the code.

The actual rate-alert flow that *does* work is the new pipeline: borrower uses rate tool → submits with email via `/api/saved-scenario` → creates a scenario with `alert_status='active'` → `/api/cron/scenario-alerts` re-prices weekdays → routes to MLO via `scenario_alert_queue`. That flow is what AD-10a is splitting properly. The legacy `rate_alerts` is parallel dead code.

---

## 4. Disposition options

### Option A — Retire entirely (RECOMMENDED)
- Delete `src/app/api/rate-alert/route.js`
- Delete `src/components/RateTool/RateAlertForm.js`
- Remove the form section from `src/app/rates/page.js`
- Drop the legacy `rate_alerts` table (migration 052 — separate small PR before mig 053)

**Pros:**
- Removes a dead code path that has never produced value
- Eliminates a known spam vector (no honeypot/Turnstile, auto-confirm)
- Frees the `rate_alerts` name for the new architecture (matches AD-10a naming verbatim)
- All 9 rows are bots; nothing of borrower value is lost
- Real users who want rate alerts have the new flow (rate tool → save scenario → opt in)
- Tier 2 — single PR, well-bounded

**Cons:**
- The "Set a Rate Alert" CTA on /rates goes away. If the marketing intent was "give us your email even if you don't want to commit to a full scenario," that path is gone. (But the path was producing nothing, so we'd be replacing a fake feature with no feature.)
- Need to confirm with David that no marketing campaign points at `/rates#rate-alert` or similar anchor

**Estimate:** 1 PR · Tier 2 · ~1 hour of agent-time

### Option B — Rename legacy + leave it for later
- Rename `rate_alerts` → `rate_alert_signups`
- Update `/api/rate-alert/route.js` to write to the new name
- Keep the form, keep the (still-useless) backend
- File a backlog item to "wire it into the new system or kill it"

**Pros:**
- Lowest immediate change
- Frees the `rate_alerts` name for new design

**Cons:**
- Ships dead code into a new name. The Coding Principles explicitly warn against "We'll get to it" deferrals — the spec says these "almost always mean never."
- Spam vector remains
- Two parallel rate-alert concepts in the codebase, clearly mismatched
- Backlog item rots

**Estimate:** 1 PR · Tier 2 · ~30 min of agent-time

### Option C — Migrate forward (wire legacy into new system)
- Build a bridge so `/api/rate-alert` creates a Contact + minimal Scenario + Rate Alert
- Backfill the 9 existing rows
- Keep the form working with a pared-down "email-only" UX

**Pros:**
- Preserves the user-facing CTA on /rates
- No public-facing change

**Cons:**
- The legacy form captures `email` + `loan_type` only. The new RateAlert needs a `scenario_id` which needs FICO / state / loan_amount / etc. There is no clean way to bridge "email-only" to "full scenario."
- Forces inventing default scenario inputs for legacy signups, which is product fiction
- Inherits the bot signups and integrates them into the real subscriber data
- Tier 3 work piggybacking onto Tier 2 disposition — scope creep

**Estimate:** 2-3 PRs · Tier 3 · multi-session

---

## 5. Recommendation

**Option A — retire entirely.**

Senior-dev rationale per the Coding Principles framework:
- The feature is observably dead (write-only table, no reader, no cron, no notify path).
- All current data is bots — nothing of value to preserve.
- The new rate-alert flow via `/api/saved-scenario` + `/api/cron/scenario-alerts` is the real subscription pipeline, and AD-10a's `rate_alerts` table is its proper home.
- Option B is "we'll get to it" deferral that the spec explicitly warns against.
- Option C is sycophantic preservation of a feature that doesn't work.

**Risk to verify with David before executing:**
- Is there a marketing campaign / paid ad / partner integration that expects the `/rates`-page rate-alert form to be live? (If yes, retire-with-migration-to-new-flow becomes the path; if no, Option A is clean.)

---

## 6. Phase 0 PR scope (if Option A approved)

### Files
- DELETE `src/app/api/rate-alert/route.js`
- DELETE `src/components/RateTool/RateAlertForm.js`
- EDIT `src/app/rates/page.js` — remove the RateAlertForm section
- NEW `migrations/052_drop_legacy_rate_alerts.sql` — single statement: `DROP TABLE rate_alerts;`
- NEW `scripts/_run-migration-052.mjs` — runner with pre-flight that dumps the rows to a JSON archive file before drop (compliance / paranoia)
- EDIT `src/lib/loan-states.js` — keep `rate_alert: 'Rate Alert'` only if it's still used for loan_event display; verify and trim if dead
- EDIT `src/lib/constants/picklists.js` — verify no rate-alert-specific entry (likely just loan_type, but confirm)

### Migration
- Pure DROP TABLE — no data preservation needed for bots, but runner archives the 9 rows to `Work/Dev/audits/legacy-rate-alerts-snapshot-2026-04-27.json` for audit
- Rehearsal: skip allowed per DEV-PLAYBOOK (drop on a known dead table — nothing to corrupt). Run pre-flight against prod, eyeball the snapshot, drop.

### Order
1. Phase 0 PR ships (this work) — clears the namespace
2. Then re-rehearse migration 053 against a fresh Neon branch — should now apply cleanly
3. Then Phase 1 PR ships as already designed

---

## 7. Lessons captured (for the next inventory pass)

- The original inventory was *table-scoped*, not *namespace-scoped*. New convention: before adding any table, run a `\dt <name>*` check across the schema and a code grep across `src/` for the proposed table name and conceptually adjacent names.
- "IF NOT EXISTS" silently masks namespace conflicts. New convention: every migration that creates a table includes a pre-flight check in the runner that fails loudly if a table of that name *already exists with a different schema*, not just "exists."
- Senior-dev question to ask before any new table: "Does anything called this already exist? Does anything *like this* already exist?" If yes — disposition pass before design pass.

These belong in DEV-PLAYBOOK.md or a sibling Coding Principles enforcement note. File a follow-up to capture them.

---

*End of Phase 0 inventory. Awaiting David's go/no-go on Option A.*
