-- Migration: Backfill unified scenarios from borrower_quotes + saved_scenarios
-- Date: 2026-04-14
-- Purpose: Copy existing data into the new scenarios/scenario_rates/scenario_fee_items tables.
-- Old tables remain untouched for rollback.
--
-- Run via Node script: scripts/_run-migration-003.mjs

-- ─── 1. Migrate borrower_quotes → scenarios ────────────────────────

INSERT INTO scenarios (
  id, organization_id, owner_type, source, visibility, status,
  mlo_id, contact_id, lead_id, loan_id,
  borrower_name, borrower_email, borrower_phone,
  loan_purpose, loan_type, property_value, loan_amount, ltv, fico,
  state, county, property_type, occupancy, term,
  closing_date, current_rate, current_balance, current_payment, current_lender,
  annual_taxes, annual_insurance, pmi_rate, monthly_pmi,
  first_payment_date, cash_to_close, monthly_payment, payback_months, monthly_savings,
  sent_at, viewed_at, expires_at, pdf_url, pdf_generated_at,
  version, parent_scenario_id, created_at, updated_at
)
SELECT
  id, organization_id, 'mlo', 'quote', 'public', status,
  mlo_id, contact_id, lead_id, loan_id,
  borrower_name, borrower_email, borrower_phone,
  purpose, COALESCE(loan_type, 'conventional'), property_value, loan_amount, ltv, fico,
  state, county, property_type, COALESCE(occupancy, 'primary'), COALESCE(term, 30),
  closing_date, current_rate, current_balance, current_payment, current_lender,
  annual_taxes, annual_insurance, pmi_rate, monthly_pmi,
  first_payment_date, cash_to_close, monthly_payment, payback_months, monthly_savings,
  sent_at, viewed_at, expires_at, pdf_url, pdf_generated_at,
  version, parent_quote_id, created_at, updated_at
FROM borrower_quotes
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Explode borrower_quotes.scenarios JSONB → scenario_rates ───

INSERT INTO scenario_rates (
  scenario_id, rate, final_price, monthly_pi, lender, lender_code,
  program, investor, tier, lock_days,
  rebate_dollars, discount_dollars, comp_dollars, lender_fee,
  breakdown, display_order, is_selected
)
SELECT
  bq.id,
  (r.elem->>'rate')::numeric,
  (r.elem->>'price')::numeric,
  (r.elem->>'monthlyPI')::numeric,
  COALESCE(r.elem->>'lender', r.elem->>'lenderCode', 'Unknown'),
  r.elem->>'lenderCode',
  r.elem->>'program',
  r.elem->>'investor',
  r.elem->>'tier',
  COALESCE((r.elem->>'lockDays')::int, 30),
  COALESCE((r.elem->>'rebateDollars')::numeric, 0),
  COALESCE((r.elem->>'discountDollars')::numeric, 0),
  COALESCE((r.elem->>'compDollars')::numeric, 0),
  COALESCE((r.elem->>'lenderFee')::numeric, 0),
  r.elem->'breakdown',
  (r.ord - 1)::int,
  true
FROM borrower_quotes bq,
  LATERAL jsonb_array_elements(bq.scenarios) WITH ORDINALITY AS r(elem, ord)
WHERE bq.scenarios IS NOT NULL
  AND jsonb_typeof(bq.scenarios) = 'array';

-- ─── 3. Explode borrower_quotes.fee_breakdown JSONB → scenario_fee_items ─

-- This is handled by the Node script since the fee_breakdown structure
-- has nested objects (sectionA.items[], sectionB.items[], etc.) that
-- are easier to iterate in JavaScript than pure SQL.

-- ─── 4. Migrate saved_scenarios → scenarios ─────────────────────────

INSERT INTO scenarios (
  id, organization_id, owner_type, source, status,
  lead_id,
  loan_purpose, loan_type, loan_amount, property_value, fico, state, county, term, ltv,
  alert_frequency, alert_days, alert_status,
  last_priced_at, last_sent_at, send_count, unsub_token,
  created_at, updated_at
)
SELECT
  ss.id, ss.organization_id, 'borrower', 'rate-tool',
  CASE WHEN ss.alert_status = 'active' THEN 'priced' ELSE 'expired' END,
  ss.lead_id,
  COALESCE(ss.scenario_data->>'purpose', 'purchase'),
  COALESCE(ss.scenario_data->>'loanType', 'conventional'),
  COALESCE((ss.scenario_data->>'loanAmount')::numeric, 0),
  (ss.scenario_data->>'propertyValue')::numeric,
  COALESCE((ss.scenario_data->>'fico')::int, 780),
  COALESCE(ss.scenario_data->>'state', 'CO'),
  ss.scenario_data->>'county',
  COALESCE((ss.scenario_data->>'term')::int, 30),
  (ss.scenario_data->>'ltv')::numeric,
  ss.alert_frequency, ss.alert_days, ss.alert_status,
  ss.last_priced_at, ss.last_sent_at, ss.send_count, ss.unsub_token,
  ss.created_at, ss.updated_at
FROM saved_scenarios ss
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Explode saved_scenarios.last_pricing_data → scenario_rates ──

INSERT INTO scenario_rates (
  scenario_id, rate, final_price,
  rebate_dollars, discount_dollars, lender_fee,
  display_order, is_selected
)
SELECT
  ss.id,
  (r.elem->>'rate')::numeric,
  (r.elem->>'price')::numeric,
  COALESCE((r.elem->>'rebateDollars')::numeric, 0),
  COALESCE((r.elem->>'discountDollars')::numeric, 0),
  COALESCE((r.elem->>'lenderFee')::numeric, 0),
  (r.ord - 1)::int,
  true
FROM saved_scenarios ss,
  LATERAL jsonb_array_elements(ss.last_pricing_data) WITH ORDINALITY AS r(elem, ord)
WHERE ss.last_pricing_data IS NOT NULL
  AND jsonb_typeof(ss.last_pricing_data) = 'array';
