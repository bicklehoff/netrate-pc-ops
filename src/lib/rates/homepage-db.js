/**
 * Homepage Rate Computation — DB-driven
 * Server-side only — computes consumer-friendly rates using pricing-v2 + DB adjustments.
 * Same engine as the Rate Tool.
 *
 * Used by: page.js (homepage), rate-watch/page.js
 */

import prisma from '@/lib/prisma';
import { priceRate } from './pricing-v2';
import { getDbLenderAdj } from './db-adj-loader';
import { DEFAULT_SCENARIO } from './defaults';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FALLBACK_COMP_RATE = 0.02;

function calculatePI(rate, amount, termYears = 30) {
  const monthlyRate = rate / 100 / 12;
  const n = termYears * 12;
  if (monthlyRate === 0) return amount / n;
  return amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

function calculateAPR(noteRate, loanAmount, financeCharges, termYears = 30) {
  const monthlyPayment = calculatePI(noteRate, loanAmount, termYears);
  const amountFinanced = loanAmount - Math.max(0, financeCharges);
  if (amountFinanced >= loanAmount) return noteRate;
  let low = noteRate;
  let high = noteRate + 5;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (calculatePI(mid, amountFinanced, termYears) < monthlyPayment) low = mid;
    else high = mid;
  }
  return Math.round(((low + high) / 2) * 100) / 100;
}

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

  // Get active rate sheet
  const activeSheet = await prisma.rateSheet.findFirst({
    where: { status: 'active' },
    include: { lender: true },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!activeSheet?.lender) return null;

  const lenderCode = activeSheet.lender.code;
  const lender = activeSheet.lender;

  // Build broker config from DB lender data
  const brokerConfig = {
    compRate: lender.compRate ? Number(lender.compRate) : FALLBACK_COMP_RATE,
    compCapPurchase: Number(lender.maxCompCapPurchase) || 3595,
    compCapRefi: Number(lender.maxCompCapRefi) || 3595,
  };

  // Get DB adjustments for this lender + loan type
  const lenderAdj = await getDbLenderAdj(lenderCode, loanType);
  if (!lenderAdj) return null;

  // Find products matching our criteria
  // Products have loan amount ranges in display_name — filter by loanType + term
  const products = await prisma.rateProduct.findMany({
    where: {
      lenderId: activeSheet.lenderId,
      loanType,
      term: termYears,
      productType: 'fixed',
      occupancy: 'primary',
      isHighBalance: false,
      isStreamline: false,
      isBuydown: false,
      isInterestOnly: false,
    },
  });

  if (!products.length) return null;

  // Filter products that cover our loan amount
  const matchingProducts = products.filter(p => {
    if (p.loanAmountMin && loanAmount < p.loanAmountMin) return false;
    if (p.loanAmountMax && loanAmount > p.loanAmountMax) return false;
    return true;
  });

  if (!matchingProducts.length) return null;

  let bestRate = null;

  for (const product of matchingProducts) {
    // Get prices for this product from the active sheet
    const prices = await prisma.ratePrice.findMany({
      where: {
        productId: product.id,
        rateSheetId: activeSheet.id,
        lockDays: 30,
      },
      orderBy: { rate: 'asc' },
    });

    for (const price of prices) {
      const rate = Number(price.rate);
      const basePrice = Number(price.price);

      const rateEntry = { rate, price: basePrice };
      const productObj = {
        term: termYears,
        productType: 'fixed',
        investor: product.agency,
        tier: product.tier || 'core',
        name: product.displayName,
        lenderCode: lenderCode,
        uwFee: product.originationFee || product.uwFee || 999,
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
 */
export async function getHomepageRatesFromDB() {
  try {
    // Get the latest active sheet date
    const latestSheet = await prisma.rateSheet.findFirst({
      where: { status: 'active' },
      orderBy: { effectiveDate: 'desc' },
      select: { effectiveDate: true },
    });

    let dateShort = null;
    if (latestSheet?.effectiveDate) {
      const d = new Date(latestSheet.effectiveDate);
      dateShort = `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    }

    // Price all products — sequential to avoid connection pool exhaustion
    const conv30 = await priceProduct('conventional', 30);
    const conv15 = await priceProduct('conventional', 15);
    const fha30 = await priceProduct('fha', 30);
    const va30 = await priceProduct('va', 30);

    return { dateShort, conv30, conv15, fha30, va30 };
  } catch (err) {
    console.error('DB homepage rate computation failed:', err.message);
    return null;
  }
}
