/**
 * Integration tests for the ResiCentral DSCR LLPA parser
 * (Premier + Investor Premier scope per D9c.6.5).
 *
 * Builds synthetic XLSX workbooks in memory exercising:
 *   - FICO×LTV grid (10 FICO × 9 LTV)
 *   - Feature×LTV grid with the four locked decisions:
 *       Q1 → loan_size_secondary
 *       Q3 → pricing_special with FICO/DSCR/LTV gates
 *       Q4 → prepay_term + prepay_structure (split)
 *   - Max Price block, Loan Amount Adj, Misc Adjustments
 *   - Deferred Elite + Select tabs surface in `skipped[]` correctly
 *   - "N/A" cell marker (Investor Premier convention)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseResicentralLlpasXlsx } from '../../../../src/lib/pricing-nonqm/parsers/resicentral-llpas.js';

// ─── Fixture helpers ─────────────────────────────────────────────────

const PLACEHOLDER = '·';      // sticks otherwise-blank rows so XLSX preserves index

function emptyRow(width = 14) {
  const r = new Array(width).fill(null);
  r[0] = PLACEHOLDER;
  return r;
}

/**
 * Build a Premier-shape LLPA tab fixture.
 *
 *   row 12: program-label cell
 *   row 16: FICO anchor in col 7
 *   row 17: "FICO" in col 3 + "LTV Ratio" in col 8
 *   row 18: "Score" in col 3 + LTV bands in cols 4-12
 *   rows 19-28: 10 FICO bands × 9 LTV cells in cols 4-12
 *   row 32: feature anchor in col 6
 *   row 33: "Product" / "LTV Ratio"
 *   row 34: "Feature" + LTV bands
 *   rows 35..: feature rows (caller supplies)
 *   row beforeFees: blank
 *   feesRow: "Fees" / "Max Price" / "Loan Amount Adj" headers
 *   feesRow+1..: Fees / Max Price / Loan Amount Adj data (caller supplies)
 *   miscRow: "Misc Adjustments" header
 *   miscRow+1..: misc data (caller supplies)
 */
function buildPremierTab({
  programLabel = 'DSCR Premier Loan Level Adjustments',
  ficoCells,            // 10×9 array of cell values (numbers, 'NA', 'N/A', null)
  featureRows = [],     // [[label, v0, v1, ..., v8], ...]
  maxPriceRows = [],    // [[ppp_label, value], ...] cols 6+7
  loanAmountRows = [],  // [[label, value], ...] cols 9+11
  miscRows = [],        // [[label, value], ...]
  feesHeader = 'Max Price Premier',
}) {
  const aoa = [];
  for (let i = 0; i <= 11; i++) aoa.push(emptyRow());
  // r12: program label
  const r12 = emptyRow(); r12[0] = programLabel; aoa.push(r12);
  // r13-r15: blanks
  aoa.push(emptyRow()); aoa.push(emptyRow()); aoa.push(emptyRow());
  // r16: FICO anchor
  const r16 = emptyRow(); r16[7] = 'FICO Score/LTV Ratio'; aoa.push(r16);
  // r17: "FICO" + "LTV Ratio"
  const r17 = emptyRow(); r17[3] = 'FICO'; r17[8] = 'LTV Ratio'; aoa.push(r17);
  // r18: "Score" + LTV band labels in cols 4-12
  const r18 = emptyRow();
  r18[3] = 'Score';
  const ltvLabels = ['0-50.00%','50.01-55%','55.01-60%','60.01-65%','65.01-70%','70.01-75%','75.01-80%','80.01-85%','85.01-90%'];
  for (let j = 0; j < ltvLabels.length; j++) r18[4 + j] = ltvLabels[j];
  aoa.push(r18);
  // r19-r28: FICO grid data
  const ficoLabels = ['780-999','760-779','740-759','720-739','700-719','680-699','660-679','640-659','620-639','600-619'];
  for (let fi = 0; fi < 10; fi++) {
    const row = emptyRow();
    row[3] = ficoLabels[fi];
    const cells = ficoCells?.[fi] ?? new Array(9).fill(0);
    for (let ci = 0; ci < 9; ci++) row[4 + ci] = cells[ci];
    aoa.push(row);
  }
  // r29-r31: blanks
  aoa.push(emptyRow()); aoa.push(emptyRow()); aoa.push(emptyRow());
  // r32: feature anchor
  const r32 = emptyRow(); r32[6] = 'Product Feature/LTV Ratio'; aoa.push(r32);
  // r33: "Product" + "LTV Ratio"
  const r33 = emptyRow(); r33[3] = 'Product'; r33[8] = 'LTV Ratio'; aoa.push(r33);
  // r34: "Feature" + LTV band labels
  const r34 = emptyRow();
  r34[3] = 'Feature';
  for (let j = 0; j < ltvLabels.length; j++) r34[4 + j] = ltvLabels[j];
  aoa.push(r34);
  // r35..: feature data
  for (const fr of featureRows) {
    const [label, ...vals] = fr;
    const row = emptyRow();
    row[3] = label;
    for (let j = 0; j < 9 && j < vals.length; j++) row[4 + j] = vals[j];
    aoa.push(row);
  }
  // Add 3 blank rows before the Fees section
  aoa.push(emptyRow()); aoa.push(emptyRow()); aoa.push(emptyRow());
  // feesRow: "Fees" / "Max Price <prog>" / "Loan Amount Adj" headers
  const fr = emptyRow();
  fr[3] = 'Fees'; fr[6] = feesHeader; fr[9] = 'Loan Amount Adj';
  aoa.push(fr);
  // Side-by-side data rows. We want max(maxPriceRows.length, loanAmountRows.length) entries.
  const sideBySideMax = Math.max(maxPriceRows.length, loanAmountRows.length, 1);
  for (let i = 0; i < sideBySideMax; i++) {
    const row = emptyRow();
    if (maxPriceRows[i]) {
      row[6] = maxPriceRows[i][0];
      row[7] = maxPriceRows[i][1];
    }
    if (loanAmountRows[i]) {
      row[9]  = loanAmountRows[i][0];
      row[11] = loanAmountRows[i][1];
    }
    aoa.push(row);
  }
  // Misc Adjustments header + data
  if (miscRows.length) {
    const mhdr = emptyRow(); mhdr[3] = 'Misc Adjustments'; aoa.push(mhdr);
    for (const [label, value] of miscRows) {
      const row = emptyRow();
      row[3] = label;
      row[4] = value;
      aoa.push(row);
    }
  }
  return aoa;
}

function buildBook(tabs) {
  const wb = XLSX.utils.book_new();
  for (const [tabName, aoa] of Object.entries(tabs)) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, tabName);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Generate a constant-valued FICO grid with one corner NA / N/A cell to
// exercise the not_offered branch.
function makeFicoGrid({ value = 0.005, naAt = null, naMarker = 'NA' } = {}) {
  const grid = [];
  for (let fi = 0; fi < 10; fi++) {
    const row = new Array(9).fill(value);
    if (naAt && naAt[0] === fi) row[naAt[1]] = naMarker;
    grid.push(row);
  }
  return grid;
}

// ─── Smoke ───────────────────────────────────────────────────────────

test('smoke: parses Premier + InvPremier when both tabs present', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01, naAt: [0, 8] }),
      featureRows: [['DSCR 1.25 - 1.49', 0.005,0.005,0.005,0.005,0.005,0.005,0.005,0,0]],
    }),
    'DSCR Investor Premier LLPAs': buildPremierTab({
      programLabel: 'DSCR Investor Premier Loan Level Adjustments',
      ficoCells: makeFicoGrid({ value: 0.005, naMarker: 'N/A' }),
      featureRows: [['DSCR 1.25 - 1.49', 0.005,0.005,0.005,0.005,0.005,0.005,'N/A','N/A','N/A']],
      feesHeader: 'Max Price Investor Premier',
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  assert.equal(r.lender_code, 'resicentral');
  assert.deepEqual(r.tiers_seen.sort(), ['investor_premier', 'premier']);
  assert.ok(r.rules.length > 0);
});

test('Elite + Select tabs in workbook → recorded in skipped[] as deferred', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
    }),
    'DSCR Elite LLPAs':  buildPremierTab({ ficoCells: makeFicoGrid({ value: 0.005 }) }),
    'DSCR Select LLPA':  buildPremierTab({ ficoCells: makeFicoGrid({ value: 0.005 }) }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  assert.ok(r.skipped.some(s => s.includes('elite') && s.includes('deferred')));
  assert.ok(r.skipped.some(s => s.includes('select') && s.includes('deferred')));
});

// ─── FICO grid ───────────────────────────────────────────────────────

test('FICO grid emits 90 rules (10 FICO × 9 LTV) per tier', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const grid = r.rules.filter(x => x.rule_type === 'fico_cltv_grid');
  assert.equal(grid.length, 90);
  for (const x of grid) {
    assert.equal(x.tier, 'premier');
    assert.equal(x.occupancy, 'investment');
    assert.equal(x.loan_purpose, null);          // ResiCentral grid is not split by purpose
  }
});

test('FICO grid: NA marker → not_offered=true with no llpa_points', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01, naAt: [0, 8] }),    // 780+ × 85.01-90%
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const corner = r.rules.find(x => x.rule_type === 'fico_cltv_grid' && x.fico_min === 780 && x.cltv_min === 85.01);
  assert.equal(corner.not_offered, true);
  assert.equal(Object.prototype.hasOwnProperty.call(corner, 'llpa_points'), false);
});

test('FICO grid: "N/A" (Investor Premier convention) is treated like "NA"', () => {
  const buf = buildBook({
    'DSCR Investor Premier LLPAs': buildPremierTab({
      programLabel: 'DSCR Investor Premier Loan Level Adjustments',
      ficoCells: makeFicoGrid({ value: 0.01, naAt: [0, 8], naMarker: 'N/A' }),
      feesHeader: 'Max Price Investor Premier',
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const corner = r.rules.find(x => x.tier === 'investor_premier' && x.rule_type === 'fico_cltv_grid' && x.fico_min === 780 && x.cltv_min === 85.01);
  assert.equal(corner.not_offered, true);
});

// ─── Feature classifier ─────────────────────────────────────────────

test('feature: DSCR ratio bands are classified to dscr_ratio rule_type', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [
        ['No Ratio',         'NA',-0.005,-0.005,-0.005,-0.005,-0.01,-0.01,-0.0125,'NA'],
        ['DSCR 0.75 - 0.89', -0.005,-0.005,-0.005,-0.005,-0.005,-0.005,'NA','NA','NA'],
        ['DSCR 1.25 - 1.49',  0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005,0,'NA'],
        ['DSCR => 1.50',      0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0,'NA'],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const dscr = r.rules.filter(x => x.rule_type === 'dscr_ratio');
  // 4 rows × 9 LTV = 36 rules
  assert.equal(dscr.length, 36);
  const noRatio = dscr.filter(x => x.feature === 'no_ratio');
  assert.equal(noRatio.length, 9);
  const gte150 = dscr.filter(x => x.dscr_ratio_min === 1.5 && x.dscr_ratio_max === null);
  assert.equal(gte150.length, 9);
  const range1 = dscr.filter(x => x.dscr_ratio_min === 1.25 && x.dscr_ratio_max === 1.49);
  assert.equal(range1.length, 9);
});

test('feature: UPB band labels parse correctly across formats', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [
        ['UPB <=150K',                -0.005,-0.005,-0.005,-0.005,-0.005,-0.0125,-0.015,-0.0175,'NA'],
        ['UPB >150K - 250K',          -0.00125,-0.00125,-0.00125,-0.00125,-0.00125,-0.0025,-0.0025,-0.0075,'NA'],
        ['UPB 250,001-350,000',        0.00125,0.00125,0.00125,0.00125,0.00125,0.00125,0.00125,0,'NA'],
        ['UPB > 1.5mm - 2.0mm',        0,0,0,0,0,0,-0.0025,'NA','NA'],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const ls = r.rules.filter(x => x.rule_type === 'loan_size');
  assert.equal(ls.length, 36);                     // 4 bands × 9 LTV
  const lte150K = ls.find(x => x.loan_size_min === 0 && x.loan_size_max === 150000);
  assert.ok(lte150K);
  const gtRange = ls.find(x => x.loan_size_min === 150001 && x.loan_size_max === 250000);
  assert.ok(gtRange);
  const explicit = ls.find(x => x.loan_size_min === 250001 && x.loan_size_max === 350000);
  assert.ok(explicit);
  const mmRange = ls.find(x => x.loan_size_min === 1500001 && x.loan_size_max === 2000000);
  assert.ok(mmRange);
});

test('feature: Cash Out / Debt Consolidation → loan_purpose rule', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [['Cash Out / Debt Consolidation', 0,0,0,-0.005,-0.005,-0.0075,'NA','NA','NA']],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const purp = r.rules.filter(x => x.rule_type === 'loan_purpose');
  assert.equal(purp.length, 9);
  for (const x of purp) assert.equal(x.loan_purpose, 'cashout');
});

test('feature: property_type rules — Condo, Non-Warrantable Condo, 2 Unit, 3-4 Unit', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [
        ['Non-Warrantable Condo', -0.0025,-0.0025,-0.0025,-0.00375,-0.005,-0.0075,-0.00875,'NA','NA'],
        ['Condo',                  0,0,0,0,0,-0.00125,-0.0025,'NA','NA'],
        ['2 Unit Property',       -0.00125,-0.00125,-0.00125,-0.00375,-0.005,-0.00625,-0.0125,'NA','NA'],
        ['3-4 Unit Property',     -0.00125,-0.00125,-0.00125,-0.00375,-0.005,-0.00625,-0.015,'NA','NA'],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const types = [...new Set(r.rules.filter(x => x.rule_type === 'property_type').map(x => x.property_type))].sort();
  assert.deepEqual(types, ['2unit','3_4unit','condo','nonwarr_condo']);
});

test('feature: prepay term + structure split (Q4) into separate rule_types', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [
        ['5yr PPP',  0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.005,'NA'],
        ['1yr PPP', -0.01,-0.01,-0.01,-0.01,-0.01,-0.01,-0.01,'NA','NA'],
        ['No PPP* (exception for specific states)',  -0.015,-0.015,-0.015,-0.015,-0.015,-0.015,-0.015,'NA','NA'],
        ['Declining Prepay (i.e. 5/4/3/2/1)*',        0,0,0,0,0,0,0,0,'NA'],
        ['5% Flat Prepay (i.e. 5/5/5/5/5)*',          0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,'NA'],
        ['Standard 6 Months Interest Prepay Penalty', 0,0,0,0,0,0,0,0,'NA'],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);

  const term = r.rules.filter(x => x.rule_type === 'prepay_term');
  const struct = r.rules.filter(x => x.rule_type === 'prepay_structure');
  assert.equal(term.length, 27);                 // 3 term rows × 9 LTV
  assert.equal(struct.length, 27);               // 3 structure rows × 9 LTV
  const yr5 = term.find(x => x.prepay_years === 5 && x.cltv_min === 0);
  assert.ok(yr5);
  const noPpp = term.filter(x => x.prepay_years === 0);
  assert.equal(noPpp.length, 9);
  const declining = struct.filter(x => x.feature === 'declining');
  assert.equal(declining.length, 9);
  const fixed5 = struct.filter(x => x.feature === 'fixed_5');
  assert.equal(fixed5.length, 9);
  const sixMo = struct.filter(x => x.feature === 'six_months_interest');
  assert.equal(sixMo.length, 9);
});

test('feature: IO + 40yr term feature rules', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [
        ['30 YR IO',             -0.00125,-0.00125,-0.0025,-0.0025,-0.00375,-0.005,-0.00875,'NA','NA'],
        ['40 YR IO ',            -0.005,-0.005,-0.005,-0.005,-0.00625,-0.0075,-0.01,'NA','NA'],
        ['40yr Fully Amortized', -0.00375,-0.00375,-0.00375,-0.00375,-0.00375,-0.00375,-0.00625,'NA','NA'],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const features = [...new Set(r.rules.filter(x => x.rule_type === 'feature').map(x => x.feature))].sort();
  assert.deepEqual(features, ['io_30','io_40','term_40_amortized']);
});

test('feature: Pricing Special row → pricing_special rule_type with FICO + DSCR gates (×100 to points)', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [['Pricing Special (700+ FICO, >=1 DSCR)***', 0.00875,0.00875,0.00875,0.00875,0.00875,0.00875,0.00875,'NA','NA']],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const ps = r.rules.filter(x => x.rule_type === 'pricing_special');
  assert.equal(ps.length, 9);            // 1 row × 9 LTV
  for (const x of ps) {
    assert.equal(x.fico_min, 700);
    assert.equal(x.dscr_ratio_min, 1.0);
  }
  // Source 0.00875 → stored 0.875 points (×100)
  const ltv70 = ps.find(x => x.cltv_min === 65.01);
  assert.equal(ltv70.llpa_points, 0.875);
  const ltv85 = ps.find(x => x.cltv_min === 80.01);
  assert.equal(ltv85.not_offered, true);
});

// ─── Side-by-side blocks ────────────────────────────────────────────

test('Max Price block emits prepay_term rules with price_cap', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      maxPriceRows: [
        ['5yr PPP', 103.65],
        ['4yr PPP', 103.15],
        ['3yr PPP', 103.15],
        ['2yr PPP', 101.9],
        ['1yr PPP', 100.9],
        ['No PPP',  100.9],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const caps = r.rules.filter(x => x.rule_type === 'prepay_term' && x.price_cap !== undefined);
  assert.equal(caps.length, 6);
  const yr5 = caps.find(x => x.prepay_years === 5);
  assert.equal(yr5.price_cap, 103.65);
  const noPpp = caps.find(x => x.prepay_years === 0);
  assert.equal(noPpp.price_cap, 100.9);
});

test('Loan Amount Adj block (Q1) emits loan_size_secondary rules (×100 to points)', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      loanAmountRows: [
        ['Min Loan Amount-$199,999', -0.015],
        ['$200,000-$749,999',         0],
        ['$750,000-$999,999',         0.00125],
        ['$1MM-$1,999,999',           0.0025],
        ['$2MM-$3,000,000',           0.00375],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const ls2 = r.rules.filter(x => x.rule_type === 'loan_size_secondary');
  assert.equal(ls2.length, 5);
  const min = ls2.find(x => x.loan_size_min === 0);
  assert.equal(min.loan_size_max, 199999);
  // Source -0.015 → stored -1.5 points
  assert.equal(min.llpa_points, -1.5);
  const mm = ls2.find(x => x.loan_size_min === 1000000);
  assert.equal(mm.loan_size_max, 1999999);
  // Source 0.0025 → stored 0.25 points
  assert.equal(mm.llpa_points, 0.25);
  const big = ls2.find(x => x.loan_size_min === 2000000);
  assert.equal(big.loan_size_max, 3000000);
});

test('Misc Adjustments: Guideline Exception → flat feature LLPA (×100 to points)', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      miscRows: [
        ['Guideline Exception', -0.0025],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const ge = r.rules.filter(x => x.rule_type === 'feature' && x.feature === 'guideline_exception');
  assert.equal(ge.length, 1);
  // Source -0.0025 → stored -0.25 points
  assert.equal(ge[0].llpa_points, -0.25);
});

test('Misc Adjustments: January Pricing Special → pricing_special with FICO 700 + LTV ≤ 80 (×100)', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      miscRows: [
        ['Guideline Exception',                        -0.0025],
        ['January Pricing Special (700+ FICO & LTV <=80)', 0.005],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  const jan = r.rules.find(x =>
    x.rule_type === 'pricing_special' && (x.raw_label || '').includes('January')
  );
  assert.ok(jan);
  assert.equal(jan.fico_min, 700);
  assert.equal(jan.cltv_min, 0);
  assert.equal(jan.cltv_max, 80);
  // Source 0.005 → stored 0.5 points (matches LS display of "+0.500")
  assert.equal(jan.llpa_points, 0.5);
});

// ─── Output discipline ─────────────────────────────────────────────

test('Every emitted rule carries occupancy=investment (DSCR-is-NOO invariant)', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [['Cash Out / Debt Consolidation', 0,0,0,-0.005,-0.005,-0.0075,'NA','NA','NA']],
      maxPriceRows: [['5yr PPP', 103.65]],
      loanAmountRows: [['Min Loan Amount-$199,999', -0.015]],
      miscRows: [['Guideline Exception', -0.0025]],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  for (const x of r.rules) {
    assert.equal(x.occupancy, 'investment', `rule lacks occupancy=investment: ${JSON.stringify(x)}`);
  }
});

// ─── LS-anchored regression test ────────────────────────────────────
// Ensures the LLPA scale (×100) stays in lockstep with what LoanSifter
// shows. If anyone reverts the scale, this test fires immediately.
//
// Source workbook values (per inventory + screenshot 2026-04-27):
//   Pricing Special row, LTV 65.01-70 → 0.005 in workbook
//   No PPP row,          LTV 65.01-70 → -0.01125 in workbook
// LS confirmed display:
//   Pricing Special                   → +0.500 points
//   No PPP (Investment property)      → -1.125 points
test('LS-anchored: Pricing Special and No PPP scaled correctly to points', () => {
  const buf = buildBook({
    'DSCR Premier LLPAs': buildPremierTab({
      ficoCells: makeFicoGrid({ value: 0.01 }),
      featureRows: [
        ['No PPP* (exception for specific states)',
                                       -0.015,-0.015,-0.015,-0.015,-0.015,-0.015,-0.015,-0.015,'NA'],
        ['Pricing Special (700+ FICO, >=1 DSCR)***',
                                        0.00875,0.00875,0.00875,0.00875,0.005,0.005,0.005,'NA','NA'],
      ],
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);

  // No PPP at LTV 65.01-70 (cltv_min=65.01) — LS shows -1.125 points
  const noPpp = r.rules.find(x =>
    x.rule_type === 'prepay_term' && x.prepay_years === 0 && x.cltv_min === 65.01
  );
  assert.ok(noPpp);
  assert.equal(noPpp.llpa_points, -1.5); // synthetic uses -0.015 → -1.5; LS sample row uses -0.01125 → -1.125

  // Pricing Special at LTV 65.01-70 — LS shows +0.500 points
  const ps65 = r.rules.find(x =>
    x.rule_type === 'pricing_special' && x.cltv_min === 65.01
  );
  assert.ok(ps65);
  assert.equal(ps65.llpa_points, 0.5);
});

test('Missing FICO anchor → tab skipped; other tab still parses', () => {
  const broken = buildPremierTab({ ficoCells: makeFicoGrid({ value: 0.01 }) });
  // Wipe the FICO anchor by replacing row 16 with placeholder-only
  broken[16] = emptyRow();
  const buf = buildBook({
    'DSCR Premier LLPAs':           broken,
    'DSCR Investor Premier LLPAs': buildPremierTab({
      programLabel: 'DSCR Investor Premier Loan Level Adjustments',
      ficoCells: makeFicoGrid({ value: 0.005 }),
      feesHeader: 'Max Price Investor Premier',
    }),
  });
  const r = parseResicentralLlpasXlsx(buf);
  assert.deepEqual(r.tiers_seen, ['investor_premier']);
  assert.ok(r.skipped.some(s => s.includes('premier') && s.includes('FICO')));
});
