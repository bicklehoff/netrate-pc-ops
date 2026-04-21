/**
 * DB-backed reader for ref_hecm_plf (D9d · migration 026).
 *
 * Returns the HUD PLF factor for a (expected rate, borrower age) pair.
 * Expected rate is passed as a percentage (e.g. 6.5 for 6.500%) and
 * internally converted to bps for the DB lookup — matches the row
 * storage format, which uses integer bps keys for exact-match
 * indexing.
 *
 * Temporal `asOf` per D9d §5 convention; 1-hour in-memory cache per
 * (rateBps, age, asOf-day) tuple. Throws on missing row (no silent
 * fallback to src/lib/hecm/plf-table.js, which remains the legacy
 * authoritative source until consumer retirement ships).
 *
 * The PLF grid is discrete. Callers whose expected rate falls between
 * two 0.125% increments (e.g. 6.437%) must round to the nearest
 * supported rate themselves — this DAL does not interpolate. HUD's
 * HECM pricing protocol specifies rounding up to the next 0.125%
 * increment for PLF lookup.
 */

import sql from '@/lib/db';

const TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Look up HECM PLF factor for an expected rate + age.
 *
 * @param {Object} params
 * @param {number} params.ratePct  expected rate as a percent (6.5 = 6.500%)
 * @param {number} params.age      borrower age, integer 62-99
 * @param {Date}   [params.asOf]   defaults to new Date()
 * @returns {Promise<number>}      PLF factor (0..1)
 */
export async function getHecmPlf({ ratePct, age, asOf = new Date() } = {}) {
  if (ratePct == null || !Number.isFinite(ratePct)) {
    throw new Error('getHecmPlf: ratePct (percent) is required');
  }
  if (age == null || !Number.isInteger(age)) {
    throw new Error('getHecmPlf: age (integer) is required');
  }
  const rateBps = Math.round(Number(ratePct) * 100);
  const day = dayKey(asOf);
  const k = `${rateBps}|${age}|${day}`;
  const cached = cache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await sql`
    SELECT plf_factor
      FROM ref_hecm_plf
     WHERE expected_rate_bps = ${rateBps}
       AND age = ${age}
       AND effective_from <= ${day}::date
       AND (effective_to IS NULL OR effective_to > ${day}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) {
    throw new Error(`No ref_hecm_plf row for ${(rateBps / 100).toFixed(3)}% / age ${age} effective ${day}`);
  }
  const value = Number(rows[0].plf_factor);
  cache.set(k, { value, at: Date.now() });
  return value;
}

export function __clearCache() {
  cache.clear();
}
