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
 * Also parses: LLPAs, Loan Amount Adjustments, State Adjustments, Spec Payups,
 *              Pricing Specials, Occupancy (Second Home / Investment) Adjustments
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

/**
 * Search for a row containing `text` in any of the given columns.
 * Returns the 0-indexed row number, or -1 if not found.
 */
function findRow(ws, text, { startRow = 0, endRow = 1500, cols = [0, 1, 2, 3, 4, 5, 6] } = {}) {
  const needle = String(text).toLowerCase().trim();
  for (let r = startRow; r <= endRow; r++) {
    for (const c of cols) {
      const v = cellVal(ws, r, c);
      if (v !== null && String(v).toLowerCase().trim().includes(needle)) {
        return r;
      }
    }
  }
  return -1;
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

// ---------------------------------------------------------------------------
// Helpers for adjustment parsing
// ---------------------------------------------------------------------------

/** Parse a loan amount string like "75,000 - 99,999" or "$475,001 - $500,000" */
function parseLoanRange(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).replace(/[$,]/g, '');
  const parts = s.split(/\s*-\s*/);
  if (parts.length !== 2) return null;
  const min = parseInt(parts[0].trim(), 10);
  const max = parseInt(parts[1].trim(), 10);
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
}

/** Normalize an LTV band header to short form, e.g. "<= 30.00%" -> "<=30" */
function normalizeLtvBand(str) {
  if (str === null || str === undefined) return null;
  return String(str)
    .replace(/\s+/g, '')
    .replace(/\.00/g, '')
    .replace(/%/g, '');
}

/** Check if a value is an LLPA number (not "NA" / "n/a" / null) */
function parseLlpa(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'na' || lower === 'n/a' || lower === '') return null;
    const n = parseFloat(lower);
    if (isNaN(n)) return null;
    if (n < -6 || n > 2) return null;
    // Negate: Keystone stores LLPAs as negative (cost to borrower),
    // but pricing engine expects positive = cost (GSE convention)
    return -n;
  }
  if (typeof val === 'number') {
    if (val < -6 || val > 2) return null;
    return -val;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

/**
 * Parse a single FICO/LTV LLPA matrix (purchase, refi, or cashout).
 * `headerRow` is the row with LTV band headers.
 * Returns { matrix: { ficoLabel: [values...] }, ltvBands: [...] }
 */
function parseLlpaMatrix(ws, headerRow) {
  // LTV band headers — col 1 is "FICO Range", data starts at col 2
  // Scan cols 2-11 (9 LTV bands: <=30 through 95.01-97)
  const ltvBands = [];
  for (let c = 2; c <= 11; c++) {
    const v = cellVal(ws, headerRow, c);
    if (v === null) continue;
    const band = normalizeLtvBand(v);
    if (band) ltvBands.push({ col: c, band });
  }
  if (ltvBands.length === 0) return null;

  const matrix = {};
  // Data rows follow immediately after header
  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    // FICO labels are in col 1 (col 0 is null in Keystone sheets)
    const ficoLabel = cellVal(ws, r, 1) || cellVal(ws, r, 0);
    if (ficoLabel === null) continue;
    const label = String(ficoLabel).trim();
    if (!label || label === '') continue;
    // Skip "< 620" or similar below-threshold rows
    if (label.startsWith('<') && !label.startsWith('<=')) continue;
    // Stop if we hit an empty row or a new section header
    if (label.toLowerCase().includes('llpa') || label.toLowerCase().includes('refinance') || label.toLowerCase().includes('cashout')) break;

    const values = ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
    // Only include rows that have at least one numeric value
    if (values.some(v => v !== null)) {
      // Normalize FICO key: "720 - 739" → "720-739" to match engine's getFicoBand()
      const normalizedLabel = label.replace(/\s*-\s*/g, '-');
      matrix[normalizedLabel] = values;
    }
  }

  return {
    matrix,
    ltvBands: ltvBands.map(lb => lb.band),
  };
}

/**
 * Parse all three LLPA matrices (purchase, refi, cashout).
 */
function parseLlpas(ws) {
  const purchaseRow = findRow(ws, 'Purchase - FICO/LTV', { startRow: 900, cols: [0, 1, 2, 3, 4, 5] });
  if (purchaseRow === -1) {
    // Try alternate header text
    const alt = findRow(ws, 'Purchase', { startRow: 900, cols: [0, 1, 2, 3, 4, 5] });
    if (alt === -1) return null;
  }

  const startSearch = purchaseRow !== -1 ? purchaseRow : 900;

  // Find the header rows for each matrix (2 rows after the section title)
  const purchaseHeaderRow = findRow(ws, 'FICO Range', { startRow: startSearch, endRow: startSearch + 5, cols: [0, 1] });
  if (purchaseHeaderRow === -1) return null;

  const purchaseResult = parseLlpaMatrix(ws, purchaseHeaderRow);
  if (!purchaseResult) return null;

  // Find refi section
  const refiRow = findRow(ws, 'Non Cashout Refinance', { startRow: purchaseHeaderRow + 5, endRow: purchaseHeaderRow + 30, cols: [0, 1, 2, 3, 4, 5] });
  let refinance = null;
  if (refiRow !== -1) {
    const refiHeaderRow = findRow(ws, 'FICO Range', { startRow: refiRow, endRow: refiRow + 5, cols: [0, 1] });
    if (refiHeaderRow !== -1) {
      refinance = parseLlpaMatrix(ws, refiHeaderRow);
    }
  }

  // Find cashout section
  const cashoutRow = findRow(ws, 'Cashout Refinance', { startRow: (refiRow !== -1 ? refiRow : purchaseHeaderRow) + 5, endRow: (refiRow !== -1 ? refiRow : purchaseHeaderRow) + 50, cols: [0, 1, 2, 3, 4, 5] });
  let cashout = null;
  if (cashoutRow !== -1) {
    const cashoutHeaderRow = findRow(ws, 'FICO Range', { startRow: cashoutRow, endRow: cashoutRow + 5, cols: [0, 1] });
    if (cashoutHeaderRow !== -1) {
      cashout = parseLlpaMatrix(ws, cashoutHeaderRow);
    }
  }

  return {
    purchase: purchaseResult.matrix,
    refinance: refinance ? refinance.matrix : {},
    cashout: cashout ? cashout.matrix : {},
    ltvBands: purchaseResult.ltvBands,
  };
}

/**
 * Parse Loan Amount Adjustments (right side of rate grid area, cols 15-19).
 */
function parseLoanAmountAdj(ws) {
  const headerRow = findRow(ws, 'Loan Amount Adjustments', { endRow: 50, cols: [15, 14, 13] });
  if (headerRow === -1) return [];

  const adjustments = [];
  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    const rangeStr = cellVal(ws, r, 15);
    if (rangeStr === null) continue;
    const range = parseLoanRange(rangeStr);
    if (!range) continue;

    // 20/25/30yr adjustment in col 18, 10/15yr in col 19
    const adj30 = cellVal(ws, r, 18);
    const adj15 = cellVal(ws, r, 19);
    if (adj30 === null && adj15 === null) continue;

    adjustments.push({
      min: range.min,
      max: range.max,
      adj30yr: typeof adj30 === 'number' ? adj30 : 0,
      adj15yr: typeof adj15 === 'number' ? adj15 : 0,
    });
  }

  return adjustments;
}

/**
 * Parse State Adjustments (right side of rate grid area, cols 15-19+).
 */
function parseStateAdj(ws) {
  const headerRow = findRow(ws, 'State Adjustments', { endRow: 50, cols: [15, 14, 13] });
  if (headerRow === -1) return {};

  const stateAdj = {};

  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    const stateStr = cellVal(ws, r, 15);
    if (stateStr === null) continue;
    const label = String(stateStr).trim();
    if (!label || label === '') continue;
    // Stop if we hit another section
    if (label.toLowerCase().includes('adjustment') || label.toLowerCase().includes('second home')) break;
    // Skip "SPECIAL - ..." rows — those are additive, handled separately
    if (label.toUpperCase().startsWith('SPECIAL')) continue;

    const adj30 = cellVal(ws, r, 18);
    const adj15 = cellVal(ws, r, 19);
    if (adj30 === null && adj15 === null) continue;

    // Split state codes on spaces
    const states = label.split(/\s+/).filter(s => /^[A-Z]{2}$/.test(s));
    for (const st of states) {
      stateAdj[st] = {
        adj30yr: typeof adj30 === 'number' ? adj30 : 0,
        adj15yr: typeof adj15 === 'number' ? adj15 : 0,
      };
    }

    // Check col 20 for "State Special" entries (extra states with a single value)
    const specialStates = cellVal(ws, r, 20);
    const specialVal = cellVal(ws, r, 21);
    if (specialStates !== null && specialVal !== null) {
      // Could be "NC, SC, TN" or "NC SC TN"
      const specStates = String(specialStates).split(/[\s,]+/).filter(s => /^[A-Z]{2}$/.test(s));
      for (const st of specStates) {
        stateAdj[st] = {
          adj30yr: typeof specialVal === 'number' ? specialVal : 0,
          adj15yr: typeof specialVal === 'number' ? specialVal : 0,
        };
      }
    }
  }

  return stateAdj;
}

/**
 * Parse a single spec payup grid (one product type).
 * `productRow` is the row with the product name, e.g. "Conforming 30 Year Fixed".
 * Returns { loanAmtBuckets: [...], byRate: {...} } or null.
 */
function parseSpecPayupGrid(ws, productRow) {
  // Header row is the next row after product name
  const headerRow = productRow + 1;

  // Col 1 = "Rate", cols 2-19 = loan amount buckets
  const loanAmtBuckets = [];
  for (let c = 2; c <= 25; c++) {
    const v = cellVal(ws, headerRow, c);
    if (v === null) break;
    const range = parseLoanRange(v);
    if (!range) continue;
    loanAmtBuckets.push({ min: range.min, max: range.max, col: c });
  }
  if (loanAmtBuckets.length === 0) return null;

  // Data rows follow header
  const byRate = {};
  for (let r = headerRow + 1; r < headerRow + 30; r++) {
    const rateVal = cellVal(ws, r, 1);
    if (rateVal === null) continue;
    const rateNum = typeof rateVal === 'number' ? rateVal : parseFloat(String(rateVal));
    if (isNaN(rateNum) || rateNum < 3 || rateNum > 12) continue;

    const rateKey = rateNum.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    const values = loanAmtBuckets.map(b => {
      const v = cellVal(ws, r, b.col);
      return typeof v === 'number' ? v : null;
    });

    // Only include rows with at least one value
    if (values.some(v => v !== null)) {
      byRate[rateKey] = values;
    }
  }

  return { loanAmtBuckets, byRate };
}

/**
 * Parse all spec payup sections.
 */
function parseSpecPayups(ws) {
  const specRow = findRow(ws, 'SPEC PAYUPS', { startRow: 800, cols: [0, 1, 2] });
  if (specRow === -1) return {};

  const result = {};

  // Search for each product grid within the spec payups area
  const searchEnd = specRow + 150;

  // Conforming 30
  const conv30Row = findRow(ws, 'Conforming 30 Year Fixed', { startRow: specRow, endRow: searchEnd, cols: [0, 1] });
  if (conv30Row !== -1) {
    const grid = parseSpecPayupGrid(ws, conv30Row);
    if (grid) result.conv30 = grid;
  }

  // FHA 30
  const fha30Row = findRow(ws, 'FHA 30 Year Fixed', { startRow: specRow, endRow: searchEnd, cols: [0, 1] });
  if (fha30Row !== -1) {
    const grid = parseSpecPayupGrid(ws, fha30Row);
    if (grid) result.fha30 = grid;
  }

  // VA 30
  const va30Row = findRow(ws, 'VA 30 Year Fixed', { startRow: specRow, endRow: searchEnd, cols: [0, 1] });
  if (va30Row !== -1) {
    const grid = parseSpecPayupGrid(ws, va30Row);
    if (grid) result.va30 = grid;
  }

  return result;
}

/**
 * Parse Pricing Specials section.
 */
function parsePricingSpecials(ws) {
  const headerRow = findRow(ws, 'Pricing Specials', { startRow: 900, cols: [0, 1, 2, 3, 4, 5] });
  if (headerRow === -1) return null;

  // LTV band header row is 2 rows after section header
  const ltvHeaderRow = headerRow + 2;

  // Find LTV columns (typically cols 6-12 or similar)
  const ltvCols = [];
  for (let c = 2; c <= 20; c++) {
    const v = cellVal(ws, ltvHeaderRow, c);
    if (v !== null) {
      const band = normalizeLtvBand(v);
      if (band && (band.includes('<') || band.includes('>') || band.includes('-') || /\d/.test(band))) {
        ltvCols.push(c);
      }
    }
  }
  if (ltvCols.length === 0) return null;

  function readSpecialRow(r) {
    return ltvCols.map(c => {
      const v = cellVal(ws, r, c);
      return typeof v === 'number' ? v : 0;
    });
  }

  const result = {};

  // Scan the rows after the LTV header for named specials
  for (let r = ltvHeaderRow + 1; r < ltvHeaderRow + 10; r++) {
    // Check cols 0-5 for the label
    let label = null;
    for (let c = 0; c <= 5; c++) {
      const v = cellVal(ws, r, c);
      if (v !== null && typeof v === 'string' && v.trim().length > 0) {
        label = v.trim().toLowerCase();
        break;
      }
    }
    if (!label) continue;

    if (label.includes('purchase') && label.includes('special')) {
      result.purchaseSpecial = readSpecialRow(r);
    } else if (label.includes('refinance') && label.includes('special')) {
      result.refinanceSpecial = readSpecialRow(r);
    } else if (label.includes('buydown')) {
      result.tempBuydown = readSpecialRow(r);
    } else if (label.includes('escrow')) {
      result.escrowWaiver = readSpecialRow(r);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Parse Second Home and Investment LTV Adjustments.
 */
function parseOccupancyAdj(ws) {
  const headerRow = findRow(ws, 'Second Home', { endRow: 60, cols: [15, 14, 13, 0, 1, 2] });
  if (headerRow === -1) return null;

  // LTV band headers on the row after the section label
  const ltvHeaderRow = headerRow + 1;

  // Find LTV band columns
  const ltvCols = [];
  const ltvBands = [];
  for (let c = 15; c <= 25; c++) {
    const v = cellVal(ws, ltvHeaderRow, c);
    if (v !== null) {
      const band = normalizeLtvBand(v);
      if (band) {
        ltvCols.push(c);
        ltvBands.push(band);
      }
    }
  }

  // If not found in cols 15+, try starting from col 0
  if (ltvCols.length === 0) {
    for (let c = 0; c <= 15; c++) {
      const v = cellVal(ws, ltvHeaderRow, c);
      if (v !== null) {
        const band = normalizeLtvBand(v);
        if (band && (band.includes('-') || band.includes('>') || band.includes('<') || /\d/.test(band))) {
          ltvCols.push(c);
          ltvBands.push(band);
        }
      }
    }
  }

  if (ltvCols.length === 0) return null;

  let secondHome = null;
  let investment = null;

  for (let r = ltvHeaderRow + 1; r < ltvHeaderRow + 5; r++) {
    // Check multiple cols for the label
    let label = null;
    for (let c = Math.max(0, ltvCols[0] - 3); c <= ltvCols[0]; c++) {
      const v = cellVal(ws, r, c);
      if (v !== null && typeof v === 'string' && v.trim().length > 0) {
        label = v.trim().toLowerCase();
        break;
      }
    }
    if (!label) continue;

    const values = ltvCols.map(c => {
      const v = cellVal(ws, r, c);
      return typeof v === 'number' ? v : 0;
    });

    if (label.includes('second')) {
      secondHome = values;
    } else if (label.includes('investment')) {
      investment = values;
    }
  }

  if (!secondHome && !investment) return null;

  return {
    secondHome: secondHome || [],
    investment: investment || [],
    ltvBands,
  };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse Keystone rate sheet XLSX.
 * @param {Buffer|ArrayBuffer} xlsxBuffer - raw XLSX file
 * @returns {{ sheetDate: string|null, programs: Array, llpas, loanAmountAdj, stateAdj, specPayups, pricingSpecials, occupancyAdj, lenderFee: number }}
 */
function parseRates(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const ws = wb.Sheets['Sheet1'];
  if (!ws) return { sheetDate: null, programs: [], llpas: null, loanAmountAdj: [], stateAdj: {}, specPayups: {}, pricingSpecials: null, occupancyAdj: null, lenderFee: 1125 };

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

  // Parse adjustment sections
  const llpas = parseLlpas(ws);
  const loanAmountAdj = parseLoanAmountAdj(ws);
  const stateAdj = parseStateAdj(ws);
  const specPayups = parseSpecPayups(ws);
  const pricingSpecials = parsePricingSpecials(ws);
  const occupancyAdj = parseOccupancyAdj(ws);

  return {
    sheetDate,
    programs,
    llpas,
    loanAmountAdj,
    stateAdj,
    specPayups,
    pricingSpecials,
    occupancyAdj,
    lenderFee: 1125,
    compCap: { purchase: 3595, refinance: 3595 },
  };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
