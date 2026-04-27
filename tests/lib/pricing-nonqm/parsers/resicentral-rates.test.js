/**
 * Integration tests for the ResiCentral DSCR rate sheet parser.
 *
 * Builds synthetic XLSX workbooks in memory to verify the parser's
 * behavior against documented edge cases. Tests use minimal fixtures
 * — not full per-program rate ladders — so they stay readable.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseResicentralRatesXlsx } from '../../../../src/lib/pricing-nonqm/parsers/resicentral-rates.js';

/**
 * Build a fixture for a single tab. `variantHeaders` is an object
 * keyed by rateCol index (1, 7, or 13) → header string.
 * `ratesByVariant` is keyed by rateCol → array of [rate, p30, p45, p60].
 *
 * Header rows match the real ResiCentral layout:
 *   row 14 = variant headers, row 16 = "Rate" axis, row 17 = ladder start.
 */
function buildTabRows({ programLabel = 'Program', variantHeaders = {}, ratesByVariant = {} }) {
  // XLSX collapses empty leading rows on buffer round-trip — every boilerplate
  // row needs at least one non-null cell to preserve absolute row indices.
  // Filling col 0 with a placeholder string is cheap and the parser doesn't
  // read col 0 outside row 12 (the program label, informational).
  const placeholder = '·';
  const aoa = [];
  for (let i = 0; i <= 11; i++) aoa.push([placeholder]);
  // Row 12: program label in col A
  aoa.push([programLabel]);
  // Row 13: placeholder so the row sticks
  aoa.push([placeholder]);
  // Row 14: variant headers in cols 1, 7, 13
  const headerRow = new Array(20).fill(null);
  headerRow[0]  = placeholder;
  headerRow[1]  = variantHeaders[1]  ?? null;
  headerRow[7]  = variantHeaders[7]  ?? null;
  headerRow[13] = variantHeaders[13] ?? null;
  aoa.push(headerRow);
  // Row 15: "Days to Lock" labels in cols 3, 9, 15
  const r15 = new Array(20).fill(null);
  r15[0]  = placeholder;
  r15[3]  = 'Days to Lock';
  r15[9]  = 'Days to Lock';
  r15[15] = 'Days to Lock';
  aoa.push(r15);
  // Row 16: Rate axis row — col 1/7/13="Rate", col 3-5/9-11/15-17 = lock days
  const r16 = new Array(20).fill(null);
  r16[0]  = placeholder;
  r16[1]  = 'Rate';  r16[3]  = 30;  r16[4]  = 45;  r16[5]  = 60;
  r16[7]  = 'Rate';  r16[9]  = 30;  r16[10] = 45;  r16[11] = 60;
  r16[13] = 'Rate';  r16[15] = 30;  r16[16] = 45;  r16[17] = 60;
  aoa.push(r16);
  // Rows 17+: rate ladder. Pad each variant's data into its rate/price cols.
  const cols = { 1: { price: [3, 4, 5] }, 7: { price: [9, 10, 11] }, 13: { price: [15, 16, 17] } };
  const maxLen = Math.max(0, ...Object.values(ratesByVariant).map(arr => arr.length));
  for (let li = 0; li < maxLen; li++) {
    const ladderRow = new Array(20).fill(null);
    for (const [rateColStr, layout] of Object.entries(cols)) {
      const rateCol = Number(rateColStr);
      const arr = ratesByVariant[rateCol];
      if (!arr || arr[li] === undefined) continue;
      const [rate, p30, p45, p60] = arr[li];
      ladderRow[rateCol]          = rate;
      ladderRow[layout.price[0]]  = p30;
      ladderRow[layout.price[1]]  = p45;
      ladderRow[layout.price[2]]  = p60;
    }
    aoa.push(ladderRow);
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

// ─── Basic parsing ───────────────────────────────────────────────────

test('Premier tab — 30Y Fixed and 40Y Fixed variants emit; 30Y IO variant skipped', () => {
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      programLabel: 'DSCR Premier',
      variantHeaders: {
        1:  'DSCR Premier 30 Year Fixed',
        7:  'DSCR Premier 30 Year Fixed IO',
        13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO',
      },
      ratesByVariant: {
        1:  [[5.99, 96.0, 95.85, 95.55], [6.0, 96.1, 95.95, 95.65]],
        7:  [[5.99, 97.5, 97.3, 97.0],   [6.0, 97.6, 97.4, 97.1]],   // IO — should be skipped entirely
        13: [[5.99, 95.0, 94.85, 94.55], [6.0, 95.1, 94.95, 94.65]],
      },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');

  // 30Y + 40Y in scope = 2 variants × 2 rates × 3 lock days = 12 products
  assert.equal(r.products.length, 12);
  assert.deepEqual(r.tiers_seen, ['premier']);
  // 30Y Fixed prices come from col 1 (96.0, etc.) — never the IO col
  const v30 = r.products.filter(p => p.term === 30);
  const v40 = r.products.filter(p => p.term === 40);
  assert.equal(v30.length, 6);
  assert.equal(v40.length, 6);
  // No IO product leaked through
  for (const p of r.products) {
    assert.notEqual(p.final_base_price, 97.5);
    assert.notEqual(p.final_base_price, 97.6);
  }
});

test('Investor Premier — only 30Y Fixed in scope (both 40Y variants are IO)', () => {
  const buf = buildBook({
    'DSCR Investor Premier': buildTabRows({
      programLabel: 'DSCR Investor Premier',
      variantHeaders: {
        1:  'DSCR Investor Premier 30 Year Fixed',
        7:  'DSCR Investor Premier 30 Year Fixed IO',
        13: 'DSCR Investor Premier 40 Year Fixed IO',
      },
      ratesByVariant: {
        1:  [[5.99, 97.7, 97.5, 97.2]],
        7:  [[5.99, 99.0, 98.8, 98.5]],
        13: [[5.99, 96.0, 95.85, 95.55]],
      },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  assert.equal(r.products.length, 3);              // 1 ladder × 3 lock days
  for (const p of r.products) {
    assert.equal(p.tier, 'investor_premier');
    assert.equal(p.term, 30);
    assert.equal(p.final_base_price, p.lock_days === 30 ? 97.7 : p.lock_days === 45 ? 97.5 : 97.2);
  }
});

test('Select — 30Y combined and 15Y in scope; 40Y IO skipped', () => {
  const buf = buildBook({
    'DSCR Select': buildTabRows({
      programLabel: 'DSCR Select',
      variantHeaders: {
        1:  'DSCR Select 30 Year Fixed & 30 Year IO',
        7:  'DSCR Select 15 Year Fixed',
        13: 'DSCR Select 40 Year Fixed IO',
      },
      ratesByVariant: {
        1:  [[5.49, 94.5, 94.35, 94.1]],
        7:  [[5.49, 94.7, 94.55, 94.3]],
        13: [[5.49, 94.0, 93.85, 93.55]],
      },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  assert.equal(r.products.length, 6);              // 2 ladders × 3 lock days
  const terms = [...new Set(r.products.map(p => p.term))].sort();
  assert.deepEqual(terms, [15, 30]);
  // No 40Y product
  for (const p of r.products) assert.notEqual(p.term, 40);
});

// ─── Effective date ──────────────────────────────────────────────────

test('Effective date is parsed from filename, not the workbook', () => {
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
      ratesByVariant: { 1: [[5.99, 96, 95.85, 95.55]] },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_1128199760.xlsx');
  assert.equal(r.effective_at, '2026-04-24T00:00:00.000Z');
});

test('No filename → effective_at is null (caller must supply elsewhere)', () => {
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
      ratesByVariant: { 1: [[5.99, 96, 95.85, 95.55]] },
    }),
  });
  const r = parseResicentralRatesXlsx(buf);                // no filename
  assert.equal(r.effective_at, null);
});

// ─── Robustness ──────────────────────────────────────────────────────

test('Missing tab → entry in skipped[] but parser continues', () => {
  // Only Premier present; Investor Premier / Elite / Select missing.
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
      ratesByVariant: { 1: [[5.99, 96, 95.85, 95.55]] },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  assert.equal(r.products.length, 3);
  assert.deepEqual(r.tiers_seen, ['premier']);
  assert.equal(r.skipped.length, 3);
  for (const s of r.skipped) assert.match(s, /^missing tab:/);
});

test('Variant header that doesn\'t match expected regex → skipped[] entry, other variants still parse', () => {
  // 30Y header is mangled; 40Y header is correct.
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      variantHeaders: {
        1:  'DSCR Premier Foo 30 Year Fixed',           // typo — won't match
        7:  'DSCR Premier 30 Year Fixed IO',
        13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO',
      },
      ratesByVariant: {
        1:  [[5.99, 96, 95.85, 95.55]],
        13: [[5.99, 95, 94.85, 94.55]],
      },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  // 40Y still emits; 30Y doesn't
  assert.equal(r.products.length, 3);
  assert.equal(r.products[0].term, 40);
  // Layout drift recorded
  assert.ok(r.skipped.some(s => s.includes('col 1') && s.includes('variant header')));
});

test('Missing Rate axis row → entire tab skipped', () => {
  // Build a Premier tab but stomp row 16 with garbage.
  const aoa = buildTabRows({
    variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
    ratesByVariant: { 1: [[5.99, 96, 95.85, 95.55]] },
  });
  aoa[16] = ['junk'];                                       // wipe Rate header
  const buf = buildBook({ 'DSCR Premier': aoa });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  assert.equal(r.products.length, 0);
  assert.ok(r.skipped.some(s => s.includes('not the expected Rate header')));
});

test('Ladder break: non-numeric text in rate col stops scanning', () => {
  // Premier 30Y ladder followed by ARM section header.
  const aoa = buildTabRows({
    variantHeaders: {
      1:  'DSCR Premier 30 Year Fixed',
      7:  'DSCR Premier 30 Year Fixed IO',
      13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO',
    },
    ratesByVariant: {
      1:  [[5.99, 96, 95.85, 95.55], [6.0, 96.1, 95.95, 95.65]],
      13: [[5.99, 95, 94.85, 94.55], [6.0, 95.1, 94.95, 94.65]],
    },
  });
  // Append ARM section: blank rows, then a row with "DSCR Premier 7/6 Arm" in col 1
  aoa.push([], []);
  const armHeaderRow = [];
  armHeaderRow[1]  = 'DSCR Premier 7/6 Arm';
  armHeaderRow[7]  = 'DSCR Premier 7/6 Arm IO';
  armHeaderRow[13] = 'DSCR Premier 10/6 Arm';
  aoa.push(armHeaderRow);
  // ARM rate row with same numeric ladder shape
  const armRateRow = [];
  armRateRow[1] = 5.5;  armRateRow[3] = 99.0;  armRateRow[4] = 98.85;  armRateRow[5] = 98.55;
  armRateRow[13] = 5.5; armRateRow[15] = 99.0; armRateRow[16] = 98.85; armRateRow[17] = 98.55;
  aoa.push(armRateRow);
  const buf = buildBook({ 'DSCR Premier': aoa });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  // Should emit only the 2 fixed rates × 3 locks × 2 in-scope variants = 12 products
  assert.equal(r.products.length, 12);
  for (const p of r.products) assert.ok([5.99, 6.0].includes(p.note_rate));
});

test('Skips blank rows mid-ladder without breaking', () => {
  // Some ResiCentral tabs have informational text (SOFR boilerplate) in col 0
  // between the fixed ladder and the ARM section. Col 1 (rate col) is null
  // for those rows. Parser should `continue`, not `break`.
  const aoa = buildTabRows({
    variantHeaders: {
      1:  'DSCR Premier 30 Year Fixed',
      7:  'DSCR Premier 30 Year Fixed IO',
      13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO',
    },
    ratesByVariant: {
      1:  [[5.99, 96, 95.85, 95.55]],
      13: [[5.99, 95, 94.85, 94.55]],
    },
  });
  // Append a row with text only in col 0 — parser should skip, not break
  aoa.push(['Some informational text', null]);
  // Then a real second rate row
  const r19 = [];
  r19[1] = 6.0;  r19[3] = 96.1;  r19[4] = 95.95;  r19[5] = 95.65;
  r19[13] = 6.0; r19[15] = 95.1; r19[16] = 94.95; r19[17] = 94.65;
  aoa.push(r19);
  const buf = buildBook({ 'DSCR Premier': aoa });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  // 2 rates × 3 locks × 2 in-scope variants = 12
  assert.equal(r.products.length, 12);
});

// ─── Output shape ────────────────────────────────────────────────────

test('Emitted product rows have the schema expected by ingest.js', () => {
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
      ratesByVariant: { 1: [[5.99, 96, 95.85, 95.55]] },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  const p = r.products[0];
  assert.equal(p.lender_code, 'resicentral');
  assert.equal(p.loan_type, 'dscr');
  assert.equal(p.tier, 'premier');
  assert.equal(p.product_type, 'fixed');
  assert.equal(p.term, 30);
  assert.equal(p.arm_fixed_period, null);
  assert.equal(p.arm_adj_period, null);
  assert.ok([30, 45, 60].includes(p.lock_days));
  assert.equal(typeof p.note_rate, 'number');
  assert.equal(typeof p.final_base_price, 'number');
  assert.match(p.raw_product_name, /ResiCentral DSCR premier 30yr Fixed/);
});

test('Lock day order: 30 → 45 → 60', () => {
  const buf = buildBook({
    'DSCR Premier': buildTabRows({
      variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
      ratesByVariant: { 1: [[6.5, 99.5, 99.3, 99.0]] },
    }),
  });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  const byLock = r.products.reduce((acc, p) => { acc[p.lock_days] = p.final_base_price; return acc; }, {});
  assert.equal(byLock[30], 99.5);
  assert.equal(byLock[45], 99.3);
  assert.equal(byLock[60], 99.0);
});

test('Rate cells with NA / non-numeric → that price col skipped, others emit', () => {
  // Row 17: rate=6.5, p30=NA, p45=99.3, p60=99.0
  const aoa = buildTabRows({
    variantHeaders: { 1: 'DSCR Premier 30 Year Fixed', 7: 'DSCR Premier 30 Year Fixed IO', 13: 'DSCR Premier 40Yr Fixed/40Yr Fixed IO' },
    ratesByVariant: {},
  });
  const r17 = [];
  r17[1] = 6.5; r17[3] = 'NA'; r17[4] = 99.3; r17[5] = 99.0;
  aoa.push(r17);
  const buf = buildBook({ 'DSCR Premier': aoa });
  const r = parseResicentralRatesXlsx(buf, '67370_04242026_x.xlsx');
  // Should emit 2 products (45-day and 60-day), not 3
  assert.equal(r.products.length, 2);
  assert.ok(!r.products.some(p => p.lock_days === 30));
});
