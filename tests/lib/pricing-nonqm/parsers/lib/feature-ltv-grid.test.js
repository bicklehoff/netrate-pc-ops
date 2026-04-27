import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatureLtvGrid } from '../../../../../src/lib/pricing-nonqm/parsers/lib/feature-ltv-grid.js';

const ltv = [
  { min: 0,     max: 60 },
  { min: 60.01, max: 70 },
];

const classify = (label) => {
  if (/^Cash Out/i.test(label))
    return { rule_type: 'loan_purpose', loan_purpose: 'cashout' };
  if (/^DSCR\s+>=?\s*1\.5/i.test(label))
    return { rule_type: 'dscr_ratio', dscr_ratio_min: 1.5 };
  return null;
};

test('emits one rule per (matched-row × ltv band)', () => {
  const data = [
    ['Cash Out / Debt Consolidation',           0.250, 0.375],
    ['Some unrecognized label',                 0.100, 0.200],
    ['DSCR >= 1.50',                           -0.125, -0.250],
  ];
  const rules = extractFeatureLtvGrid(data, 0, 3, ltv, classify);
  assert.equal(rules.length, 4);
  assert.equal(rules[0].rule_type, 'loan_purpose');
  assert.equal(rules[0].loan_purpose, 'cashout');
  assert.equal(rules[0].llpa_points, 0.250);
  assert.equal(rules[2].rule_type, 'dscr_ratio');
  assert.equal(rules[2].dscr_ratio_min, 1.5);
  assert.equal(rules[3].llpa_points, -0.250);
});

test('preserves raw_label on every emitted rule', () => {
  const data = [['Cash Out / Debt Consolidation', 0.25, 0.375]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify);
  assert.equal(rules[0].raw_label, 'Cash Out / Debt Consolidation');
  assert.equal(rules[1].raw_label, 'Cash Out / Debt Consolidation');
});

test('handles NA cells as not_offered with llpa_points=null', () => {
  const data = [['Cash Out', 'NA', 0.5]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].not_offered, true);
  assert.equal(rules[0].llpa_points, null);
  assert.equal(rules[1].not_offered, false);
  assert.equal(rules[1].llpa_points, 0.5);
});

test('skips empty / null cells silently', () => {
  const data = [['Cash Out', null, 0.5]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].llpa_points, 0.5);
  assert.equal(rules[0].cltv_min, 60.01);
});

test('respects labelCol / startCol for offset layouts', () => {
  const data = [[null, 'Cash Out', 0.25, 0.375]];
  const rules = extractFeatureLtvGrid(
    data, 0, 1, ltv, classify,
    { labelCol: 1, startCol: 2 }
  );
  assert.equal(rules.length, 2);
  assert.equal(rules[0].llpa_points, 0.25);
  assert.equal(rules[1].llpa_points, 0.375);
});

test('merges baseFields into every emitted rule', () => {
  const data = [['Cash Out', 0.25, 0.375]];
  const rules = extractFeatureLtvGrid(
    data, 0, 1, ltv, classify,
    { baseFields: { lender_code: 'resicentral', tier: 'premier' } }
  );
  for (const r of rules) {
    assert.equal(r.lender_code, 'resicentral');
    assert.equal(r.tier, 'premier');
  }
});

test('skips empty / null label rows', () => {
  const data = [
    [null,       0.25, 0.375],
    ['',         0.25, 0.375],
    ['Cash Out', 0.25, 0.375],
  ];
  const rules = extractFeatureLtvGrid(data, 0, 3, ltv, classify);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].raw_label, 'Cash Out');
});

test('skips rows where classify returns null', () => {
  const data = [['Some unrecognized label', 0.25, 0.375]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify);
  assert.equal(rules.length, 0);
});

test('honors ltvKey="ltv"', () => {
  const data = [['Cash Out', 0.25, 0.375]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify, { ltvKey: 'ltv' });
  assert.equal(rules[0].ltv_min, 0);
  assert.equal(rules[0].ltv_max, 60);
  assert.equal(Object.prototype.hasOwnProperty.call(rules[0], 'cltv_min'), false);
});

test('honors valueScale option (×100 for ResiCentral-shape inputs)', () => {
  const data = [['Cash Out', 0.005, -0.00875]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify, { valueScale: 100 });
  // Source 0.005 → 0.5; source -0.00875 → -0.875 (rounded)
  assert.equal(rules[0].llpa_points, 0.5);
  assert.equal(rules[1].llpa_points, -0.875);
});

test('valueScale=1 (default) preserves Everstream behavior', () => {
  const data = [['Cash Out', -0.5, 0.25]];
  const rules = extractFeatureLtvGrid(data, 0, 1, ltv, classify);
  assert.equal(rules[0].llpa_points, -0.5);
  assert.equal(rules[1].llpa_points, 0.25);
});

test('startRow / endRow define the inclusive-exclusive scan window', () => {
  const data = [
    ['skip-pre', 0.1, 0.2],
    ['Cash Out', 0.25, 0.375],
    ['skip-post', 0.1, 0.2],
  ];
  const rules = extractFeatureLtvGrid(data, 1, 2, ltv, classify);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].raw_label, 'Cash Out');
});

// ─── 2-col category + sub-label mode (Elite/Select layout, inventory §10.6) ───

const elite_classify = (subLabel, ctx = {}) => {
  const cat = ctx.category;
  if (cat === 'DSCR Additional Adjust') {
    if (/^>=?\s*1\.25$/.test(subLabel))
      return { rule_type: 'dscr_ratio', dscr_ratio_min: 1.25 };
    if (/^1\.00\s*-\s*1\.24$/.test(subLabel))
      return { rule_type: 'dscr_ratio', dscr_ratio_min: 1.0, dscr_ratio_max: 1.24 };
  }
  if (cat === 'Housing History') {
    if (subLabel === '1x30x12')
      return { rule_type: 'feature', feature: 'mortgage_lates_1x30' };
  }
  if (cat === 'State') return null;       // out-of-license drop
  return null;
};

test('categoryCol forward-fills the active category across blank rows', () => {
  const data = [
    [null, null, null, 'DSCR Additional Adjust', '>= 1.25',     0.005, 0.005],
    [null, null, null, null,                     '1.00 - 1.24', 0,     0],
    [null, null, null, 'Housing History',        '1x30x12',    -0.0025, -0.0025],
  ];
  const rules = extractFeatureLtvGrid(
    data, 0, 3, ltv, elite_classify,
    { categoryCol: 3, labelCol: 4, startCol: 5 }
  );
  assert.equal(rules.length, 6);
  assert.equal(rules[0].rule_type, 'dscr_ratio');
  assert.equal(rules[0].dscr_ratio_min, 1.25);
  assert.equal(rules[2].rule_type, 'dscr_ratio');
  assert.equal(rules[2].dscr_ratio_min, 1.0);
  assert.equal(rules[2].dscr_ratio_max, 1.24);
  assert.equal(rules[4].rule_type, 'feature');
  assert.equal(rules[4].feature, 'mortgage_lates_1x30');
});

test('categoryCol mode uses combined "category / subLabel" raw_label', () => {
  const data = [
    [null, null, null, 'DSCR Additional Adjust', '>= 1.25', 0.005, 0.005],
    [null, null, null, null,                     '1.00 - 1.24', 0, 0],
  ];
  const rules = extractFeatureLtvGrid(
    data, 0, 2, ltv, elite_classify,
    { categoryCol: 3, labelCol: 4, startCol: 5 }
  );
  assert.equal(rules[0].raw_label, 'DSCR Additional Adjust / >= 1.25');
  assert.equal(rules[2].raw_label, 'DSCR Additional Adjust / 1.00 - 1.24');
});

test('categoryCol mode passes category context to classify', () => {
  const seen = [];
  const probe = (subLabel, ctx) => {
    seen.push({ subLabel, category: ctx?.category });
    return null;
  };
  const data = [
    [null, null, null, 'CatA', 'sub1', 0.1, 0.2],
    [null, null, null, null,   'sub2', 0.1, 0.2],
    [null, null, null, 'CatB', 'sub3', 0.1, 0.2],
  ];
  extractFeatureLtvGrid(data, 0, 3, ltv, probe, { categoryCol: 3, labelCol: 4, startCol: 5 });
  assert.deepEqual(seen, [
    { subLabel: 'sub1', category: 'CatA' },
    { subLabel: 'sub2', category: 'CatA' },     // forward-filled
    { subLabel: 'sub3', category: 'CatB' },
  ]);
});

test('categoryCol mode lets classifier drop rows by returning null (e.g. out-of-license State row)', () => {
  const data = [
    [null, null, null, 'State', 'CT, IL, NJ, NY', 0, 0],     // out-of-license — dropped
    [null, null, null, 'Housing History', '1x30x12', -0.0025, -0.0025],
  ];
  const rules = extractFeatureLtvGrid(
    data, 0, 2, ltv, elite_classify,
    { categoryCol: 3, labelCol: 4, startCol: 5 }
  );
  assert.equal(rules.length, 2);
  assert.equal(rules.every(r => r.rule_type === 'feature'), true);
});

test('categoryCol mode + valueScale composes correctly', () => {
  const data = [
    [null, null, null, 'DSCR Additional Adjust', '>= 1.25', 0.005, 0.0063],
  ];
  const rules = extractFeatureLtvGrid(
    data, 0, 1, ltv, elite_classify,
    { categoryCol: 3, labelCol: 4, startCol: 5, valueScale: 100 }
  );
  assert.equal(rules[0].llpa_points, 0.5);
  assert.equal(rules[1].llpa_points, 0.63);
});

test('categoryCol omitted = backward-compatible single-col behavior', () => {
  // Same fixture as the very first test should still pass when categoryCol not supplied.
  const data = [
    ['Cash Out / Debt Consolidation',           0.250, 0.375],
    ['Some unrecognized label',                 0.100, 0.200],
    ['DSCR >= 1.50',                           -0.125, -0.250],
  ];
  const rules = extractFeatureLtvGrid(data, 0, 3, ltv, classify);
  assert.equal(rules.length, 4);
  assert.equal(rules[0].raw_label, 'Cash Out / Debt Consolidation');     // no category prefix
});
