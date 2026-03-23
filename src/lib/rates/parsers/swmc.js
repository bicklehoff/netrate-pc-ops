/**
 * SWMC (Sun West Mortgage Company) Rate Sheet Parser
 *
 * Single XLSX with one sheet ('RATESHEET'). 4,400+ rows.
 * Layout: product sections in triples (3 products side-by-side per row block).
 * Section headers are text rows naming the product, then Rate/30Day/45Day/60Day columns.
 * Prices are discount/rebate format (positive = cost, negative = rebate).
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
        rates.push({ rate: rateNum, lockDays: lc.days, price: priceNum });
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

/**
 * Parse SWMC rate sheet XLSX.
 * @param {Buffer|ArrayBuffer} xlsxBuffer - raw XLSX file
 * @returns {{ sheetDate: string|null, programs: Array }}
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
        priceFormat: 'discount',
        rates: block.rates,
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
