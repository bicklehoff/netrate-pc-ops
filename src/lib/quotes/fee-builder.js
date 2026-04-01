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
    return buildDefaultFees({ state, purpose, lenderFeeUw, loanAmount, propertyValue });
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

/**
 * Fallback defaults when no fee template exists for the state.
 */
function buildDefaultFees({ state, lenderFeeUw }) {
  const defaults = STATE_DEFAULTS[state] || STATE_DEFAULTS.DEFAULT;

  const sectionA = {
    label: 'Lender Fees',
    items: [{ label: 'Underwriting Fee', amount: lenderFeeUw }],
    total: lenderFeeUw,
  };

  const sectionB = {
    label: 'Third-Party Services',
    items: [
      { label: 'Appraisal', amount: defaults.appraisal },
      { label: 'Credit Report', amount: defaults.creditReport },
      { label: 'Flood Certification', amount: defaults.floodCert },
      { label: 'Tax Service', amount: defaults.taxService },
    ],
    total: defaults.appraisal + defaults.creditReport + defaults.floodCert + defaults.taxService,
  };

  const sectionC = {
    label: 'Title & Settlement',
    items: [
      { label: "Lender's Title Policy", amount: defaults.titlePolicy },
      { label: 'Settlement Agent Fee', amount: defaults.settlementFee },
    ],
    total: defaults.titlePolicy + defaults.settlementFee,
  };

  const sectionE = {
    label: 'Recording Fees',
    items: [{ label: 'Recording Fees', amount: defaults.recordingFees }],
    total: defaults.recordingFees,
  };

  const sectionF = {
    label: 'Prepaid Items',
    items: [{ label: 'Homeowner\'s Insurance (12 months)', amount: defaults.annualInsurance }],
    total: defaults.annualInsurance,
  };

  const monthlyTax = defaults.monthlyTax;
  const monthlyInsurance = Math.round(defaults.annualInsurance / 12);
  const sectionG = {
    label: 'Initial Escrow',
    items: [
      { label: 'Insurance (3 months)', amount: monthlyInsurance * 3 },
      { label: 'Property Tax (3 months)', amount: monthlyTax * 3 },
    ],
    total: (monthlyInsurance * 3) + (monthlyTax * 3),
  };

  const totalClosingCosts = sectionA.total + sectionB.total + sectionC.total + sectionE.total + sectionF.total + sectionG.total;

  return {
    sectionA,
    sectionB,
    sectionC,
    sectionE,
    sectionF,
    sectionG,
    totalClosingCosts,
    monthlyTax,
    monthlyInsurance,
    templateId: null,
  };
}

const STATE_DEFAULTS = {
  CO: {
    appraisal: 650,
    creditReport: 75,
    floodCert: 14,
    taxService: 78,
    titlePolicy: 875,
    settlementFee: 450,
    recordingFees: 75,
    annualInsurance: 2400,
    monthlyTax: 250,
  },
  CA: {
    appraisal: 750,
    creditReport: 75,
    floodCert: 14,
    taxService: 78,
    titlePolicy: 1200,
    settlementFee: 600,
    recordingFees: 125,
    annualInsurance: 3000,
    monthlyTax: 400,
  },
  TX: {
    appraisal: 600,
    creditReport: 75,
    floodCert: 14,
    taxService: 78,
    titlePolicy: 950,
    settlementFee: 500,
    recordingFees: 85,
    annualInsurance: 3600,
    monthlyTax: 500,
  },
  OR: {
    appraisal: 650,
    creditReport: 75,
    floodCert: 14,
    taxService: 78,
    titlePolicy: 800,
    settlementFee: 475,
    recordingFees: 100,
    annualInsurance: 1800,
    monthlyTax: 300,
  },
  DEFAULT: {
    appraisal: 650,
    creditReport: 75,
    floodCert: 14,
    taxService: 78,
    titlePolicy: 900,
    settlementFee: 475,
    recordingFees: 85,
    annualInsurance: 2400,
    monthlyTax: 300,
  },
};
