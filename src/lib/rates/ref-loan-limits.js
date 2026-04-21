/**
 * DB-backed reader for ref_county_loan_limits + ref_conforming_baselines.
 *
 * D9d's first reference-data DAL. Mirrors the API surface of the old
 * src/data/county-loan-limits.js module so consumers can migrate with
 * minimal churn (function names + return shapes match). The data source
 * is the DB; the JS module stays in place until the follow-up PR retires
 * all consumers, at which point it can be deleted.
 *
 * Every lookup is temporal: accepts an optional `asOf` Date (defaults to
 * NOW()). Pricing code that locks a rate should pass the lock date so
 * historical quotes stay stable; live display code passes NOW().
 *
 * Caching: each reader caches its query result keyed by `(asOf day, lookup
 * key)` with a 1-hour TTL. Reference data changes on a cadence measured
 * in months, so a 60-minute cache is strictly safe and saves ~one DB hit
 * per unique lookup per hour per serverless instance.
 *
 * See Work/Dev/audits/D9d-REFERENCE-DATA-SPEC.md for the umbrella design.
 */

import sql from '@/lib/db';

const TTL_MS = 60 * 60 * 1000;

// Cache keyed by a stringified composite so we never leak stale rows.
const baselineCache = new Map();   // key: asOfDay -> { value, at }
const countyCache = new Map();     // key: `${state}|${norm}|${asOfDay}` -> { value, at }

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Normalize county name: lowercase + strip common suffixes (County, Parish,
 * Borough, Census Area, Municipio, Municipality). Matches the normalizer
 * used at seed time in _run-migration-020.mjs so lookups resolve.
 */
function normalizeCounty(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+parish$/i, '')
    .replace(/\s+borough$/i, '')
    .replace(/\s+census area$/i, '')
    .replace(/\s+municipio$/i, '')
    .replace(/\s+municipality$/i, '');
}

/**
 * State abbreviation normalizer. Accepts either 'CA' or 'California'.
 */
const STATE_NAMES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI',
  idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE',
  nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX',
  utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

function normalizeState(state) {
  if (!state) return null;
  const trimmed = String(state).trim();
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return STATE_NAMES[trimmed.toLowerCase()] || null;
}

/**
 * Fetch the active conforming baseline row for a given date.
 * Returns { baseline_1unit, ..., high_balance_ceiling_1unit, ... }.
 */
export async function getConformingBaseline({ asOf = new Date() } = {}) {
  const k = dayKey(asOf);
  const cached = baselineCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const rows = await sql`
    SELECT baseline_1unit, baseline_2unit, baseline_3unit, baseline_4unit,
           high_balance_ceiling_1unit, high_balance_ceiling_2unit,
           high_balance_ceiling_3unit, high_balance_ceiling_4unit,
           effective_from, source
      FROM ref_conforming_baselines
     WHERE effective_from <= ${k}::date
       AND (effective_to IS NULL OR effective_to > ${k}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) {
    throw new Error(`No ref_conforming_baselines row for ${k}`);
  }
  const value = rows[0];
  baselineCache.set(k, { value, at: Date.now() });
  return value;
}

/**
 * Get per-county loan limits. Mirrors the return shape of the legacy
 * getLoanLimits() in src/data/county-loan-limits.js — conforming1Unit
 * through conforming4Unit, plus isBaseline, highBalance, and fhaLimit.
 *
 * Returns null for an unknown state/county pair.
 */
export async function getLoanLimits(state, county, { asOf = new Date() } = {}) {
  const stateAbbr = normalizeState(state);
  if (!stateAbbr || !county) return null;
  const norm = normalizeCounty(county);
  const k = `${stateAbbr}|${norm}|${dayKey(asOf)}`;
  const cached = countyCache.get(k);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const asOfKey = dayKey(asOf);
  const rows = await sql`
    SELECT state, county_fips, county_name,
           limit_1unit, limit_2unit, limit_3unit, limit_4unit,
           is_high_cost, effective_from
      FROM ref_county_loan_limits
     WHERE state = ${stateAbbr}
       AND county_name_norm = ${norm}
       AND effective_from <= ${asOfKey}::date
       AND (effective_to IS NULL OR effective_to > ${asOfKey}::date)
     ORDER BY effective_from DESC
     LIMIT 1
  `;
  if (!rows.length) {
    countyCache.set(k, { value: null, at: Date.now() });
    return null;
  }

  const row = rows[0];
  const baseline = await getConformingBaseline({ asOf });
  const isBaseline = !row.is_high_cost;
  const value = {
    year: new Date(row.effective_from).getUTCFullYear(),
    state: row.state,
    county: row.county_name,
    fips: row.county_fips,
    conforming1Unit: row.limit_1unit,
    conforming2Unit: row.limit_2unit,
    conforming3Unit: row.limit_3unit,
    conforming4Unit: row.limit_4unit,
    highBalance: !isBaseline,
    isBaseline,
    // FHA floor = 65% of baseline; FHA ceiling for high-cost = high-balance ceiling
    // capped at the national high-balance ceiling. Matches legacy formula.
    fhaLimit: isBaseline
      ? Math.round(baseline.baseline_1unit * 0.65)
      : Math.min(row.limit_1unit, baseline.high_balance_ceiling_1unit),
  };
  countyCache.set(k, { value, at: Date.now() });
  return value;
}

/**
 * Classify a loan as conforming / highBalance / jumbo. Same contract as
 * legacy classifyLoan(): compare to national baseline for conforming,
 * county-specific limit for high-balance, anything above is jumbo.
 */
export async function classifyLoan(loanAmount, state, county, units = 1, { asOf = new Date() } = {}) {
  const limits = await getLoanLimits(state, county, { asOf });
  if (!limits) return null;
  const unitKey = `conforming${units}Unit`;
  const conformingLimit = limits[unitKey];

  const baseline = await getConformingBaseline({ asOf });
  const baselines = {
    1: baseline.baseline_1unit,
    2: baseline.baseline_2unit,
    3: baseline.baseline_3unit,
    4: baseline.baseline_4unit,
  };
  const base = baselines[units] || baseline.baseline_1unit;

  if (loanAmount <= base) return 'conforming';
  if (loanAmount <= conformingLimit) return 'highBalance';
  return 'jumbo';
}

/**
 * For testing / admin tooling. Clears all in-process caches so the next
 * read hits the DB. Not used by runtime code.
 */
export function __clearCache() {
  baselineCache.clear();
  countyCache.clear();
}
