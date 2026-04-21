/**
 * DB-backed reader for ref_fha_ufmip (D9d · migration 022).
 *
 * Returns HUD's upfront FHA mortgage-insurance-premium rate for a given
 * loan purpose + case type. Mirrors the DAL shape established by
 * src/lib/rates/ref-loan-limits.js: typed accessor, temporal `asOf`
 * param, 1-hour in-memory cache, explicit throw on missing row (no
 * silent hardcoded fallback — per D9d §5).
 *
 * Consumers (server-side pricing path):
 *   - src/lib/rates/price-scenario.js resolves fhaUfmip for each lender
 *     (lender-specific override from rate_lenders.fha_ufmip first, else
 *     this DAL for the HUD regulatory baseline).
 *   - src/lib/quotes/fee-builder.js reads UFMIP rate for fee breakdown.
 *   - src/lib/rates/pricing-v2.js no longer falls back to a constant —
 *     it throws if brokerConfig.fhaUfmip is missing on an FHA loan.
 *
 * src/lib/constants/fha.js retains a client-side FHA_UFMIP_RATE mirror
 * for QuoteScenarioForm's synchronous display label only.
 *
 * See Work/Dev/audits/D9d-REFERENCE-DATA-SPEC.md §4.2 for the table
 * design and §5 for DAL conventions.
 */

import sql from '@/lib/db';

const TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Look up the active FHA UFMIP rate for a loan purpose + case type, as of
 * the given date (defaults to NOW()). Pricing code that has locked a rate
 * should pass the lock date so historical quotes stay stable.
 *
 * @param {Object} params
 * @param {string} params.loanPurpose  'purchase' | 'refinance' | 'cashout'
 * @param {string} [params.caseType]   'standard' | 'streamline' — defaults to 'standard'
 * @param {Date}   [params.asOf]       defaults to new Date()
 * @returns {Promise<number>}          rate as decimal (e.g. 0.0175 for 1.75%)
 */
export async function getFhaUfmip({ loanPurpose, caseType = 'standard', asOf = new Date() } = {}) {
  if (!loanPurpose) {
    throw new Error('getFhaUfmip: loanPurpose is required');
  }
  const k = `${loanPurpose}|${caseType}|${dayKey(asOf)}`;
  const cached = cache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const asOfKey = dayKey(asOf);
  const rows = await sql`
    SELECT rate
      FROM ref_fha_ufmip
     WHERE loan_purpose = ${loanPurpose}
       AND case_type = ${caseType}
       AND effective_from <= ${asOfKey}::date
       AND (effective_to IS NULL OR effective_to > ${asOfKey}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) {
    throw new Error(
      `No ref_fha_ufmip row for ${loanPurpose}/${caseType} effective ${asOfKey}`
    );
  }
  const value = Number(rows[0].rate);
  cache.set(k, { value, at: Date.now() });
  return value;
}

/**
 * For testing / admin tooling. Clears the in-process cache so the next
 * read hits the DB. Not used by runtime code.
 */
export function __clearCache() {
  cache.clear();
}
