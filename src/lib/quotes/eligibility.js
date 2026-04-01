/**
 * Eligibility checking library — surfaces guideline warnings BEFORE pricing.
 *
 * The pricing engine silently skips ineligible products. This layer makes those
 * failures visible so the MLO can adjust the scenario or explain to the borrower.
 *
 * Warnings are soft by default — the MLO can override and proceed.
 * Only "zero eligible lenders" is a hard stop.
 */

import prisma from '@/lib/prisma';
import { classifyLoan, getLoanLimits } from '@/data/county-loan-limits';
import { FHA_BASELINE_LIMIT } from '@/lib/rates/defaults';

// 5-minute cache for lender/product metadata
let metaCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadLenderMeta() {
  const now = Date.now();
  if (metaCache.data && (now - metaCache.fetchedAt) < CACHE_TTL_MS) {
    return metaCache.data;
  }

  const [lenders, products] = await Promise.all([
    prisma.rateLender.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        code: true,
        name: true,
        excludedStateVariants: true,
        maxCompRate: true,
        fhaUfmip: true,
      },
    }),
    prisma.rateProduct.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        lenderId: true,
        loanType: true,
        term: true,
        ficoMin: true,
        ficoMax: true,
        maxLtv: true,
        loanAmountMin: true,
        loanAmountMax: true,
        isHighBalance: true,
        occupancy: true,
        productType: true,
      },
    }),
  ]);

  const activeSheets = await prisma.rateSheet.findMany({
    where: { status: 'active' },
    select: { lenderId: true },
    distinct: ['lenderId'],
  });
  const lendersWithSheets = new Set(activeSheets.map(s => s.lenderId));

  metaCache = {
    data: { lenders, products, lendersWithSheets },
    fetchedAt: now,
  };
  return metaCache.data;
}

/**
 * Check scenario eligibility against all lender products.
 *
 * @param {Object} scenario
 * @param {number} scenario.loanAmount
 * @param {string} scenario.loanType — conventional/fha/va/dscr/bankstatement
 * @param {string} scenario.loanPurpose — purchase/refinance/cashout
 * @param {number} scenario.creditScore
 * @param {number} scenario.ltv
 * @param {string} scenario.state
 * @param {string} [scenario.county]
 * @param {number} [scenario.term]
 * @param {string} [scenario.productType] — fixed/arm
 *
 * @returns {Object} { eligible, warnings, eligibleLenders, ineligibleLenders }
 */
export async function checkEligibility(scenario) {
  const { lenders, products, lendersWithSheets } = await loadLenderMeta();
  const warnings = [];
  const eligibleLenders = [];
  const ineligibleLenders = [];

  const {
    loanAmount,
    loanType = 'conventional',
    creditScore = 780,
    ltv = 75,
    state = 'CO',
    county,
    term = 30,
    loanPurpose = 'purchase',
  } = scenario;

  // County loan limits
  let loanClassification = null;
  if (county && state) {
    const limits = getLoanLimits(state, county);
    if (limits) {
      if (loanType === 'fha') {
        const fhaBaseline = FHA_BASELINE_LIMIT;
        if (loanAmount <= fhaBaseline) loanClassification = 'conforming';
        else if (loanAmount <= limits.fhaLimit) loanClassification = 'highBalance';
        else loanClassification = 'jumbo';
      } else {
        loanClassification = classifyLoan(loanAmount, state, county);
      }

      if (loanClassification === 'jumbo') {
        warnings.push({
          severity: 'warning',
          code: 'EXCEEDS_CONFORMING_LIMIT',
          message: `Loan amount $${loanAmount.toLocaleString()} exceeds ${county} County conforming limit ($${limits.conforming1Unit?.toLocaleString()}). No agency products available — jumbo pricing required.`,
        });
      }
    }
  }

  // Per-lender checks
  for (const lender of lenders) {
    const reasons = [];

    // State exclusion
    const excluded = lender.excludedStateVariants;
    if (excluded) {
      const excludedList = typeof excluded === 'string' ? JSON.parse(excluded) : excluded;
      if (Array.isArray(excludedList) && excludedList.includes(state)) {
        reasons.push(`Not available in ${state}`);
      }
    }

    // No active rate sheet
    if (!lendersWithSheets.has(lender.id)) {
      reasons.push('No active rate sheet loaded');
    }

    // Filter products for this lender + loan type + term
    const lenderProducts = products.filter(p =>
      p.lenderId === lender.id &&
      p.loanType === loanType &&
      p.term === term
    );

    if (lenderProducts.length === 0 && reasons.length === 0) {
      reasons.push(`No ${loanType} ${term}yr products available`);
    }

    // FICO check against product minimums
    if (lenderProducts.length > 0) {
      const ficoMins = lenderProducts.map(p => Number(p.ficoMin ?? 0)).filter(v => v > 0);
      if (ficoMins.length > 0) {
        const minFico = Math.min(...ficoMins);
        if (creditScore < minFico) {
          reasons.push(`FICO ${creditScore} below minimum ${minFico}`);
        }
      }
    }

    // LTV check
    if (lenderProducts.length > 0) {
      const maxLtv = Math.max(...lenderProducts.map(p => Number(p.maxLtv ?? 100)));
      if (maxLtv < 100 && ltv > maxLtv) {
        reasons.push(`LTV ${ltv}% exceeds maximum ${maxLtv}%`);
      }
    }

    // Loan amount range
    if (lenderProducts.length > 0) {
      const hasInRange = lenderProducts.some(p => {
        const min = Number(p.loanAmountMin ?? 0);
        const max = Number(p.loanAmountMax ?? 999999999);
        return loanAmount > min && loanAmount <= max;
      });
      if (!hasInRange && lenderProducts.length > 0) {
        reasons.push(`Loan amount $${loanAmount.toLocaleString()} outside available product ranges`);
      }
    }

    if (reasons.length > 0) {
      ineligibleLenders.push({
        code: lender.code,
        name: lender.name,
        reasons,
      });
    } else {
      eligibleLenders.push({
        code: lender.code,
        name: lender.name,
      });
    }
  }

  // Add per-lender ineligibility as warnings
  for (const il of ineligibleLenders) {
    warnings.push({
      severity: 'warning',
      code: 'LENDER_INELIGIBLE',
      lender: il.name,
      lenderCode: il.code,
      message: `${il.name}: ${il.reasons.join('; ')}`,
    });
  }

  // Loan type disclosures
  if (loanType === 'fha') {
    warnings.push({
      severity: 'info',
      code: 'FHA_UFMIP',
      message: 'FHA loans include 1.75% Up-Front Mortgage Insurance Premium (UFMIP) financed into the loan amount, plus monthly MIP.',
    });
  }

  if (loanType === 'va') {
    warnings.push({
      severity: 'info',
      code: 'VA_FUNDING_FEE',
      message: 'VA loans include a funding fee (1.25%-3.3%) financed into the loan amount. Exempt for service-connected disability.',
    });
  }

  if (loanType === 'conventional' && ltv > 80) {
    warnings.push({
      severity: 'info',
      code: 'PMI_REQUIRED',
      message: `LTV ${ltv}% exceeds 80% — Private Mortgage Insurance (PMI) will be required.`,
    });
  }

  if (loanPurpose === 'cashout') {
    warnings.push({
      severity: 'info',
      code: 'CASHOUT_ADJUSTMENTS',
      message: 'Cash-out refinance carries additional LLPA adjustments that increase the rate or cost.',
    });
  }

  // Hard stop: no eligible lenders
  const eligible = eligibleLenders.length > 0;
  if (!eligible) {
    warnings.unshift({
      severity: 'error',
      code: 'NO_ELIGIBLE_LENDERS',
      message: 'No lenders can price this scenario. Adjust FICO, LTV, loan amount, or loan type.',
    });
  }

  return { eligible, warnings, eligibleLenders, ineligibleLenders };
}
