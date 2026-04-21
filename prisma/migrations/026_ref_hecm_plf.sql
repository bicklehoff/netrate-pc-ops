-- Migration 026: D9d · ref_hecm_plf (HECM Principal Limit Factor table).
--
-- Fifth HECM table in the D9d cluster. The full HUD PLF grid —
-- expected rate × borrower age → principal limit factor. Seeded from
-- src/lib/hecm/plf-table.js, which was itself extracted from a HUD
-- reference spreadsheet and has been the authoritative source for
-- NetRate's HECM pricing to date.
--
-- Grid shape: expected rates from 3.000% to 18.875% in 0.125%
-- increments (128 rates) × ages 62-99 (38 ages) = 4,864 cells.
-- Stored one row per cell so queries can filter by rate+age directly.
--
-- Key: (effective_from, expected_rate_bps, age). Rate stored as bps
-- (integer basis points) to avoid floating-point lookup fuzziness —
-- 3.000% → 300, 6.500% → 650, 18.875% → 1888 (round half up).
--
-- Seed effective_from = 2017-10-02 (HUD ML 2017-12, which mandated
-- the current PLF schedule). The PLF tables have been stable since.

BEGIN;

CREATE TABLE IF NOT EXISTS ref_hecm_plf (
  id                 SERIAL PRIMARY KEY,
  effective_from     DATE NOT NULL,
  effective_to       DATE NULL,
  expected_rate_bps  INT NOT NULL,
  age                INT NOT NULL CHECK (age BETWEEN 18 AND 110),
  plf_factor         NUMERIC(5, 4) NOT NULL CHECK (plf_factor >= 0 AND plf_factor <= 1),
  source             TEXT NOT NULL,
  notes              TEXT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (effective_from, expected_rate_bps, age)
);

CREATE INDEX IF NOT EXISTS idx_ref_hecm_plf_lookup
  ON ref_hecm_plf (expected_rate_bps, age);

CREATE INDEX IF NOT EXISTS idx_ref_hecm_plf_effective
  ON ref_hecm_plf (effective_from, effective_to);

-- Seed rows inserted by the companion runner script
-- (_run-migration-026.mjs) — the grid is 4,864 cells and lives in
-- src/lib/hecm/plf-table.js which uses ESM syntax not loadable by a
-- plain Node require. Runner parses the file and batch-inserts.

COMMIT;
