/**
 * Last-known-good cache for homepage rate rows (D9b.7).
 *
 * Writer — called after every successful live compute in homepage.js.
 * Reader — called when the live compute fails; returns whatever was
 * last written. Retires the hardcoded '5.875% / Mar 24, 2026 / ...'
 * fallback literals in src/app/page.js by giving the homepage a real
 * last-known-good value instead of a 3-week-stale compiled string.
 *
 * The cache row is always the last successful output — there's no TTL.
 * A row from 3 days ago is still strictly better than a hardcoded string
 * that was already stale when the site was last deployed.
 */

import sql from '@/lib/db';

const SCENARIO_SLUG = 'homepage_default';

/** Product rows we cache. Must match what homepage.js computes. */
const HOMEPAGE_PRODUCTS = [
  { key: 'conv30', loanType: 'conventional', term: 30 },
  { key: 'conv15', loanType: 'conventional', term: 15 },
  { key: 'fha30', loanType: 'fha', term: 30 },
  { key: 'va30', loanType: 'va', term: 30 },
];

/**
 * Write the computed homepage rates to cache. Called after every
 * successful live compute. Individual writes are best-effort — cache
 * write failures are logged but do not propagate (cache is belt-and-
 * suspenders, not a critical path).
 *
 * @param {object} rates — { conv30, conv15, fha30, va30 } each with
 *   { rate, apr, payment, costDollars, lender?, finalPrice? } shape
 * @param {Date|string} effectiveDate — rate_sheets.effective_date at
 *   compute time; persisted so reader can surface "as of {date}"
 */
export async function writeHomepageCache(rates, effectiveDate) {
  if (!rates || !effectiveDate) return;

  const effectiveDateIso = effectiveDate instanceof Date
    ? effectiveDate.toISOString().split('T')[0]
    : String(effectiveDate).split('T')[0];

  for (const p of HOMEPAGE_PRODUCTS) {
    const row = rates[p.key];
    if (!row?.rate) continue;

    try {
      await sql`
        INSERT INTO homepage_rate_cache (
          scenario_slug, loan_type, term,
          rate, apr, monthly_pi, final_price, lender,
          effective_date, computed_at
        ) VALUES (
          ${SCENARIO_SLUG}, ${p.loanType}, ${p.term},
          ${row.rate}, ${row.apr ?? null}, ${row.payment ?? null},
          ${row.finalPrice ?? null}, ${row.lender ?? null},
          ${effectiveDateIso}, NOW()
        )
        ON CONFLICT (scenario_slug, loan_type, term)
        DO UPDATE SET
          rate = EXCLUDED.rate,
          apr = EXCLUDED.apr,
          monthly_pi = EXCLUDED.monthly_pi,
          final_price = EXCLUDED.final_price,
          lender = EXCLUDED.lender,
          effective_date = EXCLUDED.effective_date,
          computed_at = NOW()
      `;
    } catch (err) {
      console.error(`[homepage-cache] write failed for ${p.key}:`, err.message);
    }
  }
}

/**
 * Read the last-known-good cache. Called when live compute fails.
 * Returns the same shape homepage.js produces on success, plus a
 * `source: 'cache'` marker so callers can flag staleness if desired.
 *
 * @returns {Promise<{ dateShort: string|null, conv30, conv15, fha30, va30, source: 'cache' }|null>}
 */
export async function readHomepageCache() {
  try {
    const rows = await sql`
      SELECT loan_type, term, rate, apr, monthly_pi AS payment,
             final_price, lender, effective_date, computed_at
      FROM homepage_rate_cache
      WHERE scenario_slug = ${SCENARIO_SLUG}
    `;
    if (!rows?.length) return null;

    const byKey = {};
    let maxEffective = null;
    for (const p of HOMEPAGE_PRODUCTS) {
      const row = rows.find((r) => r.loan_type === p.loanType && Number(r.term) === p.term);
      if (row) {
        byKey[p.key] = {
          rate: Number(row.rate),
          apr: row.apr != null ? Number(row.apr) : null,
          payment: row.payment != null ? Number(row.payment) : null,
          finalPrice: row.final_price != null ? Number(row.final_price) : null,
          lender: row.lender ?? null,
        };
        const rowEffective = row.effective_date instanceof Date
          ? row.effective_date
          : new Date(row.effective_date);
        if (!maxEffective || rowEffective > maxEffective) {
          maxEffective = rowEffective;
        }
      }
    }

    if (!byKey.conv30 && !byKey.conv15 && !byKey.fha30 && !byKey.va30) return null;

    return {
      dateShort: formatDateShort(maxEffective),
      conv30: byKey.conv30 || null,
      conv15: byKey.conv15 || null,
      fha30: byKey.fha30 || null,
      va30: byKey.va30 || null,
      source: 'cache',
    };
  } catch (err) {
    console.error('[homepage-cache] read failed:', err.message);
    return null;
  }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateShort(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}
