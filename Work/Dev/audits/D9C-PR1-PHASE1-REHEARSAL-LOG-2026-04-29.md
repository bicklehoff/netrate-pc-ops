# D9c PR-1 / Phase 1 — Rehearsal log

**Date:** 2026-04-29
**Neon project:** `aged-dew-33863780` (netrate_pc, neon-purple-xylophone)
**Rehearsal branch:** `br-lucky-sea-ai6oxn9z` (d9c-pr1-rehearsal-2026-04-29)
**Parent branch:** `br-little-shape-aixoyptk` (main / production)
**Endpoint:** `ep-royal-rice-aiue0k57.c-4.us-east-1.aws.neon.tech`
**Database:** `netrate_pc`

## Pre-rehearsal source counts (matched prod baseline)

| Metric | Rehearsal | Prod | Match |
|---|---|---|---|
| scenarios total | 56 | 56 | ✓ |
| scenarios (borrower + alert) → rate_alerts target | 13 | 13 | ✓ |
| scenarios (mlo + sent) → quotes target | 2 | 2 | ✓ |
| scenario_alert_queue rows → retarget | 100 | 100 | ✓ |

## Migration run

```
Migration 053 — D9c PR-1 / Phase 1 — scenarios split (additive)
Target: ep-royal-rice-aiue0k57-pooler.c-4.us-east-1.aws.neon.tech
Mode:   PRE-FLIGHT + APPLY + VERIFY

━━━ Pre-flight ━━━
  [1/5] rate_alerts: table absent (will be created)
  [2/5] quotes: table absent (will be created)
  [3/5] scenarios: all 24 depended-on columns present
  [4/5] scenario_alert_queue: 0 orphans (FK retarget is safe)
  [5/5] Source counts:
        scenarios total:                    56
        scenarios (borrower + alert):       13  → rate_alerts target
        scenarios (mlo + sent):             2  → quotes target
        scenario_alert_queue rows:          100  → all retarget

━━━ Applying migration 053 ━━━
  Parsed 21 statements from 053_d9c_scenarios_split_phase1.sql
  [01/21] CREATE TABLE IF NOT EXISTS rate_alerts (... ok
  [02/21] CREATE INDEX IF NOT EXISTS idx_rate_alerts_org_status... ok
  [03/21] CREATE INDEX IF NOT EXISTS idx_rate_alerts_contact... ok
  [04/21] CREATE INDEX IF NOT EXISTS idx_rate_alerts_unsub_token... ok
  [05/21] CREATE INDEX IF NOT EXISTS idx_rate_alerts_lead... ok
  [06/21] CREATE TABLE IF NOT EXISTS quotes (... ok
  [07/21] CREATE INDEX IF NOT EXISTS idx_quotes_org_status... ok
  [08/21] CREATE INDEX IF NOT EXISTS idx_quotes_scenario... ok
  [09/21] CREATE INDEX IF NOT EXISTS idx_quotes_contact... ok
  [10/21] CREATE INDEX IF NOT EXISTS idx_quotes_deal... ok
  [11/21] CREATE INDEX IF NOT EXISTS idx_quotes_share_token... ok
  [12/21] CREATE INDEX IF NOT EXISTS idx_quotes_mlo... ok
  [13/21] ALTER TABLE scenarios... ok
  [14/21] CREATE INDEX IF NOT EXISTS idx_scenarios_purge_at... ok
  [15/21] INSERT INTO rate_alerts (... ok
  [16/21] INSERT INTO quotes (... ok
  [17/21] UPDATE quotes q... ok
  [18/21] ALTER TABLE scenario_alert_queue... ok
  [19/21] UPDATE scenario_alert_queue saq... ok
  [20/21] ALTER TABLE scenario_alert_queue... ok
  [21/21] CREATE INDEX IF NOT EXISTS idx_scenario_alert_queue_rate_alert... ok
  ✓ Migration applied (21 statements)

━━━ Post-migration verification ━━━
  ✓ rate_alerts count:                13 (matches source)
  ✓ quotes count:                     2 (matches source)
  ✓ quotes status distribution matches: sent=1, viewed=1
  ✓ parent_quote_id orphans:          0
  ✓ scenario_alert_queue retarget:    0 NULLs, 0 dangling
  ✓ rate_alerts FK pass-through:      clean
  ✓ quotes FK pass-through:           clean
  ✓ scenarios.purge_at:               present

✅ Migration 053 verified clean.
```

## Idempotency re-run (2nd application against same branch)

Per CODING-PRINCIPLES.md restartability requirement. Re-running the runner against the already-migrated branch should be a no-op (CREATE TABLE IF NOT EXISTS + NOT EXISTS guards on INSERTs).

```
  [10/21] CREATE INDEX IF NOT EXISTS idx_quotes_deal... ok
  [11/21] CREATE INDEX IF NOT EXISTS idx_quotes_share_token... ok
  [12/21] CREATE INDEX IF NOT EXISTS idx_quotes_mlo... ok
  [13/21] ALTER TABLE scenarios... ok
  [14/21] CREATE INDEX IF NOT EXISTS idx_scenarios_purge_at... ok
  [15/21] INSERT INTO rate_alerts (... ok
  [16/21] INSERT INTO quotes (... ok
  [17/21] UPDATE quotes q... ok
  [18/21] ALTER TABLE scenario_alert_queue... ok
  [19/21] UPDATE scenario_alert_queue saq... ok
  [20/21] ALTER TABLE scenario_alert_queue... ok
  [21/21] CREATE INDEX IF NOT EXISTS idx_scenario_alert_queue_rate_alert... ok
  ✓ Migration applied (21 statements)

━━━ Post-migration verification ━━━
  ✓ rate_alerts count:                13 (matches source)
  ✓ quotes count:                     2 (matches source)
  ✓ quotes status distribution matches: sent=1, viewed=1
  ✓ parent_quote_id orphans:          0
  ✓ scenario_alert_queue retarget:    0 NULLs, 0 dangling
  ✓ rate_alerts FK pass-through:      clean
  ✓ quotes FK pass-through:           clean
  ✓ scenarios.purge_at:               present

✅ Migration 053 verified clean.
```

## Conclusion

**Migration 053 is verified safe to apply against production.**

- All 21 statements applied cleanly on first run
- All 8 post-migration verifications green
- Idempotency confirmed (2nd run = same row counts, no errors)
- Backfill counts match prod baseline exactly (13 rate_alerts, 2 quotes, 100 queue retargets)

Rehearsal branch `br-lucky-sea-ai6oxn9z` deleted via `scripts/_neon-branch.mjs delete`.

## Tooling note

This rehearsal was the first to use `scripts/_neon-branch.mjs` (created 2026-04-29). The script wraps Neon's REST API for branch lifecycle (create / list / delete / uri / list-projects). Future migrations should rehearse via this same helper rather than dashboard-clicking — reproducible, scriptable, and the URI flows directly into the migration runner via `--connection-string=$(node scripts/_neon-branch.mjs create rehearsal-NNN)`.
