/**
 * Integration test for the top-level ResiCentral orchestrator.
 * Verifies that `parseResicentralXlsx` returns both rates + llpas
 * results, with effective_at threaded from the filename to the rates
 * side and the deferred-tab notes surfacing on the llpas side.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseResicentralXlsx } from '../../../../src/lib/pricing-nonqm/parsers/resicentral.js';

// Minimal XLSX fixture: each tab gets at least the boilerplate cells the
// per-tab parsers expect to find. We don't need rich data — we just need
// to confirm the orchestrator wires the two sub-parsers together
// correctly.
function buildBareWorkbook() {
  const wb = XLSX.utils.book_new();
  const empty = [['placeholder']];   // single non-null cell so XLSX preserves the tab
  for (const tab of [
    'DSCR Premier', 'DSCR Investor Premier', 'DSCR Elite', 'DSCR Select',
    'DSCR Premier LLPAs', 'DSCR Investor Premier LLPAs',
    'DSCR Elite LLPAs', 'DSCR Select LLPA',
  ]) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empty), tab);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('orchestrator returns both rates and llpas results', () => {
  const buf = buildBareWorkbook();
  const out = parseResicentralXlsx(buf, '67370_04242026_xyz.xlsx');
  assert.ok(out.rates, 'rates result missing');
  assert.ok(out.llpas, 'llpas result missing');
  assert.equal(out.rates.lender_code, 'resicentral');
  assert.equal(out.llpas.lender_code, 'resicentral');
});

test('effective_at flows from filename to rates, not llpas', () => {
  const buf = buildBareWorkbook();
  const out = parseResicentralXlsx(buf, '67370_04242026_xyz.xlsx');
  assert.equal(out.rates.effective_at, '2026-04-24T00:00:00.000Z');
  // LLPAs side has no effective_at — it's a sheet-level concept owned by rates
  assert.equal(out.llpas.effective_at, undefined);
});

test('orchestrator works with no filename (rates.effective_at = null)', () => {
  const buf = buildBareWorkbook();
  const out = parseResicentralXlsx(buf);
  assert.equal(out.rates.effective_at, null);
});

test('LLPAs side surfaces deferred Elite + Select tabs in skipped[]', () => {
  const buf = buildBareWorkbook();
  const out = parseResicentralXlsx(buf, '67370_04242026_xyz.xlsx');
  assert.ok(out.llpas.skipped.some(s => s.includes('elite') && s.includes('deferred')));
  assert.ok(out.llpas.skipped.some(s => s.includes('select') && s.includes('deferred')));
});
