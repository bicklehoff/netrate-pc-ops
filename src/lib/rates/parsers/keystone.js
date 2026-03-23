/**
 * Keystone Funding Rate Sheet Parser
 *
 * Single XLSX file with one sheet ('Sheet1').
 * Layout: product sections in pairs (left cols 1-7, right cols 8-11),
 * each with a product name header, column labels, then rate rows.
 * Prices are 100-based (100 = par).
 *
 * Products: Conforming 30/20/15/10yr, High Balance 30/15yr,
 *           FHA/USDA 30/15 Standard & Streamline, FHA 30 HB Standard & Streamline,
 *           VA 30/15 Standard, VA 30 IRRRL, VA 30 Cashout, VA 30 HB Standard & IRRRL
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

const lenderId = 'keystone';

// Section definitions: row where product name appears, columns for left/right
// Each section has two products side by side
const SECTIONS = [
  // Conventional
  { startRow: 10, left: { name: 'Conforming 30 Year Fixed', id: 'conventional_30yr_fixed', loanType: 'conventional', term: 30 },
                  right: { name: 'Conforming 20 Year Fixed', id: 'conventional_20yr_fixed', loanType: 'conventional', term: 20 } },
  { startRow: 30, left: { name: 'Conforming 15 Year Fixed', id: 'conventional_15yr_fixed', loanType: 'conventional', term: 15 },
                  right: { name: 'Conforming 10 Year Fixed', id: 'conventional_10yr_fixed', loanType: 'conventional', term: 10 } },
  { startRow: 49, left: { name: 'High Balance 30 Year Fixed', id: 'conventional_30yr_fixed_highbal', loanType: 'conventional', term: 30, isHighBalance: true },
                  right: { name: 'High Balance 15 Year Fixed', id: 'conventional_15yr_fixed_highbal', loanType: 'conventional', term: 15, isHighBalance: true } },
  // FHA/USDA
  { startRow: 77, left: { name: 'FHA/USDA 30 Standard', id: 'fha_30yr_fixed', loanType: 'fha', term: 30 },
                  right: { name: 'FHA 15 Standard', id: 'fha_15yr_fixed', loanType: 'fha', term: 15 } },
  { startRow: 99, left: { name: 'FHA/USDA 30 Streamline', id: 'fha_30yr_fixed_streamline', loanType: 'fha', term: 30, isStreamline: true },
                  right: { name: 'FHA 15 Streamline', id: 'fha_15yr_fixed_streamline', loanType: 'fha', term: 15, isStreamline: true } },
  { startRow: 120, left: { name: 'FHA 30 HB Standard', id: 'fha_30yr_fixed_highbal', loanType: 'fha', term: 30, isHighBalance: true },
                   right: { name: 'FHA 30 HB Streamline', id: 'fha_30yr_fixed_highbal_streamline', loanType: 'fha', term: 30, isHighBalance: true, isStreamline: true } },
  // VA
  { startRow: 160, left: { name: 'VA 30 Standard', id: 'va_30yr_fixed', loanType: 'va', term: 30 },
                   right: { name: 'VA 15 Standard', id: 'va_15yr_fixed', loanType: 'va', term: 15 } },
  { startRow: 182, left: { name: 'VA 30 IRRRL', id: 'va_30yr_fixed_streamline', loanType: 'va', term: 30, isStreamline: true },
                   right: { name: 'VA 30 Cashout >90%', id: 'va_30yr_fixed_cashout', loanType: 'va', term: 30, variant: 'cashout' } },
  { startRow: 201, left: { name: 'VA 30 HB Standard', id: 'va_30yr_fixed_highbal', loanType: 'va', term: 30, isHighBalance: true },
                   right: { name: 'VA 30 HB IRRRL', id: 'va_30yr_fixed_highbal_streamline', loanType: 'va', term: 30, isHighBalance: true, isStreamline: true } },
];

// Lock period columns (0-indexed): left product uses cols 1-7, right uses cols 8-11+
// Header row has: Rate, 21-Day, 30-Day, 45-Day, 60-Day, 75-Day, 90-Day
const LEFT_LOCK_COLS = [
  { col: 2, days: 21 },
  { col: 3, days: 30 },
  { col: 4, days: 45 },
  { col: 5, days: 60 },
  { col: 6, days: 75 },
  { col: 7, days: 90 },
];

const RIGHT_LOCK_COLS = [
  { col: 9, days: 21 },
  { col: 10, days: 30 },
  { col: 11, days: 45 },
];

function cellVal(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return null;
  return cell.v;
}

function extractRates(ws, startRow, rateCol, lockCols, maxRows = 20) {
  const rates = [];
  // Data starts 2 rows after the section header (header row, then column labels, then data)
  const dataStart = startRow + 1; // 0-indexed; startRow is 1-indexed product name row

  for (let r = dataStart; r < dataStart + maxRows; r++) {
    const rate = cellVal(ws, r, rateCol);
    if (rate === null || typeof rate === 'string') continue;
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 3 || rateNum > 12) continue;

    for (const lc of lockCols) {
      const price = cellVal(ws, r, lc.col);
      if (price === null || typeof price === 'string') continue;
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 85 || priceNum > 115) continue;
      rates.push({ rate: rateNum, lockDays: lc.days, price: priceNum });
    }
  }

  return rates;
}

function makeProgramName(def) {
  const parts = [];
  switch (def.loanType) {
    case 'conventional': parts.push('Conventional'); break;
    case 'fha': parts.push('FHA'); break;
    case 'va': parts.push('VA'); break;
  }
  if (def.isStreamline) parts.push('Streamline');
  parts.push(`${def.term}yr Fixed`);
  if (def.isHighBalance) parts.push('High Balance');
  if (def.variant === 'cashout') parts.push('Cashout');
  return parts.join(' ');
}

function getCategory() {
  return 'agency';
}

function getSubcategory(def) {
  return def.loanType;
}

/**
 * Parse Keystone rate sheet XLSX.
 * @param {Buffer|ArrayBuffer} xlsxBuffer - raw XLSX file
 * @returns {{ sheetDate: string|null, programs: Array }}
 */
function parseRates(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const ws = wb.Sheets['Sheet1'];
  if (!ws) return { sheetDate: null, programs: [] };

  // No date in data — caller provides it from filename or manifest
  const sheetDate = null;

  const programs = [];

  for (const section of SECTIONS) {
    const headerRow = section.startRow - 1; // convert to 0-indexed

    // Left product
    const leftRates = extractRates(ws, headerRow + 1, 1, LEFT_LOCK_COLS);
    if (leftRates.length > 0) {
      const def = section.left;
      const lockDays = [...new Set(leftRates.map(r => r.lockDays))].sort((a, b) => a - b);
      programs.push({
        id: def.id,
        name: makeProgramName(def),
        category: getCategory(),
        subcategory: getSubcategory(def),
        loanType: def.loanType,
        term: def.term,
        productType: 'fixed',
        occupancy: 'primary',
        isHighBalance: def.isHighBalance || false,
        isStreamline: def.isStreamline || false,
        variant: def.variant || null,
        priceFormat: '100-based',
        rates: leftRates,
        lockDays,
      });
    }

    // Right product
    const rightRates = extractRates(ws, headerRow + 1, 8, RIGHT_LOCK_COLS);
    if (rightRates.length > 0) {
      const def = section.right;
      const lockDays = [...new Set(rightRates.map(r => r.lockDays))].sort((a, b) => a - b);
      programs.push({
        id: def.id,
        name: makeProgramName(def),
        category: getCategory(),
        subcategory: getSubcategory(def),
        loanType: def.loanType,
        term: def.term,
        productType: 'fixed',
        occupancy: 'primary',
        isHighBalance: def.isHighBalance || false,
        isStreamline: def.isStreamline || false,
        variant: def.variant || null,
        priceFormat: '100-based',
        rates: rightRates,
        lockDays,
      });
    }
  }

  return { sheetDate, programs };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
