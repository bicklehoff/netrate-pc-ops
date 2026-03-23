/**
 * AmWest Funding Rate Sheet Parser
 *
 * XLSX with 12 sheets: CONV, FT_LLPAS, LLPAS, HR & HP, CES, HELOC,
 * AAA_AAI_AAQ_AAO, AIA_AIP, JUMBO, GOV, and Spring Special sheets.
 *
 * Layout: quad products side-by-side (cols B-D, E-G, H-J, K-M).
 * Prices are discount/rebate format (positive = cost, negative = rebate).
 *
 * Products: Fast Track Conv (30/20/15/10yr, HB), Standard Conv, FHA/USDA,
 *           VA, FHA/VA Streamline, FHA/VA HB, Jumbo, HELOC, CES, HomeReady, HomePossible
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

const lenderId = 'amwest';

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
 * Extract rate data from a column group.
 * @param {object} ws - XLSX worksheet
 * @param {number} startRow - 0-indexed row where data starts
 * @param {number} rateCol - column index for rate
 * @param {Array} lockCols - [{col, days}]
 * @param {number} maxRows - max data rows to read
 */
function extractRates(ws, startRow, rateCol, lockCols, maxRows = 25) {
  const rates = [];
  for (let r = startRow; r < startRow + maxRows; r++) {
    const rate = cellVal(ws, r, rateCol);
    if (rate === null) { if (rates.length > 0) break; continue; }
    const rateNum = typeof rate === 'string' ? parseFloat(rate) : rate;
    if (isNaN(rateNum) || rateNum < 3 || rateNum > 12) { if (rates.length > 0) break; continue; }

    for (const lc of lockCols) {
      const price = cellVal(ws, r, lc.col);
      if (price === null || typeof price === 'string') continue;
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < -10 || priceNum > 15) continue;
      rates.push({ rate: rateNum, lockDays: lc.days, price: priceNum });
    }
  }
  return rates;
}

/**
 * Scan a sheet for product sections with a quad layout.
 * Products are in groups of 4: cols (1,2,3), (4,5,6), (7,8,9), (10,11,12).
 * Section headers have product codes like (FFT30), (FHA30), etc.
 */
function parseConvSheet(ws) {
  const programs = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Quad column groups
  const quads = [
    { rateCol: 1, lockCols: [{ col: 2, days: 30 }, { col: 3, days: 45 }] },
    { rateCol: 4, lockCols: [{ col: 5, days: 30 }, { col: 6, days: 45 }] },
    { rateCol: 7, lockCols: [{ col: 8, days: 30 }, { col: 9, days: 45 }] },
    { rateCol: 10, lockCols: [{ col: 11, days: 30 }, { col: 12, days: 45 }] },
  ];

  // Known section start patterns
  const sections = [];

  // Scan for "RATE" header rows which mark data start
  for (let r = 0; r <= range.e.r; r++) {
    const v = cellStr(ws, r, 1);
    if (v === 'RATE') {
      // Look at the row(s) above for product names/codes
      const sectionLabel = cellStr(ws, r - 2, 1) || cellStr(ws, r - 1, 1);
      const productRow = r - 1; // row with product codes like (FFT30)
      sections.push({ headerRow: r, sectionLabel, productRow });
    }
  }

  for (const section of sections) {
    const isFastTrack = /FAST\s*TRACK/i.test(section.sectionLabel) ||
      /^FF|^FMFT/i.test(cellStr(ws, section.productRow, 1));

    for (let qi = 0; qi < quads.length; qi++) {
      const q = quads[qi];
      const productCode = cellStr(ws, section.productRow, q.rateCol);
      if (!productCode) continue;

      const rates = extractRates(ws, section.headerRow + 1, q.rateCol, q.lockCols);
      if (rates.length === 0) continue;

      // Parse product code to determine product details
      const parsed = parseAmwestCode(productCode, isFastTrack);
      if (!parsed) continue;

      const lockDays = [...new Set(rates.map(r => r.lockDays))].sort((a, b) => a - b);
      programs.push({
        id: parsed.id,
        name: parsed.name,
        productCode: productCode.replace(/[()]/g, ''),
        category: parsed.category,
        subcategory: parsed.subcategory,
        loanType: parsed.loanType,
        term: parsed.term,
        productType: parsed.productType || 'fixed',
        armStructure: parsed.armStructure || null,
        occupancy: 'primary',
        isHighBalance: parsed.isHighBalance || false,
        isStreamline: parsed.isStreamline || false,
        isFastTrack: isFastTrack,
        variant: parsed.variant || null,
        priceFormat: 'discount',
        rates,
        lockDays,
      });
    }
  }

  return programs;
}

function parseAmwestCode(rawCode, isFastTrack) {
  const code = rawCode.replace(/[()]/g, '').trim().toUpperCase();
  const tier = isFastTrack ? 'fast-track' : 'standard';

  // FHA
  if (/^FHA30$/.test(code)) return { id: `fha_30yr_fixed_${tier}`, name: `FHA 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha' };
  if (/^FHA30HB/.test(code)) return { id: `fha_30yr_fixed_highbal_${tier}`, name: `FHA 30yr Fixed HB${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha', isHighBalance: true };
  if (/^FHA15/.test(code)) return { id: `fha_15yr_fixed_${tier}`, name: `FHA 15yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 15, category: 'agency', subcategory: 'fha' };
  if (/^FHA30SL/.test(code)) return { id: `fha_30yr_fixed_streamline_${tier}`, name: `FHA Streamline 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha', isStreamline: true };
  if (/^FHA.*ARM/.test(code)) return { id: `fha_30yr_arm_${tier}`, name: `FHA ARM${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha', productType: 'arm' };

  // VA
  if (/^VA30$/.test(code)) return { id: `va_30yr_fixed_${tier}`, name: `VA 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va' };
  if (/^VA30HB/.test(code)) return { id: `va_30yr_fixed_highbal_${tier}`, name: `VA 30yr Fixed HB${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va', isHighBalance: true };
  if (/^VA15/.test(code)) return { id: `va_15yr_fixed_${tier}`, name: `VA 15yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 15, category: 'agency', subcategory: 'va' };
  if (/^VA30IRRRL/.test(code)) return { id: `va_30yr_fixed_irrrl_${tier}`, name: `VA IRRRL 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va', isStreamline: true };
  if (/^VA.*ARM/.test(code)) return { id: `va_30yr_arm_${tier}`, name: `VA ARM${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va', productType: 'arm' };

  // USDA
  if (/^USDA30/.test(code)) return { id: `usda_30yr_fixed_${tier}`, name: `USDA 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'usda', term: 30, category: 'agency', subcategory: 'usda' };

  // Conventional (Fannie = FF/FCF, Freddie = FM/FMFT)
  const isFreddie = /^FM/.test(code);
  const investor = isFreddie ? 'freddie' : 'fannie';

  if (/30/.test(code) && /RP/.test(code)) return { id: `conventional_30yr_fixed_refipossible_${tier}`, name: `Conv 30yr Fixed RefiPossible${isFastTrack ? ' FT' : ''}`, loanType: 'conventional', term: 30, category: 'agency', subcategory: 'conventional', variant: 'refipossible' };
  if (/30\s*YR|30\)/.test(rawCode) || /30$/.test(code)) {
    const isHB = /HB/.test(code);
    return { id: `conventional_30yr_fixed${isHB ? '_highbal' : ''}_${investor}_${tier}`, name: `Conv 30yr Fixed${isHB ? ' HB' : ''} (${investor})${isFastTrack ? ' FT' : ''}`, loanType: 'conventional', term: 30, category: 'agency', subcategory: 'conventional', isHighBalance: isHB };
  }
  if (/20/.test(code)) return { id: `conventional_20yr_fixed_${investor}_${tier}`, name: `Conv 20yr Fixed (${investor})${isFastTrack ? ' FT' : ''}`, loanType: 'conventional', term: 20, category: 'agency', subcategory: 'conventional' };
  if (/15/.test(code)) {
    const isHB = /HB/.test(code);
    return { id: `conventional_15yr_fixed${isHB ? '_highbal' : ''}_${investor}_${tier}`, name: `Conv 15yr Fixed${isHB ? ' HB' : ''} (${investor})${isFastTrack ? ' FT' : ''}`, loanType: 'conventional', term: 15, category: 'agency', subcategory: 'conventional', isHighBalance: isHB };
  }
  if (/10/.test(code)) return { id: `conventional_10yr_fixed_${investor}_${tier}`, name: `Conv 10yr Fixed (${investor})${isFastTrack ? ' FT' : ''}`, loanType: 'conventional', term: 10, category: 'agency', subcategory: 'conventional' };

  // Jumbo
  if (/^JE/.test(code)) {
    const term = /15/.test(code) ? 15 : 30;
    return { id: `jumbo_${term}yr_fixed`, name: `Jumbo ${term}yr Fixed`, loanType: 'conventional', term, category: 'agency', subcategory: 'jumbo' };
  }

  return null;
}

function parseGovSheet(ws) {
  return parseConvSheet(ws); // Same quad layout
}

/**
 * Parse AmWest rate sheet XLSX.
 */
function parseRates(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });

  // Extract date
  let sheetDate = null;
  const govWs = wb.Sheets['GOV'];
  if (govWs) {
    const dateVal = cellVal(govWs, 7, 11); // Row 8, col L
    if (dateVal) {
      if (typeof dateVal === 'number') {
        const d = XLSX.SSF.parse_date_code(dateVal);
        if (d) sheetDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } else if (typeof dateVal === 'string') {
        const m = dateVal.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) sheetDate = m[0];
      }
    }
  }

  const programs = [];

  // Parse CONV sheet (has both Fast Track and Standard sections)
  const convWs = wb.Sheets['CONV'];
  if (convWs) programs.push(...parseConvSheet(convWs));

  // Parse GOV sheet
  if (govWs) programs.push(...parseGovSheet(govWs));

  // Parse JUMBO sheet
  const jumboWs = wb.Sheets['JUMBO'];
  if (jumboWs) programs.push(...parseConvSheet(jumboWs));

  return { sheetDate, programs };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
