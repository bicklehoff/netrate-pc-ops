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
import { calculatePI, calculateAPR, getFicoBand, getLtvBandIndex } from './engine';
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
  tls: 1281,
  keystone: 1125,
  swmc: 1195,    // Non-DPA, non-streamline
  amwest: 1295,
};

// LLPA mode per lender:
// 'baked' = LLPAs are already in the base rate sheet prices. Do NOT apply additional adjustments.
// 'separate' = Base prices are pre-LLPA. Apply lender-specific grids or GSE fallback.
const LENDER_LLPA_MODE = {
  tls: 'baked',        // Product codes encode the tier — each product IS a specific LLPA scenario
  swmc: 'baked',       // Base prices include LLPAs — confirmed via LoanSifter comparison
  keystone: 'baked',   // Base prices include LLPAs — confirmed via LoanSifter comparison
  amwest: 'separate',  // Separate FT_LLPAS and LLPAS sheets — must apply
  everstream: 'separate', // 19 separate LLPA sheets — must apply
};

// ─── LLPA (Loan-Level Price Adjustments) ──────────────────────────
// Standard GSE LLPA grids (Fannie Mae / Freddie Mac)
//
// IMPORTANT: Not all lenders need external LLPA application.
// - TLS: LLPAs baked into product codes (each product IS a tier). Skip.
// - SWMC: LLPAs baked into base prices. Skip.
// - Keystone: LLPAs baked into base prices. Skip.
// - AmWest: Separate LLPA sheets (FT_LLPAS, LLPAS). MUST apply.
// - EverStream: Separate 19 LLPA sheets. MUST apply.
//
// Lenders with llpaMode = 'baked' skip LLPA application entirely.
// Lenders with llpaMode = 'separate' use their own grids or GSE fallback.
//
// Each FICO band maps to an array of 9 LTV tier adjustments.
// LTV tiers: <=30, 30.01-60, 60.01-70, 70.01-75, 75.01-80, 80.01-85, 85.01-90, 90.01-95, >95
// Values are in points (positive = cost to borrower, added to price)

const LTV_BANDS = ['<=30', '30.01-60', '60.01-70', '70.01-75', '75.01-80', '80.01-85', '85.01-90', '90.01-95', '>95'];

const GSE_PURCHASE_LLPA = {
  '>=800':   [0, 0, 0, 0, 0.375, 0.375, 0.25, 0.25, 0.125],
  '780-799': [0, 0, 0, 0, 0.375, 0.375, 0.25, 0.25, 0.125],
  '760-779': [0, 0, 0, 0.25, 0.625, 0.625, 0.5, 0.5, 0.25],
  '740-759': [0, 0, 0.125, 0.375, 0.875, 1.0, 0.75, 0.625, 0.5],
  '720-739': [0, 0, 0.25, 0.75, 1.25, 1.25, 1.0, 0.875, 0.75],
  '700-719': [0, 0, 0.375, 0.875, 1.375, 1.5, 1.25, 1.125, 0.875],
  '680-699': [0, 0, 0.625, 1.125, 1.75, 1.875, 1.5, 1.375, 1.125],
  '660-679': [0, 0, 0.75, 1.375, 1.875, 2.125, 1.75, 1.625, 1.25],
  '640-659': [0, 0, 1.125, 1.5, 2.25, 2.5, 2.0, 1.875, 1.5],
  '620-639': [0, 0.125, 1.5, 2.125, 2.75, 2.875, 2.625, 2.25, 1.75],
};

const GSE_REFI_LLPA = {
  '>=800':   [0, 0, 0, 0.125, 0.5, 1.0, 1.0, 1.0, 1.125],
  '780-799': [0, 0, 0, 0.125, 0.5, 1.0, 1.0, 1.0, 1.125],
  '760-779': [0, 0, 0.125, 0.375, 0.875, 1.375, 1.25, 1.25, 1.375],
  '740-759': [0, 0, 0.25, 0.75, 1.125, 1.75, 1.625, 1.625, 1.75],
  '720-739': [0, 0, 0.5, 1.0, 1.625, 2.125, 2.0, 1.875, 2.0],
  '700-719': [0, 0, 0.625, 1.25, 1.875, 2.5, 2.25, 2.25, 2.375],
  '680-699': [0, 0, 0.875, 1.625, 2.25, 2.875, 2.625, 2.375, 2.5],
  '660-679': [0, 0.375, 1.5, 2.25, 2.875, 3.375, 2.875, 2.75, 2.875],
  '640-659': [0, 0.5, 1.875, 2.625, 3.375, 3.875, 3.375, 3.125, 3.25],
  '620-639': [0, 0.625, 2.375, 3.125, 4.125, 4.5, 4.25, 3.125, 3.25],
};

const GSE_CASHOUT_LLPA = {
  '>=800':   [0.375, 0.375, 0.625, 0.875, 1.375],
  '780-799': [0.375, 0.375, 0.625, 0.875, 1.375],
  '760-779': [0.375, 0.375, 0.875, 1.25, 1.875],
  '740-759': [0.375, 0.375, 1.0, 1.625, 2.375],
  '720-739': [0.375, 0.5, 1.375, 2.0, 2.75],
  '700-719': [0.375, 0.5, 1.625, 2.625, 3.25],
  '680-699': [0.375, 0.625, 2.0, 2.875, 3.75],
  '660-679': [0.75, 1.25, 3.125, 4.375, 5.125],
  '640-659': [0.875, 1.875, 3.625, 5.125, 5.625],
  '620-639': [1.0, 2.0, 4.0, 5.5, 5.75],
};

// Additional adjustments by property type / feature
const GSE_ADDITIONAL_LLPA = {
  condo:        [0, 0, 0.125, 0.125, 0.75, 0.75, 0.75, 0.75, 0.75],
  manufactured: [0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  investment:   [0, 0.25, 0.25, 0.25, 0.5, 0.75, 0.75, 0.75, 0.75],
  secondHome:   [0, 0, 0, 0, 0, 0.125, 0.125, 0.125, 0.125],
  highBal:      [0.5, 0.5, 0.75, 0.75, 1.0, 1.0, 1.0, 1.0, 1.0],
  subFin:       [0.625, 0.625, 0.625, 0.875, 1.125, 1.125, 1.125, 1.875, 1.875],
};

/**
 * Calculate LLPA adjustment for a scenario.
 * Uses lender-specific grids if available, falls back to GSE standard.
 *
 * @param {Object} scenario - { creditScore, ltv, loanPurpose, propertyType, occupancy, loanAmount }
 * @param {Object} lenderLlpas - Lender-specific LLPA data (optional, same format as sunwest.json)
 * @param {Object} program - The program being priced (for category-specific behavior)
 * @returns {{ total: number, breakdown: Array }}
 */
function calculateLLPAForScenario(scenario, lenderLlpas, program) {
  const { creditScore, ltv, cltv, loanPurpose, loanAmount, subFinancing } = scenario;
  const propertyType = scenario.propertyType || 'sfr';
  const occupancy = scenario.occupancy || program.occupancy || 'primary';

  const ficoBand = getFicoBand(creditScore);
  // Use CLTV for LLPA lookup when sub financing exists (per GSE guidelines)
  const effectiveLtv = (subFinancing && cltv) ? Math.max(ltv, cltv) : ltv;
  const ltvIdx = getLtvBandIndex(effectiveLtv);
  let total = 0;
  const breakdown = [];

  // Non-QM products (DSCR, bank statement, etc.) don't use GSE LLPAs —
  // their pricing is already tier-adjusted in the rate sheet
  if (program.category === 'nonqm' || program.category === 'other') {
    return { total: 0, breakdown: [{ label: 'Non-QM (LLPAs in base price)', value: 0 }] };
  }

  // Check lender LLPA mode — if 'baked', prices already include LLPAs
  if (program._llpaMode === 'baked') {
    return { total: 0, breakdown: [{ label: 'LLPAs in base price', value: 0 }] };
  }

  // Select the right LLPA grid
  const llpaSource = lenderLlpas || {
    purchaseLlpa: GSE_PURCHASE_LLPA,
    refiLlpa: GSE_REFI_LLPA,
    cashoutLlpa: GSE_CASHOUT_LLPA,
    additionalLlpa: GSE_ADDITIONAL_LLPA,
    loanAmtAdj: [],
  };

  // FICO × LTV base adjustment
  let matrix;
  if (loanPurpose === 'purchase') matrix = llpaSource.purchaseLlpa;
  else if (loanPurpose === 'cashout') matrix = llpaSource.cashoutLlpa;
  else matrix = llpaSource.refiLlpa;

  if (matrix) {
    const maxIdx = loanPurpose === 'cashout' ? 4 : 8;
    const useIdx = Math.min(ltvIdx, maxIdx);
    const baseAdj = matrix[ficoBand]?.[useIdx] ?? 0;
    total += baseAdj;
    breakdown.push({
      label: `FICO/LTV (${ficoBand}, ${LTV_BANDS[ltvIdx] || '?'})`,
      value: baseAdj,
    });
  }

  // Property type adjustments
  const addl = llpaSource.additionalLlpa || GSE_ADDITIONAL_LLPA;
  if (propertyType === 'condo' && addl.condo) {
    const adj = addl.condo[Math.min(ltvIdx, 8)] ?? 0;
    total += adj;
    if (adj !== 0) breakdown.push({ label: 'Attached Condo', value: adj });
  }
  if (propertyType === 'manufactured' && addl.manufactured) {
    const adj = addl.manufactured[Math.min(ltvIdx, 8)] ?? 0;
    total += adj;
    if (adj !== 0) breakdown.push({ label: 'Manufactured Home', value: adj });
  }

  // Occupancy adjustments
  if (occupancy === 'investment' && addl.investment) {
    const adj = addl.investment[Math.min(ltvIdx, 8)] ?? 0;
    total += adj;
    if (adj !== 0) breakdown.push({ label: 'Investment Property', value: adj });
  }
  if (occupancy === 'secondary' && addl.secondHome) {
    const adj = addl.secondHome[Math.min(ltvIdx, 8)] ?? 0;
    total += adj;
    if (adj !== 0) breakdown.push({ label: 'Second Home', value: adj });
  }

  // Subordinate financing adjustment
  if (subFinancing && addl.subFin) {
    const adj = addl.subFin[Math.min(ltvIdx, 8)] ?? 0;
    total += adj;
    if (adj !== 0) breakdown.push({ label: 'Subordinate Financing', value: adj });
  }

  // High balance adjustment
  if (program.isHighBalance && addl.highBal) {
    const adj = addl.highBal[Math.min(ltvIdx, 8)] ?? 0;
    total += adj;
    if (adj !== 0) breakdown.push({ label: 'High Balance', value: adj });
  }

  // Loan amount tier adjustments (lender-specific)
  if (llpaSource.loanAmtAdj) {
    for (const tier of llpaSource.loanAmtAdj) {
      if (loanAmount >= tier.min && loanAmount <= tier.max) {
        total += tier.adj;
        if (tier.adj !== 0) {
          breakdown.push({
            label: `Loan Amount ($${(tier.min / 1000).toFixed(0)}K-$${(tier.max / 1000).toFixed(0)}K)`,
            value: tier.adj,
          });
        }
        break;
      }
    }
  }

  return { total, breakdown };
}

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

  // Fast Track eligibility — requires W-2, no sub financing, primary/second home, standard property
  if (program.isFastTrack) {
    if (scenario.employmentType === 'selfEmployed') {
      return { eligible: false, reason: 'fast_track_requires_w2' };
    }
    if (scenario.subFinancing) {
      return { eligible: false, reason: 'fast_track_no_sub_financing' };
    }
    if (scenario.occupancy === 'investment') {
      return { eligible: false, reason: 'fast_track_no_investment' };
    }
    if (scenario.propertyType === 'manufactured' || scenario.propertyType === '3unit' || scenario.propertyType === '4unit') {
      return { eligible: false, reason: 'fast_track_property_type' };
    }
  }

  // Self-employed routing — show bank statement products, hide W-2-only programs
  if (scenario.employmentType === 'selfEmployed') {
    // Bank statement and DSCR products are good for self-employed
    // Standard agency still eligible (just with full doc requirements)
  }

  // Sub financing — apply CLTV-based adjustments (handled in LLPA calc)
  // Some programs have max CLTV limits
  if (scenario.subFinancing && scenario.cltv > 95 && program.category === 'agency') {
    return { eligible: false, reason: 'cltv_exceeds_95' };
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
    creditScore = 740,
    propertyValue = null,
    term = 30,
    employmentType = 'w2',         // 'w2' | 'selfEmployed' — defaults to W-2
    subFinancing = false,          // subordinate financing (second mortgage/HELOC staying in place)
    subFinancingBalance = 0,       // balance of second lien (for CLTV calc)
    propertyType = 'sfr',
    occupancy = 'primary',
  } = scenario;

  const lockDays = options.lockDays || 30;
  const termFilter = options.termFilter || term;

  // Derived values
  const ltv = propertyValue ? (loanAmount / propertyValue) * 100 : 80;

  // CLTV — if sub financing exists, combined LTV drives certain LLPA lookups
  const cltv = (propertyValue && subFinancing && subFinancingBalance > 0)
    ? ((loanAmount + subFinancingBalance) / propertyValue) * 100
    : ltv; // no sub financing → CLTV = LTV

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
    cltv,
    loanCategory,
    loanPurpose,
    loanType,
    category,
    employmentType,
    subFinancing,
    propertyType,
    occupancy,
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

      // Calculate LLPA for this lender/program
      // Tag program with lender's LLPA mode so the LLPA function can skip if 'baked'
      const llpaMode = LENDER_LLPA_MODE[lenderId] || 'separate';
      program._llpaMode = llpaMode;
      const lenderLlpas = lenderData.llpas || null; // lender-specific LLPAs if available
      const llpa = calculateLLPAForScenario(enrichedScenario, lenderLlpas, program);

      for (const rateEntry of lockRates) {
        // Normalize price to discount format
        const rawDiscount = toDiscountFormat(rateEntry.price, program.priceFormat || 'discount');

        // Apply LLPA adjustments (increases cost — worse FICO/LTV = higher adjustment)
        const afterLlpa = rawDiscount + llpa.total;

        // Add broker comp (lender-paid = increases cost to borrower)
        const afterComp = afterLlpa + compPoints;

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
          llpaPoints: Math.round(llpa.total * 1000) / 1000,
          llpaBreakdown: llpa.breakdown,
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
      cltv: Math.round(cltv * 100) / 100,
      loanCategory,
      employmentType,
      subFinancing,
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
