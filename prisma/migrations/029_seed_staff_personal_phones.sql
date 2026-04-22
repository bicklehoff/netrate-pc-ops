-- Migration 029: seed staff.phone for David & Jamie — personal cell fallback.
--
-- Context:
-- /api/dialer/incoming now rings both the MLO's browser client AND their
-- personal cell in parallel (<Client> + <Number> in a single <Dial>).
-- First to answer wins. This replaces the standalone "Fwd-Voice-to-David-Cell"
-- TwiML Bin forward — now the browser gets a shot at picking up, and the
-- cell is a safety net for when the MLO is away from desk.
--
-- staff.phone is already declared (nullable TEXT) but unused anywhere in
-- the codebase (verified via repo-wide grep — all .phone references are
-- contacts/leads/borrowers, not staff). This migration establishes the
-- column's semantics: staff.phone = MLO's personal cell for call-fallback
-- routing. Do NOT display publicly.
--
-- Bounded UPDATE by explicit UUID (2 rows). Idempotent.

BEGIN;

-- David Burson (admin) → +17204998384
UPDATE staff SET phone = '+17204998384'
 WHERE id = '1e188a6f-b98b-4892-9979-28baaa8b4d85';

-- Jamie Cunningham (mlo) → +13037319262
UPDATE staff SET phone = '+13037319262'
 WHERE id = 'e7dde2d1-f836-48e6-bb14-de52cecf3ac3';

COMMIT;
