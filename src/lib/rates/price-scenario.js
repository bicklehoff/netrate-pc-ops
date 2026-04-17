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
import { DEFAULT_SCENARIO, FHA_BASELINE_LIMIT } from '@/lib/rates/defaults';
import { EMPTY_ADJ } from '@/lib/rates/empty-adj';
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
    const sql = (await import('@/lib/db')).default;
    const rows = await sql`
      SELECT effective_date FROM rate_sheets
      WHERE status = 'active'
      ORDER BY effective_date DESC
      LIMIT 1
    `;
    const sheet = rows[0];
    if (sheet?.effective_date) {
      const d = new Date(sheet.effective_date);
      return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * Price a borrower scenario against all active lender rate sheets.
 *
 * No fallback defaults — if lender config is missing in the DB, the lender is
 * skipped and a warning is returned so the admin knows what to fix.
 *
 * @param {Object} body — scenario inputs (same shape as POST /api/pricing request body)
 * @returns {Object} { scenario, effectiveDate, loanClassification, countyLimits, resultCount, results, configWarnings }
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
    firstTimeBuyer: body.firstTimeBuyer || false,
  };

  // County-based loan classification
  const county = body.county || null;
  let loanClassification = null;
  let countyLimits = null;
  if (county && scenario.state) {
    countyLimits = getLoanLimits(scenario.state, county);
    if (countyLimits) {
      if (scenario.loanType === 'fha') {
        const fhaBaseline = FHA_BASELINE_LIMIT;
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
  const configWarnings = [];

  for (const lenderData of allLenders) {
    const lenderId = lenderData.lenderId;
    const lenderName = lenderData.lenderName || lenderId;

    // Validate required lender config — skip with warning if missing
    if (!body.borrowerPaid) {
      if (lenderData.compRate == null) {
        configWarnings.push(`${lenderName}: missing compRate in rate_lenders — set comp % to price this lender`);
        continue;
      }
      if (!lenderData.compCap?.purchase || !lenderData.compCap?.refinance) {
        configWarnings.push(`${lenderName}: missing comp caps in rate_lenders — set maxCompCapPurchase and maxCompCapRefi`);
        continue;
      }
    }

    if (lenderData.lenderFee == null) {
      configWarnings.push(`${lenderName}: missing uwFee in rate_lenders — set underwriting fee to price this lender`);
      continue;
    }

    // For FTHB cross-type, don't skip lenders missing FHA config — they may have HomeReady/HomePossible
    const needsFha = scenario.loanType === 'fha';
    const hasFthbCrossType = scenario.firstTimeBuyer && needsFha;
    if (needsFha && lenderData.fhaUfmip == null && !hasFthbCrossType) {
      configWarnings.push(`${lenderName}: missing fhaUfmip in rate_lenders — set FHA UFMIP rate for FHA pricing`);
      continue;
    }

    const brokerConfig = {
      compRate: body.borrowerPaid ? 0 : lenderData.compRate,
      compCapPurchase: body.borrowerPaid ? 0 : lenderData.compCap.purchase,
      compCapRefi: body.borrowerPaid ? 0 : lenderData.compCap.refinance,
      fhaUfmip: lenderData.fhaUfmip,
    };

    const lenderAdj = await getDbLenderAdj(lenderId, scenario.loanType);
    // Lenders with no adjustment rules (e.g., TLS — LLPAs baked into product codes)
    // get an empty adj object so pricing can still proceed with zero adjustments.
    const effectiveAdj = lenderAdj || EMPTY_ADJ;

    // Pre-load conventional adjustments if FTHB is checked and main type isn't conventional
    // (needed for HomeReady/HomePossible cross-type pricing)
    let convAdj = null;
    if (scenario.firstTimeBuyer && scenario.loanType !== 'conventional') {
      convAdj = await getDbLenderAdj(lenderId, 'conventional');
    }

    for (const program of lenderData.programs) {
      if (program.term !== termFilter) continue;
      // Loan type filter — but when firstTimeBuyer, also allow HomeReady/HomePossible
      // (conventional products) through even if FHA/VA is selected
      const isFthbVariant = (program.variant === 'homeready' || program.variant === 'homepossible');
      if (scenario.loanType && program.loanType !== scenario.loanType) {
        if (!(scenario.firstTimeBuyer && isFthbVariant && program.loanType === 'conventional')) continue;
      }
      if (program.occupancy && program.occupancy !== 'primary') continue;

      if (program.loanAmountRange) {
        const { min, max } = program.loanAmountRange;
        if (min && loanAmount <= min) continue;
        if (max && loanAmount > max) continue;
      }

      if (body.productType && program.productType !== body.productType) continue;

      // Filter HomeReady / Home Possible — require firstTimeBuyer flag
      if (isFthbVariant && !scenario.firstTimeBuyer) continue;

      // Filter FastTrack products — requires eligibility fields not in scenario model
      if (program.tier === 'fasttrack') continue;

      // Filter Buydown products — these require a separate buydown agreement
      // (typically seller-paid) and have different pricing that doesn't apply to
      // standard purchase/refi scenarios
      if (program.isBuydown) continue;

      // Optional exclusion filters — opt-in per caller. Default off, so
      // existing callers (MLO quotes, saved scenarios, rate alerts,
      // /api/pricing consumers) see the full ladder unchanged. Used by
      // public-display surfaces (homepage, rate-watch) that show only
      // standard owner-occupied fully-amortizing conforming products.
      if (body.excludeStreamline && program.isStreamline) continue;
      if (body.excludeInterestOnly && program.isInterestOnly) continue;
      if (body.excludeHighBalance && program.isHighBalance) continue;
      if (body.excludeJumbo && program.isJumbo) continue;

      // Filter by loan purpose if the product is purpose-specific (e.g. TLS CONF30R = refinance)
      // Programs with no purpose set are eligible for any purpose.
      if (program.loanPurpose) {
        const scenarioPurpose = scenario.loanPurpose === 'cashout' ? 'refinance' : scenario.loanPurpose;
        if (program.loanPurpose !== scenarioPurpose) continue;
      }

      if (loanClassification) {
        if (loanClassification === 'conforming' && program.isHighBalance) continue;
        if (loanClassification === 'conforming' && program.isJumbo) continue;
        if (loanClassification === 'jumbo') continue;
      }

      const lockRates = program.rates.filter(r => r.lockDays === lockDays);
      if (lockRates.length === 0) continue;

      const product = {
        name: program.name || program.rawName,
        lenderCode: lenderId,
        term: program.term,
        productType: program.productType,
        investor: program.investor,
        tier: program.tier,
        uwFee: lenderData.lenderFee,
        priceFormat: program.priceFormat || lenderData.priceFormat || '100-based',
      };

      const llpaGrids = lenderData.llpas || null;

      // Use conventional adjustments for FTHB cross-type programs
      const useAdj = (isFthbVariant && program.loanType === 'conventional' && convAdj) ? convAdj : effectiveAdj;
      const pricingScenario = (isFthbVariant && program.loanType === 'conventional' && scenario.loanType !== 'conventional')
        ? { ...scenario, loanType: 'conventional' }
        : scenario;

      for (const rateEntry of lockRates) {
        const result = priceRate(rateEntry, product, pricingScenario, useAdj, brokerConfig, llpaGrids);
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
    configWarnings,
  };
}
