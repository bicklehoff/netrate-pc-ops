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
import { EMPTY_ADJ } from './empty-adj';
import { pickParRate } from './pick-par-rate';
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
 *
 * Iterates ALL active rate_sheets across ALL active lenders (one sheet per
 * lender — the most recently-effective one). For each, queries products
 * matching loan type + term, prices every (product × rate) combo through
 * priceRate() with DB adjustments, and collects the combined ladder.
 * pickParRate() then selects the rate a borrower would actually take —
 * lowest rate at/above par (matches LoanSifter default + MND par rule,
 * audit finding {pick-par-rate}).
 *
 * Previously this function did a single `LIMIT 1 ORDER BY effective_date DESC`
 * on rate_sheets, which picked whichever lender parsed most recently — the
 * returned "par" was that one lender's view, not the true best-across-lenders
 * par. This produced a homepage rate that diverged from /api/pricing's
 * output for the same scenario (D8 Pass 2 finding HP-B6). All-lenders
 * iteration aligns homepage-db.js with /api/pricing's best-across-lenders
 * semantics while keeping the intentional compRate=0 public-display behavior.
 */
async function priceProduct(loanType, termYears) {
  const loanAmount = DEFAULT_SCENARIO.loanAmount;
  const propertyValue = DEFAULT_SCENARIO.propertyValue;
  const ltv = Math.floor((loanAmount / propertyValue) * 10000) / 100;
  const fico = DEFAULT_SCENARIO.fico;
  const purpose = DEFAULT_SCENARIO.loanPurpose;

  // One active sheet per active lender — the most recently-effective one.
  // DISTINCT ON keeps the first row per lender after the ORDER BY, so the
  // `effective_date DESC` tiebreaker picks each lender's freshest active sheet.
  const sheetRows = await sql`
    SELECT DISTINCT ON (rs.lender_id)
      rs.id, rs.lender_id, rs.effective_date,
      rl.code AS lender_code, rl.name AS lender_name,
      rl.max_comp_cap_purchase, rl.max_comp_cap_refi, rl.price_format
    FROM rate_sheets rs
    JOIN rate_lenders rl ON rs.lender_id = rl.id
    WHERE rs.status = 'active' AND rl.status = 'active'
    ORDER BY rs.lender_id, rs.effective_date DESC
  `;

  if (!sheetRows.length) return null;

  const scenarioObj = {
    creditScore: fico,
    ltv,
    loanAmount,
    loanPurpose: purpose,
    state: DEFAULT_SCENARIO.state,
    loanType,
  };

  // 1. Collect every (lender × product × rate) combo into a single ladder.
  //    finalPrice is native to pricing (100 = par, >100 = credit to
  //    borrower, <100 = discount to borrower). We derive it from netCost so
  //    downstream code stays unit-agnostic.
  const ladder = [];

  for (const activeSheet of sheetRows) {
    const lenderCode = activeSheet.lender_code;

    // Build broker config per-lender for public display — comp is excluded.
    // Homepage/rate-watch shows borrower-facing par rates from the sheet.
    // Broker comp is our revenue, not a borrower cost — including it shifts
    // the "par" selection lower and produces misleading APRs.
    const brokerConfig = {
      compRate: 0,
      compCapPurchase: Number(activeSheet.max_comp_cap_purchase) || 3595,
      compCapRefi: Number(activeSheet.max_comp_cap_refi) || 3595,
    };

    // Get DB adjustments for this lender + loan type. Some lenders (e.g., TLS,
    // whose LLPAs are baked into product codes on the sheet) have no rows in
    // adjustment_rules — for those, fall back to EMPTY_ADJ so pricing proceeds
    // with zero adjustments instead of silently returning null. Matches the
    // behavior in price-scenario.js; an earlier hard-fail cascaded to the
    // hardcoded '5.875%' fallback in src/app/page.js:56 (D3 D0 re-audit,
    // resolved in PR #77).
    const lenderAdj = await getDbLenderAdj(lenderCode, loanType);
    const effectiveAdj = lenderAdj || EMPTY_ADJ;

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

    if (!products.length) continue;

    const matchingProducts = products.filter(p => {
      if (p.loan_amount_min && loanAmount < p.loan_amount_min) return false;
      if (p.loan_amount_max && loanAmount > p.loan_amount_max) return false;
      return true;
    });

    if (!matchingProducts.length) continue;

    for (const product of matchingProducts) {
      const prices = await sql`
        SELECT * FROM rate_prices
        WHERE product_id = ${product.id}
          AND rate_sheet_id = ${activeSheet.id}
          AND lock_days = 30
        ORDER BY rate ASC
      `;

      const productObj = {
        term: termYears,
        productType: 'fixed',
        investor: product.agency,
        tier: product.tier || 'core',
        name: product.display_name,
        lenderCode: lenderCode,
        uwFee: product.origination_fee || product.uw_fee || 999,
      };

      for (const price of prices) {
        const rate = Number(price.rate);
        const rateEntry = { rate, price: Number(price.price) };

        const result = priceRate(rateEntry, productObj, scenarioObj, effectiveAdj, brokerConfig);
        if (!result) continue;

        const netCost = (result.discountDollars || 0) - (result.rebateDollars || 0);
        const finalPrice = 100 - (netCost * 100 / loanAmount);
        ladder.push({ rate, finalPrice });
      }
    }
  }

  if (!ladder.length) return null;

  // 2. Let the shared par picker choose — LoanSifter rule (lowest rate whose
  //    best outcome is at or above par, fallback to closest-to-par).
  const picked = pickParRate(ladder);
  if (!picked) return null;

  if (picked.reason === 'fallback_closest') {
    console.warn(
      `[homepage-db] No ${loanType} ${termYears}yr combo at/above par across any active lender — ` +
      `fell back to closest-to-par. Check active rate sheets.`
    );
  }

  // 3. Recompute dollar fields from the chosen row. netCost: positive = borrower
  //    pays (discount), negative = borrower receives (credit/rebate).
  const netCost = (100 - picked.finalPrice) * loanAmount / 100;
  const financeCharges = Math.max(0, netCost);

  return {
    rate: picked.rate,
    apr: calculateAPR(picked.rate, loanAmount, financeCharges, termYears),
    payment: Math.round(calculatePI(picked.rate, loanAmount, termYears)),
    absCost: Math.abs(netCost),
    costDollars: Math.round(netCost),
  };
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
