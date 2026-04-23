-- Migration: Unified Scenarios Schema
-- Date: 2026-04-14
-- Purpose: Create scenarios, scenario_rates, scenario_fee_items tables.
-- These replace borrower_quotes and saved_scenarios with a normalized relational model.
-- Old tables are NOT touched — they remain for rollback until migration 004.
--
-- Run: node -e "..." (see PR instructions) or paste into Neon SQL Editor

BEGIN;

-- ─── 1. Create scenarios table ─────────────────────────────────────
-- Replaces both borrower_quotes (MLO quotes) and saved_scenarios (borrower rate alerts)

CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
    REFERENCES organizations(id),

  -- Ownership & provenance
  owner_type TEXT NOT NULL CHECK (owner_type IN ('mlo', 'borrower', 'system')),
  source TEXT NOT NULL CHECK (source IN ('quote', 'rate-tool', 'alert', 'import')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'priced', 'sent', 'viewed', 'accepted', 'declined', 'expired')),

  -- Actor references
  mlo_id UUID,
  contact_id UUID,
  lead_id UUID,
  loan_id UUID,

  -- Borrower info (denormalized for display)
  borrower_name TEXT,
  borrower_email TEXT,
  borrower_phone TEXT,

  -- Scenario inputs (all proper columns, no JSONB)
  loan_purpose TEXT NOT NULL,
  loan_type TEXT NOT NULL DEFAULT 'conventional',
  property_value NUMERIC(12,2),
  loan_amount NUMERIC(12,2) NOT NULL,
  ltv NUMERIC(5,2),
  fico INT NOT NULL,
  state TEXT NOT NULL DEFAULT 'CO',
  county TEXT,
  property_type TEXT,
  occupancy TEXT DEFAULT 'primary',
  term INT NOT NULL DEFAULT 30,
  product_type TEXT DEFAULT 'fixed',
  lock_days INT DEFAULT 30,
  first_time_buyer BOOLEAN DEFAULT false,
  borrower_paid BOOLEAN DEFAULT false,
  escrows_waived BOOLEAN DEFAULT false,

  -- Refi-specific
  current_rate NUMERIC(5,3),
  current_balance NUMERIC(12,2),
  current_payment NUMERIC(10,2),
  current_lender TEXT,
  closing_date DATE,

  -- DSCR-specific
  dscr_ratio NUMERIC(5,2),
  monthly_rent NUMERIC(10,2),
  unit_count INT,

  -- Computed / display
  monthly_payment NUMERIC(10,2),
  monthly_savings NUMERIC(10,2),
  cash_to_close NUMERIC(12,2),
  annual_taxes NUMERIC(10,2),
  annual_insurance NUMERIC(10,2),
  pmi_rate NUMERIC(5,4),
  monthly_pmi NUMERIC(10,2),
  first_payment_date DATE,
  payback_months INT,

  -- Fee totals (computed from scenario_fee_items, stored for fast reads)
  fee_total_d NUMERIC(12,2),
  fee_total_i NUMERIC(12,2),
  fee_total_closing NUMERIC(12,2),
  monthly_tax NUMERIC(10,2),
  monthly_insurance NUMERIC(10,2),
  monthly_mip NUMERIC(10,2),

  -- Alert fields (migrated from saved_scenarios)
  alert_frequency TEXT DEFAULT '2x_week',
  alert_days TEXT[] DEFAULT '{tue,thu}',
  alert_status TEXT DEFAULT 'inactive',
  last_priced_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  send_count INT DEFAULT 0,
  unsub_token TEXT DEFAULT gen_random_uuid()::text,

  -- Quote lifecycle
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  version INT DEFAULT 1,
  parent_scenario_id UUID REFERENCES scenarios(id),

  -- Pricing metadata
  effective_date TEXT,
  loan_classification TEXT,
  pricing_result_count INT,
  config_warnings TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Create scenario_rates table ────────────────────────────────
-- Replaces borrower_quotes.scenarios JSONB array
-- One row per rate option (typically 3 per scenario)

CREATE TABLE IF NOT EXISTS scenario_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,

  -- Rate data
  rate NUMERIC(5,3) NOT NULL,
  final_price NUMERIC(8,3),
  apr NUMERIC(5,3),
  monthly_pi NUMERIC(10,2),
  lender TEXT NOT NULL,
  lender_code TEXT,
  program TEXT,
  investor TEXT,
  tier TEXT,
  lock_days INT DEFAULT 30,

  -- Cost / credit
  rebate_dollars NUMERIC(10,2) DEFAULT 0,
  discount_dollars NUMERIC(10,2) DEFAULT 0,
  comp_dollars NUMERIC(10,2) DEFAULT 0,
  lender_fee NUMERIC(10,2) DEFAULT 0,
  ufmip NUMERIC(10,2) DEFAULT 0,
  effective_loan_amount NUMERIC(12,2),

  -- Selection
  is_selected BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,

  -- Pricing breakdown (kept as JSONB — variable-length debug tuples, no query benefit)
  breakdown JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Create scenario_fee_items table ────────────────────────────
-- Replaces borrower_quotes.fee_breakdown JSONB
-- One row per fee line item

CREATE TABLE IF NOT EXISTS scenario_fee_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,

  section CHAR(1) NOT NULL CHECK (section IN ('A','B','C','D','E','F','G','H','I')),
  fee_name TEXT NOT NULL,
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  poc BOOLEAN DEFAULT false,
  hud_line TEXT,
  note TEXT,
  display_order INT DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. Create indexes ─────────────────────────────────────────────

-- scenarios indexes
CREATE INDEX IF NOT EXISTS idx_scenarios_org ON scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_mlo ON scenarios(mlo_id) WHERE mlo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_lead ON scenarios(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_contact ON scenarios(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_loan ON scenarios(loan_id) WHERE loan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON scenarios(status);
CREATE INDEX IF NOT EXISTS idx_scenarios_owner_type ON scenarios(owner_type);
CREATE INDEX IF NOT EXISTS idx_scenarios_alert_active ON scenarios(alert_status) WHERE alert_status = 'active';
CREATE INDEX IF NOT EXISTS idx_scenarios_unsub ON scenarios(unsub_token) WHERE unsub_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_created ON scenarios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenarios_email ON scenarios(borrower_email) WHERE borrower_email IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_scenarios_org_owner ON scenarios(organization_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_scenarios_org_status ON scenarios(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_scenarios_org_mlo ON scenarios(organization_id, mlo_id);

-- scenario_rates indexes
CREATE INDEX IF NOT EXISTS idx_scenario_rates_scenario ON scenario_rates(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_rates_selected ON scenario_rates(scenario_id) WHERE is_selected = true;

-- scenario_fee_items indexes
CREATE INDEX IF NOT EXISTS idx_scenario_fee_items_scenario ON scenario_fee_items(scenario_id);

COMMIT;
