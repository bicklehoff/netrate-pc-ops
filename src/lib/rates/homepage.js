/**
 * Homepage Live Rates — thin wrapper around the canonical pricer.
 *
 * Replaces the parallel `homepage-db.js` engine (D9b.3). All pricing logic
 * now flows through `priceScenario()`, which is what /api/pricing, the MLO
 * quote generator, saved scenarios, and rate alerts use. One engine, no
 * drift between homepage and everything else.
 *
 * Used by: src/app/page.js, src/app/rate-watch/page.js
 *
 * Public display rules:
 *   - compRate=0 (borrower-paid view — don't factor broker comp into par
 *     selection, which would shift the published rate)
 *   - No buydown / IO / streamline / high-balance products — we show only
 *     standard owner-occupied fixed products
 *   - Par rate = lowest rate at/above finalPrice 100 (LoanSifter default,
 *     matches MND methodology) — picked via pickParRate()
 */

import sql from '@/lib/db';
import { priceScenario } from './price-scenario';
import { pickParRate } from './pick-par-rate';
import { DEFAULT_SCENARIO } from './defaults';
import { calculateMonthlyPI, calculateAPR } from '@/lib/mortgage-math';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Module-level cache — rates only change when a new sheet is parsed (~once/day).
// Keyed on effective_date so it auto-busts on new sheets. 30-min TTL as
// a safety net; ISR already caches the rendered pages at a higher level.
let cache = { data: null, sheetDate: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000;

async function getLatestSheetDate() {
  try {
    const rows = await sql`
      SELECT effective_date FROM rate_sheets
      WHERE status = 'active'
      ORDER BY effective_date DESC
      LIMIT 1
    `;
    return rows[0]?.effective_date || null;
  } catch (err) {
    console.error('[homepage] latest sheet date query failed:', err.message);
    return null;
  }
}

function formatDateShort(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

/**
 * Price one product using the canonical pricer, then apply pickParRate.
 * Returns a shape compatible with the previous homepage-db output.
 */
async function priceOne(loanType, termYears) {
  const result = await priceScenario({
    loanAmount: DEFAULT_SCENARIO.loanAmount,
    propertyValue: DEFAULT_SCENARIO.propertyValue,
    loanPurpose: DEFAULT_SCENARIO.loanPurpose,
    state: DEFAULT_SCENARIO.state,
    creditScore: DEFAULT_SCENARIO.fico,
    loanType,
    term: termYears,
    productType: 'fixed',
    lockDays: DEFAULT_SCENARIO.lockDays,
    // Public display — exclude broker comp from par selection
    borrowerPaid: true,
    // Match homepage-db filters — only standard owner-occupied products
    excludeStreamline: true,
    excludeInterestOnly: true,
    excludeHighBalance: true,
  });

  if (!result?.results?.length) return null;

  // priceScenario returns results with rate, finalPrice, etc.
  // pickParRate expects a ladder of { rate, finalPrice } — construct one.
  const ladder = result.results
    .filter((r) => r.rate != null && r.finalPrice != null)
    .map((r) => ({ rate: Number(r.rate), finalPrice: Number(r.finalPrice) }));

  if (!ladder.length) return null;

  const picked = pickParRate(ladder);
  if (!picked) return null;

  if (picked.reason === 'fallback_closest') {
    console.warn(
      `[homepage] No ${loanType} ${termYears}yr combo at/above par across any active lender — ` +
      `fell back to closest-to-par.`
    );
  }

  const loanAmount = DEFAULT_SCENARIO.loanAmount;
  const netCost = ((100 - picked.finalPrice) * loanAmount) / 100;
  const financeCharges = Math.max(0, netCost);

  return {
    rate: picked.rate,
    apr: calculateAPR(picked.rate, loanAmount, financeCharges, termYears),
    payment: Math.round(calculateMonthlyPI(picked.rate, loanAmount, termYears)),
    absCost: Math.abs(netCost),
    costDollars: Math.round(netCost),
  };
}

/**
 * Compute the 4 homepage display rates.
 * @returns {Promise<{ dateShort: string|null, conv30, conv15, fha30, va30 }|null>}
 */
export async function getHomepageLiveRates() {
  try {
    const latestSheetDate = await getLatestSheetDate();
    const sheetDateKey = latestSheetDate ? new Date(latestSheetDate).toISOString() : null;
    const now = Date.now();

    if (
      cache.data &&
      cache.sheetDate === sheetDateKey &&
      now - cache.fetchedAt < CACHE_TTL_MS
    ) {
      return cache.data;
    }

    const [conv30, conv15, fha30, va30] = await Promise.all([
      priceOne('conventional', 30),
      priceOne('conventional', 15),
      priceOne('fha', 30),
      priceOne('va', 30),
    ]);

    const result = {
      dateShort: formatDateShort(latestSheetDate),
      conv30,
      conv15,
      fha30,
      va30,
    };

    cache = { data: result, sheetDate: sheetDateKey, fetchedAt: now };
    return result;
  } catch (err) {
    console.error('[homepage] live rates computation failed:', err.message);
    return null;
  }
}
