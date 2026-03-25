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
import { getLenderLLPAs as loadLenderLLPAs } from '@/data/lender-llpas';
import { DEFAULT_SCENARIO } from './defaults';

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

// ─── FHA UFMIP (Upfront Mortgage Insurance Premium) ──────────────
// 1.75% of base loan amount, financed into the loan
// This increases the total loan amount used for P&I calculation

function calculateUFMIP(baseLoanAmount) {
  return Math.round(baseLoanAmount * 0.0175 * 100) / 100;
}

// ─── FHA Monthly MIP ─────────────────────────────────────────────
// Based on loan term, LTV, and loan amount
// These are the standard FHA MIP rates (annual, divided by 12 for monthly)
//
// Loan term > 15 years:
//   LTV ≤ 90%: 0.50% annual (for life if originated after 6/3/2013 with LTV > 90%)
//   LTV > 90% ≤ 95%: 0.50% annual
//   LTV > 95%: 0.55% annual
//   Loan amount > $726,200 (high balance): add 0.25%
//
// Loan term ≤ 15 years:
//   LTV ≤ 90%: 0.15% annual
//   LTV > 90%: 0.40% annual

function calculateFHAMonthlyMIP(totalLoanAmount, ltv, term) {
  let annualRate;
  if (term > 15) {
    if (ltv <= 90) annualRate = 0.0050;
    else if (ltv <= 95) annualRate = 0.0050;
    else annualRate = 0.0055;
    // High balance surcharge
    if (totalLoanAmount > 726200) annualRate += 0.0025;
  } else {
    if (ltv <= 90) annualRate = 0.0015;
    else annualRate = 0.0040;
  }
  return Math.round((totalLoanAmount * annualRate / 12) * 100) / 100;
}

// ─── VA Funding Fee ──────────────────────────────────────────────
// Based on: first use vs subsequent, down payment %, and disability exemption
// Financed into the loan (increases total loan amount)
//
// Purchase / Cash-Out Refi:
//   First use:      0% down = 2.15%, 5-10% down = 1.50%, ≥10% down = 1.25%
//   Subsequent use: 0% down = 3.30%, 5-10% down = 1.50%, ≥10% down = 1.25%
//
// Rate/Term Refi (IRRRL): 0.50% regardless
// Exempt: disabled veterans, surviving spouses → 0%

const VA_FUNDING_FEE = {
  purchase: {
    firstUse:      { 0: 0.0215, 5: 0.0150, 10: 0.0125 },
    subsequentUse: { 0: 0.0330, 5: 0.0150, 10: 0.0125 },
  },
  cashout: {
    firstUse:      { 0: 0.0215, 5: 0.0150, 10: 0.0125 },
    subsequentUse: { 0: 0.0330, 5: 0.0150, 10: 0.0125 },
  },
  refinance: {
    firstUse:      { 0: 0.0050 },  // IRRRL
    subsequentUse: { 0: 0.0050 },  // IRRRL
  },
};

function calculateVAFundingFee(baseLoanAmount, loanPurpose, downPaymentPct = 0, options = {}) {
  const { isSubsequentUse = false, isExempt = false } = options;
  if (isExempt) return 0;

  const purposeKey = loanPurpose === 'cashout' ? 'cashout'
    : loanPurpose === 'purchase' ? 'purchase' : 'refinance';
  const useKey = isSubsequentUse ? 'subsequentUse' : 'firstUse';
  const tiers = VA_FUNDING_FEE[purposeKey]?.[useKey] || { 0: 0.0215 };

  // Find applicable tier based on down payment
  let rate;
  if (downPaymentPct >= 10 && tiers[10] !== undefined) rate = tiers[10];
  else if (downPaymentPct >= 5 && tiers[5] !== undefined) rate = tiers[5];
  else rate = tiers[0];

  return Math.round(baseLoanAmount * rate * 100) / 100;
}

// ─── Conventional PMI (Private Mortgage Insurance) ───────────────
// Required when LTV > 80% for conventional loans
// Rates vary by FICO and LTV. These are industry-average monthly rates.
// Actual PMI depends on insurer (MGIC, Radian, Essent, etc.)
//
// Values are annual PMI rate as percentage of loan amount
// Monthly PMI = loanAmount * annualRate / 12

const PMI_RATES = {
  // FICO bands → LTV tiers: 80.01-85, 85.01-90, 90.01-95, 95.01-97
  '>=760': [0.0019, 0.0027, 0.0046, 0.0063],
  '740-759': [0.0025, 0.0035, 0.0053, 0.0071],
  '720-739': [0.0033, 0.0047, 0.0068, 0.0090],
  '700-719': [0.0042, 0.0059, 0.0082, 0.0105],
  '680-699': [0.0055, 0.0078, 0.0105, 0.0136],
  '660-679': [0.0070, 0.0098, 0.0130, 0.0175],
  '640-659': [0.0085, 0.0120, 0.0165, 0.0220],
  '620-639': [0.0100, 0.0145, 0.0200, 0.0265],
};

function calculateConventionalPMI(loanAmount, ltv, creditScore) {
  if (ltv <= 80) return 0;

  // Determine PMI LTV tier index
  let ltvIdx;
  if (ltv <= 85) ltvIdx = 0;
  else if (ltv <= 90) ltvIdx = 1;
  else if (ltv <= 95) ltvIdx = 2;
  else ltvIdx = 3;

  // Determine FICO band
  let ficoBand;
  if (creditScore >= 760) ficoBand = '>=760';
  else if (creditScore >= 740) ficoBand = '740-759';
  else if (creditScore >= 720) ficoBand = '720-739';
  else if (creditScore >= 700) ficoBand = '700-719';
  else if (creditScore >= 680) ficoBand = '680-699';
  else if (creditScore >= 660) ficoBand = '660-679';
  else if (creditScore >= 640) ficoBand = '640-659';
  else ficoBand = '620-639';

  const annualRate = PMI_RATES[ficoBand]?.[ltvIdx] ?? 0.0080;
  return Math.round((loanAmount * annualRate / 12) * 100) / 100;
}

// ─── Lender Fee Defaults ──────────────────────────────────────────
// Per-lender origination/UW fees (from rate sheets)
// "Fees In" pricing: lender fees are baked into the rate pricing (subtracted from price)
// so the borrower sees the TRUE cost of each option. Lender fees do NOT appear
// separately in closing costs — only third-party costs (title, escrow, recording) do.

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
// ALL lenders have LLPAs applied separately — confirmed via LoanSifter comparison.
// LoanSifter shows adjustment breakdown for Keystone: FICO/LTV, loan amount, state.
// EverStream, AmWest, SWMC have LLPA grids on their rate sheets.
// Keystone and TLS don't publish LLPAs — use GSE standard as fallback.
const LENDER_LLPA_MODE = {
  tls: 'separate',        // No LLPA sheet — use GSE standard
  swmc: 'separate',       // LLPA grids at rows 1316+ on RATESHEET
  keystone: 'separate',   // No LLPA sheet — use GSE standard
  amwest: 'separate',     // FT_LLPAS and LLPAS sheets
  everstream: 'separate', // 19 LLPA sheets in companion XLSX
};

// ─── LLPA (Loan-Level Price Adjustments) ──────────────────────────
// Standard GSE LLPA grids (Fannie Mae / Freddie Mac)
//
// ALL lenders have LLPAs applied separately (confirmed via LoanSifter comparison).
// - TLS: No LLPA sheet on rate sheet — use GSE standard as fallback.
// - SWMC: LLPA grids at rows 1316+ on rate sheet — TODO: extract lender-specific.
// - Keystone: No LLPA sheet — use GSE standard as fallback.
// - AmWest: Separate FT_LLPAS and LLPAS sheets — TODO: wire lender-specific.
// - EverStream: 19 LLPA sheets in companion XLSX — TODO: wire lender-specific.
//
// All lenders use llpaMode = 'separate'. Lender-specific grids used when available,
// GSE standard as fallback when lender doesn't publish their own grid.
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

  // Exclude "Same Servicer" products — David never uses these
  if (program.name && /same\s*servicer/i.test(program.name)) {
    return { eligible: false, reason: 'same_servicer_excluded' };
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
    creditScore = DEFAULT_SCENARIO.fico,
    propertyValue = null,
    term = 30,
    employmentType = 'w2',         // 'w2' | 'selfEmployed' — defaults to W-2
    subFinancing = false,          // subordinate financing (second mortgage/HELOC staying in place)
    subFinancingBalance = 0,       // balance of second lien (for CLTV calc)
    propertyType = 'sfr',
    occupancy = 'primary',
    // VA-specific
    vaSubsequentUse = false,       // first use vs subsequent (affects funding fee)
    vaExempt = false,              // disabled veteran / surviving spouse (no funding fee)
    downPaymentPct = 0,            // for VA funding fee tiers
  } = scenario;

  const lockDays = options.lockDays || 30;
  const termFilter = options.termFilter || term;

  // Derived values — round to 2 decimal places to avoid floating-point band boundary issues
  const ltv = propertyValue ? Math.round((loanAmount / propertyValue) * 10000) / 100 : 80;

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

  // Default broker comp (may be overridden per-lender below)
  const defaultCompAmount = calculateComp(loanAmount, loanPurpose);
  const defaultCompPoints = (defaultCompAmount / loanAmount) * 100;

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
    compAmount: defaultCompAmount,
    compPoints: defaultCompPoints,
  };

  const results = [];

  for (const lenderData of allPrograms) {
    const lenderId = lenderData.lenderId;

    // Use lender-specific fee from parsed data, fall back to hardcoded
    const lenderFee = lenderData.lenderFee || LENDER_FEES[lenderId] || 1000;

    // Use lender-specific comp cap if available
    let compAmount = defaultCompAmount;
    let compPoints = defaultCompPoints;
    if (lenderData.compCap) {
      const cap = loanPurpose === 'purchase'
        ? (lenderData.compCap.purchase || lenderData.compCap.refinance)
        : (lenderData.compCap.refinance || lenderData.compCap.purchase);
      if (cap) {
        compAmount = Math.min(loanAmount * BROKER_COMP.rate, cap);
        compPoints = (compAmount / loanAmount) * 100;
      }
    }

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

      // Load lender-specific LLPA data if available
      // Priority: 1) parsed from rate sheet (normalized keys), 2) lender-llpas.js (pre-baked), 3) GSE defaults
      const lenderLlpaData = loadLenderLLPAs(lenderId);
      let lenderLlpas = null;
      if (lenderData.llpas) {
        // Use LLPA grids parsed from the rate sheet (normalized >=800 keys)
        // Additional adjustments may be per-purpose — select the right one
        const purposeKey = loanPurpose === 'cashout' ? 'cashout' : loanPurpose === 'purchase' ? 'purchase' : 'refinance';
        const parsedAdditionalByPurpose = lenderData.agencyLlpas?.additionalAdjustments;
        const parsedAdditional = parsedAdditionalByPurpose?.[purposeKey]
          || lenderLlpaData?.additionalAdjustments?.[purposeKey]
          || lenderLlpaData?.additionalAdjustments || null;
        lenderLlpas = {
          purchaseLlpa: lenderData.llpas.purchase || null,
          refiLlpa: lenderData.llpas.refinance || null,
          cashoutLlpa: lenderData.llpas.cashout || null,
          additionalLlpa: parsedAdditional,
          loanAmtAdj: lenderLlpaData?.loanAmountAdj || [],
          ltvBands: lenderData.llpas.ltvBands || null,
        };
      } else if (lenderLlpaData) {
        lenderLlpas = {
          purchaseLlpa: lenderLlpaData.ficoLtvGrids?.purchase || null,
          refiLlpa: lenderLlpaData.ficoLtvGrids?.refinance || null,
          cashoutLlpa: lenderLlpaData.ficoLtvGrids?.cashout || null,
          additionalLlpa: lenderLlpaData.additionalAdjustments || null,
          loanAmtAdj: lenderLlpaData.loanAmountAdj || [],
        };
      }

      const llpa = calculateLLPAForScenario(enrichedScenario, lenderLlpas, program);

      // Apply lender-specific additional adjustments (FICO tier, purpose, state, LTV specials)
      // These are ON TOP of the FICO×LTV base grid
      if (lenderLlpaData) {
        // FICO tier adjustment (separate from FICO×LTV grid)
        if (lenderLlpaData.ficoTierAdj) {
          let ficoAdj = 0;
          if (creditScore < 620) ficoAdj = lenderLlpaData.ficoTierAdj['0-619'] || 0;
          else if (creditScore < 640) ficoAdj = lenderLlpaData.ficoTierAdj['620-639'] || 0;
          else if (creditScore < 700) ficoAdj = lenderLlpaData.ficoTierAdj['640-699'] || 0;
          else ficoAdj = lenderLlpaData.ficoTierAdj['700+'] || 0;
          if (ficoAdj !== 0) {
            llpa.total += ficoAdj;
            llpa.breakdown.push({ label: `FICO tier (${creditScore})`, value: ficoAdj });
          }
        }

        // Loan purpose adjustment
        if (lenderLlpaData.purposeAdj) {
          const purposeKey = loanPurpose === 'cashout' ? 'cashout' : loanPurpose === 'purchase' ? 'purchase' : 'refinance';
          const purposeAdj = lenderLlpaData.purposeAdj[purposeKey] || 0;
          if (purposeAdj !== 0) {
            llpa.total += purposeAdj;
            llpa.breakdown.push({ label: `Loan purpose (${purposeKey})`, value: purposeAdj });
          }
        }

        // State adjustment
        if (lenderLlpaData.stateAdj && state) {
          const stateAdj = lenderLlpaData.stateAdj[state] || 0;
          if (stateAdj !== 0) {
            llpa.total += stateAdj;
            llpa.breakdown.push({ label: `State (${state})`, value: stateAdj });
          }
        }

        // LTV special adjustments
        if (lenderLlpaData.ltvSpecialAdj) {
          if (ltv > 95 && creditScore < 700 && lenderLlpaData.ltvSpecialAdj.ltv95_fico700) {
            llpa.total += lenderLlpaData.ltvSpecialAdj.ltv95_fico700;
            llpa.breakdown.push({ label: 'LTV>95% & FICO<700', value: lenderLlpaData.ltvSpecialAdj.ltv95_fico700 });
          } else if (ltv > 95 && lenderLlpaData.ltvSpecialAdj.ltv95) {
            llpa.total += lenderLlpaData.ltvSpecialAdj.ltv95;
            llpa.breakdown.push({ label: 'LTV>95%', value: lenderLlpaData.ltvSpecialAdj.ltv95 });
          } else if (ltv > 85 && lenderLlpaData.ltvSpecialAdj.ltv85) {
            llpa.total += lenderLlpaData.ltvSpecialAdj.ltv85;
            llpa.breakdown.push({ label: 'LTV>85%', value: lenderLlpaData.ltvSpecialAdj.ltv85 });
          }
        }
      }

      // ─── Parsed lender-specific adjustments (from rate sheet) ──────
      // These are applied to the LLPA total (same sign convention: positive = cost)

      // Loan amount adjustment (e.g., +0.075 for $400K-$548K)
      if (lenderData.loanAmountAdj?.length) {
        const termKey = program.term > 15 ? 'adj30yr' : 'adj15yr';
        const loanAmtTier = lenderData.loanAmountAdj.find(
          t => loanAmount >= t.min && loanAmount <= t.max
        );
        if (loanAmtTier) {
          const adj = loanAmtTier[termKey] || 0;
          if (adj !== 0) {
            // Loan amount adj is a CREDIT (positive = price improvement), so SUBTRACT from cost
            llpa.total -= adj;
            llpa.breakdown.push({ label: `Loan amt (${(loanAmtTier.min/1000).toFixed(0)}K-${(loanAmtTier.max/1000).toFixed(0)}K)`, value: -adj });
          }
        }
      }

      // State adjustment (e.g., CO = +0.050)
      if (lenderData.stateAdj && state) {
        const stAdj = lenderData.stateAdj[state];
        if (stAdj) {
          const termKey = program.term > 15 ? 'adj30yr' : 'adj15yr';
          const adj = stAdj[termKey] || 0;
          if (adj !== 0) {
            // State adj: positive = price improvement, so SUBTRACT from cost
            llpa.total -= adj;
            llpa.breakdown.push({ label: `State (${state})`, value: -adj });
          }
        }
      }

      for (const rateEntry of lockRates) {
        // Normalize price to discount format
        const rawDiscount = toDiscountFormat(rateEntry.price, program.priceFormat || 'discount');

        // Apply spec payups (rate × loan amount matrix — price IMPROVEMENT)
        let specPayup = 0;
        if (lenderData.specPayups) {
          // Determine which product key to use
          const spKey = program.loanType === 'fha' ? 'fha30'
            : program.loanType === 'va' ? 'va30'
            : program.term === 30 ? 'conv30' : null;
          const spGrid = spKey ? lenderData.specPayups[spKey] : null;
          if (spGrid?.byRate && spGrid?.loanAmtBuckets) {
            const rateKey = String(rateEntry.rate);
            const ratePayups = spGrid.byRate[rateKey];
            if (ratePayups) {
              const bucketIdx = spGrid.loanAmtBuckets.findIndex(
                b => loanAmount >= b.min && loanAmount <= b.max
              );
              if (bucketIdx !== -1 && typeof ratePayups[bucketIdx] === 'number') {
                specPayup = ratePayups[bucketIdx];
              }
            }
          }
        }

        // Apply LLPA adjustments (increases cost — worse FICO/LTV = higher adjustment)
        // Spec payup is subtracted (it's a price improvement / credit)
        const afterLlpa = rawDiscount + llpa.total - specPayup;

        // Add broker comp (lender-paid = increases cost to borrower)
        const afterComp = afterLlpa + compPoints;

        // "Fees In" — bake lender fee into pricing so borrower sees true cost
        // Convert lender fee to points: fee / loanAmount * 100
        const lenderFeePoints = (lenderFee / loanAmount) * 100;
        const feesIn = afterComp + lenderFeePoints;

        // Convert to dollars (fees-in total — includes lender fee, LLPAs, comp)
        const costDollars = (feesIn / 100) * loanAmount;

        // ─── Loan-type-specific calculations ─────────────────────
        // FHA: UFMIP financed into loan, monthly MIP added to payment
        // VA: Funding fee financed into loan
        // Conv: PMI if LTV > 80%

        let totalLoanAmount = loanAmount;  // Base loan
        let monthlyMI = 0;                 // Monthly mortgage insurance
        let upfrontMI = 0;                 // Financed upfront premium
        let upfrontMILabel = null;

        if (program.loanType === 'fha') {
          // FHA UFMIP — financed into loan
          upfrontMI = calculateUFMIP(loanAmount);
          upfrontMILabel = 'UFMIP (1.75%)';
          totalLoanAmount = loanAmount + upfrontMI;
          // FHA Monthly MIP
          monthlyMI = calculateFHAMonthlyMIP(totalLoanAmount, ltv, program.term);
        } else if (program.loanType === 'va') {
          // VA Funding Fee — financed into loan
          upfrontMI = calculateVAFundingFee(loanAmount, loanPurpose, downPaymentPct, {
            isSubsequentUse: vaSubsequentUse,
            isExempt: vaExempt,
          });
          upfrontMILabel = vaExempt ? 'VA Funding Fee (Exempt)' : `VA Funding Fee`;
          totalLoanAmount = loanAmount + upfrontMI;
          // VA has no monthly MI
        } else if (program.loanType === 'conventional' && ltv > 80) {
          // Conventional PMI
          monthlyMI = calculateConventionalPMI(loanAmount, ltv, creditScore);
        }
        // USDA: has guarantee fee (1%) + annual fee (0.35%) — TODO: add when USDA programs are parsed

        // Monthly P&I — calculated on total loan amount (includes financed premiums)
        const monthlyPI = calculatePI(rateEntry.rate, totalLoanAmount, program.term);

        // Total monthly payment (P&I + MI)
        const totalPayment = Math.round((monthlyPI + monthlyMI) * 100) / 100;

        // APR: finance charges = net cost to borrower + upfront MI (if financed)
        const netFinanceCharges = Math.max(0, costDollars + upfrontMI);
        const apr = calculateAPR(rateEntry.rate, loanAmount, netFinanceCharges, program.term);

        // Tags — based on fees-in pricing (true cost to borrower)
        const tags = [];
        if (Math.abs(feesIn) < 0.15) tags.push('PAR');
        if (feesIn < -0.5) tags.push('NO COST');
        if (program.isStreamline) tags.push('STREAMLINE');
        if (program.isFastTrack) tags.push('FAST TRACK');
        if (vaExempt && program.loanType === 'va') tags.push('VA EXEMPT');

        results.push({
          lender: lenderId,
          lenderFee,                    // Still tracked for transparency
          lenderFeePoints: Math.round(lenderFeePoints * 1000) / 1000,
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
          costPoints: Math.round(feesIn * 1000) / 1000,     // "Fees In" — includes lender fee
          costDollars: Math.round(costDollars),              // "Fees In" — includes lender fee
          costBeforeFees: Math.round(afterComp * 1000) / 1000, // Pre-fee cost (for debugging)
          // Loan amounts
          baseLoanAmount: loanAmount,
          totalLoanAmount: Math.round(totalLoanAmount),      // Includes financed UFMIP/VA FF
          upfrontMI: Math.round(upfrontMI),
          upfrontMILabel,
          // Payments
          monthlyPI: Math.round(monthlyPI * 100) / 100,
          monthlyMI: Math.round(monthlyMI * 100) / 100,
          totalPayment,                                      // P&I + MI
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
          monthlyMI: r.monthlyMI,
          totalPayment: r.totalPayment,
          totalLoanAmount: r.totalLoanAmount,
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
      compAmount: Math.round(defaultCompAmount),
      compPoints: Math.round(defaultCompPoints * 1000) / 1000,
    },
    closingCosts: {
      // "Fees In" pricing — lender fee and broker comp are baked into rate pricing.
      // Closing costs shown to borrower are ONLY third-party costs.
      lenderFee: 'Included in rate pricing (Fees In)',
      brokerComp: 'Included in rate pricing (lender-paid)',
      thirdParty: {
        estimate: state ? getThirdPartyCostEstimate(state, loanPurpose) : null,
        note: 'Estimated third-party costs only — lender fees already reflected in rate/pricing above',
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

// ─── Exports ─────────────────────────────────────────────────────
// Export utility functions for use by individual calculators

export {
  calculateUFMIP,
  calculateFHAMonthlyMIP,
  calculateVAFundingFee,
  calculateConventionalPMI,
  calculateComp,
  calculateLLPAForScenario,
  getThirdPartyCostEstimate,
};
