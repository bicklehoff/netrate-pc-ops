/**
 * Quotes slice — transforms.
 *
 * Functions here produce quote-shaped API output from scenario + quote
 * row pairs.
 *
 * Slice ownership rule (per Phase 2 spec §3): a transform lives in the
 * slice that owns the OUTPUT shape it produces. `scenarioToQuoteShape`
 * produces an MLO-quote-shaped output, so it lives here even though it
 * reads from a scenario row too.
 *
 * Phase 2 backward compat: the quote arg is OPTIONAL. When omitted, the
 * function falls back to reading quote-lifecycle fields off the scenario
 * row (the Phase 1 columns still exist on scenarios until Phase 4).
 * 1-arg callers get the same shape they got before the split. Phase 3
 * callers pass both args.
 */

import { deriveIdentity } from '@/lib/scenarios/transform';
import { rateRowToQuoteShape, feeItemsToBreakdownShape } from '@/lib/scenarios/transform';

/**
 * Compose the MLO-quote-shape API output from scenario + (optional) quote.
 *
 * @param {object} scenario - Scenario row with rates[] and feeItems[],
 *   plus identity JOIN aliases (_c_*, _l_*).
 * @param {object|null} [quote] - quotes row, when available. When
 *   null/omitted, falls back to scenario.{sent_at, viewed_at, expires_at,
 *   pdf_url, pdf_generated_at, version, status, parent_scenario_id}
 *   (Phase 2 transition).
 * @returns {object} Quote shape consumed by /api/portal/mlo/quotes,
 *   /api/portal/quotes/[id], etc.
 */
export function scenarioToQuoteShape(scenario, quote = null) {
  const rates = scenario.rates || [];
  const feeItems = scenario.feeItems || [];
  const { contact_name, contact_email, contact_phone } = deriveIdentity(scenario);

  // Graceful fallback: prefer quote fields when caller supplies the row.
  // When omitted, fall back to scenario columns (still exist until Phase 4).
  const q = quote || scenario;

  return {
    // The API id remains the scenario id even when a quote row is present.
    // The quote.id is an internal lifecycle handle; routes (URL params,
    // email magic links, blob paths) all key off scenario.id. Phase 3b
    // 2-arg callers and Phase 2 1-arg callers see the same id.
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
    // Lifecycle fields — prefer quote row, fall back to scenario.
    status: q.status || scenario.status,
    sent_at: q.sent_at,
    viewed_at: q.viewed_at,
    expires_at: q.expires_at,
    pdf_url: q.pdf_url,
    pdf_generated_at: q.pdf_generated_at,
    version: q.version || scenario.version || 1,
    // parent_quote_id: from the quote row when available; falls back to
    // scenario.parent_scenario_id (which was the pre-Phase-1 lineage proxy).
    parent_quote_id: quote?.parent_quote_id || scenario.parent_scenario_id || null,
    // share_token: only on quotes, but readable from scenario in transition window
    // since scenarios.share_token doesn't exist (was never added to scenarios per
    // Phase 1 spec §3.6) — both the quote and the fallback resolve to undefined.
    share_token: quote?.share_token || null,
    created_at: scenario.created_at,
    updated_at: scenario.updated_at,
  };
}
