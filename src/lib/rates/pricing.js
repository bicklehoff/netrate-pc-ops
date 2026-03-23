/**
 * Pricing Engine — Core Module
 *
 * Takes a borrower scenario and returns priced, ranked results across all lenders.
 * Handles price format normalization, broker comp, lender fees, and program eligibility.
 *
 * Price formats:
 *   "100-based" (Keystone, EverStream): 100 = par. >100 = credit, <100 = cost.
 *   "discount" (TLS, SWMC, AmWest): 0 = par. positive = cost (points), negative = credit.
 *
 * Normalized to discount format internally (positive = cost to borrower).
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { calculatePI, calculateAPR } from './engine';
import { getLoanLimits, classifyLoan } from '@/data/county-loan-limits';

// ─── Broker Compensation ──────────────────────────────────────────
// Lender-paid: comp is deducted from lender credit (increases effective cost at each rate)

const BROKER_COMP = {
  rate: 0.02,         // 2% of loan amount
  capRefi: 3595,      // Max comp on refinances
  capPurchase: 4595,  // Max comp on purchases
};

function calculateComp(loanAmount, loanPurpose) {
  const raw = loanAmount * BROKER_COMP.rate;
  const cap = loanPurpose === 'purchase' ? BROKER_COMP.capPurchase : BROKER_COMP.capRefi;
  return Math.min(raw, cap);
}

// ─── Lender Fee Defaults ──────────────────────────────────────────
// Per-lender origination/UW fees (from rate sheets)
// These are charged to borrower as closing costs, separate from rate pricing

const LENDER_FEES = {
  everstream: 999,
  tls: 1195,
  keystone: 995,
  swmc: 1195,    // Non-DPA, non-streamline
  amwest: 995,
};

// ─── Price Format Normalization ───────────────────────────────────

/**
 * Convert any price to discount format.
 * Discount: positive = cost (points borrower pays), negative = credit (lender pays)
 *
 * 100-based → discount: price - 100, then negate
 *   100.5 (half point credit) → -(100.5 - 100) = -0.5
 *   99.5 (half point cost) → -(99.5 - 100) = 0.5
 *
 * Already discount → pass through
 */
function toDiscountFormat(price, format) {
  if (format === 'discount') return price;
  if (format === '100-based') return -(price - 100);
  return price; // unknown format, assume discount
}

// ─── Program Eligibility ──────────────────────────────────────────

/**
 * Check if a program is eligible for the given scenario.
 * Returns { eligible: boolean, reason?: string }
 */
function checkEligibility(program, scenario) {
  const { loanPurpose, loanCategory } = scenario;

  // Loan type filter
  if (scenario.loanType && program.loanType !== scenario.loanType) {
    // Allow 'conventional' to match both conventional and jumbo subcategories
    if (!(scenario.loanType === 'conventional' && program.subcategory === 'jumbo')) {
      return { eligible: false, reason: 'loan_type_mismatch' };
    }
  }

  // Category filter (agency vs nonqm)
  if (scenario.category && program.category !== scenario.category) {
    return { eligible: false, reason: 'category_mismatch' };
  }

  // Jumbo: if loan exceeds conforming limit, only show jumbo/HB programs
  if (loanCategory === 'jumbo' && program.subcategory !== 'jumbo' && !program.isHighBalance) {
    return { eligible: false, reason: 'exceeds_conforming_limit' };
  }
  if (loanCategory === 'highBalance' && !program.isHighBalance && program.subcategory !== 'jumbo') {
    // High balance loans need HB or jumbo programs
    // Standard conforming won't work
    return { eligible: false, reason: 'exceeds_conforming_needs_hb' };
  }
  if (loanCategory === 'conforming' && (program.isHighBalance || program.subcategory === 'jumbo')) {
    // Don't show HB/jumbo for conforming loans (they'd have worse pricing)
    return { eligible: false, reason: 'conforming_loan_no_hb_needed' };
  }

  // Streamline only for refis
  if (program.isStreamline && loanPurpose === 'purchase') {
    return { eligible: false, reason: 'streamline_not_for_purchase' };
  }

  // Buydown filter — skip buydown products unless specifically requested
  if (program.isBuydown && !scenario.includeBuydowns) {
    return { eligible: false, reason: 'buydown_not_requested' };
  }

  // Interest-only filter
  if (program.isInterestOnly && !scenario.includeIO) {
    return { eligible: false, reason: 'io_not_requested' };
  }

  return { eligible: true };
}

// ─── Main Pricing Function ────────────────────────────────────────

/**
 * Price a scenario against all available programs from all lenders.
 *
 * @param {Object} scenario - Borrower scenario
 * @param {Array} allPrograms - Parsed programs from all lenders [{lenderId, programs: [...]}]
 * @param {Object} options - { lockDays: 30, termFilter: 30 }
 * @returns {Object} { scenario, derived, results, bestExecution }
 */
export function priceScenario(scenario, allPrograms, options = {}) {
  const {
    loanAmount,
    loanPurpose = 'purchase',
    loanType = null,       // null = show all types
    category = null,       // null = show all categories
    state = null,
    county = null,
    creditScore = 740,     // Phase 2: LLPA lookup
    propertyValue = null,
    term = 30,
  } = scenario;

  const lockDays = options.lockDays || 30;
  const termFilter = options.termFilter || term;

  // Derived values
  const ltv = propertyValue ? (loanAmount / propertyValue) * 100 : 80;

  // County loan limits
  let loanCategory = 'conforming';
  if (state && county) {
    const limits = getLoanLimits(state, county);
    if (limits) {
      const classification = classifyLoan(loanAmount, state, county);
      loanCategory = classification?.category || 'conforming';
    }
  } else if (loanAmount > 766550) {
    // Fallback without county: use baseline 2026 limit
    loanCategory = loanAmount > 1149825 ? 'jumbo' : 'highBalance';
  }

  // Broker comp
  const compAmount = calculateComp(loanAmount, loanPurpose);
  const compPoints = (compAmount / loanAmount) * 100; // Convert to points for pricing math

  const enrichedScenario = {
    ...scenario,
    ltv,
    loanCategory,
    loanPurpose,
    loanType,
    category,
    compAmount,
    compPoints,
  };

  const results = [];

  for (const lenderData of allPrograms) {
    const lenderId = lenderData.lenderId;
    const lenderFee = LENDER_FEES[lenderId] || 1000;

    for (const program of lenderData.programs) {
      // Term filter
      if (program.term !== termFilter) continue;

      // Product type filter (fixed vs arm)
      if (options.productType && program.productType !== options.productType) continue;

      // Eligibility check
      const eligibility = checkEligibility(program, enrichedScenario);
      if (!eligibility.eligible) continue;

      // Get rates for requested lock period
      const lockRates = program.rates.filter(r => r.lockDays === lockDays);
      if (lockRates.length === 0) continue;

      for (const rateEntry of lockRates) {
        // Normalize price to discount format
        const rawDiscount = toDiscountFormat(rateEntry.price, program.priceFormat || 'discount');

        // Add broker comp (lender-paid = increases cost to borrower)
        const afterComp = rawDiscount + compPoints;

        // Convert to dollars
        const costDollars = (afterComp / 100) * loanAmount;

        // Monthly P&I
        const monthlyPI = calculatePI(rateEntry.rate, loanAmount, program.term);

        // APR: finance charges = lender fee + net points cost
        const netFinanceCharges = Math.max(0, lenderFee + costDollars);
        const apr = calculateAPR(rateEntry.rate, loanAmount, netFinanceCharges, program.term);

        // Tags
        const tags = [];
        if (Math.abs(afterComp) < 0.15) tags.push('PAR');
        if (afterComp < -0.5) tags.push('NO COST');
        if (program.isStreamline) tags.push('STREAMLINE');
        if (program.isFastTrack) tags.push('FAST TRACK');

        results.push({
          lender: lenderId,
          lenderFee,
          program: program.name,
          programId: program.id,
          productCode: program.productCode || null,
          category: program.category,
          subcategory: program.subcategory,
          loanType: program.loanType,
          term: program.term,
          productType: program.productType,
          rate: rateEntry.rate,
          apr: Math.round(apr * 1000) / 1000,
          rawPrice: rateEntry.price,
          priceFormat: program.priceFormat || 'discount',
          compPoints: Math.round(compPoints * 1000) / 1000,
          compDollars: Math.round(compAmount),
          costPoints: Math.round(afterComp * 1000) / 1000,
          costDollars: Math.round(costDollars),
          monthlyPI: Math.round(monthlyPI * 100) / 100,
          lockDays,
          tags,
        });
      }
    }
  }

  // Sort by rate ascending, then by cost (lower = better)
  results.sort((a, b) => a.rate - b.rate || a.costPoints - b.costPoints);

  // Best execution per category (lowest rate at par or better)
  const bestExecution = {};
  for (const r of results) {
    const cat = r.category === 'agency' ? r.subcategory : r.category;
    if (!bestExecution[cat]) {
      // First result at or below par
      if (r.costPoints <= 0.25) {
        bestExecution[cat] = {
          programId: r.programId,
          lender: r.lender,
          rate: r.rate,
          apr: r.apr,
          costPoints: r.costPoints,
          costDollars: r.costDollars,
          monthlyPI: r.monthlyPI,
        };
      }
    }
  }

  return {
    scenario: enrichedScenario,
    derived: {
      ltv: Math.round(ltv * 100) / 100,
      loanCategory,
      compAmount: Math.round(compAmount),
      compPoints: Math.round(compPoints * 1000) / 1000,
    },
    closingCosts: {
      lenderFee: 'varies', // per-result
      brokerComp: Math.round(compAmount),
      brokerCompNote: 'Lender-paid — included in rate pricing',
      thirdParty: {
        estimate: state ? getThirdPartyCostEstimate(state, loanPurpose) : null,
        note: 'Estimated — actual costs vary by transaction',
      },
    },
    results,
    bestExecution,
    pricedAt: new Date().toISOString(),
    resultCount: results.length,
  };
}

// ─── Third Party Cost Estimates ───────────────────────────────────
// Stub — will be replaced with detailed state/county data

function getThirdPartyCostEstimate(state, purpose) {
  // Refi costs are more predictable (no inspections, surveys, etc.)
  const refiCosts = {
    CO: { title: 1200, escrow: 400, recording: 75, total: 1675 },
    CA: { title: 1800, escrow: 500, recording: 100, total: 2400 },
    TX: { title: 2200, escrow: 450, recording: 85, total: 2735 },
    OR: { title: 1300, escrow: 400, recording: 80, total: 1780 },
  };

  // Purchase adds appraisal, inspections, survey, HOI setup, etc.
  const purchaseCosts = {
    CO: { title: 1500, escrow: 600, recording: 75, appraisal: 550, inspection: 400, insurance: 300, total: 3425 },
    CA: { title: 2200, escrow: 700, recording: 100, appraisal: 650, inspection: 500, insurance: 350, total: 4500 },
    TX: { title: 2800, escrow: 650, recording: 85, appraisal: 550, inspection: 400, insurance: 300, total: 4785 },
    OR: { title: 1600, escrow: 600, recording: 80, appraisal: 550, inspection: 400, insurance: 300, total: 3530 },
  };

  const table = purpose === 'purchase' ? purchaseCosts : refiCosts;
  return table[state] || null;
}
