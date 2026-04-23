-- Migration 028: staff.twilio_phone_number + seed David & Jamie.
--
-- Context:
-- Retires the global TWILIO_PHONE_NUMBER env var as the dialer's single
-- source of truth for outbound caller ID / SMS From. With two Twilio
-- numbers now ported (David = +13034445251 for 5251 + business main,
-- Jamie = +17205061311 as his eventual handoff), the routing must be
-- per-staff, not per-deploy.
--
-- Effects:
-- 1. ADD COLUMN staff.twilio_phone_number TEXT — nullable (not every staff
--    row owns a Twilio number; non-MLO roles stay NULL).
-- 2. UNIQUE CONSTRAINT — a Twilio number may only map to one staff at a
--    time. Enforced via a partial unique index (NULLs are not constrained).
-- 3. Seed the two known rows by explicit UUID.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS
-- + UPDATE by id (no-op if value already matches).

BEGIN;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS staff_twilio_phone_number_unique
  ON staff (twilio_phone_number)
  WHERE twilio_phone_number IS NOT NULL;

-- David Burson (admin) → +13034445251 (business main + his personal)
UPDATE staff SET twilio_phone_number = '+13034445251'
 WHERE id = '1e188a6f-b98b-4892-9979-28baaa8b4d85';

-- Jamie Cunningham (mlo) → +17205061311 (his future handoff number)
UPDATE staff SET twilio_phone_number = '+17205061311'
 WHERE id = 'e7dde2d1-f836-48e6-bb14-de52cecf3ac3';

COMMIT;
