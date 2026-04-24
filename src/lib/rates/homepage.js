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
import { loadSiteScenario, loadSurfaceConfig } from './site-scenario-config';
import { writeHomepageCache, readHomepageCache } from './homepage-cache';
import { calculateMonthlyPI, calculateAPR } from '@/lib/mortgage-math';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Module-level cache. Rate sheets update ~4x/day.
//
// Cache is keyed on MAX(rate_sheets.created_at) across active sheets
// rather than effective_date. When a lender re-uploads a sheet dated
// for the same effective_date (common — e.g. multi-sheet rate day or
// a mid-day refresh that re-parses), effective_date wouldn't move but
// created_at does, so the cache correctly busts. 30-min TTL is a
// safety net.
let cache = { data: null, version: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000;

async function getActiveSheetsInfo() {
  try {
    const rows = await sql`
      SELECT
        MAX(effective_date) AS latest_effective,
        MAX(created_at)     AS latest_created
      FROM rate_sheets
      WHERE status = 'active'
    `;
    const row = rows[0] || {};
    return {
      latestEffective: row.latest_effective || null,
      // Serialized to ISO for comparison; `max(created_at)` bumps every
      // time any lender's sheet is freshly inserted.
      version: row.latest_created ? new Date(row.latest_created).toISOString() : null,
    };
  } catch (err) {
    console.error('[homepage] active sheets query failed:', err.message);
    return { latestEffective: null, version: null };
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
 *
 * Scenario defaults + filter flags load from DB (site_scenarios +
 * surface_pricing_config) via the DAL. DAL falls back to DEFAULT_SCENARIO
 * constants if the DB read fails, so this path is safe even before the
 * migration has been applied.
 */
async function priceOne(scenario, config, loanType, termYears) {
  const result = await priceScenario({
    loanAmount: scenario.loanAmount,
    propertyValue: scenario.propertyValue,
    loanPurpose: scenario.loanPurpose,
    state: scenario.state,
    creditScore: scenario.fico,
    loanType,
    term: termYears,
    productType: 'fixed',
    lockDays: scenario.lockDays,
    // Broker comp: do NOT pass borrowerPaid unless the surface config
    // explicitly opts in. The pricer reads per-lender comp from
    // rate_lenders and deducts it inside priceRate() — that's the LPC
    // rate a borrower sees for public display.
    borrowerPaid: config.borrowerPaid,
    // Filter flags loaded from surface_pricing_config per D9b.6.
    excludeStreamline: config.excludeStreamline,
    excludeInterestOnly: config.excludeInterestOnly,
    excludeHighBalance: config.excludeHighBalance,
    excludeBuydowns: config.excludeBuydowns,
    excludeJumbo: config.excludeJumbo,
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

  const loanAmount = scenario.loanAmount;
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
 *
 * Fallback chain (D9b.7):
 *   1. Live priceScenario for all 4 products → write cache + return
 *   2. Live fails → read homepage_rate_cache → return last-known-good
 *      (tagged `source: 'cache'`)
 *   3. Cache also empty → return null; page.js shows graceful null state
 *
 * @returns {Promise<{ dateShort: string|null, conv30, conv15, fha30, va30, source?: 'cache' }|null>}
 */
export async function getHomepageLiveRates() {
  try {
    const { latestEffective: latestSheetDate, version } = await getActiveSheetsInfo();
    const now = Date.now();

    if (
      cache.data &&
      cache.version === version &&
      now - cache.fetchedAt < CACHE_TTL_MS
    ) {
      return cache.data;
    }

    // Load scenario + surface config once per render — DB-backed with
    // DEFAULT_SCENARIO fallback (see site-scenario-config.js).
    const [scenario, config] = await Promise.all([
      loadSiteScenario('homepage_default'),
      loadSurfaceConfig('homepage'),
    ]);

    // Sequential pricing to avoid hammering the DB/connection pool.
    // priceScenario caches lender data internally for 2 min — calls 2-4
    // hit cache.
    const conv30 = await priceOne(scenario, config, 'conventional', 30);
    const conv15 = await priceOne(scenario, config, 'conventional', 15);
    const fha30 = await priceOne(scenario, config, 'fha', 30);
    const va30 = await priceOne(scenario, config, 'va', 30);

    // Require at least one product to consider the compute a success.
    // If all four came back null (config warnings, missing products,
    // etc.) fall through to cache read — better to serve stale rates
    // than a null hero card.
    if (!conv30 && !conv15 && !fha30 && !va30) {
      throw new Error('priceScenario returned null for all homepage products');
    }

    const result = {
      dateShort: formatDateShort(latestSheetDate),
      conv30,
      conv15,
      fha30,
      va30,
    };

    cache = { data: result, version, fetchedAt: now };

    // Persist to last-known-good cache (best-effort, non-blocking for
    // the return value — if the cache write fails we still serve live).
    if (latestSheetDate) {
      writeHomepageCache(result, latestSheetDate).catch((err) => {
        console.error('[homepage] cache write failed:', err.message);
      });
    }

    return result;
  } catch (err) {
    console.error('[homepage] live rates computation failed:', err.message);
    // Fall back to last-known-good cache row. Returns null if cache is
    // also empty — page.js handles null with a graceful "rates
    // temporarily unavailable" state instead of stale hardcoded strings.
    const cached = await readHomepageCache();
    if (cached) {
      console.warn('[homepage] serving cached rates (live compute failed)');
    }
    return cached;
  }
}
