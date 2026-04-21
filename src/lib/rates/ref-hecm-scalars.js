/**
 * DB-backed readers for the three HECM scalar reference tables
 * (D9d · migration 025): ref_hecm_limits, ref_hecm_ufmip,
 * ref_hecm_annual_mip.
 *
 * One module exposes all three readers because consumers typically
 * price a single HECM scenario and want all three scalars together —
 * colocating keeps the call-sites concise without conflating the
 * underlying tables (each scalar lives in its own table per the D9d
 * spec §4.2/§4.3 one-table-per-concept rule).
 *
 * Temporal `asOf` per D9d §5 convention; 1-hour cache; throws on
 * missing row (no silent fallback to a hardcoded constant).
 *
 * No runtime consumers yet — src/lib/hecm/constants.js still exports
 * UFMIP_RATE / DEFAULT_FHA_LIMIT / DEFAULT_MIP_RATE, and HECM pricing
 * code (src/lib/hecm/rate-sheet.js, plf-table.js) still imports from
 * there. Follow-up PR migrates those consumers to this DAL.
 */

import sql from '@/lib/db';

const TTL_MS = 60 * 60 * 1000;
const limitCache = new Map();
const ufmipCache = new Map();
const annualCache = new Map();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * HUD HECM Maximum Claim Amount (national, set annually by HUD).
 *
 * @param {Object} [params]
 * @param {Date} [params.asOf]  defaults to new Date()
 * @returns {Promise<number>}   MCA in whole dollars
 */
export async function getHecmMaxClaimAmount({ asOf = new Date() } = {}) {
  const k = dayKey(asOf);
  const cached = limitCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await sql`
    SELECT max_claim_amount
      FROM ref_hecm_limits
     WHERE effective_from <= ${k}::date
       AND (effective_to IS NULL OR effective_to > ${k}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) throw new Error(`No ref_hecm_limits row effective ${k}`);
  const value = Number(rows[0].max_claim_amount);
  limitCache.set(k, { value, at: Date.now() });
  return value;
}

/**
 * HECM upfront MIP rate (decimal, e.g. 0.02 = 2%).
 */
export async function getHecmUfmip({ asOf = new Date() } = {}) {
  const k = dayKey(asOf);
  const cached = ufmipCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await sql`
    SELECT rate
      FROM ref_hecm_ufmip
     WHERE effective_from <= ${k}::date
       AND (effective_to IS NULL OR effective_to > ${k}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) throw new Error(`No ref_hecm_ufmip row effective ${k}`);
  const value = Number(rows[0].rate);
  ufmipCache.set(k, { value, at: Date.now() });
  return value;
}

/**
 * HECM annual MIP rate (decimal, e.g. 0.005 = 0.50%).
 */
export async function getHecmAnnualMip({ asOf = new Date() } = {}) {
  const k = dayKey(asOf);
  const cached = annualCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await sql`
    SELECT rate
      FROM ref_hecm_annual_mip
     WHERE effective_from <= ${k}::date
       AND (effective_to IS NULL OR effective_to > ${k}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) throw new Error(`No ref_hecm_annual_mip row effective ${k}`);
  const value = Number(rows[0].rate);
  annualCache.set(k, { value, at: Date.now() });
  return value;
}

export function __clearCache() {
  limitCache.clear();
  ufmipCache.clear();
  annualCache.clear();
}
