/**
 * Shared pricing function — prices a borrower scenario against all active lender rate sheets.
 *
 * Extracted from POST /api/pricing so both the consumer API and the MLO quote generator
 * can call the same logic without an HTTP roundtrip.
 *
 * Usage:
 *   import { priceScenario } from '@/lib/rates/price-scenario';
 *   const result = await priceScenario({ loanAmount: 400000, state: 'CO', ... });
 */

import { priceRate } from '@/lib/rates/pricing-v2';
import { getDbLenderAdj } from '@/lib/rates/db-adj-loader';
import { loadRateDataFromDB } from '@/lib/rates/db-loader';
import { DEFAULT_SCENARIO } from '@/lib/rates/defaults';
import { classifyLoan, getLoanLimits } from '@/data/county-loan-limits';

const CACHE_TTL_MS = 2 * 60 * 1000;
let rateCache = { data: null, fetchedAt: 0 };

async function loadRateData() {
  const now = Date.now();
  if (rateCache.data && (now - rateCache.fetchedAt) < CACHE_TTL_MS) {
    return rateCache.data;
  }
  try {
    const lenders = await loadRateDataFromDB();
    if (lenders?.length) {
      rateCache = { data: lenders, fetchedAt: now };
      return lenders;
    }
  } catch (err) {
    console.error('DB rate data load failed:', err.message);
  }
  return [];
}

async function getEffectiveDate() {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const sheet = await prisma.rateSheet.findFirst({
      where: { status: 'active' },
      orderBy: { effectiveDate: 'desc' },
      select: { effectiveDate: true },
    });
    if (sheet?.effectiveDate) {
      const d = new Date(sheet.effectiveDate);
      return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
    }
  } catch { /* fall through */ }
  return null;
}

const FALLBACK_COMP_RATE = 0.02;

/**
 * Price a borrower scenario against all active lender rate sheets.
 *
 * @param {Object} body — scenario inputs (same shape as POST /api/pricing request body)
 * @returns {Object} { scenario, effectiveDate, loanClassification, countyLimits, resultCount, results }
 */
export async function priceScenario(body) {
  const loanAmount = Number(body.loanAmount);
  const propertyValue = body.propertyValue ? Number(body.propertyValue) : null;
  const ltv = propertyValue ? Math.floor((loanAmount / propertyValue) * 10000) / 100 : 75;

  const scenario = {
    loanAmount,
    loanPurpose: body.loanPurpose || 'purchase',
    loanType: body.loanType || 'conventional',
    state: body.state || 'CO',
    creditScore: body.creditScore || DEFAULT_SCENARIO.fico,
    ltv: Math.round(ltv * 100) / 100,
    propertyValue,
    term: body.term || 30,
  };

  // County-based loan classification
  const county = body.county || null;
  let loanClassification = null;
  let countyLimits = null;
  if (county && scenario.state) {
    countyLimits = getLoanLimits(scenario.state, county);
    if (countyLimits) {
      if (scenario.loanType === 'fha') {
        const fhaBaseline = Math.round(832750 * 0.65);
        if (loanAmount <= fhaBaseline) {
          loanClassification = 'conforming';
        } else if (loanAmount <= countyLimits.fhaLimit) {
          loanClassification = 'highBalance';
        } else {
          loanClassification = 'jumbo';
        }
      } else {
        loanClassification = classifyLoan(loanAmount, scenario.state, county);
      }
    }
  }

  const lockDays = body.lockDays || 30;
  const termFilter = body.term || 30;
  const allLenders = await loadRateData();
  const results = [];

  for (const lenderData of allLenders) {
    const lenderId = lenderData.lenderId;

    const brokerConfig = {
      compRate: lenderData.compRate || FALLBACK_COMP_RATE,
      compCapPurchase: lenderData.compCap?.purchase || 3595,
      compCapRefi: lenderData.compCap?.refinance || 3595,
      fhaUfmip: lenderData.fhaUfmip || 0.0175,
    };

    const lenderAdj = await getDbLenderAdj(lenderId, scenario.loanType);
    if (!lenderAdj) continue;

    for (const program of lenderData.programs) {
      if (program.term !== termFilter) continue;
      if (scenario.loanType && program.loanType !== scenario.loanType) continue;
      if (program.occupancy && program.occupancy !== 'primary') continue;

      if (program.loanAmountRange) {
        const { min, max } = program.loanAmountRange;
        if (min && loanAmount <= min) continue;
        if (max && loanAmount > max) continue;
      }

      if (body.productType && program.productType !== body.productType) continue;

      if (loanClassification) {
        if (loanClassification === 'conforming' && program.isHighBalance) continue;
        if (loanClassification === 'jumbo') continue;
      }

      const lockRates = program.rates.filter(r => r.lockDays === lockDays);
      if (lockRates.length === 0) continue;

      const product = {
        name: program.name || program.rawName,
        lenderCode: lenderId,
        term: program.term,
        productType: program.productType || 'fixed',
        investor: program.investor || 'fnma',
        tier: program.tier || 'core',
        uwFee: lenderData.lenderFee || 999,
      };

      const llpaGrids = lenderData.llpas || null;

      for (const rateEntry of lockRates) {
        const result = priceRate(rateEntry, product, scenario, lenderAdj, brokerConfig, llpaGrids);
        results.push(result);
      }
    }
  }

  results.sort((a, b) => a.rate - b.rate);

  const effectiveDate = await getEffectiveDate();

  return {
    scenario,
    effectiveDate,
    loanClassification,
    countyLimits: countyLimits ? {
      county: countyLimits.county,
      state: countyLimits.state,
      conformingLimit: countyLimits.conforming1Unit,
      fhaLimit: countyLimits.fhaLimit,
      isHighCost: !countyLimits.isBaseline,
    } : null,
    resultCount: results.length,
    results,
  };
}
