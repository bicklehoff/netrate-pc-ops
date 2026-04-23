-- Migration 035 — UNIQUE index on contacts (organization_id, lower(email))
--
-- Context:
--   DB structure audit (§6.4) found that D9a identity unification assumed
--   email-scoped-per-org uniqueness but never enforced it at the DB layer.
--   `findOrCreateContactByEmail` in src/app/api/portal/mlo/quotes/route.js
--   depends on this uniqueness; without the constraint, a race between
--   two near-simultaneous quote creations can produce duplicate contacts
--   with the same email within an org.
--
--   Pre-flight (2026-04-23) verified zero duplicates in prod
--   for (organization_id, lower(email)) WHERE email IS NOT NULL. Safe
--   to add the constraint without a dedup pass.
--
-- Effect:
--   Creates a partial unique index. Partial (WHERE email IS NOT NULL)
--   so legacy rows with NULL email are not constrained. Lower(email)
--   so case variants (DAVID@x.com vs david@x.com) are treated as equal.
--
-- Idempotence:
--   CREATE UNIQUE INDEX IF NOT EXISTS is a no-op if the index already
--   exists with the same definition. If the name collides with a
--   different definition, Postgres raises an error — safe.

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_email_unique_idx
  ON contacts (organization_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
