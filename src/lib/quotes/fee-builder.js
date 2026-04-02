/**
 * Fee template builder — loads state/county/purpose fee templates
 * and builds the sections A-H JSON for BorrowerQuote.feeBreakdown.
 *
 * Section A: Lender/origination fees (from lender data, not template)
 * Section B: Third-party services (appraisal, credit, flood cert, tax service, MERS, title endorsement)
 * Section C: Title/settlement (lender's title policy, closing protection, settlement agent)
 * Section E: Recording fees
 * Section F: Prepaid items — from calculateEscrowSections (HOI, flood, hail/wind, interest ±)
 * Section G: Initial escrow reserves — from calculateEscrowSections (RESPA aggregate; empty if not escrowing)
 */

import prisma from '@/lib/prisma';
import { calculateEscrowSections } from './escrow-calc';

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
 * @param {string}      params.state
 * @param {string}      [params.county]
 * @param {string}      params.purpose           — purchase/refinance/cashout
 * @param {number}      params.lenderFeeUw       — underwriting fee from lender
 * @param {number}      [params.loanAmount]
 * @param {Date|string} [params.fundingDate]      — used for escrow & prepaid interest calc
 * @param {number}      [params.annualRate]       — interest rate for per diem (e.g. 6.75)
 * @param {boolean}     [params.isEscrowing]      — default true; false → Section G is empty
 * @param {number}      [params.annualTaxes]      — override annual tax; falls back to template.propertyTaxMonthly×12
 * @param {number}      [params.annualInsurance]  — override annual HOI; falls back to template.homeInsuranceAtClose
 * @param {Date|string} [params.hoiEffectiveDate] — HOI policy date (purchase: defaults to fundingDate)
 * @param {boolean}     [params.hasFlood]
 * @param {number}      [params.annualFlood]
 * @param {boolean}     [params.hasMud]           — TX MUD tax
 * @param {number}      [params.annualMud]
 * @param {boolean}     [params.hasHailWind]      — TX hail/wind separate policy
 * @param {number}      [params.annualHailWind]
 *
 * @returns {Object} Fee breakdown with sections A-G, totals, and escrow metadata
 */
export async function buildFeeBreakdown({
  state,
  county,
  purpose,
  lenderFeeUw = 0,
  loanAmount,
  fundingDate,
  annualRate,
  isEscrowing = true,
  annualTaxes,
  annualInsurance,
  hoiEffectiveDate = null,
  hasFlood = false,
  annualFlood = 0,
  hasMud = false,
  annualMud = 0,
  hasHailWind = false,
  annualHailWind = 0,
}) {
  const mappedPurpose = purpose === 'cashout' ? 'refinance' : purpose;
  const template = await loadTemplate(state, county, mappedPurpose);

  // Resolve annual escrow amounts: use passed values → template defaults → 0
  const resolvedAnnualTaxes    = annualTaxes    != null ? Number(annualTaxes)    : toNum(template?.propertyTaxMonthly) * 12;
  const resolvedAnnualIns      = annualInsurance != null ? Number(annualInsurance) : toNum(template?.homeInsuranceAtClose);
  const resolvedAnnualFlood    = annualFlood    != null ? Number(annualFlood)    : 0;
  const resolvedAnnualMud      = annualMud      != null ? Number(annualMud)      : 0;
  const resolvedAnnualHailWind = annualHailWind != null ? Number(annualHailWind) : 0;

  // Run escrow calculation
  const escrow = calculateEscrowSections({
    fundingDate,
    loanAmount,
    annualRate,
    state,
    purpose,
    isEscrowing,
    annualTaxes:    resolvedAnnualTaxes,
    annualInsurance: resolvedAnnualIns,
    hoiEffectiveDate,
    hasFlood,
    annualFlood: resolvedAnnualFlood,
    hasMud,
    annualMud: resolvedAnnualMud,
    hasHailWind,
    annualHailWind: resolvedAnnualHailWind,
  });

  // ── Section A: Lender fees ────────────────────────────────────────────────
  const sectionA = {
    label: 'Lender Fees',
    items: [
      { label: 'Underwriting Fee', amount: lenderFeeUw },
      ...(toNum(template?.lenderFeeOrigination) > 0
        ? [{ label: 'Origination Fee', amount: toNum(template.lenderFeeOrigination) }]
        : []),
    ],
    total: lenderFeeUw + toNum(template?.lenderFeeOrigination),
  };

  if (!template) {
    // No template — return minimal skeleton with escrow still calculated from dates
    const sectionF = {
      label: 'Prepaid Items',
      items: escrow.sectionFItems,
      total: escrow.sectionFItems.reduce((s, i) => s + i.amount, 0),
    };
    const sectionG = {
      label: 'Initial Escrow',
      items: escrow.sectionGItems,
      total: escrow.sectionGItems.reduce((s, i) => s + i.amount, 0),
    };
    const totalClosingCosts = sectionA.total + sectionF.total + sectionG.total;

    return {
      sectionA,
      sectionB: { label: 'Third-Party Services', items: [], total: 0 },
      sectionC: { label: 'Title & Settlement', items: [], total: 0 },
      sectionE: { label: 'Recording Fees', items: [], total: 0 },
      sectionF,
      sectionG,
      totalClosingCosts,
      monthlyTax:      escrow.escrowMonthly.taxes,
      monthlyInsurance: escrow.escrowMonthly.insurance,
      // Escrow metadata for client-side state init
      isEscrowing,
      fundingDate: fundingDate || null,
      firstPaymentDateStr: escrow.firstPaymentDateStr,
      isInterestCredit: escrow.isInterestCredit,
      annualTaxes:    resolvedAnnualTaxes,
      annualInsurance: resolvedAnnualIns,
      hoiEffectiveDate: hoiEffectiveDate || null,
      hasFlood,   annualFlood: resolvedAnnualFlood,
      hasMud,     annualMud: resolvedAnnualMud,
      hasHailWind, annualHailWind: resolvedAnnualHailWind,
      escrowCalc: escrow,
      templateId: null,
      configWarning: `No fee template for ${state}/${county || 'any county'}/${mappedPurpose} — add a row to fee_templates for accurate closing costs.`,
    };
  }

  // ── Section B: Third-party services ──────────────────────────────────────
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
  sectionB.total = sectionB.items.reduce((s, i) => s + i.amount, 0);

  // ── Section C: Title & settlement ────────────────────────────────────────
  const sectionC = {
    label: 'Title & Settlement',
    items: [
      { label: "Lender's Title Policy", amount: toNum(template.titleLendersPolicy) },
      { label: 'Closing Protection Letter', amount: toNum(template.closingProtectionLetter) },
      { label: 'Settlement Agent Fee', amount: toNum(template.settlementAgentFee) },
    ].filter(i => i.amount > 0),
  };
  sectionC.total = sectionC.items.reduce((s, i) => s + i.amount, 0);

  // ── Section E: Recording fees ─────────────────────────────────────────────
  const sectionE = {
    label: 'Recording Fees',
    items: [
      { label: 'Recording Service Fee', amount: toNum(template.recordingServiceFee) },
      { label: 'Recording Fees', amount: toNum(template.recordingFees) },
      { label: 'County Recording Fee', amount: toNum(template.countyRecordingFee) },
    ].filter(i => i.amount > 0),
  };
  sectionE.total = sectionE.items.reduce((s, i) => s + i.amount, 0);

  // ── Section F: Prepaids (from escrow calc) ────────────────────────────────
  const sectionF = {
    label: 'Prepaid Items',
    items: escrow.sectionFItems,
    total: escrow.sectionFItems.reduce((s, i) => s + i.amount, 0),
  };

  // ── Section G: Initial escrow reserves (from escrow calc) ────────────────
  const sectionG = {
    label: 'Initial Escrow',
    items: escrow.sectionGItems,
    total: escrow.sectionGItems.reduce((s, i) => s + i.amount, 0),
  };

  const totalClosingCosts =
    sectionA.total + sectionB.total + sectionC.total + sectionE.total +
    sectionF.total + sectionG.total;

  return {
    sectionA,
    sectionB,
    sectionC,
    sectionE,
    sectionF,
    sectionG,
    totalClosingCosts,
    monthlyTax:       escrow.escrowMonthly.taxes,
    monthlyInsurance: escrow.escrowMonthly.insurance,
    // Escrow metadata for client-side state init
    isEscrowing,
    fundingDate: fundingDate || null,
    firstPaymentDateStr: escrow.firstPaymentDateStr,
    isInterestCredit: escrow.isInterestCredit,
    annualTaxes:    resolvedAnnualTaxes,
    annualInsurance: resolvedAnnualIns,
    hoiEffectiveDate: hoiEffectiveDate || null,
    hasFlood,   annualFlood: resolvedAnnualFlood,
    hasMud,     annualMud: resolvedAnnualMud,
    hasHailWind, annualHailWind: resolvedAnnualHailWind,
    escrowCalc: escrow,
    templateId: template.id,
  };
}
