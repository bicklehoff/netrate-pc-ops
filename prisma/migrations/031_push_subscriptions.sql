-- Migration 031: push_subscriptions table.
--
-- Stores each device's Web Push subscription so the server can send
-- notifications to the MLO's PWA (iPhone / Mac) when an inbound call
-- arrives. One staff member can have multiple subscriptions — one per
-- device they've installed the PWA on.
--
-- endpoint is globally unique within the push service — Twilio-issued
-- URL-like identifier. p256dh and auth are the ECDH keys the browser
-- hands us at subscribe time; the server uses them to encrypt the
-- payload so only the destination device can decrypt it.
--
-- user_agent is stored for debugging only (so we can tell David's
-- iPhone from his Mac in the DB).
--
-- Additive, idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS push_subscriptions_staff_id_idx
  ON push_subscriptions (staff_id);

COMMIT;
