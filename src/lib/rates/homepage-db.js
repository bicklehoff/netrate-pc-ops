/**
 * Homepage Rate Computation — DB-driven
 * Server-side only — computes consumer-friendly rates using pricing-v2 + DB adjustments.
 * Replaces the old homepage.js that used parsed-rates.json + legacy pricing engine.
 *
 * Used by: page.js (homepage), rate-watch/page.js
 */

import prisma from '@/lib/prisma';
import { priceRate } from './pricing-v2';
import { getDbLenderAdj } from './db-adj-loader';
import { DEFAULT_SCENARIO } from './defaults';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
 * Returns the par rate (lowest cost to borrower) across all lenders with DB adjustments.
 */
async function priceProduct(loanType, term) {
  const loanAmount = DEFAULT_SCENARIO.loanAmount;
  const propertyValue = DEFAULT_SCENARIO.propertyValue;
  const ltv = Math.floor((loanAmount / propertyValue) * 10000) / 100;
  const fico = DEFAULT_SCENARIO.fico;
  const purpose = DEFAULT_SCENARIO.loanPurpose;

  // Get all active rate sheets with their lenders
  const sheets = await prisma.rateSheet.findMany({
    where: { status: 'active' },
    include: { lender: true },
  });

  let bestRate = null;

  for (const sheet of sheets) {
    const lenderCode = sheet.lender?.code;
    if (!lenderCode) continue;

    // Get DB adjustments for this lender + loan type
    const lenderAdj = await getDbLenderAdj(lenderCode, loanType);
    if (!lenderAdj) continue;

    // Get prices for this sheet matching our criteria
    const products = await prisma.rateProduct.findMany({
      where: {
        sheetId: sheet.id,
        term,
        category: loanType === 'fha' ? 'fha' : loanType === 'va' ? 'va' : 'agency',
      },
      include: {
        prices: {
          where: { lockDays: 30 },
          orderBy: { rate: 'asc' },
        },
      },
    });

    for (const product of products) {
      for (const price of product.prices) {
        const rate = Number(price.rate);
        const basePrice = Number(price.price);

        const result = priceRate({
          basePrice,
          rate,
          lenderAdj,
          fico,
          ltv,
          loanAmount,
          purpose,
          state: DEFAULT_SCENARIO.state,
          loanType,
          term,
          investor: product.investor,
          tier: product.tier || 'core',
          productName: product.name,
        });

        if (!result) continue;

        // Find par rate: closest to zero borrower cost (rebate - comp ≈ 0)
        const borrowerCost = result.totalCostDollars || 0;
        const absCost = Math.abs(borrowerCost);

        if (!bestRate || absCost < bestRate.absCost || (absCost === bestRate.absCost && rate < bestRate.rate)) {
          const financeCharges = Math.max(0, borrowerCost);
          bestRate = {
            rate,
            apr: calculateAPR(rate, loanAmount, financeCharges, term),
            payment: Math.round(calculatePI(rate, loanAmount, term)),
            absCost,
            costDollars: Math.round(borrowerCost),
          };
        }
      }
    }
  }

  return bestRate;
}

/**
 * Compute homepage display rates from DB using pricing-v2 engine.
 * Same adjustments as the Rate Tool.
 *
 * @returns {Object|null} { date, dateShort, conv30, conv15, fha30, va30 }
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

    // Price all products in parallel
    const [conv30, conv15, fha30, va30] = await Promise.all([
      priceProduct('conventional', 30),
      priceProduct('conventional', 15),
      priceProduct('fha', 30),
      priceProduct('va', 30),
    ]);

    return {
      dateShort,
      conv30,
      conv15,
      fha30,
      va30,
    };
  } catch (err) {
    console.error('DB homepage rate computation failed:', err.message);
    return null;
  }
}
