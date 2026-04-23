/**
 * Transform functions for backward compatibility.
 *
 * Converts between the normalized scenario tables and the legacy JSONB
 * shapes that existing UI consumers expect in API responses.
 *
 * Post-D9a + migration 036: `scenarios.borrower_name/email/phone` columns
 * have been dropped. Identity comes exclusively from the JOINed contact
 * (scenario_id → contact_id → contacts) or the JOINed lead (scenario_id →
 * lead_id → leads) when no contact has been attached yet.
 */

/**
 * Derive `{ contact_name, contact_email, contact_phone }` from a
 * scenario row that was read with identity JOIN aliases:
 *   - Contact:  `_c_first_name`, `_c_last_name`, `_c_email`, `_c_phone`
 *   - Lead:     `_l_first_name`, `_l_last_name`, `_l_name`, `_l_email`, `_l_phone`
 *
 * Priority: contact → lead. Output keys are `contact_*` regardless of
 * which source wins — the API surface is unified post-UAD D9a.
 *
 * @param {object} scenario - Row from listScenarios / getScenarioById / createScenario.
 * @returns {{ contact_name: string|null, contact_email: string|null, contact_phone: string|null }}
 */
export function deriveIdentity(scenario) {
  if (!scenario) {
    return { contact_name: null, contact_email: null, contact_phone: null };
  }

  // Name: prefer contact (first+last), then lead structured, then lead full name.
  let contact_name = null;

  const cFn = scenario._c_first_name || null;
  const cLn = scenario._c_last_name || null;
  if (cFn || cLn) {
    contact_name = [cFn, cLn].filter(Boolean).join(' ') || null;
  }

  if (!contact_name) {
    const lFn = scenario._l_first_name || null;
    const lLn = scenario._l_last_name || null;
    if (lFn || lLn) {
      contact_name = [lFn, lLn].filter(Boolean).join(' ') || null;
    }
  }

  if (!contact_name) contact_name = scenario._l_name || null;

  const contact_email = scenario._c_email || scenario._l_email || null;
  const contact_phone = scenario._c_phone || scenario._l_phone || null;

  return { contact_name, contact_email, contact_phone };
}

/**
 * Convert a scenario_rates row to the legacy quote "scenarios" JSONB shape.
 * The quote API clients still expect the pre-unification response shape;
 * this keeps their contract stable while the data comes from scenario_rates.
 * @param {object} rate - scenario_rates row
 * @returns {object} Legacy-format rate object
 */
export function rateRowToQuoteShape(rate) {
  return {
    rate: Number(rate.rate),
    price: Number(rate.final_price),
    lender: rate.lender,
    lenderCode: rate.lender_code,
    program: rate.program,
    investor: rate.investor,
    tier: rate.tier,
    lockDays: rate.lock_days,
    monthlyPI: rate.monthly_pi != null ? Number(rate.monthly_pi) : null,
    rebateDollars: Number(rate.rebate_dollars || 0),
    discountDollars: Number(rate.discount_dollars || 0),
    compDollars: Number(rate.comp_dollars || 0),
    lenderFee: Number(rate.lender_fee || 0),
    ufmip: Number(rate.ufmip || 0),
    effectiveLoanAmount: rate.effective_loan_amount != null ? Number(rate.effective_loan_amount) : null,
    breakdown: rate.breakdown || [],
  };
}

/**
 * Convert scenario_fee_items rows back to the legacy fee_breakdown JSONB shape.
 * Quote responses still use the pre-unification fee_breakdown structure.
 * @param {object[]} feeItems - scenario_fee_items rows
 * @param {object} scenario - The parent scenario (for totals)
 * @returns {object} Legacy-format fee_breakdown object
 */
export function feeItemsToBreakdownShape(feeItems, scenario = {}) {
  const SECTION_LABELS = {
    A: 'Lender Fees',
    B: 'Third-Party Services',
    C: 'Title & Settlement',
    D: 'Total Originator Charges',
    E: 'Recording Fees',
    F: 'Prepaid Items',
    G: 'Initial Escrow',
    H: 'Other',
    I: 'Total Borrower-Paid',
  };

  const sections = {};

  for (const [code, label] of Object.entries(SECTION_LABELS)) {
    const items = feeItems
      .filter(fi => fi.section === code)
      .sort((a, b) => a.display_order - b.display_order)
      .map(fi => ({
        label: fi.fee_name,
        amount: Number(fi.fee_amount),
        ...(fi.poc ? { poc: true } : {}),
        ...(fi.hud_line ? { hudLine: fi.hud_line } : {}),
        ...(fi.note ? { note: fi.note } : {}),
      }));

    if (items.length > 0) {
      const sectionKey = `section${code}`;
      sections[sectionKey] = {
        label,
        items,
        total: items.reduce((sum, i) => sum + i.amount, 0),
      };
    }
  }

  return {
    ...sections,
    totalClosingCosts: scenario.fee_total_closing != null ? Number(scenario.fee_total_closing) : null,
    monthlyTax: scenario.monthly_tax != null ? Number(scenario.monthly_tax) : null,
    monthlyInsurance: scenario.monthly_insurance != null ? Number(scenario.monthly_insurance) : null,
    monthlyMip: scenario.monthly_mip != null ? Number(scenario.monthly_mip) : null,
  };
}

/**
 * Convert a full scenario (with rates[] and feeItems[]) to the legacy quote shape
 * that quote-viewer + MLO-quote APIs emit. Preserves the pre-unification response
 * contract so UI clients don't need to change.
 * @param {object} scenario - Scenario with rates[] and feeItems[]
 * @returns {object} Legacy-format quote object
 */
export function scenarioToQuoteShape(scenario) {
  const rates = scenario.rates || [];
  const feeItems = scenario.feeItems || [];
  const { contact_name, contact_email, contact_phone } = deriveIdentity(scenario);

  return {
    id: scenario.id,
    organization_id: scenario.organization_id,
    mlo_id: scenario.mlo_id,
    contact_id: scenario.contact_id,
    lead_id: scenario.lead_id,
    loan_id: scenario.loan_id,
    contact_name,
    contact_email,
    contact_phone,
    purpose: scenario.loan_purpose,
    property_value: scenario.property_value,
    loan_amount: scenario.loan_amount,
    ltv: scenario.ltv,
    fico: scenario.fico,
    state: scenario.state,
    county: scenario.county,
    property_type: scenario.property_type,
    occupancy: scenario.occupancy,
    loan_type: scenario.loan_type,
    term: scenario.term,
    closing_date: scenario.closing_date,
    current_rate: scenario.current_rate,
    current_balance: scenario.current_balance,
    current_payment: scenario.current_payment,
    current_lender: scenario.current_lender,
    scenarios: rates.map(rateRowToQuoteShape),
    fee_breakdown: feeItems.length > 0 ? feeItemsToBreakdownShape(feeItems, scenario) : null,
    annual_taxes: scenario.annual_taxes,
    annual_insurance: scenario.annual_insurance,
    pmi_rate: scenario.pmi_rate,
    monthly_pmi: scenario.monthly_pmi,
    first_payment_date: scenario.first_payment_date,
    cash_to_close: scenario.cash_to_close,
    monthly_payment: scenario.monthly_payment,
    payback_months: scenario.payback_months,
    monthly_savings: scenario.monthly_savings,
    status: scenario.status,
    sent_at: scenario.sent_at,
    viewed_at: scenario.viewed_at,
    expires_at: scenario.expires_at,
    pdf_url: scenario.pdf_url,
    pdf_generated_at: scenario.pdf_generated_at,
    version: scenario.version,
    parent_quote_id: scenario.parent_scenario_id,
    created_at: scenario.created_at,
    updated_at: scenario.updated_at,
  };
}

/**
 * Convert a scenario to the legacy saved-scenario shape used by My Rates
 * and rate alert APIs. Preserves the pre-unification response contract.
 * @param {object} scenario - Scenario with rates[]
 * @returns {object} Legacy-format saved scenario object
 */
export function scenarioToSavedShape(scenario) {
  const rates = scenario.rates || [];

  return {
    id: scenario.id,
    lead_id: scenario.lead_id,
    scenario_data: {
      purpose: scenario.loan_purpose,
      loanType: scenario.loan_type,
      loanAmount: scenario.loan_amount != null ? Number(scenario.loan_amount) : null,
      propertyValue: scenario.property_value != null ? Number(scenario.property_value) : null,
      fico: scenario.fico,
      ltv: scenario.ltv != null ? Number(scenario.ltv) : null,
      state: scenario.state,
      county: scenario.county,
      term: scenario.term,
      productType: scenario.product_type,
      propertyType: scenario.property_type,
      currentRate: scenario.current_rate != null ? Number(scenario.current_rate) : null,
      currentPayoff: scenario.current_balance != null ? Number(scenario.current_balance) : null,
    },
    last_pricing_data: rates.map(r => ({
      rate: Number(r.rate),
      price: r.final_price != null ? Number(r.final_price) : null,
      rebateDollars: Number(r.rebate_dollars || 0),
      discountDollars: Number(r.discount_dollars || 0),
      lenderFee: Number(r.lender_fee || 0),
      lenderName: r.lender,
      program: r.program,
      monthlyPI: r.monthly_pi != null ? Number(r.monthly_pi) : null,
    })),
    alert_frequency: scenario.alert_frequency,
    alert_days: scenario.alert_days,
    alert_status: scenario.alert_status,
    last_priced_at: scenario.last_priced_at,
    last_sent_at: scenario.last_sent_at,
    send_count: scenario.send_count,
    unsub_token: scenario.unsub_token,
    created_at: scenario.created_at,
    updated_at: scenario.updated_at,
  };
}
