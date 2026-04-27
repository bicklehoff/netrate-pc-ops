import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellStr, isNa, parseCell } from '../../../../../src/lib/pricing-nonqm/parsers/lib/cells.js';

test('cellStr coerces null/undefined/empty to ""', () => {
  assert.equal(cellStr(null), '');
  assert.equal(cellStr(undefined), '');
  assert.equal(cellStr(''), '');
});

test('cellStr trims whitespace', () => {
  assert.equal(cellStr('  hello  '), 'hello');
  assert.equal(cellStr('\tworld\n'), 'world');
});

test('cellStr stringifies numbers', () => {
  assert.equal(cellStr(42), '42');
  assert.equal(cellStr(0), '0');
  assert.equal(cellStr(-0.125), '-0.125');
});

test('isNa detects "NA" case-insensitively, with surrounding whitespace', () => {
  assert.equal(isNa('NA'), true);
  assert.equal(isNa('na'), true);
  assert.equal(isNa('Na'), true);
  assert.equal(isNa('  NA  '), true);
});

test('isNa detects "N/A" (Investor Premier convention) case-insensitively', () => {
  assert.equal(isNa('N/A'), true);
  assert.equal(isNa('n/a'), true);
  assert.equal(isNa('  N/A  '), true);
});

test('isNa rejects everything else', () => {
  assert.equal(isNa(''), false);
  assert.equal(isNa(null), false);
  assert.equal(isNa(undefined), false);
  assert.equal(isNa('0.5'), false);
  assert.equal(isNa(0), false);
  assert.equal(isNa('not available'), false);
  assert.equal(isNa('n.a.'), false);   // dots are not slashes
  assert.equal(isNa('n a'), false);    // space-separated not allowed
});

test('parseCell returns finite numbers as-is', () => {
  assert.equal(parseCell(0.25), 0.25);
  assert.equal(parseCell(0), 0);
  assert.equal(parseCell(-0.125), -0.125);
});

test('parseCell parses numeric strings (with surrounding whitespace)', () => {
  assert.equal(parseCell('0.25'), 0.25);
  assert.equal(parseCell(' -0.125 '), -0.125);
  assert.equal(parseCell('100'), 100);
});

test('parseCell returns null for null / undefined / empty / whitespace', () => {
  assert.equal(parseCell(null), null);
  assert.equal(parseCell(undefined), null);
  assert.equal(parseCell(''), null);
  assert.equal(parseCell('   '), null);
});

test('parseCell returns null for NA marker', () => {
  assert.equal(parseCell('NA'), null);
  assert.equal(parseCell('na'), null);
  assert.equal(parseCell(' NA '), null);
});

test('parseCell returns null for non-numeric strings', () => {
  assert.equal(parseCell('hello'), null);
  assert.equal(parseCell('0.25abc'), null);
});

test('parseCell returns null for non-finite numbers', () => {
  assert.equal(parseCell(NaN), null);
  assert.equal(parseCell(Infinity), null);
  assert.equal(parseCell(-Infinity), null);
});
