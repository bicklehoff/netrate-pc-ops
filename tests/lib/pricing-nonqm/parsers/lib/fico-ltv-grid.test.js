import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFicoLtvGrid } from '../../../../../src/lib/pricing-nonqm/parsers/lib/fico-ltv-grid.js';

const fico = [
  { min: 780, max: 999, label: '780+' },
  { min: 760, max: 779, label: '760-779' },
];
const ltv = [
  { min: 0,     max: 50 },
  { min: 50.01, max: 60 },
  { min: 60.01, max: 70 },
];

test('extracts a 2 × 3 grid into 6 rules', () => {
  const data = [
    [null, 0.000, 0.125, 0.250],
    [null, 0.125, 0.250, 0.375],
  ];
  const rules = extractFicoLtvGrid(data, 0, { fico, ltv });
  assert.equal(rules.length, 6);
  assert.deepEqual(rules[0], {
    rule_type: 'fico_cltv_grid',
    fico_min: 780, fico_max: 999,
    cltv_min: 0,   cltv_max: 50,
    not_offered: false,
    llpa_points: 0,
  });
  assert.deepEqual(rules[5], {
    rule_type: 'fico_cltv_grid',
    fico_min: 760, fico_max: 779,
    cltv_min: 60.01, cltv_max: 70,
    not_offered: false,
    llpa_points: 0.375,
  });
});

test('marks NA cells as not_offered with no payload field', () => {
  const data = [[null, 'NA', 0.125, 0.250]];
  const rules = extractFicoLtvGrid(data, 0, { fico: fico.slice(0, 1), ltv });
  assert.equal(rules.length, 3);
  assert.equal(rules[0].not_offered, true);
  assert.equal(Object.prototype.hasOwnProperty.call(rules[0], 'llpa_points'), false);
  assert.equal(rules[1].not_offered, false);
  assert.equal(rules[1].llpa_points, 0.125);
});

test('skips empty / non-numeric / null cells silently', () => {
  const data = [[null, '', 0.125, null]];
  const rules = extractFicoLtvGrid(data, 0, { fico: fico.slice(0, 1), ltv });
  assert.equal(rules.length, 1);
  assert.equal(rules[0].llpa_points, 0.125);
  assert.equal(rules[0].cltv_min, 50.01);
});

test('honors startCol option', () => {
  const data = [['Premier', null, 0.000, 0.125, 0.250]];
  const rules = extractFicoLtvGrid(data, 0, { fico: fico.slice(0, 1), ltv }, { startCol: 2 });
  assert.equal(rules.length, 3);
  assert.equal(rules[0].cltv_min, 0);
  assert.equal(rules[0].llpa_points, 0);
});

test('honors payloadField + ruleType (price_cap mode)', () => {
  const data = [[null, 103.65, 103.50]];
  const rules = extractFicoLtvGrid(
    data, 0,
    { fico: fico.slice(0, 1), ltv: ltv.slice(0, 2) },
    { payloadField: 'price_cap', ruleType: 'price_cap' }
  );
  assert.equal(rules.length, 2);
  assert.equal(rules[0].rule_type, 'price_cap');
  assert.equal(rules[0].price_cap, 103.65);
  assert.equal(Object.prototype.hasOwnProperty.call(rules[0], 'llpa_points'), false);
});

test('merges baseFields into every rule', () => {
  const data = [[null, 0.000, 0.125, 0.250]];
  const rules = extractFicoLtvGrid(
    data, 0,
    { fico: fico.slice(0, 1), ltv },
    { baseFields: { lender_code: 'resicentral', tier: 'premier', product_type: 'fixed' } }
  );
  for (const r of rules) {
    assert.equal(r.lender_code, 'resicentral');
    assert.equal(r.tier, 'premier');
    assert.equal(r.product_type, 'fixed');
  }
});

test('honors ltvKey="ltv" — output keys become ltv_min / ltv_max', () => {
  const data = [[null, 0.000, 0.125, 0.250]];
  const rules = extractFicoLtvGrid(
    data, 0,
    { fico: fico.slice(0, 1), ltv },
    { ltvKey: 'ltv' }
  );
  assert.equal(rules[0].ltv_min, 0);
  assert.equal(rules[0].ltv_max, 50);
  assert.equal(Object.prototype.hasOwnProperty.call(rules[0], 'cltv_min'), false);
});

test('skips FICO bands beyond data.length silently', () => {
  const data = [[null, 0.000, 0.125, 0.250]];
  // bands.fico has 2 rows; data has 1 — second row missing
  const rules = extractFicoLtvGrid(data, 0, { fico, ltv });
  assert.equal(rules.length, 3);
  assert.equal(rules[0].fico_min, 780);
});

test('honors rawLabelFn — receives fico and ltv bands per cell', () => {
  const data = [[null, 0.000, 'NA', 0.250]];
  const rules = extractFicoLtvGrid(
    data, 0,
    { fico: fico.slice(0, 1), ltv },
    { rawLabelFn: (f, l) => `Sec / FICO ${f.label} / CLTV ${l.min}-${l.max}` }
  );
  assert.equal(rules.length, 3);
  assert.equal(rules[0].raw_label, 'Sec / FICO 780+ / CLTV 0-50');
  assert.equal(rules[1].raw_label, 'Sec / FICO 780+ / CLTV 50.01-60');
  assert.equal(rules[1].not_offered, true);            // NA cell still gets a raw_label
  assert.equal(rules[2].raw_label, 'Sec / FICO 780+ / CLTV 60.01-70');
});

test('omits raw_label when rawLabelFn is not supplied', () => {
  const data = [[null, 0.000]];
  const rules = extractFicoLtvGrid(data, 0, { fico: fico.slice(0, 1), ltv: ltv.slice(0, 1) });
  assert.equal(Object.prototype.hasOwnProperty.call(rules[0], 'raw_label'), false);
});

test('respects anchorRow > 0', () => {
  const data = [
    ['header', null, null, null],
    ['header', null, null, null],
    [null, 0.000, 0.125, 0.250],
  ];
  const rules = extractFicoLtvGrid(data, 2, { fico: fico.slice(0, 1), ltv });
  assert.equal(rules.length, 3);
  assert.equal(rules[0].llpa_points, 0);
});
