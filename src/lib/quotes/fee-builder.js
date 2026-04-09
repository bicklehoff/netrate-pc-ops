/**
 * Fee template builder — loads state/county/purpose fee templates
 * and builds the sections A-H JSON for BorrowerQuote.feeBreakdown.
 *
 * Section A: Origination Charges
 * Section B: Services You Cannot Shop For
 * Section C: Services You Can Shop For
 * Section D: TOTAL LOAN COSTS (A + B + C)
 * Section E: Taxes and Other Government Fees
 * Section F: Prepaids
 * Section G: Initial Escrow Payment at Closing
 * Section H: Other (MLO-entered manual fees)
 * Section I: TOTAL OTHER COSTS (E + F + G + H)
 * Section J: TOTAL CLOSING COSTS (D + I)
 */

import sql from '@/lib/db';
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
  const exactRows = await sql`
    SELECT * FROM fee_templates
    WHERE state = ${state} AND county = ${county ?? ''} AND purpose = ${purpose}
    LIMIT 1
  `;
  let template = exactRows[0] || null;

  if (!template && county) {
    const stateRows = await sql`
      SELECT * FROM fee_templates
      WHERE state = ${state} AND county IS NULL AND purpose = ${purpose} AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    template = stateRows[0] || null;
  }

  if (!template) {
    const fallbackRows = await sql`
      SELECT * FROM fee_templates
      WHERE state = ${state} AND purpose = ${purpose} AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    template = fallbackRows[0] || null;
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
 * FHA annual MIP rate based on term, LTV, and base loan amount.
 * Current schedule (case numbers assigned on/after 3/20/2023).
 * Returns annual rate as a decimal (e.g. 0.0055 = 55 bps).
 */
function getFhaMipRate(term, ltv, baseLoanAmount) {
  const isHighBalance = baseLoanAmount > 726200;
  const extra = isHighBalance ? 0.0025 : 0;
  if (term <= 15) {
    return (ltv <= 90 ? 0.0015 : 0.0040) + extra;
  }
  return (ltv <= 95 ? 0.0050 : 0.0055) + extra;
}

const FHA_UFMIP_RATE = 0.0175; // 1.75%

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
 * @param {number}      [params.annualTaxes]      — override annual tax; falls back to template.property_tax_monthly×12
 * @param {number}      [params.annualInsurance]  — override annual HOI; falls back to template.home_insurance_at_close
 * @param {Date|string} [params.hoiEffectiveDate] — HOI policy date (purchase: defaults to fundingDate)
 * @param {boolean}     [params.hasFlood]
 * @param {number}      [params.annualFlood]
 * @param {boolean}     [params.hasMud]           — TX MUD tax
 * @param {number}      [params.annualMud]
 * @param {boolean}     [params.hasHailWind]      — TX hail/wind separate policy
 * @param {number}      [params.annualHailWind]
 * @param {string}      [params.loanType]         — conventional/fha/va
 * @param {number}      [params.ltv]              — LTV % for FHA MIP lookup
 * @param {number}      [params.term]             — loan term for FHA MIP lookup
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
  loanType = 'conventional',
  ltv = 75,
  term = 30,
}) {
  const mappedPurpose = purpose === 'cashout' ? 'refinance' : purpose;
  const template = await loadTemplate(state, county, mappedPurpose);

  // Resolve annual escrow amounts: use passed values → template defaults → 0
  const resolvedAnnualTaxes    = annualTaxes    != null ? Number(annualTaxes)    : toNum(template?.property_tax_monthly) * 12;
  const resolvedAnnualIns      = annualInsurance != null ? Number(annualInsurance) : toNum(template?.home_insurance_at_close);
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

  // ── FHA calculations ────────────────────────────────────────────────────
  const isFha = loanType === 'fha';
  const ufmip = isFha ? Math.round(loanAmount * FHA_UFMIP_RATE) : 0;
  const annualMipRate = isFha ? getFhaMipRate(term, ltv, loanAmount) : 0;
  // Monthly MIP is on the total loan amount (base + financed UFMIP)
  const monthlyMip = isFha ? Math.round((loanAmount + ufmip) * annualMipRate / 12 * 100) / 100 : 0;

  // ── Section A: Origination Charges ────────────────────────────────────────
  const sectionA = {
    label: 'A. Origination Charges',
    items: [
      { label: 'Underwriting Fee', amount: lenderFeeUw },
      ...(toNum(template?.lender_fee_origination) > 0
        ? [{ label: 'Origination Fee', amount: toNum(template.lender_fee_origination) }]
        : []),
    ],
    total: lenderFeeUw + toNum(template?.lender_fee_origination),
  };

  if (!template) {
    // No template — return minimal skeleton with escrow still calculated from dates
    const sectionF = {
      label: 'F. Prepaids',
      items: escrow.sectionFItems,
      total: escrow.sectionFItems.reduce((s, i) => s + i.amount, 0),
    };
    const sectionG = {
      label: 'G. Initial Escrow Payment at Closing',
      items: escrow.sectionGItems,
      total: escrow.sectionGItems.reduce((s, i) => s + i.amount, 0),
    };
    const sectionH = { label: 'H. Other', items: [], total: 0 };
    const sectionD = sectionA.total;
    const sectionI = sectionF.total + sectionG.total + sectionH.total;
    const totalClosingCosts = sectionD + sectionI;

    return {
      sectionA,
      sectionB: { label: 'B. Services You Cannot Shop For', items: ufmip > 0 ? [{ label: 'FHA Upfront MIP (1.75%)', amount: ufmip, note: 'Financed into loan' }] : [], total: ufmip },
      sectionC: { label: 'C. Services You Can Shop For', items: [], total: 0 },
      sectionE: { label: 'E. Taxes and Other Government Fees', items: [], total: 0 },
      sectionF,
      sectionG,
      sectionH,
      sectionD,
      sectionI,
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
      monthlyMip,
      ufmip,
      annualMipRate,
      escrowCalc: escrow,
      templateId: null,
      configWarning: `No fee template for ${state}/${county || 'any county'}/${mappedPurpose} — add a row to fee_templates for accurate closing costs.`,
    };
  }

  // ── Section B: Services You Cannot Shop For ──────────────────────────────
  const sectionBItems = [
    ...(ufmip > 0
      ? [{ label: 'FHA Upfront MIP (1.75%)', amount: ufmip, note: 'Financed into loan' }]
      : []),
    { label: 'Appraisal', amount: toNum(template.appraisal) },
    { label: 'Credit Report', amount: toNum(template.credit_report) },
    { label: 'MERS Fee', amount: toNum(template.mers_fee) },
    { label: 'Flood Certification', amount: toNum(template.flood_cert) },
    { label: 'Tax Service', amount: toNum(template.tax_service) },
    { label: 'Title Endorsement', amount: toNum(template.title_endorsement) },
  ].filter(i => i.amount > 0);
  const sectionB = {
    label: 'B. Services You Cannot Shop For',
    items: sectionBItems,
    total: sectionBItems.reduce((s, i) => s + i.amount, 0),
  };

  // ── Section C: Services You Can Shop For ─────────────────────────────────
  const sectionC = {
    label: 'C. Services You Can Shop For',
    items: [
      { label: "Lender's Title Policy", amount: toNum(template.title_lenders_policy) },
      { label: 'Closing Protection Letter', amount: toNum(template.closing_protection_letter) },
      { label: 'Settlement Agent Fee', amount: toNum(template.settlement_agent_fee) },
    ].filter(i => i.amount > 0),
  };
  sectionC.total = sectionC.items.reduce((s, i) => s + i.amount, 0);

  // ── Section E: Taxes and Other Government Fees ────────────────────────────
  const sectionE = {
    label: 'E. Taxes and Other Government Fees',
    items: [
      { label: 'Recording Service Fee', amount: toNum(template.recording_service_fee) },
      { label: 'Recording Fees', amount: toNum(template.recording_fees) },
      { label: 'County Recording Fee', amount: toNum(template.county_recording_fee) },
    ].filter(i => i.amount > 0),
  };
  sectionE.total = sectionE.items.reduce((s, i) => s + i.amount, 0);

  // ── Section F: Prepaids (from escrow calc) ────────────────────────────────
  const sectionF = {
    label: 'F. Prepaids',
    items: escrow.sectionFItems,
    total: escrow.sectionFItems.reduce((s, i) => s + i.amount, 0),
  };

  // ── Section G: Initial Escrow Payment at Closing ─────────────────────────
  const sectionG = {
    label: 'G. Initial Escrow Payment at Closing',
    items: escrow.sectionGItems,
    total: escrow.sectionGItems.reduce((s, i) => s + i.amount, 0),
  };

  // ── Section H: Other (MLO-entered manual fees) ───────────────────────────
  const sectionH = { label: 'H. Other', items: [], total: 0 };

  // ── Subtotals (LE format) ───────────────────────────────────────────────
  const sectionD = sectionA.total + sectionB.total + sectionC.total;
  const sectionI = sectionE.total + sectionF.total + sectionG.total + sectionH.total;
  const totalClosingCosts = sectionD + sectionI;

  return {
    sectionA,
    sectionB,
    sectionC,
    sectionE,
    sectionF,
    sectionG,
    sectionH,
    sectionD,
    sectionI,
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
    monthlyMip,
    ufmip,
    annualMipRate,
    escrowCalc: escrow,
    templateId: template.id,
  };
}
