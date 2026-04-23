-- Migration 023: D9d · ref_va_funding_fee table (empty — schema only).
--
-- Third D9d reference table. Per the D9d spec §8 Q2 decision, we're
-- shipping the schema now and populating when VA pricing becomes a
-- real product. Reasoning: schema is cheap, a future refactor adding
-- the schema is not. Until VA pricing ships, NetRate has no consumer
-- that charges the fee — today it's disclosed in prose only on the
-- VA landing page (REF-8 from Pass 8 inventory).
--
-- Keys match spec §4.2: (effective_from, purpose, down_payment_min,
-- is_first_use, is_exempt). Populating the grid at seed time is
-- deferred — when the VA pricer ships it can decide whether IRRRL is
-- its own `purpose` value or a sub-case, how to represent exempt-
-- veteran rows (single row vs cartesian zeros), and what `case_type`
-- distinctions are needed. None of those decisions should be locked in
-- by today's empty-table migration.
--
-- No consumer, no DAL, no seed in this PR. See D9d spec §8 Q2 and
-- D9d-REFERENCE-DATA-SPEC.md §7 build order.

BEGIN;

CREATE TABLE IF NOT EXISTS ref_va_funding_fee (
  id                SERIAL PRIMARY KEY,
  effective_from    DATE NOT NULL,
  effective_to      DATE NULL,
  purpose           TEXT NOT NULL,
  down_payment_min  NUMERIC(5, 4) NOT NULL,
  is_first_use      BOOLEAN NOT NULL,
  is_exempt         BOOLEAN NOT NULL,
  rate              NUMERIC(7, 6) NOT NULL,
  source            TEXT NOT NULL,
  notes             TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purpose, down_payment_min, is_first_use, is_exempt, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ref_va_funding_fee_lookup
  ON ref_va_funding_fee (purpose, is_first_use, is_exempt);

CREATE INDEX IF NOT EXISTS idx_ref_va_funding_fee_effective
  ON ref_va_funding_fee (effective_from, effective_to);

COMMIT;
