/**
 * DB-backed readers for ref_state_tax_rates + ref_county_tax_rates
 * (D9d · migration 027).
 *
 * Two readers sharing one module since both answer the same question
 * (effective property tax rate for a location) at different
 * granularities. County reader falls back to state-average when no
 * county-specific row exists — matches the "is_placeholder" semantics
 * of the table and mirrors how src/data/county-tax-rates.js callers
 * already expect to be handled.
 *
 * Temporal `asOf` per D9d §5; 1-hour in-memory cache. Throws on
 * missing state row (we should have all 50 + DC seeded — a missing
 * state means bad data or an unexpected state code).
 */

import sql from '@/lib/db';

const TTL_MS = 60 * 60 * 1000;
const stateCache = new Map();
const countyCache = new Map();

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * State-average effective property tax rate.
 *
 * @param {Object} params
 * @param {string} params.state   2-letter state code
 * @param {Date}   [params.asOf]  defaults to new Date()
 * @returns {Promise<number>}     rate as decimal (e.g. 0.0071 for CA)
 */
export async function getStateTaxRate({ state, asOf = new Date() } = {}) {
  if (!state) throw new Error('getStateTaxRate: state is required');
  const stateCode = String(state).trim().toUpperCase();
  const k = `${stateCode}|${dayKey(asOf)}`;
  const cached = stateCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const asOfKey = dayKey(asOf);
  const rows = await sql`
    SELECT rate
      FROM ref_state_tax_rates
     WHERE state = ${stateCode}
       AND effective_from <= ${asOfKey}::date
       AND (effective_to IS NULL OR effective_to > ${asOfKey}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) {
    throw new Error(`No ref_state_tax_rates row for ${stateCode} effective ${asOfKey}`);
  }
  const value = Number(rows[0].rate);
  stateCache.set(k, { value, at: Date.now() });
  return value;
}

/**
 * County-level property tax rate. Falls back to state-average when no
 * county row exists — consumers can call this uniformly whether or
 * not we have county-specific data.
 *
 * @param {Object} params
 * @param {string} params.state        2-letter state code
 * @param {string} params.countyFips   5-char county FIPS (e.g. "06037" for LA)
 * @param {Date}   [params.asOf]       defaults to new Date()
 * @returns {Promise<{rate: number, source: 'county'|'state-fallback'}>}
 */
export async function getCountyTaxRate({ state, countyFips, asOf = new Date() } = {}) {
  if (!state) throw new Error('getCountyTaxRate: state is required');
  if (!countyFips) throw new Error('getCountyTaxRate: countyFips is required');
  const stateCode = String(state).trim().toUpperCase();
  const k = `${stateCode}|${countyFips}|${dayKey(asOf)}`;
  const cached = countyCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const asOfKey = dayKey(asOf);
  const rows = await sql`
    SELECT rate, is_placeholder
      FROM ref_county_tax_rates
     WHERE state = ${stateCode}
       AND county_fips = ${countyFips}
       AND effective_from <= ${asOfKey}::date
       AND (effective_to IS NULL OR effective_to > ${asOfKey}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;

  let value;
  if (rows.length && !rows[0].is_placeholder) {
    value = { rate: Number(rows[0].rate), source: 'county' };
  } else {
    const stateRate = await getStateTaxRate({ state: stateCode, asOf });
    value = { rate: stateRate, source: 'state-fallback' };
  }
  countyCache.set(k, { value, at: Date.now() });
  return value;
}

export function __clearCache() {
  stateCache.clear();
  countyCache.clear();
}
