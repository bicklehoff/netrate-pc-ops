/**
 * Rate-alerts slice — transforms.
 *
 * Functions here produce rate-alert / saved-scenario API output shapes from
 * scenario + rate_alert row pairs.
 *
 * Slice ownership rule (per Phase 2 spec §3): a transform lives in the slice
 * that owns the OUTPUT shape it produces. `scenarioToSavedShape` produces a
 * borrower-facing "saved scenario" view that's a rate-alert subscription, so
 * it lives here even though it reads from a scenario row too.
 *
 * Phase 2 backward compat: the rateAlert arg is OPTIONAL. When omitted, the
 * function falls back to reading alert fields off the scenario row (the
 * Phase 1 columns still exist on scenarios until Phase 4). 1-arg callers get
 * the same shape they got before the split. Phase 3 callers pass both args.
 */

/**
 * Compose the borrower-facing saved-scenario API shape.
 *
 * @param {object} scenario - Scenario row (with rates[] for last_pricing_data).
 * @param {object|null} [rateAlert] - rate_alerts row, when available. When
 *   null/omitted, falls back to scenario columns (Phase 2 transition).
 * @returns {object} Saved scenario shape consumed by /api/my-rates,
 *   /api/saved-scenario, etc.
 */
export function scenarioToSavedShape(scenario, rateAlert = null) {
  // Graceful fallback: prefer rate_alert fields when caller supplies the row.
  // When omitted, fall back to scenario columns (still exist until Phase 4).
  const alert = rateAlert || scenario;

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
    last_pricing_data: rates.map((r) => ({
      rate: Number(r.rate),
      price: r.final_price != null ? Number(r.final_price) : null,
      rebateDollars: Number(r.rebate_dollars || 0),
      discountDollars: Number(r.discount_dollars || 0),
      lenderFee: Number(r.lender_fee || 0),
      lenderName: r.lender,
      program: r.program,
      monthlyPI: r.monthly_pi != null ? Number(r.monthly_pi) : null,
    })),
    alert_frequency: alert.alert_frequency,
    alert_days: alert.alert_days,
    alert_status: alert.alert_status,
    last_priced_at: alert.last_priced_at,
    last_sent_at: alert.last_sent_at,
    send_count: alert.send_count,
    unsub_token: alert.unsub_token,
    created_at: scenario.created_at,
    updated_at: scenario.updated_at,
  };
}
