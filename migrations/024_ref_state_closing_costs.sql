-- Migration 024: D9d · ref_state_closing_costs reference table.
--
-- Fourth D9d reference table. State-level third-party closing cost
-- estimates (title, escrow, appraisal, recording — excludes lender
-- fees). Currently seeded for the four NetRate-licensed states
-- (CO, TX, OR, CA) with values mirroring src/lib/rates/closing-costs.js.
-- That module stays in place as a client-bundled UX mirror (used
-- synchronously inside client components for initial form state and
-- dropdown labels); server-side code that wants the authoritative
-- per-state number reads from here via the DAL. Drift between the
-- mirror and this table is caught by scripts/check-state-closing-
-- costs-parity.mjs.
--
-- Unblocks D9b.11. Follows the D9d §3 universal pattern: temporal
-- versioning (effective_from/effective_to), source citation, audit
-- stamps, UNIQUE (state, effective_from) for supersede semantics.

BEGIN;

CREATE TABLE IF NOT EXISTS ref_state_closing_costs (
  id                   SERIAL PRIMARY KEY,
  effective_from       DATE NOT NULL,
  effective_to         DATE NULL,
  state                TEXT NOT NULL,
  third_party_cost     INT NOT NULL,
  source               TEXT NOT NULL,
  notes                TEXT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_state_closing_costs_lookup
  ON ref_state_closing_costs (state);

CREATE INDEX IF NOT EXISTS idx_ref_state_closing_costs_effective
  ON ref_state_closing_costs (effective_from, effective_to);

INSERT INTO ref_state_closing_costs (effective_from, state, third_party_cost, source, notes) VALUES
  ('2026-01-01', 'CO', 2800, 'NetRate internal estimate 2026', 'Title + escrow + appraisal + recording, Denver-metro baseline'),
  ('2026-01-01', 'TX', 3200, 'NetRate internal estimate 2026', 'Includes title company escrow + TX recording + state doc stamp'),
  ('2026-01-01', 'OR', 2600, 'NetRate internal estimate 2026', 'Portland-metro baseline'),
  ('2026-01-01', 'CA', 3500, 'NetRate internal estimate 2026', 'Higher baseline reflects CA title insurance premiums')
ON CONFLICT (state, effective_from) DO NOTHING;

COMMIT;
