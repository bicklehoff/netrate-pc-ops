-- Migration 053 — D9c PR-1 / Phase 1 — scenarios split (additive)
-- Date: 2026-04-29
-- Spec: Work/Dev/audits/D9C-PR1-PHASE1-MIGRATION-SPEC-2026-04-29.md
-- Tier: T3 — schema-touching, multi-consumer, cross-cutting
--
-- Implements UAD AD-10a: split overloaded `scenarios` table into three
-- conceptually distinct tables.
--
--   - `scenarios`         — immutable pricing snapshots (existing table; gets purge_at)
--   - `rate_alerts`       — borrower subscriptions (NEW; references scenarios)
--   - `quotes`            — MLO deliverables (NEW; references scenarios; immutable-on-send per AD-12a)
--
-- Phase 1 is ADDITIVE. No columns dropped from `scenarios`. Soak window
-- mandatory before Phase 4 cleanup (after Phase 2/3 consumer rewrites land).
--
-- Idempotency strategy (because Neon's HTTP driver runs each statement as a
-- separate HTTP request — no session-level transaction across calls):
--   - All CREATE statements use IF NOT EXISTS.
--   - Backfills are guarded by NOT EXISTS so re-running is safe.
--   - ALTER TABLE ADD COLUMN uses IF NOT EXISTS.
--   - The BEGIN; ... COMMIT; framing here is honored if the file is applied
--     via psql or another tool that maintains a single session. The runner
--     filters them out and relies on idempotency for safety on re-run.
--
-- The runner (scripts/_run-migration-053.mjs) executes pre-flights before
-- applying this file, and verification queries after. SQL alone is not
-- sufficient — run via the runner.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. New table: rate_alerts (borrower subscriptions, mutable)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  scenario_id     UUID NOT NULL REFERENCES scenarios(id) ON DELETE RESTRICT,
  contact_id      UUID REFERENCES contacts(id),
  lead_id         UUID REFERENCES leads(id),

  alert_status    TEXT NOT NULL DEFAULT 'active'
                    CHECK (alert_status IN ('active','paused','triggered','unsubscribed')),
  alert_frequency TEXT
                    CHECK (alert_frequency IN ('daily','2x_week','weekly','manual') OR alert_frequency IS NULL),
  alert_days      TEXT[] DEFAULT NULL,

  last_priced_at  TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ,
  send_count      INT NOT NULL DEFAULT 0,
  unsub_token     TEXT UNIQUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rate_alerts_unique_scenario UNIQUE (scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_alerts_org_status
  ON rate_alerts(organization_id, alert_status);
CREATE INDEX IF NOT EXISTS idx_rate_alerts_contact
  ON rate_alerts(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_alerts_unsub_token
  ON rate_alerts(unsub_token) WHERE unsub_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_alerts_lead
  ON rate_alerts(lead_id) WHERE lead_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. New table: quotes (MLO deliverables, immutable-on-send)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  scenario_id       UUID NOT NULL REFERENCES scenarios(id) ON DELETE RESTRICT,
  mlo_id            UUID REFERENCES staff(id),
  contact_id        UUID REFERENCES contacts(id),
  -- deal_id: column reserved per UAD AD-7 (strike rate lives on Deal). FK constraint
  -- intentionally omitted in Phase 1 because the `deals` table does not yet exist on prod.
  -- A follow-up migration adds the FK constraint when `deals` is created. Keeping the
  -- column nullable lets quotes-creation code be forward-compatible without a schema change.
  deal_id           UUID,

  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','viewed','accepted','declined','expired')),

  -- Populated when AD-11a calculator-module registry lands (ships empty here).
  attached_modules  JSONB NOT NULL DEFAULT '[]'::jsonb,

  share_token       TEXT UNIQUE,

  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  pdf_url           TEXT,
  pdf_generated_at  TIMESTAMPTZ,

  version           INT NOT NULL DEFAULT 1,
  parent_quote_id   UUID REFERENCES quotes(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_org_status
  ON quotes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_scenario
  ON quotes(scenario_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact
  ON quotes(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_deal
  ON quotes(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_share_token
  ON quotes(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_mlo
  ON quotes(mlo_id) WHERE mlo_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. scenarios.purge_at — TTL for anonymous pricing snapshots
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS purge_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scenarios_purge_at
  ON scenarios(purge_at) WHERE purge_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Backfill rate_alerts from scenarios (owner_type='borrower' + alert_status NOT NULL)
-- ─────────────────────────────────────────────────────────────────────

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
  AND s.alert_status IS NOT NULL
  -- Idempotency guard: don't re-backfill if a rate_alert already exists for this scenario.
  AND NOT EXISTS (SELECT 1 FROM rate_alerts ra WHERE ra.scenario_id = s.id);

-- ─────────────────────────────────────────────────────────────────────
-- 5. Backfill quotes from scenarios (owner_type='mlo' + sent_at NOT NULL)
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO quotes (
  id, organization_id, scenario_id, mlo_id, contact_id, deal_id,
  status, share_token,
  sent_at, viewed_at, expires_at, pdf_url, pdf_generated_at,
  version, parent_quote_id,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  s.organization_id,
  s.id,
  s.mlo_id,
  s.contact_id,
  NULL,  -- deal_id: scenarios doesn't carry deal_id today; quotes.deal_id populated by new code paths post-Phase-2
  CASE
    WHEN s.status IN ('draft','sent','viewed','accepted','declined','expired') THEN s.status
    ELSE 'sent'  -- defensive: if status is null or out-of-enum, we know it was sent
  END,
  NULL,  -- share_token: scenarios doesn't carry share_token today; quotes.share_token populated by new code paths post-Phase-2
  s.sent_at,
  s.viewed_at,
  s.expires_at,
  s.pdf_url,
  s.pdf_generated_at,
  COALESCE(s.version, 1),
  NULL,  -- parent_quote_id: backfilled in step 6
  s.created_at,
  s.updated_at
FROM scenarios s
WHERE s.owner_type = 'mlo'
  AND s.sent_at IS NOT NULL
  -- Idempotency guard: one quote per scenario in the backfill (re-runs no-op).
  AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.scenario_id = s.id);

-- ─────────────────────────────────────────────────────────────────────
-- 6. Backfill quotes.parent_quote_id from scenarios.parent_scenario_id chain
-- ─────────────────────────────────────────────────────────────────────

UPDATE quotes q
SET parent_quote_id = (
  SELECT q2.id FROM quotes q2
  WHERE q2.scenario_id = (
    SELECT s.parent_scenario_id FROM scenarios s WHERE s.id = q.scenario_id
  )
  LIMIT 1
)
WHERE q.parent_quote_id IS NULL
  AND EXISTS (
    SELECT 1 FROM scenarios s
    WHERE s.id = q.scenario_id AND s.parent_scenario_id IS NOT NULL
  );

-- ─────────────────────────────────────────────────────────────────────
-- 7. scenario_alert_queue.rate_alert_id — FK retarget (additive)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE scenario_alert_queue
  ADD COLUMN IF NOT EXISTS rate_alert_id UUID REFERENCES rate_alerts(id) ON DELETE CASCADE;

UPDATE scenario_alert_queue saq
SET rate_alert_id = (
  SELECT ra.id FROM rate_alerts ra WHERE ra.scenario_id = saq.scenario_id LIMIT 1
)
WHERE saq.rate_alert_id IS NULL
  AND saq.scenario_id IS NOT NULL;

-- After backfill, enforce NOT NULL. If any orphans exist (queue rows with no
-- matching rate_alert), this will fail and roll back the entire migration —
-- that's intentional: orphans are a bug we want to surface, not paper over.
ALTER TABLE scenario_alert_queue
  ALTER COLUMN rate_alert_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scenario_alert_queue_rate_alert
  ON scenario_alert_queue(rate_alert_id);

COMMIT;
