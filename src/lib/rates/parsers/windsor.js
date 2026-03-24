/**
 * Windsor Mortgage / Plains Commerce Rate Sheet Parser
 *
 * XLSX with multiple sheets:
 *   - "Conventional and Government" — main sheet with conforming, high balance,
 *     HomeReady, conventional ARMs, VA, FHA, USDA products
 *   - "Gov ARM" — government ARM products (FHA/VA 5/1 CMT)
 *   - "Jumbo 1", "Jumbo 1 AUS", "Jumbo 1 15YR", "Jumbo 1 ARM" — jumbo tiers
 *   - "Jumbo 2", "Jumbo 2 AUS", "Jumbo 3 AUS", "Jumbo 4", "Jumbo 4 ARM"
 *   - "Conv LLPA", "Gov LLPA", "Jumbo 4 LLPA", "LPMI", "FHA Flex"
 *
 * Layout (main sheet): 4 products side-by-side per section row.
 *   Columns: A-E (0-4), F-J (5-9), K-O (10-14), P-T (15-19)
 *   Each group: Rate, 15 Day, 30 Day, 45 Day, 60 Day
 *   Products vary by loan amount tier (e.g., ">$350K", "<=$325K", etc.)
 *
 * Pricing: 100-based (100 = par, >100 = rebate, <100 = cost).
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

const lenderId = 'windsor';

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
 * Extract rates from a column group starting at a given row.
 * @param {object} ws - worksheet
 * @param {number} dataStartRow - 0-indexed row where rate data begins
 * @param {number} rateCol - column index for rate values
 * @param {Array} lockCols - [{col, days}]
 * @param {number} maxRows - max rows to scan
 */
function extractRates(ws, dataStartRow, rateCol, lockCols, maxRows = 25) {
  const rates = [];
  for (let r = dataStartRow; r < dataStartRow + maxRows; r++) {
    const rate = cellVal(ws, r, rateCol);
    if (rate === null || typeof rate === 'string') {
      if (rates.length > 0) break;
      continue;
    }
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 3 || rateNum > 12) {
      if (rates.length > 0) break;
      continue;
    }

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

/**
 * Parse a product header string to extract structured fields.
 * Examples:
 *   "30/25 Year Fixed >$350K^"
 *   "20 Year Fixed >$225K^"
 *   "15 Year Fixed High Balance"
 *   "VA 30Yr Fixed > 350K"
 *   "FHA 30Yr Fixed > 300K <= 325K"
 *   "FHA Streamline 30Yr Fixed > 350K"
 *   "USDA 30 Yr Fixed"
 *   "VA IRRRL 30Yr Fixed > 300K <= 325K"
 *   "VA 15 Year Fixed"
 *   "30 Year Fixed HomeReady >$350K"
 *   "FNMA 5/6m SOFR ARM"
 *   "FNMA 7/6m SOFR High Balance ARM"
 *   "FHA 5/1 CMT ARM 1-1-5 (2.00% Margin)"
 */
function parseProductHeader(header) {
  if (!header || typeof header !== 'string') return null;
  let s = header.trim();

  // Remove footnote markers, asterisks, carets
  s = s.replace(/[\^*]+/g, '').trim();

  // Detect loan type
  let loanType = 'conventional';
  let isStreamline = false;
  let isHighBalance = false;
  let isHomeReady = false;
  let variant = null;
  let productType = 'fixed';
  let armStructure = null;
  let term = null;

  if (/\bVA\b/i.test(s)) {
    loanType = 'va';
    if (/\bIRRRL\b/i.test(s)) { isStreamline = true; variant = 'irrrl'; }
  } else if (/\bFHA\b/i.test(s)) {
    loanType = 'fha';
    if (/\bStreamline\b/i.test(s)) { isStreamline = true; }
  } else if (/\bUSDA\b/i.test(s)) {
    loanType = 'usda';
    if (/\bStreamline\b/i.test(s) || /\bAssist\b/i.test(s)) { isStreamline = true; }
  }

  if (/\bHigh\s*Bal(ance)?\b/i.test(s)) isHighBalance = true;
  if (/\bHomeReady\b/i.test(s)) { isHomeReady = true; variant = 'homeready'; }

  // ARM detection
  const armMatch = s.match(/(\d+)\/(\d+)m?\s*(SOFR|CMT)?\s*(High\s*Balance\s*)?ARM/i);
  if (armMatch) {
    productType = 'arm';
    armStructure = `${armMatch[1]}/${armMatch[2]}`;
    term = 30; // ARMs are 30yr
  }

  // Term detection
  if (!term) {
    const termMatch = s.match(/(\d+)(?:\/\d+)?\s*(?:Year|Yr)\b/i);
    if (termMatch) {
      const t = parseInt(termMatch[1], 10);
      if (t >= 10 && t <= 40) term = t;
    }
  }
  if (!term) term = 30; // default

  // Loan amount range (for dedup/identification, not filtering)
  let loanAmountLabel = null;
  const amtMatch = s.match(/(>|<=?)\s*\$?(\d+)K?\b/gi);
  if (amtMatch) loanAmountLabel = amtMatch.join(' ').replace(/\$/g, '');

  // Second home detection
  let occupancy = 'primary';
  if (/\bSecond\s*Home\b/i.test(s)) occupancy = 'secondary';

  return {
    loanType,
    term,
    productType,
    armStructure,
    isHighBalance,
    isStreamline,
    isHomeReady,
    variant,
    occupancy,
    loanAmountLabel,
  };
}

function makeId(parsed) {
  const parts = [parsed.loanType, `${parsed.term}yr`, parsed.productType];
  if (parsed.armStructure) parts.push(parsed.armStructure.replace('/', '-'));
  if (parsed.isHighBalance) parts.push('highbal');
  if (parsed.isStreamline) parts.push('streamline');
  if (parsed.isHomeReady) parts.push('homeready');
  if (parsed.occupancy === 'secondary') parts.push('2ndhome');
  if (parsed.loanAmountLabel) {
    // Normalize the amount label for ID
    const amt = parsed.loanAmountLabel.replace(/[><=\s]/g, '').replace(/K/gi, 'k');
    parts.push(amt);
  }
  return parts.join('_');
}

function makeProgramName(parsed) {
  const parts = [];
  switch (parsed.loanType) {
    case 'conventional': parts.push('Conventional'); break;
    case 'fha': parts.push('FHA'); break;
    case 'va': parts.push('VA'); break;
    case 'usda': parts.push('USDA'); break;
    default: parts.push(parsed.loanType);
  }
  if (parsed.isStreamline) parts.push(parsed.variant === 'irrrl' ? 'IRRRL' : 'Streamline');
  parts.push(`${parsed.term}yr`);
  if (parsed.productType === 'arm' && parsed.armStructure) {
    parts.push(`${parsed.armStructure} ARM`);
  } else {
    parts.push('Fixed');
  }
  if (parsed.isHighBalance) parts.push('High Balance');
  if (parsed.isHomeReady) parts.push('HomeReady');
  if (parsed.occupancy === 'secondary') parts.push('Second Home');
  return parts.join(' ');
}

/**
 * Scan a worksheet for product sections and extract rates.
 * Looks for rows where column headers "Rate, 15 Day, 30 Day..." appear,
 * then reads the product name from the row above and data from rows below.
 */
function parseSheet(ws, sheetLabel) {
  const programs = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxRow = range.e.r;

  // Four column groups (0-indexed)
  const colGroups = [
    { rateCol: 0, lockCols: [{ col: 1, days: 15 }, { col: 2, days: 30 }, { col: 3, days: 45 }, { col: 4, days: 60 }] },
    { rateCol: 5, lockCols: [{ col: 6, days: 15 }, { col: 7, days: 30 }, { col: 8, days: 45 }, { col: 9, days: 60 }] },
    { rateCol: 10, lockCols: [{ col: 11, days: 15 }, { col: 12, days: 30 }, { col: 13, days: 45 }, { col: 14, days: 60 }] },
    { rateCol: 15, lockCols: [{ col: 16, days: 15 }, { col: 17, days: 30 }, { col: 18, days: 45 }, { col: 19, days: 60 }] },
  ];

  // Scan for "Rate" header rows
  for (let r = 0; r <= maxRow; r++) {
    // Check if any column group has "Rate" in this row
    const hasRateHeader = colGroups.some(g => {
      const v = cellStr(ws, r, g.rateCol);
      return /^Rate$/i.test(v);
    });
    if (!hasRateHeader) continue;

    // Product name is in the row above
    const nameRow = r - 1;

    for (const group of colGroups) {
      // Check this group has "Rate" header
      if (!/^Rate$/i.test(cellStr(ws, r, group.rateCol))) continue;

      const productName = cellStr(ws, nameRow, group.rateCol);
      if (!productName || productName.length < 5) continue;

      const parsed = parseProductHeader(productName);
      if (!parsed) continue;

      const rates = extractRates(ws, r + 1, group.rateCol, group.lockCols);
      if (rates.length === 0) continue;

      const id = makeId(parsed);
      const lockDays = [...new Set(rates.map(x => x.lockDays))].sort((a, b) => a - b);

      let subcategory = parsed.loanType;
      if (parsed.loanType === 'conventional' && parsed.isHighBalance) subcategory = 'conventional';

      programs.push({
        id,
        name: makeProgramName(parsed),
        category: 'agency',
        subcategory,
        loanType: parsed.loanType,
        term: parsed.term,
        productType: parsed.productType,
        armStructure: parsed.armStructure || null,
        occupancy: parsed.occupancy,
        isHighBalance: parsed.isHighBalance,
        isStreamline: parsed.isStreamline,
        variant: parsed.variant || null,
        priceFormat: '100-based',
        rates,
        lockDays,
        sheetSource: sheetLabel || null,
      });
    }
  }

  return programs;
}

/**
 * Parse Windsor/Plains Commerce rate sheet XLSX.
 * @param {Buffer|ArrayBuffer} xlsxBuffer - raw XLSX file
 * @returns {{ sheetDate: string|null, programs: Array }}
 */
function parseRates(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });

  // Extract date from cell D1 of main sheet
  let sheetDate = null;
  const mainWs = wb.Sheets['Conventional and Government'];
  if (mainWs) {
    const dateVal = cellVal(mainWs, 0, 3); // Row 1, col D
    if (dateVal && typeof dateVal === 'string') {
      const m = dateVal.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
      if (m) {
        const months = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
          July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };
        const mo = months[m[1]] || '01';
        sheetDate = `${m[3]}-${mo}-${String(m[2]).padStart(2, '0')}`;
      }
    }
  }

  const programs = [];

  // Parse main sheet (conforming + government)
  if (mainWs) {
    programs.push(...parseSheet(mainWs, 'Conventional and Government'));
  }

  // Parse Gov ARM sheet
  const govArmWs = wb.Sheets['Gov ARM'];
  if (govArmWs) {
    programs.push(...parseSheet(govArmWs, 'Gov ARM'));
  }

  // Parse Jumbo sheets
  const jumboSheets = ['Jumbo 1', 'Jumbo 1 AUS', 'Jumbo 1 15YR', 'Jumbo 1 ARM',
    'Jumbo 2', 'Jumbo 2 AUS', 'Jumbo 3 AUS', 'Jumbo 4', 'Jumbo 4 ARM'];
  for (const name of jumboSheets) {
    const ws = wb.Sheets[name];
    if (ws) {
      const jumboPrograms = parseSheet(ws, name);
      // Tag jumbo programs
      for (const p of jumboPrograms) {
        p.category = 'agency';
        p.subcategory = 'jumbo';
      }
      programs.push(...jumboPrograms);
    }
  }

  return { sheetDate, programs };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
