/**
 * Homepage Live Rates — thin wrapper around the canonical pricer.
 *
 * Replaces homepage-db.js. All pricing logic goes through priceScenario(),
 * which reads comp config from rate_lenders per lender and applies it
 * correctly (LPC deduction from wholesale sheet price → public display rate).
 *
 * This wrapper:
 *   1. Fetches the active sheet date (for the "Apr 17, 2026" label)
 *   2. Calls priceScenario() for each of the 4 homepage products
 *      passing opt-in filter flags to exclude non-standard products
 *   3. Applies pickParRate() to each ladder
 *   4. Returns the shape the homepage + rate-watch pages expect
 *
 * Used by: src/app/page.js, src/app/rate-watch/page.js
 */

import sql from '@/lib/db';
import { priceScenario } from './price-scenario';
import { pickParRate } from './pick-par-rate';
import { DEFAULT_SCENARIO } from './defaults';
import { calculateMonthlyPI, calculateAPR } from '@/lib/mortgage-math';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Module-level cache. Rate sheets update ~4x/day. Cache is keyed on
// rate_sheets.effective_date so it auto-busts the moment a new sheet
// activates — next visitor triggers a fresh compute. 30-min TTL is a
// safety net for the unlikely case where effective_date hasn't moved
// but the underlying data did (shouldn't happen, but cheap insurance).
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
 * Price one (loanType × term) combination through the canonical pricer.
 * priceScenario() reads per-lender compRate/caps from rate_lenders and
 * deducts broker comp from the wholesale sheet price — the result is
 * the LPC rate a borrower would see.
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
    // Default broker config (LPC) — do NOT pass borrowerPaid: true. The
    // pricer reads comp_rate + caps from rate_lenders per lender and
    // applies them inside priceRate(). That's exactly what we want for
    // public display.
    // Public-display filters — only show standard owner-occupied
    // fully-amortizing conforming products, matching historical homepage-db.
    excludeStreamline: true,
    excludeInterestOnly: true,
    excludeHighBalance: true,
    excludeJumbo: true,
  });

  if (!result?.results?.length) return null;

  const ladder = result.results
    .filter((r) => r.rate != null && r.finalPrice != null)
    .map((r) => ({ rate: Number(r.rate), finalPrice: Number(r.finalPrice) }));

  if (!ladder.length) return null;

  const picked = pickParRate(ladder);
  if (!picked) return null;

  if (picked.reason === 'fallback_closest') {
    console.warn(
      `[homepage] No ${loanType} ${termYears}yr combo at/above par — ` +
      `fell back to closest-to-par. Check active rate sheets.`
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
 * Compute the 4 homepage display products.
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

    // Sequential to avoid hammering the DB/connection pool. These aren't
    // parallelizable cheaply either — priceScenario caches lender data
    // internally for 2 min, so the 2nd-4th calls hit cache.
    const conv30 = await priceOne('conventional', 30);
    const conv15 = await priceOne('conventional', 15);
    const fha30 = await priceOne('fha', 30);
    const va30 = await priceOne('va', 30);

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
