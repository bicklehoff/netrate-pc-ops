import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEffectiveDateFromFilename } from '../../../../../src/lib/pricing-nonqm/parsers/lib/effective-date.js';

test('parses the canonical ResiCentral filename', () => {
  const d = parseEffectiveDateFromFilename('67370_04242026_1128199760.xlsx');
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString().slice(0, 10), '2026-04-24');
});

test('handles different lender_id prefix lengths', () => {
  const d = parseEffectiveDateFromFilename('lender123_12012025_xyz.xlsx');
  assert.equal(d.toISOString().slice(0, 10), '2025-12-01');
});

test('returns null when no MMDDYYYY token is present', () => {
  assert.equal(parseEffectiveDateFromFilename('no-date-here.xlsx'), null);
  assert.equal(parseEffectiveDateFromFilename('1234567.xlsx'), null);
  assert.equal(parseEffectiveDateFromFilename(''), null);
  assert.equal(parseEffectiveDateFromFilename(null), null);
  assert.equal(parseEffectiveDateFromFilename(undefined), null);
});

test('rejects out-of-range month / day', () => {
  assert.equal(parseEffectiveDateFromFilename('67370_13012026_x.xlsx'), null); // month 13
  assert.equal(parseEffectiveDateFromFilename('67370_00012026_x.xlsx'), null); // month 00
  assert.equal(parseEffectiveDateFromFilename('67370_02302026_x.xlsx'), null); // Feb 30 (round-trip fails)
  assert.equal(parseEffectiveDateFromFilename('67370_04312026_x.xlsx'), null); // Apr 31
});

test('rejects out-of-range year', () => {
  assert.equal(parseEffectiveDateFromFilename('67370_04241850_x.xlsx'), null);
  assert.equal(parseEffectiveDateFromFilename('67370_04242200_x.xlsx'), null);
});

test('produces UTC midnight (no timezone drift)', () => {
  const d = parseEffectiveDateFromFilename('67370_04242026_x.xlsx');
  assert.equal(d.getUTCHours(), 0);
  assert.equal(d.getUTCMinutes(), 0);
  assert.equal(d.getUTCSeconds(), 0);
  assert.equal(d.getUTCMilliseconds(), 0);
});

test('matches the FIRST 8-digit token if multiple are present', () => {
  // Synthetic edge case — ensures regex is greedy-from-left, not last-match.
  const d = parseEffectiveDateFromFilename('67370_04242026_05012025.xlsx');
  assert.equal(d.toISOString().slice(0, 10), '2026-04-24');
});
