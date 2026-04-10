/**
 * Rate Data DB Loader
 *
 * Loads rate data from the database in the exact shape the pricing engine expects.
 * Replaces the old parsed-rates.json / GCS loading path.
 *
 * Returns: Array of { lenderId, programs, sheetDate, lenderFee, compCap, priceFormat }
 *
 * Each program has: { name, loanType, term, productType, occupancy, rates, loanAmountRange, ... }
 * Each rate has: { rate, price, lockDays }
 */

import sql from '@/lib/db';

/**
 * Load all active rate data from the database.
 * Groups rate_prices by rate_products, grouped by lender.
 */
export async function loadRateDataFromDB() {
  // Get all active rate sheets with their lenders
  const activeSheets = await sql`
    SELECT
      rs.id, rs.lender_id, rs.effective_date, rs.status,
      rl.id AS lender_db_id, rl.code AS lender_code, rl.name AS lender_name,
      rl.uw_fee, rl.max_comp_cap_purchase, rl.max_comp_cap_refi,
      rl.comp_rate, rl.fha_ufmip, rl.price_format
    FROM rate_sheets rs
    JOIN rate_lenders rl ON rs.lender_id = rl.id
    WHERE rs.status = 'active'
      AND (rl.status IS NULL OR rl.status <> 'excluded')
  `;

  if (activeSheets.length === 0) return [];

  // For each active sheet, load all prices with their products
  const lenderDataMap = {};

  for (const sheet of activeSheets) {
    const lenderId = sheet.lender_code;

    // Load all prices for this sheet with their product taxonomy
    const prices = await sql`
      SELECT
        rp.rate, rp.price, rp.lock_days,
        rprod.id AS product_id, rprod.display_name, rprod.raw_name,
        rprod.loan_type, rprod.agency, rprod.term, rprod.product_type,
        rprod.arm_structure, rprod.tier, rprod.occupancy,
        rprod.is_high_balance, rprod.is_streamline, rprod.is_buydown,
        rprod.is_interest_only, rprod.loan_amount_min, rprod.loan_amount_max,
        rprod.loan_purpose
      FROM rate_prices rp
      JOIN rate_products rprod ON rp.product_id = rprod.id
      WHERE rp.rate_sheet_id = ${sheet.id}
      ORDER BY rp.rate ASC
    `;

    // Group prices by product
    const programMap = {};

    for (const price of prices) {
      const key = price.product_id;

      if (!programMap[key]) {
        programMap[key] = {
          id: price.product_id,
          name: price.display_name,
          rawName: price.raw_name,
          loanType: price.loan_type,
          investor: price.agency,
          category: ['conventional', 'fha', 'va', 'usda'].includes(price.loan_type) ? 'agency' : 'nonqm',
          subcategory: price.loan_type === 'conventional' ? (price.is_high_balance ? 'jumbo' : 'conventional') : price.loan_type,
          term: price.term,
          productType: price.product_type,
          armStructure: price.arm_structure,
          tier: price.tier,
          occupancy: price.occupancy,
          isHighBalance: price.is_high_balance,
          isStreamline: price.is_streamline,
          isBuydown: price.is_buydown,
          isInterestOnly: price.is_interest_only,
          loanPurpose: price.loan_purpose,
          loanAmountRange: {
            min: price.loan_amount_min || 0,
            max: price.loan_amount_max || null,
          },
          priceFormat: sheet.price_format || '100-based',
          rates: [],
          lockDays: [],
        };
      }

      programMap[key].rates.push({
        rate: Number(price.rate),
        price: Number(price.price),
        lockDays: price.lock_days,
      });

      if (!programMap[key].lockDays.includes(price.lock_days)) {
        programMap[key].lockDays.push(price.lock_days);
      }
    }

    // Build lender data object
    if (!lenderDataMap[lenderId]) {
      lenderDataMap[lenderId] = {
        lenderId,
        lenderName: sheet.lender_name,
        sheetDate: sheet.effective_date ? new Date(sheet.effective_date).toISOString().split('T')[0] : null,
        lenderFee: sheet.uw_fee != null ? Number(sheet.uw_fee) : null,
        compCap: {
          purchase: sheet.max_comp_cap_purchase != null ? Number(sheet.max_comp_cap_purchase) : null,
          refinance: sheet.max_comp_cap_refi != null ? Number(sheet.max_comp_cap_refi) : null,
        },
        compRate: sheet.comp_rate != null ? Number(sheet.comp_rate) : null,
        fhaUfmip: sheet.fha_ufmip != null ? Number(sheet.fha_ufmip) : null,
        priceFormat: sheet.price_format || '100-based',
        programs: [],
      };
    }

    lenderDataMap[lenderId].programs.push(...Object.values(programMap));
  }

  return Object.values(lenderDataMap);
}
