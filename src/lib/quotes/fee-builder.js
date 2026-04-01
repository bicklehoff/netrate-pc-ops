/**
 * Fee template builder — loads state/county/purpose fee templates
 * and builds the sections A-H JSON for BorrowerQuote.feeBreakdown.
 *
 * Section A: Lender/origination fees (from lender data, not template)
 * Section B: Third-party services (appraisal, credit, flood, tax, MERS, title endorsement)
 * Section C: Title/settlement (lender's title policy, closing protection, settlement agent)
 * Section E: Recording fees
 * Section F: Prepaid items (homeowner's insurance, flood insurance)
 * Section G: Initial escrow (insurance + tax months)
 * Section H: Other
 */

import prisma from '@/lib/prisma';

// 10-minute cache for fee templates (they rarely change)
let templateCache = { data: new Map(), fetchedAt: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(state, county, purpose) {
  return `${state}|${county ?? ''}|${purpose}`;
}

async function loadTemplate(state, county, purpose) {
  const now = Date.now();
  const key = cacheKey(state, county, purpose);

  if (templateCache.data.has(key) && (now - templateCache.fetchedAt) < CACHE_TTL_MS) {
    return templateCache.data.get(key);
  }

  // Try exact match (state + county + purpose), then fall back to state-level
  let template = await prisma.feeTemplate.findUnique({
    where: {
      state_county_purpose: { state, county: county ?? '', purpose },
    },
  });

  if (!template && county) {
    template = await prisma.feeTemplate.findFirst({
      where: { state, county: null, purpose, status: 'active' },
    });
  }

  // Fall back to state with null county
  if (!template) {
    template = await prisma.feeTemplate.findFirst({
      where: { state, purpose, status: 'active' },
    });
  }

  templateCache.data.set(key, template);
  if (now - templateCache.fetchedAt > CACHE_TTL_MS) {
    templateCache.fetchedAt = now;
  }

  return template;
}

function toNum(val) {
  if (val == null) return 0;
  return Number(val);
}

/**
 * Build fee breakdown for a quote.
 *
 * @param {Object} params
 * @param {string} params.state
 * @param {string} [params.county]
 * @param {string} params.purpose — purchase/refinance/cashout
 * @param {number} params.lenderFeeUw — underwriting fee from lender (typically from RateLender or product)
 * @param {number} [params.loanAmount] — used for escrow estimates
 * @param {number} [params.propertyValue] — used for insurance/tax estimates
 *
 * @returns {Object|null} { sectionA, sectionB, sectionC, sectionE, sectionF, sectionG, totalClosingCosts }
 */
export async function buildFeeBreakdown({ state, county, purpose, lenderFeeUw = 0, loanAmount, propertyValue }) {
  const mappedPurpose = purpose === 'cashout' ? 'refinance' : purpose;
  const template = await loadTemplate(state, county, mappedPurpose);

  if (!template) {
    // No fallback defaults — return empty fees with a config warning
    return {
      sectionA: { label: 'Lender Fees', items: [{ label: 'Underwriting Fee', amount: lenderFeeUw }], total: lenderFeeUw },
      sectionB: { label: 'Third-Party Services', items: [], total: 0 },
      sectionC: { label: 'Title & Settlement', items: [], total: 0 },
      sectionE: { label: 'Recording Fees', items: [], total: 0 },
      sectionF: { label: 'Prepaid Items', items: [], total: 0 },
      sectionG: { label: 'Initial Escrow', items: [], total: 0 },
      totalClosingCosts: lenderFeeUw,
      monthlyTax: 0,
      monthlyInsurance: 0,
      templateId: null,
      configWarning: `No fee template for ${state}/${county || 'any county'}/${mappedPurpose} — add a row to fee_templates for accurate closing costs.`,
    };
  }

  const sectionA = {
    label: 'Lender Fees',
    items: [
      { label: 'Underwriting Fee', amount: lenderFeeUw },
      { label: 'Origination Fee', amount: toNum(template.lenderFeeOrigination) },
    ],
    total: lenderFeeUw + toNum(template.lenderFeeOrigination),
  };

  const sectionB = {
    label: 'Third-Party Services',
    items: [
      { label: 'Appraisal', amount: toNum(template.appraisal) },
      { label: 'Credit Report', amount: toNum(template.creditReport) },
      { label: 'MERS Fee', amount: toNum(template.mersFee) },
      { label: 'Flood Certification', amount: toNum(template.floodCert) },
      { label: 'Tax Service', amount: toNum(template.taxService) },
      { label: 'Title Endorsement', amount: toNum(template.titleEndorsement) },
    ].filter(i => i.amount > 0),
  };
  sectionB.total = sectionB.items.reduce((sum, i) => sum + i.amount, 0);

  const sectionC = {
    label: 'Title & Settlement',
    items: [
      { label: "Lender's Title Policy", amount: toNum(template.titleLendersPolicy) },
      { label: 'Closing Protection Letter', amount: toNum(template.closingProtectionLetter) },
      { label: 'Settlement Agent Fee', amount: toNum(template.settlementAgentFee) },
    ].filter(i => i.amount > 0),
  };
  sectionC.total = sectionC.items.reduce((sum, i) => sum + i.amount, 0);

  const sectionE = {
    label: 'Recording Fees',
    items: [
      { label: 'Recording Service Fee', amount: toNum(template.recordingServiceFee) },
      { label: 'Recording Fees', amount: toNum(template.recordingFees) },
      { label: 'County Recording Fee', amount: toNum(template.countyRecordingFee) },
    ].filter(i => i.amount > 0),
  };
  sectionE.total = sectionE.items.reduce((sum, i) => sum + i.amount, 0);

  // Prepaid items
  const homeInsurance = toNum(template.homeInsuranceAtClose);
  const floodIns = toNum(template.floodInsurance);
  const sectionF = {
    label: 'Prepaid Items',
    items: [
      ...(homeInsurance > 0 ? [{ label: 'Homeowner\'s Insurance (12 months)', amount: homeInsurance }] : []),
      ...(floodIns > 0 ? [{ label: 'Flood Insurance (12 months)', amount: floodIns }] : []),
    ],
  };
  sectionF.total = sectionF.items.reduce((sum, i) => sum + i.amount, 0);

  // Escrow
  const taxMonthly = toNum(template.propertyTaxMonthly);
  const escrowInsMonths = template.escrowInsuranceMonths ?? 3;
  const escrowTaxMonths = template.escrowTaxMonths ?? 3;
  const monthlyInsurance = homeInsurance > 0 ? Math.round(homeInsurance / 12) : 0;
  const sectionG = {
    label: 'Initial Escrow',
    items: [
      ...(monthlyInsurance > 0 ? [{ label: `Insurance (${escrowInsMonths} months)`, amount: monthlyInsurance * escrowInsMonths }] : []),
      ...(taxMonthly > 0 ? [{ label: `Property Tax (${escrowTaxMonths} months)`, amount: taxMonthly * escrowTaxMonths }] : []),
    ],
  };
  sectionG.total = sectionG.items.reduce((sum, i) => sum + i.amount, 0);

  const totalClosingCosts = sectionA.total + sectionB.total + sectionC.total + sectionE.total + sectionF.total + sectionG.total;

  return {
    sectionA,
    sectionB,
    sectionC,
    sectionE,
    sectionF,
    sectionG,
    totalClosingCosts,
    monthlyTax: taxMonthly,
    monthlyInsurance,
    templateId: template.id,
  };
}

// No fallback defaults — fee templates must exist in the DB.
// Run: INSERT INTO fee_templates (state, purpose, appraisal, credit_report, ...) VALUES ('CO', 'purchase', 650, 75, ...)
