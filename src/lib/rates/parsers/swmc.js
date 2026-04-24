/**
 * SWMC (Sun West Mortgage Company) Rate Sheet Parser
 *
 * Single XLSX with one sheet ('RATESHEET'). 4,400+ rows.
 * Layout: product sections in triples (3 products side-by-side per row block).
 * Section headers are text rows naming the product, then Rate/30Day/45Day/60Day columns.
 * Raw prices are discount/rebate format (positive = cost, negative = rebate).
 * Parser converts to 100-based on output so the pricing engine works uniformly.
 *
 * Products: Gov (FHA/USDA/VA standard, streamline, jumbo, cashout, ARM),
 *           Agency Conforming (30/20/15/10yr, 5/6/7/6/10/6 ARM, HB, HomeReady, Investment, Super Conforming),
 *           Home Possible, HomeOne, Freddie Mac products,
 *           HECM (reverse), DPA, Non-QM (full doc, alt doc, DSCR), Jumbo AUS, Prime Jumbo,
 *           Medical Professional, HELOC
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

const lenderId = 'swmc';

function cellVal(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return null;
  return cell.v;
}

function cellStr(ws, r, c) {
  const v = cellVal(ws, r, c);
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Scan the sheet for section headers and extract rate blocks.
 * A section header is a text string in column B naming the product.
 * The row after is the column header (Rate, 30 Day, 45 Day, 60 Day).
 * Data rows follow until a blank row or next section.
 *
 * Products appear in triples: cols B-E, cols G-J, cols L-O (0-indexed: 1-4, 6-9, 11-14)
 */

// Product header patterns to detect
const SECTION_PATTERNS = [
  // Government
  { pattern: /^FHA\s*\/\s*USDA\s+30\s+YR\s+FIXED$/i, id: 'fha_30yr_fixed', loanType: 'fha', term: 30 },
  { pattern: /^FHA\s+15\s+YR\s+FIXED$/i, id: 'fha_15yr_fixed', loanType: 'fha', term: 15 },
  { pattern: /^VA\s+30\s+YR\s+FIXED$/i, id: 'va_30yr_fixed', loanType: 'va', term: 30 },
  { pattern: /^VA\s+15\s+YR\s+FIXED$/i, id: 'va_15yr_fixed', loanType: 'va', term: 15 },
  { pattern: /^FHA\s+JUMBO\s+30\s+YR\s+FIXED$/i, id: 'fha_30yr_fixed_highbal', loanType: 'fha', term: 30, isHighBalance: true },
  { pattern: /^FHA\s+JUMBO\s+15\s+YR\s+FIXED$/i, id: 'fha_15yr_fixed_highbal', loanType: 'fha', term: 15, isHighBalance: true },
  { pattern: /^VA\s+JUMBO\s+30\s+YR\s+FIXED$/i, id: 'va_30yr_fixed_highbal', loanType: 'va', term: 30, isHighBalance: true },
  { pattern: /^VA\s+HIGH\s+LTV\s+CASHOUT.*30\s+YR/i, id: 'va_30yr_fixed_cashout', loanType: 'va', term: 30, variant: 'cashout' },

  // Conforming
  { pattern: /^CONFORMING\s+30\s+YR\s+FIXED/i, id: 'conventional_30yr_fixed', loanType: 'conventional', term: 30 },
  { pattern: /^CONFORMING\s+20\s+YR\s+FIXED$/i, id: 'conventional_20yr_fixed', loanType: 'conventional', term: 20 },
  { pattern: /^CONFORMING\s+15\s+YR\s+FIXED$/i, id: 'conventional_15yr_fixed', loanType: 'conventional', term: 15 },
  { pattern: /^CONFORMING\s+10\s+YR\s+FIXED$/i, id: 'conventional_10yr_fixed', loanType: 'conventional', term: 10 },
  { pattern: /^CONFORMING\s+HIGH\s+BAL\s+30\s+YR\s+FIXED/i, id: 'conventional_30yr_fixed_highbal', loanType: 'conventional', term: 30, isHighBalance: true },
  { pattern: /^CONFORMING\s+HIGH\s+BAL\s+15\s+YR\s+FIXED/i, id: 'conventional_15yr_fixed_highbal', loanType: 'conventional', term: 15, isHighBalance: true },
  { pattern: /^HOMEREADY\s+30\s+YR\s+FIXED$/i, id: 'conventional_30yr_fixed_homeready', loanType: 'conventional', term: 30, variant: 'homeready' },
  { pattern: /^CONFORMING.*INVESTMENT/i, id: 'conventional_30yr_fixed_investment', loanType: 'conventional', term: 30, occupancy: 'investment' },
  { pattern: /^SUPER\s+CONFORMING\s+30\s+YR\s+FIXED/i, id: 'conventional_30yr_fixed_super', loanType: 'conventional', term: 30, variant: 'super-conforming' },

  // Freddie
  { pattern: /^HOME\s+POSSIBLE\s+30\s+YR\s+FIXED$/i, id: 'conventional_30yr_fixed_homepossible', loanType: 'conventional', term: 30, variant: 'homepossible' },
  { pattern: /^HOME\s+POSSIBLE\s+20\s+YR\s+FIXED$/i, id: 'conventional_20yr_fixed_homepossible', loanType: 'conventional', term: 20, variant: 'homepossible' },
  { pattern: /^HOME\s+POSSIBLE\s+15\s+YR\s+FIXED$/i, id: 'conventional_15yr_fixed_homepossible', loanType: 'conventional', term: 15, variant: 'homepossible' },
  { pattern: /^HOMEONE\s+30\s+YR\s+FIXED$/i, id: 'conventional_30yr_fixed_homeone', loanType: 'conventional', term: 30, variant: 'homeone' },

  // ARM patterns
  { pattern: /^CONFORMING\s*\n?\s*5\/6\s+ARM/i, id: 'conventional_30yr_arm_5-6', loanType: 'conventional', term: 30, productType: 'arm', armStructure: '5/6' },
  { pattern: /^CONFORMING\s*\n?\s*7\/6\s+ARM/i, id: 'conventional_30yr_arm_7-6', loanType: 'conventional', term: 30, productType: 'arm', armStructure: '7/6' },
  { pattern: /^CONFORMING\s*\n?\s*10\/6\s+ARM/i, id: 'conventional_30yr_arm_10-6', loanType: 'conventional', term: 30, productType: 'arm', armStructure: '10/6' },
  { pattern: /^FHA\s+5\/1\s+ARM/i, id: 'fha_30yr_arm_5-1', loanType: 'fha', term: 30, productType: 'arm', armStructure: '5/1' },
  { pattern: /^VA\s+5\/1\s+ARM/i, id: 'va_30yr_arm_5-1', loanType: 'va', term: 30, productType: 'arm', armStructure: '5/1' },

  // Jumbo
  { pattern: /^30\s+YR\s+FIXED$/i, id: null, loanType: null, term: 30 }, // context-dependent
  { pattern: /^15\s+YR\s+FIXED$/i, id: null, loanType: null, term: 15 },

  // Non-QM
  { pattern: /^30\s+YR\s+FIXED\s*-\s*FULL\s+DOC$/i, id: 'nonqm_30yr_fixed_fulldoc', loanType: 'nonqm', term: 30, category: 'nonqm', subcategory: 'nonqm', docType: 'full' },
  { pattern: /^30\s+YR\s+FIXED\s*-\s*ALT\s+DOC$/i, id: 'nonqm_30yr_fixed_altdoc', loanType: 'nonqm', term: 30, category: 'nonqm', subcategory: 'bankstatement', docType: 'alt' },
  { pattern: /^30\s+YR\s+FIXED\s*-\s*DSCR$/i, id: 'nonqm_30yr_fixed_dscr', loanType: 'dscr', term: 30, category: 'nonqm', subcategory: 'dscr', docType: 'dscr' },

  // HELOC
  { pattern: /^VM:\s*HELOC$/i, id: 'heloc', loanType: 'heloc', category: 'other', subcategory: 'heloc' },
  { pattern: /^HELOC\s+DSCR/i, id: 'heloc_dscr', loanType: 'heloc', category: 'other', subcategory: 'heloc', docType: 'dscr' },

  // Medical Professional
  { pattern: /^NON-CONFORMING\s*-\s*MEDICAL\s+PROFESSIONAL$/i, id: 'jumbo_medical', loanType: 'conventional', category: 'agency', subcategory: 'jumbo', variant: 'medical' },
];

/**
 * Extract rate data from a block of rows. Tries 3 column groups (triples layout).
 * Returns array of { productHeader, rates[] } for each column group that has data.
 */
function extractTripleBlock(ws, headerRow, maxDataRows = 28) {
  const results = [];

  // Three column groups: (1,2,3,4), (6,7,8,9), (11,12,13,14)
  const groups = [
    { nameCol: 1, rateCol: 1, lockCols: [{ col: 2, days: 30 }, { col: 3, days: 45 }, { col: 4, days: 60 }] },
    { nameCol: 6, rateCol: 6, lockCols: [{ col: 7, days: 30 }, { col: 8, days: 45 }, { col: 9, days: 60 }] },
    { nameCol: 11, rateCol: 11, lockCols: [{ col: 12, days: 30 }, { col: 13, days: 45 }, { col: 14, days: 60 }] },
  ];

  for (const group of groups) {
    const productName = cellStr(ws, headerRow, group.nameCol);
    if (!productName) continue;

    const rates = [];
    // Data starts 2 rows after header (column labels row, then data)
    for (let r = headerRow + 2; r < headerRow + 2 + maxDataRows; r++) {
      const rate = cellVal(ws, r, group.rateCol);
      if (rate === null || typeof rate === 'string') {
        if (rates.length > 0) break; // end of data block
        continue;
      }
      const rateNum = parseFloat(rate);
      if (isNaN(rateNum) || rateNum < 3 || rateNum > 12) continue;

      for (const lc of group.lockCols) {
        const price = cellVal(ws, r, lc.col);
        if (price === null || typeof price === 'string') continue;
        const priceNum = parseFloat(price);
        if (isNaN(priceNum)) continue;
        // Discount format: values range from about -6 to +7
        if (priceNum < -10 || priceNum > 15) continue;
        // Convert discount → 100-based (positive discount = cost → below par)
        rates.push({ rate: rateNum, lockDays: lc.days, price: 100 - priceNum });
      }
    }

    if (rates.length > 0) {
      results.push({ productName, rates });
    }
  }

  return results;
}

function matchProduct(name) {
  const cleaned = name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  for (const sp of SECTION_PATTERNS) {
    if (sp.pattern.test(cleaned)) {
      return sp;
    }
  }
  return null;
}

function makeProgramName(match, rawName) {
  if (!match) return rawName;
  const parts = [];
  switch (match.loanType) {
    case 'conventional': parts.push('Conventional'); break;
    case 'fha': parts.push('FHA'); break;
    case 'va': parts.push('VA'); break;
    case 'usda': parts.push('USDA'); break;
    case 'dscr': parts.push('DSCR'); break;
    case 'nonqm': parts.push('Non-QM'); break;
    case 'heloc': parts.push('HELOC'); break;
    default: parts.push(match.loanType || 'Unknown');
  }
  if (match.isStreamline) parts.push('Streamline');
  if (match.term) parts.push(`${match.term}yr`);
  if (match.productType === 'arm' && match.armStructure) {
    parts.push(`${match.armStructure} ARM`);
  } else {
    parts.push('Fixed');
  }
  if (match.isHighBalance) parts.push('High Balance');
  if (match.variant) {
    const v = match.variant.charAt(0).toUpperCase() + match.variant.slice(1);
    parts.push(v);
  }
  if (match.docType) parts.push(`(${match.docType})`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Adjustment parsing helpers
// ---------------------------------------------------------------------------

function findRow(ws, text, { startRow = 0, endRow = 4500, cols = [0, 1, 2, 3] } = {}) {
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

function normalizeLtvBand(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/\s+/g, '').replace(/\.00/g, '').replace(/%/g, '');
  if (s === 'N/A' || s === 'NA') return null;
  return s;
}

/** Parse LLPA value. SWMC uses positive = cost (matches engine convention). */
function parseLlpa(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'na' || lower === 'n/a' || lower === '' || lower === '-') return null;
    const n = parseFloat(lower);
    if (isNaN(n)) return null;
    return n; // positive = cost, no negation needed
  }
  if (typeof val === 'number') return val;
  return null;
}

/**
 * Parse a FICO/LTV grid from the Agency Conforming section.
 * FICO labels in col 1, LTV bands in cols 10-18.
 */
function parseAgencyLlpaMatrix(ws, headerRow) {
  const ltvBands = [];
  for (let c = 10; c <= 18; c++) {
    const v = cellVal(ws, headerRow, c);
    if (v === null) continue;
    const band = normalizeLtvBand(v);
    if (band) ltvBands.push({ col: c, band });
  }
  if (ltvBands.length === 0) return null;

  const matrix = {};
  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    const ficoLabel = cellVal(ws, r, 1);
    if (ficoLabel === null) continue;
    const label = String(ficoLabel).trim();
    if (!label || !/\d/.test(label)) continue;
    if (/other\s*adj|purchase|refinance|cashout|product/i.test(label)) break;

    const values = ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
    if (values.some(v => v !== null)) {
      // Normalize: "760 - 779" → "760-779", ">= 780" → ">=780"
      const normalized = label.replace(/\s*[-–]\s*/g, '-').replace(/>=\s*/g, '>=').replace(/<=\s*/g, '<=').replace(/\s+/g, '');
      matrix[normalized] = values;
    }
  }

  return { matrix, ltvBands: ltvBands.map(lb => lb.band) };
}

/**
 * Parse "Other Adjustments" grid (ARM, Condo, Investment, etc.)
 * Same column layout as FICO/LTV grids — FICO label col 1, values cols 10-18.
 */
function parseOtherAdjGrid(ws, headerRow, numLtvCols) {
  const additional = {};
  for (let r = headerRow + 1; r < headerRow + 18; r++) {
    const label = cellStr(ws, r, 1);
    if (!label) continue;
    if (/fico\s*\/\s*ltv|purchase|refinance|cashout|all\s*loan\s*terms|lpmi|minimum\s*mi/i.test(label)) break;

    const values = [];
    for (let c = 10; c < 10 + numLtvCols; c++) {
      values.push(parseLlpa(cellVal(ws, r, c)));
    }

    const key = label.toLowerCase();
    if (/^arm$/i.test(key.trim())) additional.arm = values;
    else if (/condo/i.test(key)) additional.condo = values;
    else if (/investment/i.test(key)) additional.investment = values;
    else if (/second\s*home/i.test(key)) additional.secondHome = values;
    else if (/manufactured/i.test(key)) additional.manufactured = values;
    else if (/2\s*-\s*4\s*unit/i.test(key)) additional['2to4unit'] = values;
    else if (/high\s*bal.*fixed.*<=\s*15|high\s*bal.*15/i.test(key)) additional.highBalFixed15 = values;
    else if (/high\s*bal.*fixed.*>\s*15|high\s*bal.*fixed/i.test(key)) additional.highBalFixed = values;
    else if (/high\s*bal.*arm/i.test(key)) additional.highBalArm = values;
    else if (/subordinate|sub\s*fin/i.test(key)) additional.subFinancing = values;
    else if (/owner\s*occ.*2\s*-\s*4/i.test(key)) additional.oo2to4unit = values;
    else if (/dti\s*>\s*40/i.test(key)) additional.dtiOver40 = values;
  }
  return additional;
}

/**
 * Parse Agency Conforming LLPAs — 3 FICO/LTV grids + 3 additional adj grids + all-terms adj.
 */
function parseAgencyConformingAdj(ws) {
  const result = {
    ficoLtvGrids: { purchase: {}, refinance: {}, cashout: {} },
    additionalAdjustments: { purchase: {}, refinance: {}, cashout: {} },
    ltvBuckets: { purchaseRefi: [], cashout: [] },
    stateAdj: {},
    allTermsAdj: {},
  };

  // Purchase FICO/LTV grid
  const purchaseRow = findRow(ws, 'FICO / LTV (%), Purchase Transaction', { startRow: 1310, endRow: 1330, cols: [1] });
  if (purchaseRow !== -1) {
    const grid = parseAgencyLlpaMatrix(ws, purchaseRow);
    if (grid) {
      result.ficoLtvGrids.purchase = grid.matrix;
      result.ltvBuckets.purchaseRefi = grid.ltvBands;
    }
  }

  // Purchase Other Adjustments
  const purchOtherRow = findRow(ws, 'Other Adjustments / LTV (%), Purchase Transaction', { startRow: 1340, endRow: 1360, cols: [1] });
  if (purchOtherRow !== -1) {
    result.additionalAdjustments.purchase = parseOtherAdjGrid(ws, purchOtherRow, result.ltvBuckets.purchaseRefi.length);
  }

  // Limited Cashout Refi FICO/LTV grid
  const refiRow = findRow(ws, 'FICO / LTV (%), Limited Cashout', { startRow: 1370, endRow: 1390, cols: [1] });
  if (refiRow !== -1) {
    const grid = parseAgencyLlpaMatrix(ws, refiRow);
    if (grid) result.ficoLtvGrids.refinance = grid.matrix;
  }

  // Refi Other Adjustments
  const refiOtherRow = findRow(ws, 'Other Adjustments / LTV (%), Limited Cashout', { startRow: 1400, endRow: 1420, cols: [1] });
  if (refiOtherRow !== -1) {
    result.additionalAdjustments.refinance = parseOtherAdjGrid(ws, refiOtherRow, result.ltvBuckets.purchaseRefi.length);
  }

  // Cashout Refi FICO/LTV grid
  const cashoutRow = findRow(ws, 'FICO / LTV (%), Cashout Refinance', { startRow: 1430, endRow: 1450, cols: [1] });
  if (cashoutRow !== -1) {
    const grid = parseAgencyLlpaMatrix(ws, cashoutRow);
    if (grid) {
      result.ficoLtvGrids.cashout = grid.matrix;
      result.ltvBuckets.cashout = grid.ltvBands;
    }
  }

  // Cashout Other Adjustments
  const cashoutOtherRow = findRow(ws, 'Other Adjustments / LTV (%), Cashout Refinance', { startRow: 1460, endRow: 1480, cols: [1] });
  if (cashoutOtherRow !== -1) {
    result.additionalAdjustments.cashout = parseOtherAdjGrid(ws, cashoutOtherRow, result.ltvBuckets.cashout.length || result.ltvBuckets.purchaseRefi.length);
  }

  // All loan terms adjustments — state LLPAs are here
  const allTermsRow = findRow(ws, 'Other Adjustments / LTV (%), All loan terms', { startRow: 1488, endRow: 1500, cols: [1] });
  if (allTermsRow !== -1) {
    for (let r = allTermsRow + 1; r < allTermsRow + 30; r++) {
      const label = cellStr(ws, r, 1);
      if (!label) continue;
      if (/lpmi\s*coverage|loan\s*amount\s*price/i.test(label)) break;

      // State LLPAs
      const stateMatch = label.match(/Properties\s+located\s+in\s+(\w{2})/i);
      if (stateMatch) {
        const st = stateMatch[1].toUpperCase();
        // Read value from col 10 (flat value, same across all LTV bands)
        const val = parseLlpa(cellVal(ws, r, 10));
        if (val !== null) {
          result.stateAdj[st] = { adj30yr: val, adj15yr: val };
        }
        continue;
      }

      // Other all-terms adjustments
      const values = [];
      for (let c = 10; c < 10 + result.ltvBuckets.purchaseRefi.length; c++) {
        values.push(parseLlpa(cellVal(ws, r, c)));
      }
      if (values.some(v => v !== null)) {
        const key = label.toLowerCase().replace(/,.*$/, '').trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.allTermsAdj[key] = values;
      }
    }
  }

  return result;
}

/**
 * Parse Government Program Price Adjustments (3 sub-tables side by side at row 896).
 */
function parseGovAdjustments(ws) {
  const headerRow = findRow(ws, 'GOVERNMENT PROGRAM PRICE ADJUSTMENTS', { startRow: 890, endRow: 910, cols: [1] });
  if (headerRow === -1) return null;

  const result = {
    ficoAdj: {},
    programAdj: {},
    stateAdj: {},
    propertyAdj: {},
    otherAdj: {},
    loanAmtAdj: [],
  };

  // Left table: col 1 = label, col 7 = value (FICO + program adjustments)
  for (let r = headerRow + 1; r < headerRow + 16; r++) {
    const label = cellStr(ws, r, 1);
    if (!label) continue;
    if (/construction|applies\s+to/i.test(label)) continue;

    const val = parseLlpa(cellVal(ws, r, 7));

    // FICO adjustments
    const ficoMatch = label.match(/FICO\s*(>=?|=>|<=?|)\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
    if (ficoMatch && val !== null) {
      let normalized;
      if (ficoMatch[3]) {
        normalized = `${ficoMatch[2]}-${ficoMatch[3]}`;
      } else if (ficoMatch[1]) {
        normalized = `${ficoMatch[1].replace(/\s/g, '').replace('=>', '>=')}${ficoMatch[2]}`;
      } else {
        normalized = ficoMatch[2];
      }
      result.ficoAdj[normalized] = val;
      continue;
    }

    // Non-Traditional Credit
    if (/non.*traditional/i.test(label) && val !== null) {
      result.ficoAdj['NTC'] = val;
      continue;
    }

    // Program adjustments
    if (val !== null) {
      const key = label.toLowerCase().replace(/[*]/g, '').trim().replace(/\s+/g, '_').replace(/[^a-z0-9_/]/g, '');
      result.programAdj[key] = val;
    }

    // Loan amount (special case — value at col 9)
    if (/loan\s*amount/i.test(label)) {
      const laVal = parseLlpa(cellVal(ws, r, 9));
      if (laVal !== null) {
        const amtMatch = label.match(/<=?\s*\$?([\d,]+)/i);
        if (amtMatch) {
          const max = parseInt(amtMatch[1].replace(/,/g, ''), 10);
          result.loanAmtAdj.push({ min: 0, max, adj30yr: laVal, adj15yr: laVal });
        }
      }
    }
  }

  // Middle table: col 9 = label, col 15 = value (state + property adjustments)
  for (let r = headerRow + 1; r < headerRow + 14; r++) {
    const label = cellStr(ws, r, 9);
    if (!label) continue;

    const val = parseLlpa(cellVal(ws, r, 15));
    if (val === null) continue;

    // State adjustments
    const stateMatch = label.match(/Properties\s+(?:located\s+)?in\s+(\w{2})/i);
    if (stateMatch) {
      result.stateAdj[stateMatch[1].toUpperCase()] = { adj30yr: val, adj15yr: val };
      continue;
    }

    // Property/purpose adjustments
    const key = label.toLowerCase().replace(/[*]/g, '').trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    result.propertyAdj[key] = val;
  }

  // Right table: col 17 = label, col 19 = value
  for (let r = headerRow + 1; r < headerRow + 12; r++) {
    const label = cellStr(ws, r, 17);
    if (!label) continue;

    const val = parseLlpa(cellVal(ws, r, 19));
    if (val === null) continue;

    const key = label.toLowerCase().replace(/[*]/g, '').trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    result.otherAdj[key] = val;
  }

  return result;
}

/**
 * Parse UW Fees and promos from header area.
 */
function parseFees(ws) {
  const result = {
    uwFee: 1195,
    streamlineFee: 625,
    nqmFee: 1299,
    portfolioFee: 795,
    portfolioStreamlineFee: 425,
    txAttorneyPurchase: 0,
    txAttorneyRefi: 0,
    promos: [],
  };

  // Attorney fees for TX
  const txPurchVal = parseLlpa(cellVal(ws, 8, 19));
  if (txPurchVal !== null) result.txAttorneyPurchase = txPurchVal;
  const txRefiVal = parseLlpa(cellVal(ws, 9, 19));
  if (txRefiVal !== null) result.txAttorneyRefi = txRefiVal;

  // March promo
  const promoStr = cellStr(ws, 18, 9);
  if (promoStr && /promo/i.test(promoStr)) {
    const bpsMatch = promoStr.match(/(\d+)\s*basis\s*points?\s*\(?([\d.]+)\)?/i);
    if (bpsMatch) {
      result.promos.push({
        label: promoStr.substring(0, 80),
        bps: parseInt(bpsMatch[1], 10),
        points: parseFloat(bpsMatch[2]),
        type: 'conventional',
      });
    }
  }

  const fhaPromoStr = cellStr(ws, 22, 9);
  if (fhaPromoStr && /special/i.test(fhaPromoStr)) {
    const bpsMatch = fhaPromoStr.match(/(\d+)\s*basis\s*points?\s*\(?([\d.]+)\)?/i);
    if (bpsMatch) {
      result.promos.push({
        label: fhaPromoStr.substring(0, 80),
        bps: parseInt(bpsMatch[1], 10),
        points: parseFloat(bpsMatch[2]),
        type: 'fha_usda',
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse SWMC rate sheet XLSX.
 * @param {Buffer|ArrayBuffer} xlsxBuffer - raw XLSX file
 * @returns full parsed result with programs + all adjustment data
 */
function parseRates(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const ws = wb.Sheets['RATESHEET'];
  if (!ws) return { sheetDate: null, programs: [] };

  // Extract date from cell K2
  let sheetDate = null;
  const dateVal = cellVal(ws, 1, 10); // row 2, col K (0-indexed)
  if (dateVal) {
    if (typeof dateVal === 'number') {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(dateVal);
      if (d) sheetDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else if (typeof dateVal === 'string') {
      const m = dateVal.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) sheetDate = m[0];
    }
  }

  const programs = [];
  const seen = new Set();

  // Scan all rows for section headers
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxRow = Math.min(range.e.r, 4500);

  // Find rows that contain product headers in the triple layout
  // We look for rows where column B has a recognized product name string
  // AND the row 1 below has "Rate" in column B
  for (let r = 0; r <= maxRow; r++) {
    const val1 = cellStr(ws, r, 1);
    if (!val1) continue;

    // Check if this is a section header for any of the 3 column positions
    const tripleNames = [
      cellStr(ws, r, 1),
      cellStr(ws, r, 6),
      cellStr(ws, r, 11),
    ];

    const hasMatch = tripleNames.some(n => n && matchProduct(n));
    if (!hasMatch) continue;

    // Verify next row has column headers (Rate, 30 Day, etc.)
    const nextRow1 = cellStr(ws, r + 1, 1);
    const nextRow6 = cellStr(ws, r + 1, 6);
    const nextRow11 = cellStr(ws, r + 1, 11);
    const hasRateHeader = /^Rate$/i.test(nextRow1) || /^Rate$/i.test(nextRow6) || /^Rate$/i.test(nextRow11);
    if (!hasRateHeader) continue;

    // Extract the triple block
    const blocks = extractTripleBlock(ws, r);

    for (const block of blocks) {
      const match = matchProduct(block.productName);
      if (!match || !match.id) continue;

      // Dedup — SWMC has streamline and non-streamline sections with same products
      const uniqueKey = match.id;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      const lockDays = [...new Set(block.rates.map(r => r.lockDays))].sort((a, b) => a - b);

      programs.push({
        id: match.id,
        name: makeProgramName(match, block.productName),
        category: match.category || 'agency',
        subcategory: match.subcategory || match.loanType,
        loanType: match.loanType,
        term: match.term || 30,
        productType: match.productType || 'fixed',
        armStructure: match.armStructure || null,
        occupancy: match.occupancy || 'primary',
        isHighBalance: match.isHighBalance || false,
        isStreamline: match.isStreamline || false,
        variant: match.variant || null,
        docType: match.docType || null,
        rates: block.rates,
        lockDays,
      });
    }
  }

  // ─── Parse adjustment sections ────────────────────────────────────

  const agencyAdj = parseAgencyConformingAdj(ws);
  const govAdj = parseGovAdjustments(ws);
  const fees = parseFees(ws);

  // Build standard output format
  const llpas = agencyAdj ? {
    purchase: agencyAdj.ficoLtvGrids.purchase,
    refinance: agencyAdj.ficoLtvGrids.refinance,
    cashout: agencyAdj.ficoLtvGrids.cashout,
    ltvBands: agencyAdj.ltvBuckets.purchaseRefi,
  } : null;

  return {
    sheetDate,
    programs,
    llpas,
    loanAmountAdj: govAdj?.loanAmtAdj || [],
    stateAdj: agencyAdj?.stateAdj || {},
    specPayups: {},
    pricingSpecials: fees.promos.length > 0 ? { promos: fees.promos } : null,
    occupancyAdj: null,
    lenderFee: fees.uwFee,
    compCap: { purchase: 4595, refinance: 3595 },
    // SWMC-specific
    agencyAdj,
    govAdj,
    fees,
  };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
