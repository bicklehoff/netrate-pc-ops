/**
 * Homepage Rate Computation — DB-driven
 * Server-side only — computes consumer-friendly rates using pricing-v2 + DB adjustments.
 * Same engine as the Rate Tool.
 *
 * Used by: page.js (homepage), rate-watch/page.js
 */

import sql from '@/lib/db';
import { priceRate } from './pricing-v2';
import { getDbLenderAdj } from './db-adj-loader';
import { DEFAULT_SCENARIO } from './defaults';
import { calculateMonthlyPI as calculatePI, calculateAPR } from '@/lib/mortgage-math';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


// ─── Homepage rate cache ─────────────────────────────────────────────
// Rates only change when a new sheet is parsed (~once/day).
// Cache keyed on effectiveDate so it auto-busts on new rate sheets.
// 30-minute TTL as safety net; ISR already caches the rendered pages.
let homepageCache = { data: null, sheetDate: null, fetchedAt: 0 }; // cache busted on deploy (cleared 2026-04-02)
const HOMEPAGE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Price a single product type using the DB-driven engine.
 * Queries: active rate sheet → products matching loan type + term → prices at 30-day lock
 * Then runs each through priceRate() with DB adjustments.
 * Returns the par rate (lowest cost to borrower).
 */
async function priceProduct(loanType, termYears) {
  const loanAmount = DEFAULT_SCENARIO.loanAmount;
  const propertyValue = DEFAULT_SCENARIO.propertyValue;
  const ltv = Math.floor((loanAmount / propertyValue) * 10000) / 100;
  const fico = DEFAULT_SCENARIO.fico;
  const purpose = DEFAULT_SCENARIO.loanPurpose;

  // Get active rate sheet with lender info
  const sheetRows = await sql`
    SELECT
      rs.id, rs.lender_id, rs.effective_date,
      rl.code AS lender_code, rl.name AS lender_name,
      rl.max_comp_cap_purchase, rl.max_comp_cap_refi, rl.price_format
    FROM rate_sheets rs
    JOIN rate_lenders rl ON rs.lender_id = rl.id
    WHERE rs.status = 'active'
    ORDER BY rs.effective_date DESC
    LIMIT 1
  `;
  const activeSheet = sheetRows[0];

  if (!activeSheet) return null;

  const lenderCode = activeSheet.lender_code;

  // Build broker config for public display — comp is excluded.
  // Homepage/rate-watch shows borrower-facing par rates from the sheet.
  // Broker comp is our revenue, not a borrower cost — including it shifts
  // the "par" selection lower and produces misleading APRs.
  const brokerConfig = {
    compRate: 0,
    compCapPurchase: Number(activeSheet.max_comp_cap_purchase) || 3595,
    compCapRefi: Number(activeSheet.max_comp_cap_refi) || 3595,
  };

  // Get DB adjustments for this lender + loan type
  const lenderAdj = await getDbLenderAdj(lenderCode, loanType);
  if (!lenderAdj) return null;

  // Find products matching our criteria
  const products = await sql`
    SELECT * FROM rate_products
    WHERE lender_id = ${activeSheet.lender_id}
      AND loan_type = ${loanType}
      AND term = ${termYears}
      AND product_type = 'fixed'
      AND occupancy = 'primary'
      AND is_high_balance = false
      AND is_streamline = false
      AND is_buydown = false
      AND is_interest_only = false
  `;

  if (!products.length) return null;

  // Filter products that cover our loan amount
  const matchingProducts = products.filter(p => {
    if (p.loan_amount_min && loanAmount < p.loan_amount_min) return false;
    if (p.loan_amount_max && loanAmount > p.loan_amount_max) return false;
    return true;
  });

  if (!matchingProducts.length) return null;

  let bestRate = null;

  for (const product of matchingProducts) {
    // Get prices for this product from the active sheet
    const prices = await sql`
      SELECT * FROM rate_prices
      WHERE product_id = ${product.id}
        AND rate_sheet_id = ${activeSheet.id}
        AND lock_days = 30
      ORDER BY rate ASC
    `;

    for (const price of prices) {
      const rate = Number(price.rate);
      const basePrice = Number(price.price);

      const rateEntry = { rate, price: basePrice };
      const productObj = {
        term: termYears,
        productType: 'fixed',
        investor: product.agency,
        tier: product.tier || 'core',
        name: product.display_name,
        lenderCode: lenderCode,
        uwFee: product.origination_fee || product.uw_fee || 999,
      };
      const scenarioObj = {
        creditScore: fico,
        ltv,
        loanAmount,
        loanPurpose: purpose,
        state: DEFAULT_SCENARIO.state,
        loanType,
      };

      const result = priceRate(rateEntry, productObj, scenarioObj, lenderAdj, brokerConfig);

      if (!result) continue;

      // Par rate = closest to zero net cost to borrower
      // rebateDollars > 0 means borrower receives money (negative cost)
      // discountDollars > 0 means borrower pays (positive cost)
      const netCost = (result.discountDollars || 0) - (result.rebateDollars || 0);
      const absCost = Math.abs(netCost);

      if (!bestRate || absCost < bestRate.absCost || (absCost === bestRate.absCost && rate < bestRate.rate)) {
        const financeCharges = Math.max(0, netCost);
        bestRate = {
          rate,
          apr: calculateAPR(rate, loanAmount, financeCharges, termYears),
          payment: Math.round(calculatePI(rate, loanAmount, termYears)),
          absCost,
          costDollars: Math.round(netCost),
        };
      }
    }
  }

  return bestRate;
}

/**
 * Compute homepage display rates from DB using pricing-v2 engine.
 * @returns {Object|null} { dateShort, conv30, conv15, fha30, va30 }
 *
 * Cached for 30 minutes, keyed on active sheet effective date.
 * When new rates are parsed (new sheet activated), cache auto-busts
 * because the effective date changes.
 */
export async function getHomepageRatesFromDB() {
  try {
    // Check active sheet date — this is ONE tiny query (just a date field)
    const dateRows = await sql`
      SELECT effective_date FROM rate_sheets
      WHERE status = 'active'
      ORDER BY effective_date DESC
      LIMIT 1
    `;
    const latestSheet = dateRows[0];

    const sheetDate = latestSheet?.effective_date ? new Date(latestSheet.effective_date).toISOString() : null;
    const now = Date.now();

    // Return cached result if:
    //   1. Same sheet date (no new rates parsed)
    //   2. Within TTL
    if (
      homepageCache.data &&
      homepageCache.sheetDate === sheetDate &&
      (now - homepageCache.fetchedAt) < HOMEPAGE_CACHE_TTL
    ) {
      return homepageCache.data;
    }

    let dateShort = null;
    if (latestSheet?.effective_date) {
      const d = new Date(latestSheet.effective_date);
      dateShort = `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    }

    // Price all products — sequential to avoid connection pool exhaustion
    const conv30 = await priceProduct('conventional', 30);
    const conv15 = await priceProduct('conventional', 15);
    const fha30 = await priceProduct('fha', 30);
    const va30 = await priceProduct('va', 30);

    const result = { dateShort, conv30, conv15, fha30, va30 };

    // Cache it
    homepageCache = { data: result, sheetDate, fetchedAt: now };

    return result;
  } catch (err) {
    console.error('DB homepage rate computation failed:', err.message);
    return null;
  }
}
