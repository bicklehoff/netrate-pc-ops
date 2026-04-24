-- Migration 049 — drop rate_lenders.price_format
--
-- All active lenders normalize rates to 100-based on parser output
-- (SWMC/AmWest explicitly compute `100 - rawValue`, Keystone/Windsor/
-- EverStream write 100-based directly). The conversion branch in
-- pricing-v2.js (`if (priceFormat === 'discount') return 100 - price`)
-- is retired in the same PR that applies this migration, so the column
-- is unused at runtime after deploy.
--
-- TLS is the only remaining discount-format parser, but TLS is marked
-- status='excluded' in rate_lenders and filtered out by db-loader.js.
-- If TLS is ever re-enabled, the parser must normalize to 100-based
-- at that time (see note in src/lib/rates/parsers/tls.js).
--
-- Safe to run only AFTER the code change is live on Vercel. The code
-- change removes all reads of rl.price_format; dropping the column
-- before deploy would 500 the pricing engine.

ALTER TABLE rate_lenders DROP COLUMN IF EXISTS price_format;
