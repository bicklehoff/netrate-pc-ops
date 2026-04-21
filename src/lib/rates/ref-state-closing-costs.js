/**
 * DB-backed reader for ref_state_closing_costs (D9d · migration 024).
 *
 * Returns the state-level third-party closing-cost estimate used by
 * server-side quote + fee-breakdown code. The client-bundled
 * src/lib/rates/closing-costs.js keeps the same numbers in a
 * synchronous constant map for client-side initial-form-state use;
 * drift is prevented by scripts/check-state-closing-costs-parity.mjs.
 *
 * Mirrors the DAL shape of src/lib/rates/ref-fha-ufmip.js: temporal
 * asOf param, 1-hour in-memory cache, throws on missing row per D9d
 * §5 (no silent fallback to a hardcoded constant).
 */

import sql from '@/lib/db';

const TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Fetch the active third-party closing-cost row for a state.
 *
 * @param {Object} params
 * @param {string} params.state   2-letter state code
 * @param {Date}   [params.asOf]  defaults to new Date()
 * @returns {Promise<number>}     third-party cost in whole dollars
 */
export async function getStateClosingCost({ state, asOf = new Date() } = {}) {
  if (!state) throw new Error('getStateClosingCost: state is required');
  const stateCode = String(state).trim().toUpperCase();
  const k = `${stateCode}|${dayKey(asOf)}`;
  const cached = cache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const asOfKey = dayKey(asOf);
  const rows = await sql`
    SELECT third_party_cost
      FROM ref_state_closing_costs
     WHERE state = ${stateCode}
       AND effective_from <= ${asOfKey}::date
       AND (effective_to IS NULL OR effective_to > ${asOfKey}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) {
    throw new Error(`No ref_state_closing_costs row for ${stateCode} effective ${asOfKey}`);
  }
  const value = Number(rows[0].third_party_cost);
  cache.set(k, { value, at: Date.now() });
  return value;
}

export function __clearCache() {
  cache.clear();
}
