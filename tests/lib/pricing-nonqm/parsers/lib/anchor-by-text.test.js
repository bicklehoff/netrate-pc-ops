import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findRowByTextInCol,
  findCellByText,
} from '../../../../../src/lib/pricing-nonqm/parsers/lib/anchor-by-text.js';

const sample = [
  ['Header',           null,          null],
  ['Premier',          null,          null],
  [null,               'FICO Score',  '0-50'],
  ['780',              '0.000',       '0.125'],
  ['Misc Adjustments', null,          null],
  [null,               'note',        null],
];

test('findRowByTextInCol returns the matching row index', () => {
  assert.equal(findRowByTextInCol(sample, 0, /^Premier$/), 1);
  assert.equal(findRowByTextInCol(sample, 0, /^Misc Adjustments$/), 4);
  assert.equal(findRowByTextInCol(sample, 1, /^FICO Score$/), 2);
});

test('findRowByTextInCol returns -1 for no match', () => {
  assert.equal(findRowByTextInCol(sample, 0, /^Elite$/), -1);
});

test('findRowByTextInCol respects startRow', () => {
  // Misc lives at row 4; starting at row 5 finds nothing.
  assert.equal(findRowByTextInCol(sample, 0, /Misc/, { startRow: 5 }), -1);
  // Starting at row 4 still finds it.
  assert.equal(findRowByTextInCol(sample, 0, /Misc/, { startRow: 4 }), 4);
});

test('findRowByTextInCol respects endRow (exclusive)', () => {
  assert.equal(findRowByTextInCol(sample, 0, /Misc/, { endRow: 4 }), -1);
  assert.equal(findRowByTextInCol(sample, 0, /Misc/, { endRow: 5 }), 4);
});

test('findRowByTextInCol skips sparse rows safely', () => {
  const sparse = [null, undefined, ['Premier', null]];
  assert.equal(findRowByTextInCol(sparse, 0, /^Premier$/), 2);
});

test('findCellByText returns {row, col} of the first match across any column', () => {
  assert.deepEqual(findCellByText(sample, /^FICO Score$/), { row: 2, col: 1 });
  assert.deepEqual(findCellByText(sample, /^Premier$/), { row: 1, col: 0 });
});

test('findCellByText returns null for no match', () => {
  assert.equal(findCellByText(sample, /^Elite$/), null);
});

test('findCellByText respects startRow / endRow', () => {
  assert.equal(findCellByText(sample, /^Premier$/, { startRow: 2 }), null);
  assert.deepEqual(
    findCellByText(sample, /^Misc Adjustments$/, { endRow: 5 }),
    { row: 4, col: 0 }
  );
});

test('findCellByText handles sparse rows', () => {
  const sparse = [null, undefined, ['a', null, 'target']];
  assert.deepEqual(findCellByText(sparse, /target/), { row: 2, col: 2 });
});
