/**
 * AmWest Funding Rate Sheet Parser
 *
 * XLSX with 12 sheets: CONV, FT_LLPAS, LLPAS, HR & HP, CES, HELOC,
 * AAA_AAI_AAQ_AAO, AIA_AIP, JUMBO, GOV, and Spring Special sheets.
 *
 * Layout: quad products side-by-side (cols B-D, E-G, H-J, K-M).
 * Prices are discount/rebate format (positive = cost, negative = rebate).
 *
 * Also parses: LLPAs (Fast Track + Agency), Government FICO adjustments,
 *              Jumbo FICO/LTV + loan amount adjustments, State adjustments,
 *              Lender fees, Comp caps
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

const lenderId = 'amwest';

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

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
 * Search for a row containing `text` in any of the given columns.
 * Returns the 0-indexed row number, or -1 if not found.
 */
function findRow(ws, text, { startRow = 0, endRow = 200, cols = [0, 1, 2, 3, 4, 5, 6] } = {}) {
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

/** Normalize an LTV band header, e.g. "<= 30.00%" -> "<=30", "≤30" -> "<=30" */
function normalizeLtvBand(str) {
  if (str === null || str === undefined) return null;
  return String(str)
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/\s+/g, '')
    .replace(/\.00/g, '')
    .replace(/%/g, '');
}

/** Parse an LLPA cell value. AmWest uses positive = cost (matches engine convention). */
function parseLlpa(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'na' || lower === 'n/a' || lower === '') return null;
    const n = parseFloat(lower);
    if (isNaN(n)) return null;
    return n;
  }
  if (typeof val === 'number') return val;
  return null;
}


// ---------------------------------------------------------------------------
// Rate extraction (unchanged from original)
// ---------------------------------------------------------------------------

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

function parseConvSheet(ws) {
  const programs = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  const quads = [
    { rateCol: 1, lockCols: [{ col: 2, days: 30 }, { col: 3, days: 45 }] },
    { rateCol: 4, lockCols: [{ col: 5, days: 30 }, { col: 6, days: 45 }] },
    { rateCol: 7, lockCols: [{ col: 8, days: 30 }, { col: 9, days: 45 }] },
    { rateCol: 10, lockCols: [{ col: 11, days: 30 }, { col: 12, days: 45 }] },
  ];

  const sections = [];
  for (let r = 0; r <= range.e.r; r++) {
    const v = cellStr(ws, r, 1);
    if (v === 'RATE') {
      const sectionLabel = cellStr(ws, r - 2, 1) || cellStr(ws, r - 1, 1);
      const productRow = r - 1;
      sections.push({ headerRow: r, sectionLabel, productRow });
    }
  }

  for (const section of sections) {
    // Check 2 AND 3 rows above "RATE" for "FAST TRACK" header
    const label3Up = cellStr(ws, section.headerRow - 3, 1);
    const isFastTrack = /FAST\s*TRACK/i.test(section.sectionLabel) ||
      /FAST\s*TRACK/i.test(label3Up) ||
      /^FF|^FMFT/i.test(cellStr(ws, section.productRow, 1).replace(/[()]/g, ''));

    for (let qi = 0; qi < quads.length; qi++) {
      const q = quads[qi];
      const productCode = cellStr(ws, section.productRow, q.rateCol);
      if (!productCode) continue;

      const rates = extractRates(ws, section.headerRow + 1, q.rateCol, q.lockCols);
      if (rates.length === 0) continue;

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

  // Dispatch on the first whitespace-delimited token. AmWest product codes
  // often have trailing descriptors like "30 YR" / "30 YEAR" appended after
  // the actual code (e.g. "FCF30 30 YEAR", "FHA30  30 YR", "JEA30 30 YEAR").
  // The first token is the real product identifier.
  const firstToken = code.split(/\s+/)[0];

  // ─── Jumbo (JE prefix) ─────────────────────────────────────────────
  // Check FIRST so JE codes don't fall into conv 30 by accident
  if (/^JE/.test(firstToken)) {
    const term = /15/.test(firstToken) ? 15 : 30;
    return { id: `jumbo_${term}yr_fixed`, name: `Jumbo ${term}yr Fixed`, loanType: 'conventional', term, category: 'agency', subcategory: 'jumbo' };
  }

  // ─── FHA ────────────────────────────────────────────────────────────
  if (/^FHA/.test(firstToken)) {
    const isHB = /HB/.test(firstToken);
    const isSL = /SL/.test(firstToken);
    const isARM = /ARM/.test(firstToken);
    if (isARM) return { id: `fha_30yr_arm_${tier}`, name: `FHA ARM${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha', productType: 'arm' };
    if (/15/.test(firstToken)) return { id: `fha_15yr_fixed_${tier}`, name: `FHA 15yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 15, category: 'agency', subcategory: 'fha' };
    if (isSL) return { id: `fha_30yr_fixed_streamline_${tier}`, name: `FHA Streamline 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha', isStreamline: true };
    if (isHB) return { id: `fha_30yr_fixed_highbal_${tier}`, name: `FHA 30yr Fixed HB${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha', isHighBalance: true };
    return { id: `fha_30yr_fixed_${tier}`, name: `FHA 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'fha', term: 30, category: 'agency', subcategory: 'fha' };
  }

  // ─── VA ─────────────────────────────────────────────────────────────
  if (/^VA/.test(firstToken)) {
    const isHB = /HB/.test(firstToken);
    const isIRRRL = /IRRRL/.test(firstToken);
    const isARM = /ARM/.test(firstToken);
    if (isARM) return { id: `va_30yr_arm_${tier}`, name: `VA ARM${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va', productType: 'arm' };
    if (/15/.test(firstToken)) return { id: `va_15yr_fixed_${tier}`, name: `VA 15yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 15, category: 'agency', subcategory: 'va' };
    if (isIRRRL) return { id: `va_30yr_fixed_irrrl_${tier}`, name: `VA IRRRL 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va', isStreamline: true };
    if (isHB) return { id: `va_30yr_fixed_highbal_${tier}`, name: `VA 30yr Fixed HB${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va', isHighBalance: true };
    return { id: `va_30yr_fixed_${tier}`, name: `VA 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'va', term: 30, category: 'agency', subcategory: 'va' };
  }

  // ─── USDA ───────────────────────────────────────────────────────────
  if (/^USDA/.test(firstToken)) {
    return { id: `usda_30yr_fixed_${tier}`, name: `USDA 30yr Fixed${isFastTrack ? ' Fast Track' : ''}`, loanType: 'usda', term: 30, category: 'agency', subcategory: 'usda' };
  }

  // ─── Conventional ───────────────────────────────────────────────────
  // Fannie = FF/FCF/FFT, Freddie = FM/FMFT. All start with F (but not FHA).
  // Some codes carry the variant suffix as a separate token (e.g. "FCF30 RN 30 YEAR")
  // so check the full pre-trailing-junk code, not just firstToken, for variant detection.
  if (/^F/.test(firstToken)) {
    const isFreddie = /^FM/.test(firstToken);
    const investor = isFreddie ? 'freddie' : 'fannie';
    const isHB = /HB/.test(firstToken);

    // Variant detection — RN (RefiNow), RP (RefiPossible), HO (HomeOne), HP (HomePossible)
    // Look at firstToken AND the second token (e.g. "FCF30 RN 30 YEAR" → second token "RN")
    const tokens = code.split(/\s+/);
    const variantToken = tokens[1] || '';
    const hasRN = /RN/.test(firstToken) || /^RN$/.test(variantToken);
    const hasRP = /RP/.test(firstToken) || /^RP$/.test(variantToken);
    const hasHO = /HO/.test(firstToken) || /^HO$/.test(variantToken);
    const hasHP = /HP/.test(firstToken) || /^HP$/.test(variantToken);

    let variant = null;
    let variantSuffix = '';
    let variantNameSuffix = '';
    if (hasRN) { variant = 'refinow'; variantSuffix = '_refinow'; variantNameSuffix = ' RefiNow'; }
    else if (hasRP) { variant = 'refipossible'; variantSuffix = '_refipossible'; variantNameSuffix = ' RefiPossible'; }
    else if (hasHO) { variant = 'homeone'; variantSuffix = '_homeone'; variantNameSuffix = ' HomeOne'; }
    else if (hasHP) { variant = 'homepossible'; variantSuffix = '_homepossible'; variantNameSuffix = ' HomePossible'; }

    const buildResult = (term) => ({
      id: `conventional_${term}yr_fixed${isHB ? '_highbal' : ''}_${investor}${variantSuffix}_${tier}`,
      name: `Conv ${term}yr Fixed${isHB ? ' HB' : ''}${variantNameSuffix} (${investor})${isFastTrack ? ' FT' : ''}`,
      loanType: 'conventional',
      term,
      category: 'agency',
      subcategory: 'conventional',
      isHighBalance: isHB,
      variant,
    });

    if (/30/.test(firstToken)) return buildResult(30);
    if (/20/.test(firstToken)) return buildResult(20);
    if (/15/.test(firstToken)) return buildResult(15);
    if (/10/.test(firstToken)) return buildResult(10);
  }

  return null;
}

// ---------------------------------------------------------------------------
// LLPA parsing — Conventional (FT_LLPAS and LLPAS sheets)
// ---------------------------------------------------------------------------

/**
 * Parse a FICO/LTV grid from an LLPA sheet.
 * @param {object} ws - worksheet
 * @param {number} headerRow - 0-indexed row with "FICO/LTV" + LTV band headers
 * @param {number} maxFicoRows - how many FICO rows to read
 * @returns {{ matrix: { ficoLabel: [values] }, ltvBands: [string] }} or null
 */
function parseLlpaMatrix(ws, headerRow, maxFicoRows = 12) {
  // LTV bands start at col 2 (col 1 = "FICO/LTV" label)
  const ltvBands = [];
  for (let c = 2; c <= 12; c++) {
    const v = cellVal(ws, headerRow, c);
    if (v === null) continue;
    const band = normalizeLtvBand(v);
    if (band) ltvBands.push({ col: c, band });
  }
  if (ltvBands.length === 0) return null;

  const matrix = {};
  for (let r = headerRow + 1; r < headerRow + 1 + maxFicoRows; r++) {
    const ficoLabel = cellVal(ws, r, 1);
    if (ficoLabel === null) continue;
    const label = String(ficoLabel).trim();
    if (!label || label === '') continue;
    // Stop if we hit a section header or non-FICO row
    if (/purchase|refinance|cashout|rate.?term|additional|llpa|loan\s*terms/i.test(label)) break;
    // Skip rows that aren't FICO ranges (must contain digits)
    if (!/\d/.test(label)) continue;

    const values = ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
    if (values.some(v => v !== null)) {
      // Normalize: "≥800" → ">=800", "780 - 799" → "780-799"
      const normalizedLabel = label.replace(/\s*[-–]\s*/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=');
      matrix[normalizedLabel] = values;
    }
  }

  return {
    matrix,
    ltvBands: ltvBands.map(lb => lb.band),
  };
}

/**
 * Parse additional adjustments block (ARM, Condo, Sub Financing, etc.)
 * These appear right after the FICO/LTV grid with a header row like
 * "Purchase Loan Additional (all amortization terms)" followed by a "LTV" row,
 * then data rows.
 */
function parseAdditionalAdj(ws, startRow, numLtvCols) {
  const additional = {};
  // Scan forward to find the data rows — skip "Purchase/Rate&Term Loan Additional" header and "LTV" header
  let dataStart = startRow;
  for (let r = startRow; r < startRow + 5; r++) {
    const label = cellStr(ws, r, 1);
    if (/additional|^ltv$/i.test(label)) { dataStart = r + 1; continue; }
    if (/arm|condo|unit|n.?o.?o|second|sub\s*fin|high|baltimore|manufactured/i.test(label)) {
      dataStart = r;
      break;
    }
  }

  for (let r = dataStart; r < dataStart + 12; r++) {
    const label = cellStr(ws, r, 1);
    if (!label) continue;
    // Stop at next major section header
    if (/fico.?ltv|^rate.?term|^cash\s*out|llpa\s*waiver|other\s*price/i.test(label)) break;
    // Skip headers
    if (/additional|^ltv$/i.test(label)) continue;

    const values = [];
    for (let c = 2; c < 2 + numLtvCols; c++) {
      values.push(parseLlpa(cellVal(ws, r, c)));
    }

    const key = label.toLowerCase();
    if (/^arm/i.test(key)) additional.arm = values;
    else if (/attached\s*condo|condo/i.test(key)) additional.condo = values;
    else if (/2[-–]4\s*unit/i.test(key)) additional['2to4unit'] = values;
    else if (/n.?o.?o|non.?owner/i.test(key)) additional.investment = values;
    else if (/second\s*home/i.test(key)) additional.secondHome = values;
    else if (/sub\s*fin/i.test(key)) additional.subFinancing = values;
    else if (/high\s*bal.*fixed|hb.*fixed/i.test(key)) additional.highBalFixed = values;
    else if (/high\s*bal.*arm|hb.*arm/i.test(key)) additional.highBalArm = values;
    else if (/baltimore/i.test(key)) additional.baltimoreMD = values;
    else if (/manufactured/i.test(key)) additional.manufactured = values;
  }
  return additional;
}

/**
 * Parse a full LLPA sheet (FT_LLPAS or LLPAS).
 * Returns { ficoLtvGrids, additionalAdjustments, ltvBuckets }
 */
function parseConvLlpaSheet(ws) {
  if (!ws) return null;

  const result = {
    ficoLtvGrids: { purchase: {}, refinance: {}, cashout: {} },
    additionalAdjustments: { purchase: {}, refinance: {}, cashout: {} },
    ltvBuckets: { purchaseRefi: [], cashout: [] },
  };

  // Find the Purchase header — search for "Purchase" in rows 14-20
  const purchaseRow = findRow(ws, 'Purchase', { startRow: 14, endRow: 22, cols: [1, 2] });
  if (purchaseRow === -1) return null;

  // FICO/LTV header is on the next row
  const purchaseHeaderRow = purchaseRow + 1;
  const purchaseGrid = parseLlpaMatrix(ws, purchaseHeaderRow);
  if (purchaseGrid) {
    result.ficoLtvGrids.purchase = purchaseGrid.matrix;
    result.ltvBuckets.purchaseRefi = purchaseGrid.ltvBands;

    // Additional adjustments start after the FICO rows
    const ficoCount = Object.keys(purchaseGrid.matrix).length;
    const additionalStart = purchaseHeaderRow + 1 + ficoCount;
    result.additionalAdjustments.purchase = parseAdditionalAdj(ws, additionalStart, purchaseGrid.ltvBands.length);
  }

  // Find Rate&Term (refi) section
  const refiRow = findRow(ws, 'Rate&Term', { startRow: purchaseHeaderRow + 10, endRow: purchaseHeaderRow + 35, cols: [1, 2] });
  if (refiRow !== -1) {
    const refiHeaderRow = refiRow + 1;
    const refiGrid = parseLlpaMatrix(ws, refiHeaderRow);
    if (refiGrid) {
      result.ficoLtvGrids.refinance = refiGrid.matrix;
      const ficoCount = Object.keys(refiGrid.matrix).length;
      const additionalStart = refiHeaderRow + 1 + ficoCount;
      result.additionalAdjustments.refinance = parseAdditionalAdj(ws, additionalStart, refiGrid.ltvBands.length);
    }
  }

  // Find Cashout section
  const searchStart = refiRow !== -1 ? refiRow + 10 : purchaseHeaderRow + 30;
  const cashoutRow = findRow(ws, 'Cash Out', { startRow: searchStart, endRow: searchStart + 25, cols: [1, 2] });
  if (cashoutRow !== -1) {
    const cashoutHeaderRow = cashoutRow + 1;
    const cashoutGrid = parseLlpaMatrix(ws, cashoutHeaderRow);
    if (cashoutGrid) {
      result.ficoLtvGrids.cashout = cashoutGrid.matrix;
      result.ltvBuckets.cashout = cashoutGrid.ltvBands;
      const ficoCount = Object.keys(cashoutGrid.matrix).length;
      const additionalStart = cashoutHeaderRow + 1 + ficoCount;
      result.additionalAdjustments.cashout = parseAdditionalAdj(ws, additionalStart, cashoutGrid.ltvBands.length);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Right-side adjustments (OTHER PRICE ADJUSTMENTS, State, etc.)
// These appear on both FT_LLPAS and LLPAS sheets in cols M-T (12-19)
// ---------------------------------------------------------------------------

/**
 * Parse OTHER PRICE ADJUSTMENTS from the right side of an LLPA sheet.
 * Returns { loanAmtAdj: [...], lockAdj: {...}, otherAdj: [...] }
 */
function parseOtherPriceAdj(ws) {
  const headerRow = findRow(ws, 'OTHER PRICE ADJUSTMENTS', { startRow: 20, endRow: 70, cols: [12, 13, 14] });
  if (headerRow === -1) return null;

  const loanAmtAdj = [];
  const otherAdj = [];

  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    const label = cellStr(ws, r, 13);
    if (!label) continue;
    if (/state\s*adj|llpa\s*waiver|cumulative/i.test(label)) break;

    // Look for value in col 19 (T)
    const val = parseLlpa(cellVal(ws, r, 19));

    // Loan amount adjustments (separator can be "-", "–", or "to")
    const loanAmtMatch = label.match(/Loan\s*Amt\s*\$?([\d,]+)\s*(?:[-–]|to)\s*\$?([\d,]+)/i);
    if (loanAmtMatch && val !== null) {
      const min = parseInt(loanAmtMatch[1].replace(/,/g, ''), 10);
      const max = parseInt(loanAmtMatch[2].replace(/,/g, ''), 10);
      loanAmtAdj.push({ min, max, adj30yr: val, adj15yr: val });
      continue;
    }

    if (val !== null) {
      otherAdj.push({ label, value: val });
    }
  }

  return { loanAmtAdj, otherAdj };
}

/**
 * Parse State Adjuster section from right side of LLPA sheet.
 * Returns { stateCode: { adj30yr, adj15yr } }
 */
function parseStateAdj(ws) {
  const headerRow = findRow(ws, 'State Adjuster', { startRow: 30, endRow: 70, cols: [12, 13, 14] });
  if (headerRow === -1) return {};

  const stateAdj = {};

  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    // Group label in col 13-14, states in col 15-16, values in col 18-19
    const groupLabel = cellStr(ws, r, 13);
    if (!groupLabel) continue;
    if (/llpa\s*waiver|cumulative|max\s*loan/i.test(groupLabel)) break;

    // Look for state codes — they may be after "Group N:" pattern
    // Format: "Group 1: TX" with adj in cols S/T (18/19)
    const stateStr = cellStr(ws, r, 14) || '';
    const fullStr = groupLabel + ' ' + stateStr;

    // Extract 2-letter state codes
    const states = fullStr.match(/\b[A-Z]{2}\b/g);
    if (!states || states.length === 0) continue;

    // Values in columns 18 (30yr) and 19 (15yr)
    const adj30 = parseLlpa(cellVal(ws, r, 18));
    const adj15 = parseLlpa(cellVal(ws, r, 19));
    if (adj30 === null && adj15 === null) continue;

    for (const st of states) {
      stateAdj[st] = {
        adj30yr: adj30 || 0,
        adj15yr: adj15 || 0,
      };
    }
  }

  return stateAdj;
}

// ---------------------------------------------------------------------------
// Government adjustments (GOV sheet)
// ---------------------------------------------------------------------------

/**
 * Parse government price adjustments from the GOV sheet.
 * Returns { ficoAdj, loanAmtAdj, purposeAdj, stateAdj, lenderFee }
 */
function parseGovAdjustments(ws) {
  if (!ws) return null;

  const result = {
    ficoAdj: {},
    loanAmtAdj: [],
    purposeAdj: {},
    stateAdj: {},
    lenderFee: 1295,
    streamlineFee: 795,
  };

  // FICO Adjustments — search for "FICO ADJUSTMENTS" in the GOV sheet
  // These are in cols I-L area (8-11), rows 79+
  const ficoRow = findRow(ws, 'FICO ADJUSTMENTS', { startRow: 70, endRow: 100, cols: [8, 9, 10] });
  if (ficoRow !== -1) {
    for (let r = ficoRow + 1; r < ficoRow + 15; r++) {
      const label = cellStr(ws, r, 8) || cellStr(ws, r, 9);
      if (!label) continue;
      if (/no\s*fico|note:|state/i.test(label)) break;
      // Skip non-FICO rows
      if (!/\d/.test(label)) continue;

      const val = parseLlpa(cellVal(ws, r, 11));
      if (val === null) continue;

      // Normalize: ">=760" → ">=760", "740-759" → "740-759", strip asterisks
      const normalizedLabel = label.replace(/^\*+/, '').replace(/\s*[-–]\s*/g, '-').replace(/≥/g, '>=');
      result.ficoAdj[normalizedLabel] = val;
    }
  }

  // Government price adjustments — cols B-G area, rows 77+
  const govPriceRow = findRow(ws, 'GOVERNMENT PRICE ADJUSTMENTS', { startRow: 70, endRow: 100, cols: [1, 2, 3] });
  if (govPriceRow !== -1) {
    for (let r = govPriceRow + 1; r < govPriceRow + 15; r++) {
      const label = cellStr(ws, r, 1) || cellStr(ws, r, 2);
      if (!label) continue;
      if (/fico|state\s*adj/i.test(label)) break;

      const val = parseLlpa(cellVal(ws, r, 6));
      if (val === null) continue;

      // Loan amount adjustments
      const loanAmtMatch = label.match(/Loan\s*Amount\s*[<≤]=?\s*\$?([\d,]+)/i);
      if (loanAmtMatch) {
        const max = parseInt(loanAmtMatch[1].replace(/,/g, ''), 10);
        result.loanAmtAdj.push({ min: 0, max, adj30yr: val, adj15yr: val, label });
        continue;
      }
      const loanRangeMatch = label.match(/Loan\s*Amount\s*\$?([\d,]+k?)\s*to\s*\$?([\d,]+)/i);
      if (loanRangeMatch) {
        let min = loanRangeMatch[1].replace(/,/g, '');
        if (min.endsWith('k')) min = parseInt(min) * 1000; else min = parseInt(min);
        const max = parseInt(loanRangeMatch[2].replace(/,/g, ''), 10);
        result.loanAmtAdj.push({ min, max, adj30yr: val, adj15yr: val, label });
        continue;
      }

      // VA IRRRL adjustment
      if (/VA\s*IRRRL.*LTV/i.test(label)) {
        result.purposeAdj.vaIrrrlHighLtv = val;
        continue;
      }

      // USDA Streamline
      if (/USDA\s*STREAMLINE/i.test(label)) {
        result.purposeAdj.usdaStreamline = val;
        continue;
      }

      result.purposeAdj[label] = val;
    }
  }

  // State adjuster for Government
  // Format: col 1 = "Group N", col 2 = state code, col 3 = 30yr adj, col 4 = 15yr adj
  const govStateRow = findRow(ws, 'State Adjuster for Govt', { startRow: 85, endRow: 120, cols: [1, 2, 3] });
  if (govStateRow !== -1) {
    // Skip the "State/Group" header row
    for (let r = govStateRow + 1; r < govStateRow + 10; r++) {
      const col1 = cellStr(ws, r, 1);
      if (!col1) continue;
      if (/baltimore|temporary|lender/i.test(col1)) break;
      if (/state.?group|30yr|15yr/i.test(col1)) continue; // skip header

      // State code is in col 2
      const stateCode = cellStr(ws, r, 2);
      if (!stateCode || !/^[A-Z]{2}$/.test(stateCode)) continue;

      // Values in cols 4 (30yr) and 5 (15yr) — col 3 is empty
      const adj30 = parseLlpa(cellVal(ws, r, 4));
      const adj15 = parseLlpa(cellVal(ws, r, 5));
      if (adj30 === null && adj15 === null) continue;

      result.stateAdj[stateCode] = { adj30yr: adj30 || 0, adj15yr: adj15 || 0 };
    }
  }

  // Lender fees
  const feeRow = findRow(ws, 'Lender Fees', { startRow: 110, endRow: 130, cols: [1, 2, 3] });
  if (feeRow !== -1) {
    const feeStr = cellStr(ws, feeRow, 2) || cellStr(ws, feeRow, 3);
    const feeMatch = feeStr.match(/\$?([\d,]+)/);
    if (feeMatch) result.lenderFee = parseInt(feeMatch[1].replace(/,/g, ''), 10);
    // Check for streamline fee
    const slStr = cellStr(ws, feeRow + 1, 2) || cellStr(ws, feeRow + 1, 3);
    const slMatch = slStr.match(/\$?([\d,]+)/);
    if (slMatch) result.streamlineFee = parseInt(slMatch[1].replace(/,/g, ''), 10);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Jumbo adjustments (JUMBO sheet)
// ---------------------------------------------------------------------------

/**
 * Parse Jumbo FICO/LTV grid + loan amount adjustments from the JUMBO sheet.
 */
function parseJumboAdjustments(ws) {
  if (!ws) return null;

  const result = {
    ficoLtvGrid: {},
    ltvBands: [],
    occupancyAdj: {},
    purposeAdj: {},
    dtiAdj: {},
    loanAmtAdj: [],
    lenderFee: 1395,
  };

  // FICO/LTV grid — header row has LTV bands starting around col 7 (H)
  // Find the header row by looking for "LTV/CLTV" or "<=55"
  const headerRow = findRow(ws, 'LTV/CLTV', { startRow: 38, endRow: 50, cols: [4, 5, 6] });
  if (headerRow === -1) return result;

  // Read LTV bands from the header
  for (let c = 7; c <= 15; c++) {
    const v = cellVal(ws, headerRow, c);
    if (v === null) break;
    const band = normalizeLtvBand(v);
    if (band) result.ltvBands.push({ col: c, band });
  }

  // FICO rows follow the header
  for (let r = headerRow + 1; r < headerRow + 10; r++) {
    // Amort type in col 3 (D), FICO in col 5 (F)
    const ficoLabel = cellStr(ws, r, 5);
    if (!ficoLabel || !/\d/.test(ficoLabel)) continue;
    // Stop if we hit a non-data row
    if (/noo|2nd|purchase|cash|occupancy/i.test(ficoLabel)) break;

    const values = result.ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
    if (values.some(v => v !== null)) {
      const normalized = ficoLabel.replace(/\s*[-–]\s*/g, '-').replace(/\+/, '+');
      result.ficoLtvGrid[normalized] = values;
    }
  }

  // Occupancy adjustments — search for "NOO" or "2nd Home"
  const occRow = findRow(ws, 'NOO', { startRow: headerRow + 5, endRow: headerRow + 20, cols: [3, 4, 5] });
  if (occRow !== -1) {
    result.occupancyAdj.investment = result.ltvBands.map(lb => parseLlpa(cellVal(ws, occRow, lb.col)));
    const shRow = findRow(ws, '2nd Home', { startRow: occRow, endRow: occRow + 3, cols: [3, 4, 5] });
    if (shRow !== -1) {
      result.occupancyAdj.secondHome = result.ltvBands.map(lb => parseLlpa(cellVal(ws, shRow, lb.col)));
    }
  }

  // Loan purpose adjustments
  const purchRow = findRow(ws, 'PURCHASE', { startRow: headerRow + 10, endRow: headerRow + 25, cols: [3, 4, 5] });
  if (purchRow !== -1) {
    result.purposeAdj.purchase = result.ltvBands.map(lb => parseLlpa(cellVal(ws, purchRow, lb.col)));
    const coRow = findRow(ws, 'CASH-OUT', { startRow: purchRow, endRow: purchRow + 5, cols: [3, 4, 5] });
    if (coRow !== -1) {
      result.purposeAdj.cashout = result.ltvBands.map(lb => parseLlpa(cellVal(ws, coRow, lb.col)));
    }
  }

  // DTI adjustments
  const dtiLowRow = findRow(ws, 'DTI <= 30', { startRow: headerRow + 15, endRow: headerRow + 30, cols: [3, 4, 5] });
  if (dtiLowRow !== -1) {
    result.dtiAdj.low = result.ltvBands.map(lb => parseLlpa(cellVal(ws, dtiLowRow, lb.col)));
  }
  const dtiHighRow = findRow(ws, 'DTI > 45', { startRow: headerRow + 15, endRow: headerRow + 30, cols: [3, 4, 5] });
  if (dtiHighRow !== -1) {
    result.dtiAdj.high = result.ltvBands.map(lb => parseLlpa(cellVal(ws, dtiHighRow, lb.col)));
  }

  // Loan Amount Adjusters — labels in col 3, values in col 6
  const laRow = findRow(ws, 'LOAN AMOUNT ADJUSTERS', { startRow: headerRow + 20, endRow: headerRow + 40, cols: [3, 4, 5] });
  if (laRow !== -1) {
    for (let r = laRow + 1; r < laRow + 15; r++) {
      const label = cellStr(ws, r, 3) || cellStr(ws, r, 4);
      if (!label) continue;
      if (/max\s*price|lender\s*fee/i.test(label)) break;

      // Parse "L.A: <=$900,000" or "L.A: $900,001-$1,000,000"
      const rangeMatch = label.match(/\$?([\d,]+)\s*[-–]\s*\$?([\d,]+)/);
      const leMatch = label.match(/[<≤]=?\s*\$?([\d,]+)/);

      let range = null;
      if (rangeMatch) {
        range = {
          min: parseInt(rangeMatch[1].replace(/,/g, ''), 10),
          max: parseInt(rangeMatch[2].replace(/,/g, ''), 10),
        };
      } else if (leMatch) {
        range = { min: 0, max: parseInt(leMatch[1].replace(/,/g, ''), 10) };
      }
      if (!range) continue;

      const val = parseLlpa(cellVal(ws, r, 6));
      if (val === null) continue;

      result.loanAmtAdj.push({
        min: range.min,
        max: range.max,
        adj30yr: val,
        adj15yr: val,
      });
    }
  }

  // Lender fee
  const jFeeRow = findRow(ws, 'Lender Fees', { startRow: 80, endRow: 100, cols: [1, 2, 3] });
  if (jFeeRow !== -1) {
    const feeStr = cellStr(ws, jFeeRow, 2) || cellStr(ws, jFeeRow, 3);
    const feeMatch = feeStr.match(/\$?([\d,]+)/);
    if (feeMatch) result.lenderFee = parseInt(feeMatch[1].replace(/,/g, ''), 10);
  }

  result.ltvBands = result.ltvBands.map(lb => lb.band);
  return result;
}

// ---------------------------------------------------------------------------
// NOO and 2nd Home additional adjustments (LLPAS sheet right side)
// ---------------------------------------------------------------------------

/**
 * Parse NOO Additional Adjustments and 2nd Home Additional Adjustments
 * from the right side of the LLPAS sheet (cols 12-19).
 */
function parseNooAndSecondHomeAdj(ws) {
  if (!ws) return null;

  const result = { noo: {}, secondHome: {} };

  // NOO Additional Adjustments — search cols 12-14
  const nooRow = findRow(ws, 'NOO Additional Adjustments', { startRow: 12, endRow: 25, cols: [12, 13, 14] });
  if (nooRow !== -1) {
    // LTV bands on the next row
    const nooHeaderRow = nooRow + 1;
    const ltvBands = [];
    for (let c = 14; c <= 20; c++) {
      const v = cellVal(ws, nooHeaderRow, c);
      if (v === null) break;
      const band = normalizeLtvBand(v);
      if (band) ltvBands.push({ col: c, band });
    }

    for (let r = nooHeaderRow + 1; r < nooHeaderRow + 8; r++) {
      const label = cellStr(ws, r, 13);
      if (!label) continue;
      if (/2nd\s*home|owned\s*prop/i.test(label)) break;

      const values = ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
      const key = label.toLowerCase().replace(/\s+/g, '_');
      if (values.some(v => v !== null)) {
        result.noo[key] = { values, ltvBands: ltvBands.map(lb => lb.band) };
      }
    }
  }

  // 2nd Home Additional Adjustments
  const shRow = findRow(ws, '2nd Home Additional Adjustments', { startRow: 20, endRow: 35, cols: [12, 13, 14] });
  if (shRow !== -1) {
    const shHeaderRow = shRow + 1;
    const ltvBands = [];
    for (let c = 14; c <= 20; c++) {
      const v = cellVal(ws, shHeaderRow, c);
      if (v === null) break;
      const band = normalizeLtvBand(v);
      if (band) ltvBands.push({ col: c, band });
    }

    for (let r = shHeaderRow + 1; r < shHeaderRow + 5; r++) {
      const label = cellStr(ws, r, 13);
      if (!label) continue;
      if (/owned\s*prop|state/i.test(label)) break;

      const values = ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
      const key = label.toLowerCase().replace(/\s+/g, '_');
      if (values.some(v => v !== null)) {
        result.secondHome[key] = { values, ltvBands: ltvBands.map(lb => lb.band) };
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse AmWest rate sheet XLSX.
 * @param {Buffer|ArrayBuffer} xlsxBuffer - raw XLSX file
 * @returns full parsed result with programs + all adjustment data
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
  if (govWs) programs.push(...parseConvSheet(govWs));

  // Parse JUMBO sheet
  const jumboWs = wb.Sheets['JUMBO'];
  if (jumboWs) programs.push(...parseConvSheet(jumboWs));

  // ─── Parse adjustment sections ────────────────────────────────────

  // Fast Track LLPAs (FFT & FMFT products)
  const ftLlpas = parseConvLlpaSheet(wb.Sheets['FT_LLPAS']);

  // Agency LLPAs (DU/LP standard products)
  const agencyLlpas = parseConvLlpaSheet(wb.Sheets['LLPAS']);

  // NOO + 2nd Home additional adjustments (LLPAS sheet right side only)
  const nooSecondHome = parseNooAndSecondHomeAdj(wb.Sheets['LLPAS']);

  // Other price adjustments + State adjustments (from LLPAS sheet — same on both)
  const otherPriceAdj = parseOtherPriceAdj(wb.Sheets['LLPAS'] || wb.Sheets['FT_LLPAS']);
  const stateAdj = parseStateAdj(wb.Sheets['LLPAS'] || wb.Sheets['FT_LLPAS']);

  // Government adjustments
  const govAdj = parseGovAdjustments(govWs);

  // Jumbo adjustments
  const jumboAdj = parseJumboAdjustments(jumboWs);

  // ─── Build output in Keystone-compatible format ───────────────────

  // Use agency LLPAs as the primary source (standard products are more common)
  // Fast Track LLPAs stored separately for programs tagged isFastTrack
  const primaryLlpas = agencyLlpas || ftLlpas;
  const llpas = primaryLlpas ? {
    purchase: primaryLlpas.ficoLtvGrids.purchase,
    refinance: primaryLlpas.ficoLtvGrids.refinance,
    cashout: primaryLlpas.ficoLtvGrids.cashout,
    ltvBands: primaryLlpas.ltvBuckets.purchaseRefi,
  } : null;

  // Combine loan amount adjustments from all sources
  const loanAmountAdj = [
    ...(otherPriceAdj?.loanAmtAdj || []),
  ];

  // Merge state adjustments (conv + gov — conv takes precedence)
  const mergedStateAdj = { ...stateAdj };
  // Gov state adj stored under govAdj for separate application

  return {
    sheetDate,
    programs,
    llpas,
    loanAmountAdj,
    stateAdj: mergedStateAdj,
    specPayups: {},  // AmWest doesn't have spec payup grids like Keystone
    pricingSpecials: null,
    occupancyAdj: null,  // Handled via additionalAdjustments in LLPA grids
    lenderFee: 1295,
    compCap: { purchase: 4595, refinance: 3595 },
    // AmWest-specific: full LLPA data for both tiers
    fastTrackLlpas: ftLlpas,
    agencyLlpas: agencyLlpas,
    nooSecondHomeAdj: nooSecondHome,
    govAdj,
    jumboAdj,
  };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
