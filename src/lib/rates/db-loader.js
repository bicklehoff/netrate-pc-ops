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

import prisma from '@/lib/prisma';

/**
 * Load all active rate data from the database.
 * Groups rate_prices by rate_products, grouped by lender.
 */
export async function loadRateDataFromDB() {
  // Get all active rate sheets with their lenders
  const activeSheets = await prisma.rateSheet.findMany({
    where: { status: 'active' },
    include: {
      lender: true,
    },
  });

  if (activeSheets.length === 0) return [];

  // For each active sheet, load all prices with their products
  const lenderDataMap = {};

  for (const sheet of activeSheets) {
    const lender = sheet.lender;
    const lenderId = lender.code;

    // Load all prices for this sheet with their product taxonomy
    const prices = await prisma.ratePrice.findMany({
      where: { rateSheetId: sheet.id },
      include: {
        product: true,
      },
      orderBy: { rate: 'asc' },
    });

    // Group prices by product
    const programMap = {};

    for (const price of prices) {
      const prod = price.product;
      const key = prod.id;

      if (!programMap[key]) {
        programMap[key] = {
          id: prod.id,
          name: prod.displayName,
          rawName: prod.rawName,
          loanType: prod.loanType,
          investor: prod.agency,
          category: ['conventional', 'fha', 'va', 'usda'].includes(prod.loanType) ? 'agency' : 'nonqm',
          subcategory: prod.loanType === 'conventional' ? (prod.isHighBalance ? 'jumbo' : 'conventional') : prod.loanType,
          term: prod.term,
          productType: prod.productType,
          armStructure: prod.armStructure,
          tier: prod.tier,
          occupancy: prod.occupancy,
          isHighBalance: prod.isHighBalance,
          isStreamline: prod.isStreamline,
          isBuydown: prod.isBuydown,
          isInterestOnly: prod.isInterestOnly,
          loanAmountRange: {
            min: prod.loanAmountMin || 0,
            max: prod.loanAmountMax || null,
          },
          priceFormat: lender.priceFormat || '100-based',
          rates: [],
          lockDays: [],
        };
      }

      programMap[key].rates.push({
        rate: Number(price.rate),
        price: Number(price.price),
        lockDays: price.lockDays,
      });

      if (!programMap[key].lockDays.includes(price.lockDays)) {
        programMap[key].lockDays.push(price.lockDays);
      }
    }

    // Build lender data object
    if (!lenderDataMap[lenderId]) {
      lenderDataMap[lenderId] = {
        lenderId,
        lenderName: lender.name,
        sheetDate: sheet.effectiveDate?.toISOString()?.split('T')[0] || null,
        lenderFee: lender.uwFee != null ? Number(lender.uwFee) : null,
        compCap: {
          purchase: lender.maxCompCapPurchase != null ? Number(lender.maxCompCapPurchase) : null,
          refinance: lender.maxCompCapRefi != null ? Number(lender.maxCompCapRefi) : null,
        },
        compRate: lender.compRate != null ? Number(lender.compRate) : null,
        fhaUfmip: lender.fhaUfmip != null ? Number(lender.fhaUfmip) : null,
        priceFormat: lender.priceFormat || '100-based',
        programs: [],
      };
    }

    lenderDataMap[lenderId].programs.push(...Object.values(programMap));
  }

  return Object.values(lenderDataMap);
}
