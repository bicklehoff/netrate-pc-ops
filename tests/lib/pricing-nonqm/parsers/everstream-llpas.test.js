/**
 * Integration test for the refactored Everstream DSCR LLPA parser.
 *
 * Builds a minimal synthetic XLSX in memory (one section, one global
 * row, one prepay row, one SRP row) and runs `parseEverstreamLlpasXlsx`
 * end-to-end. Verifies rule shape and counts to lock in the D9c.6.3
 * refactor's parity with the prior in-file implementation.
 *
 * This is not a full coverage suite — that would require the actual
 * production workbook. It's a smoke test that catches regressions in
 * the wrapper wiring (baseFields, rawLabelFn, classify dispatch).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseEverstreamLlpasXlsx } from '../../../../src/lib/pricing-nonqm/parsers/everstream-llpas.js';

/**
 * Build a synthetic Elite DSCR 1 LLPAs sheet with the smallest
 * structure the parser will accept:
 *  - 1 occupancy×purpose section ("NOO Purchase") with 10 FICO × 10 CLTV cells
 *    (the loop emits one rule per cell — 100 rules per section per pass)
 *  - 1 Global LLPAs row ("SFR" → property_type=sfr)
 *  - 1 Prepayment Penalty row ("Fixed - 5%" with 5-yr value)
 *  - 1 SRP row ("CO" with 1 CLTV value)
 *
 * Only 1 section is provided — the parser slices [0, 9) for fixed and
 * [9, 18) for ARM. With 1 section total, fixed=[that section], arm=[].
 * That's intentional — keeps the fixture small while exercising every
 * extraction path on the fixed side.
 */
function buildSyntheticSheet() {
  const aoa = [];

  // Row 0: section label "NOO Purchase" in col A
  aoa.push(['NOO Purchase']);

  // Rows 1-10: FICO×CLTV grid (10 FICO bands × 10 CLTV columns)
  // - All cells filled with a deterministic value: 0.001 * (fico_idx + 1) * (cltv_idx + 1)
  // - One NA cell at [800+, 0-50] (row 1, col 1) to verify not_offered branch
  for (let fi = 0; fi < 10; fi++) {
    const row = [`fico-row-${fi}`];                  // col 0 (label, ignored by grid extractor)
    for (let ci = 0; ci < 10; ci++) {
      if (fi === 0 && ci === 0) row.push('NA');      // first cell → NA marker
      else row.push(0.001 * (fi + 1) * (ci + 1));
    }
    // Leave price-cap cols (14-23) empty — grid extractor skips empty cells
    while (row.length < 24) row.push(null);
    // Price cap: fill row 0 col 14 only, to verify both grid passes work
    if (fi === 0) row[14] = 105.5;
    aoa.push(row);
  }

  // Row 11: blank
  aoa.push([]);

  // Row 12: Global LLPAs section header
  aoa.push(['Global LLPAs']);

  // Row 13: SFR property — 10 CLTV bands worth of values
  aoa.push(['SFR', 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10]);

  // Row 14: blank (parser excludes the row immediately above prepay header)
  aoa.push([]);

  // Row 15: Prepayment Penalty Term header in col 1
  aoa.push([null, 'Prepayment Penalty Term']);

  // Row 16: Fixed - 5% / 5 year-cols (col 1..5)
  aoa.push(['Fixed - 5%', 0.10, 0.20, 0.30, 0.40, 0.50]);

  // Row 17: blank (parser excludes the row immediately above STATE header)
  aoa.push([]);

  // Row 18: STATE header in col 0
  aoa.push(['STATE']);

  // Row 19: CO state row — 10 CLTV bands
  aoa.push(['CO', 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.009, 0.010]);

  return aoa;
}

function buildSyntheticWorkbook() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildSyntheticSheet());
  XLSX.utils.book_append_sheet(wb, ws, 'Elite DSCR 1 LLPAs');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('parses synthetic Elite DSCR 1 sheet — smoke test', () => {
  const buf = buildSyntheticWorkbook();
  const result = parseEverstreamLlpasXlsx(buf);

  assert.equal(result.lender_code, 'everstream');
  assert.deepEqual(result.tiers_seen, ['elite_1']);
  // Elite 2 + 5 are intentionally missing from the synthetic fixture →
  // those skips are expected. Anything else is a regression.
  assert.equal(result.skipped.length, 2);
  assert.ok(result.rules.length > 0);
});

test('FICO×CLTV grid: 100 LLPA rules emitted (10 FICO × 10 CLTV) for the one section', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const grid = rules.filter(r =>
    r.rule_type === 'fico_cltv_grid' && r.product_type === 'fixed' &&
    Object.prototype.hasOwnProperty.call(r, 'llpa_points') === true || r.not_offered
  ).filter(r => r.rule_type === 'fico_cltv_grid' && r.product_type === 'fixed' && !r.price_cap);
  // 100 LLPA cells (one is NA → not_offered)
  assert.equal(grid.length, 100);
  // Verify the NA cell got marked correctly
  const na = grid.find(r => r.fico_min === 800 && r.cltv_min === 0);
  assert.equal(na.not_offered, true);
  assert.equal(Object.prototype.hasOwnProperty.call(na, 'llpa_points'), false);
  // Verify a non-NA cell carries a numeric llpa_points
  const cell = grid.find(r => r.fico_min === 780 && r.cltv_min === 50.01);
  assert.equal(cell.not_offered, false);
  assert.equal(typeof cell.llpa_points, 'number');
});

test('FICO×CLTV grid carries occupancy + loan_purpose from SECTION_MAP', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const grid = rules.filter(r => r.rule_type === 'fico_cltv_grid');
  // NOO Purchase → investment / purchase
  for (const r of grid) {
    assert.equal(r.occupancy, 'investment');
    assert.equal(r.loan_purpose, 'purchase');
    assert.equal(r.lender_code, 'everstream');
    assert.equal(r.tier, 'elite_1');
  }
});

test('FICO×CLTV grid raw_label includes section + FICO label + CLTV range + payload', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const grid = rules.filter(r => r.rule_type === 'fico_cltv_grid' && r.product_type === 'fixed');
  const sample = grid.find(r => r.fico_min === 760 && r.cltv_min === 60.01);
  assert.match(sample.raw_label, /^NOO Purchase \/ FICO 760-779 \/ CLTV 60\.01-65 \/ llpa_points$/);
});

test('Price cap pass emits a rule with price_cap (not llpa_points)', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const caps = rules.filter(r => r.rule_type === 'fico_cltv_grid' && r.price_cap !== undefined);
  // Synthetic: only 1 cell populated in price-cap pass (row 0 / col 14)
  assert.equal(caps.length, 1);
  assert.equal(caps[0].price_cap, 105.5);
  assert.equal(caps[0].fico_min, 800);
  assert.equal(caps[0].cltv_min, 0);
  // Price-cap pass should still set raw_label with payload="price_cap"
  assert.match(caps[0].raw_label, /\/ price_cap$/);
});

test('Global LLPA classifies SFR row to property_type', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const sfr = rules.filter(r => r.rule_type === 'property_type' && r.property_type === 'sfr');
  // 10 CLTV bands → 10 rules
  assert.equal(sfr.length, 10);
  for (const r of sfr) {
    assert.equal(r.lender_code, 'everstream');
    assert.equal(r.tier, 'elite_1');
    assert.equal(r.product_type, null);
    assert.equal(r.raw_label, 'SFR');
    assert.equal(typeof r.llpa_points, 'number');
  }
});

test('Prepay row produces 5 rules (one per year-term)', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const prepay = rules.filter(r => r.rule_type === 'prepay');
  assert.equal(prepay.length, 5);
  for (const r of prepay) {
    assert.equal(r.feature, 'fixed_5');
    assert.equal(r.tier, 'elite_1');
    assert.ok(r.prepay_years >= 1 && r.prepay_years <= 5);
  }
  const yr3 = prepay.find(r => r.prepay_years === 3);
  assert.equal(yr3.llpa_points, 0.30);
});

test('SRP row produces one rule per CLTV band', () => {
  const buf = buildSyntheticWorkbook();
  const { rules } = parseEverstreamLlpasXlsx(buf);
  const srp = rules.filter(r => r.rule_type === 'state_srp');
  assert.equal(srp.length, 10);
  for (const r of srp) {
    assert.equal(r.state, 'CO');
    assert.equal(r.tier, 'elite_1');
  }
});

test('Missing sheets are reported in skipped[] but parser does not throw', () => {
  // Workbook with only Elite DSCR 1 — Elite 2 + Elite 5 missing
  const buf = buildSyntheticWorkbook();
  const { skipped } = parseEverstreamLlpasXlsx(buf);
  assert.ok(skipped.some(s => s.includes('Elite DSCR 2 LLPAs')));
  assert.ok(skipped.some(s => s.includes('Elite DSCR 5 LLPAs')));
});
