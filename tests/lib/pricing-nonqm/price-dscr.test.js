/**
 * Unit tests for the DSCR pricer's new rule_types added in D9c.6a:
 *   - prepay_term       (split from existing prepay; carries price_cap)
 *   - prepay_structure  (split from existing prepay)
 *   - pricing_special   (auto-fires on FICO/DSCR/CLTV gates)
 *   - loan_size_secondary (sums with loan_size, no LTV banding)
 *
 * Tests use synthetic in-memory sheets — no DB. Each test builds a
 * minimal `{ sheet, products, rules }` shape, calls
 * `priceDscrScenario`, and asserts the priced/skipped output.
 *
 * Existing rule_types (fico_cltv_grid, property_type, loan_size,
 * dscr_ratio, state_srp, prepay, feature) are not exhaustively re-
 * tested here — `scripts/pricing-baseline.mjs --check` is the parity
 * harness for those.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceDscrScenario } from '../../../src/lib/pricing-nonqm/price-dscr.js';

// ─── Fixture helpers ─────────────────────────────────────────────────

const TIER = 'premier';

/**
 * Build the `{ sheet, products, rules }` shape that priceDscrScenario expects.
 * `extraRules` are appended to a baseline grid that always passes for the
 * canonical scenario, so individual tests can isolate one rule_type.
 */
function buildSheet({ extraRules = [], baseGridPoints = 0, productOverrides = {} } = {}) {
  const product = {
    id: 1,
    loan_type: 'dscr',
    tier: TIER,
    product_type: 'fixed',
    term: 30,
    arm_fixed_period: null,
    arm_adj_period: null,
    lock_days: 30,
    note_rate: 6.5,
    final_base_price: 100,
    raw_product_name: 'ResiCentral DSCR premier 30yr Fixed',
    ...productOverrides,
  };
  // Baseline FICO×CLTV grid match — covers fico 600-999 + cltv 60.01-70
  // so individual tests can probe rules without their products being
  // gated by the grid mismatch.
  const baselineGrid = {
    tier: TIER,
    product_type: null,
    rule_type: 'fico_cltv_grid',
    occupancy: 'investment',
    loan_purpose: null,
    fico_min: 600,
    fico_max: 999,
    cltv_min: 60.01,
    cltv_max: 70,
    llpa_points: baseGridPoints,
    price_cap: null,
    not_offered: false,
  };
  return [{
    sheet: { lender_code: 'resicentral', effective_at: '2026-04-24' },
    products: [product],
    rules: [baselineGrid, ...extraRules],
  }];
}

const scenario = {
  product_type: 'fixed',
  term: 30,
  lock_days: 30,
  fico: 760,
  cltv: 65,
  state: 'CO',
  occupancy: 'investment',
  loan_purpose: null,
  property_type: 'sfr',
  loan_size: 500000,
  dscr_ratio: 1.25,
  prepay_years: 5,
  prepay_structure: 'fixed_5',
  features: [],
};

// Find the priced row for the premier tier (single product per fixture).
function pricedRow(result) {
  return result.priced.find(r => r.tier === TIER);
}

// ─── loan_size_secondary ─────────────────────────────────────────────

test('loan_size_secondary: matches by loan_size range and sums with loan_size', () => {
  const sheets = buildSheet({
    baseGridPoints: 0,
    extraRules: [
      // First, the existing LTV-banded loan_size rule
      {
        tier: TIER, product_type: null, rule_type: 'loan_size',
        loan_size_min: 350001, loan_size_max: 500000,
        cltv_min: 60.01, cltv_max: 70,
        llpa_points: -0.001,
        not_offered: false,
      },
      // Plus the loan_size_secondary rule (no CLTV banding)
      {
        tier: TIER, product_type: null, rule_type: 'loan_size_secondary',
        loan_size_min: 200000, loan_size_max: 749999,
        cltv_min: null, cltv_max: null,
        llpa_points: -0.002,
        not_offered: false,
      },
    ],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.ok(row);
  assert.equal(row.adjustments.find(a => a.rule_type === 'loan_size').points, -0.001);
  assert.equal(row.adjustments.find(a => a.rule_type === 'loan_size_secondary').points, -0.002);
  // Final price = 100 + (-0.001) + (-0.002) = 99.997
  assert.equal(row.final_price, 99.997);
});

test('loan_size_secondary: not_offered gates the product', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'loan_size_secondary',
      loan_size_min: 200000, loan_size_max: 749999,
      llpa_points: null, not_offered: true,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  assert.equal(result.priced.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].reason, 'loan_size_secondary:not_offered');
});

test('loan_size_secondary: out-of-range scenario doesn\'t match', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'loan_size_secondary',
      loan_size_min: 1000000, loan_size_max: 1999999,
      llpa_points: 0.0025,
      not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  // No loan_size_secondary adjustment because $500K isn't in $1M-$2M
  assert.equal(row.adjustments.find(a => a.rule_type === 'loan_size_secondary'), undefined);
});

// ─── pricing_special ────────────────────────────────────────────────

test('pricing_special: auto-fires when FICO + DSCR + CLTV gates pass', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, fico_max: null,
      dscr_ratio_min: 1.0, dscr_ratio_max: null,
      cltv_min: 60.01, cltv_max: 70,
      llpa_points: 0.00875,
      not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'pricing_special').points, 0.00875);
});

test('pricing_special: doesn\'t fire when FICO below gate', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, fico_max: null,
      dscr_ratio_min: 1.0, dscr_ratio_max: null,
      cltv_min: 60.01, cltv_max: 70,
      llpa_points: 0.00875,
      not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, { ...scenario, fico: 680 });
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'pricing_special'), undefined);
});

test('pricing_special: doesn\'t fire when DSCR below gate', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, dscr_ratio_min: 1.0,
      cltv_min: 60.01, cltv_max: 70,
      llpa_points: 0.00875, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, { ...scenario, dscr_ratio: 0.95 });
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'pricing_special'), undefined);
});

test('pricing_special: doesn\'t fire when CLTV out of band', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, dscr_ratio_min: 1.0,
      cltv_min: 0, cltv_max: 50,                   // band is 0-50
      llpa_points: 0.00875, not_offered: false,
    }],
  });
  // scenario.cltv=65 → outside band
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'pricing_special'), undefined);
});

test('pricing_special: not_offered is a no-op (does NOT gate)', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, dscr_ratio_min: 1.0,
      cltv_min: 60.01, cltv_max: 70,
      llpa_points: null, not_offered: true,        // not offered for this band
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  // Product still priced; just no special applied.
  assert.equal(result.priced.length, 1);
  assert.equal(result.skipped.length, 0);
});

test('pricing_special: undefined dscr_ratio doesn\'t crash (skips the rule)', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, dscr_ratio_min: 1.0,
      cltv_min: 60.01, cltv_max: 70,
      llpa_points: 0.005, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, { ...scenario, dscr_ratio: undefined });
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'pricing_special'), undefined);
});

test('pricing_special: flat misc form (no LTV bands, single CLTV range)', () => {
  // Mimics "January Pricing Special (700+ FICO & LTV ≤ 80)" from the parser.
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'pricing_special',
      fico_min: 700, dscr_ratio_min: null,
      cltv_min: 0, cltv_max: 80,
      llpa_points: 0.005, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'pricing_special').points, 0.005);
});

// ─── prepay_term ────────────────────────────────────────────────────

test('prepay_term: matches by prepay_years (without structure)', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_term',
      prepay_years: 5,
      llpa_points: 0.01, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay_term').points, 0.01);
});

test('prepay_term: price_cap from Max Price block applies', () => {
  const sheets = buildSheet({
    baseGridPoints: 5,                              // base_price + grid = 100 + 5 = 105
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_term',
      prepay_years: 5,
      llpa_points: null, price_cap: 103.65, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.final_price, 103.65);
  assert.equal(row.price_cap, 103.65);
  assert.ok(row.warnings.some(w => w.code === 'price_cap_applied'));
});

test('prepay_term: not_offered gates the product', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_term',
      prepay_years: 5,
      llpa_points: null, not_offered: true,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  assert.equal(result.priced.length, 0);
  assert.equal(result.skipped[0].reason, 'prepay_term:5yr:not_offered');
});

test('prepay_term: doesn\'t fire when prepay_years differs', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_term',
      prepay_years: 3, llpa_points: 0.005, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, { ...scenario, prepay_years: 5 });
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay_term'), undefined);
});

// ─── prepay_structure ───────────────────────────────────────────────

test('prepay_structure: matches by feature key', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_structure',
      feature: 'fixed_5',
      llpa_points: 0.005, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay_structure').points, 0.005);
});

test('prepay_structure: doesn\'t fire when scenario.prepay_structure is missing', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_structure',
      feature: 'fixed_5', llpa_points: 0.005, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, { ...scenario, prepay_structure: undefined });
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay_structure'), undefined);
});

test('prepay_structure: not_offered gates the product', () => {
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay_structure',
      feature: 'fixed_5', llpa_points: null, not_offered: true,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  assert.equal(result.priced.length, 0);
  assert.equal(result.skipped[0].reason, 'prepay_structure:fixed_5:not_offered');
});

// ─── prepay term + structure summing ───────────────────────────────

test('prepay_term + prepay_structure: both fire and sum into llpa_total', () => {
  const sheets = buildSheet({
    extraRules: [
      {
        tier: TIER, product_type: null, rule_type: 'prepay_term',
        prepay_years: 5, llpa_points: 0.01, not_offered: false,
      },
      {
        tier: TIER, product_type: null, rule_type: 'prepay_structure',
        feature: 'fixed_5', llpa_points: 0.005, not_offered: false,
      },
    ],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay_term').points, 0.01);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay_structure').points, 0.005);
  // base 100 + grid 0 + prepay_term 0.01 + prepay_structure 0.005 = 100.015
  assert.equal(row.final_price, 100.015);
});

// ─── Backward compat: existing `prepay` rule_type still works ──────

test('Existing prepay rule_type (Everstream) still applies LLPAs', () => {
  // Everstream-shape: rule_type='prepay' carrying both prepay_years AND feature.
  const sheets = buildSheet({
    extraRules: [{
      tier: TIER, product_type: null, rule_type: 'prepay',
      prepay_years: 5, feature: 'fixed_5',
      llpa_points: 0.01, not_offered: false,
    }],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.find(a => a.rule_type === 'prepay').points, 0.01);
});

test('Existing prepay coexists with new prepay_term/_structure (both fire)', () => {
  // Defensive: if both shapes show up in the DB simultaneously
  // (transition state), all three rules apply additively.
  const sheets = buildSheet({
    extraRules: [
      { tier: TIER, product_type: null, rule_type: 'prepay',
        prepay_years: 5, feature: 'fixed_5',
        llpa_points: 0.01, not_offered: false },
      { tier: TIER, product_type: null, rule_type: 'prepay_term',
        prepay_years: 5, llpa_points: 0.005, not_offered: false },
      { tier: TIER, product_type: null, rule_type: 'prepay_structure',
        feature: 'fixed_5', llpa_points: 0.0025, not_offered: false },
    ],
  });
  const result = priceDscrScenario(sheets, scenario);
  const row = pricedRow(result);
  assert.equal(row.adjustments.length, 4);            // grid (0) + 3 prepay
  assert.equal(row.final_price, 100 + 0 + 0.01 + 0.005 + 0.0025);
});
