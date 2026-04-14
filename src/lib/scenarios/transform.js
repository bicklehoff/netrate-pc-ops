/**
 * Transform functions for backward compatibility.
 *
 * Converts between the new normalized scenario tables and the old JSONB shapes
 * that existing UI consumers expect in API responses.
 */

/**
 * Convert a scenario_rates row to the old quote scenarios JSONB shape.
 * Used when the API needs to return the same shape as borrower_quotes.scenarios.
 * @param {object} rate - scenario_rates row
 * @returns {object} Old-format rate object
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
 * Convert scenario_fee_items rows back to the old fee_breakdown JSONB shape.
 * Used when the API needs to return the same shape as borrower_quotes.fee_breakdown.
 * @param {object[]} feeItems - scenario_fee_items rows
 * @param {object} scenario - The parent scenario (for totals)
 * @returns {object} Old-format fee_breakdown object
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
 * Convert a full scenario (with rates[] and feeItems[]) to the old borrower_quotes shape.
 * Used by APIs that need to return backward-compatible responses.
 * @param {object} scenario - Scenario with rates[] and feeItems[]
 * @returns {object} Old-format quote object
 */
export function scenarioToQuoteShape(scenario) {
  const rates = scenario.rates || [];
  const feeItems = scenario.feeItems || [];

  return {
    id: scenario.id,
    organization_id: scenario.organization_id,
    mlo_id: scenario.mlo_id,
    contact_id: scenario.contact_id,
    lead_id: scenario.lead_id,
    loan_id: scenario.loan_id,
    borrower_name: scenario.borrower_name,
    borrower_email: scenario.borrower_email,
    borrower_phone: scenario.borrower_phone,
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
 * Convert a scenario to the old saved_scenarios shape.
 * Used by My Rates and rate alert APIs.
 * @param {object} scenario - Scenario with rates[]
 * @returns {object} Old-format saved scenario object
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
