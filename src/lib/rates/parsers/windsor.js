/**
 * Windsor Mortgage / Plains Commerce Rate Sheet Parser
 *
 * XLSX with 16 sheets:
 *   - "Conventional and Government" — main rate grid
 *   - "Gov ARM" — government ARM products
 *   - "Jumbo 1"..."Jumbo 4 ARM" — jumbo tiers
 *   - "Conv LLPA" — conventional FICO/LTV grids + product features + state tiers
 *   - "Gov LLPA" — government FICO adjustments + VA/FHA/USDA adjustments
 *   - "Jumbo 4 LLPA" — jumbo FICO/LTV grid + per-state adjusters
 *   - "LPMI", "FHA Flex"
 *
 * Layout (main sheet): 4 products side-by-side per section row.
 *   Columns: A-E (0-4), F-J (5-9), K-O (10-14), P-T (15-19)
 *   Each group: Rate, 15 Day, 30 Day, 45 Day, 60 Day
 *
 * Pricing: 100-based (100 = par, >100 = rebate, <100 = cost).
 * LLPA sign: negative = cost in sheet. Parser negates to positive = cost (engine convention).
 *
 * Exports: parseRates, parse, lenderId
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');

const lenderId = 'windsor';

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

function normalizeLtvBand(str) {
  if (str === null || str === undefined) return null;
  return String(str)
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/\s+/g, '')
    .replace(/\.00/g, '')
    .replace(/%/g, '');
}

/** Parse LLPA value. Windsor uses negative = cost. Negate to match engine convention (positive = cost). */
function parseLlpa(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'na' || lower === 'n/a' || lower === '' || lower === '-') return null;
    const n = parseFloat(lower);
    if (isNaN(n)) return null;
    return n === 0 ? 0 : -n; // negate: sheet negative = cost → engine positive = cost
  }
  if (typeof val === 'number') return val === 0 ? 0 : -val;
  return null;
}

/** Parse a flat adjustment value (no negation — some sections use positive = credit). */
function parseAdj(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const n = parseFloat(val.trim());
    if (isNaN(n)) return null;
    return n;
  }
  if (typeof val === 'number') return val;
  return null;
}

// ---------------------------------------------------------------------------
// Rate extraction (unchanged from original)
// ---------------------------------------------------------------------------

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

function parseProductHeader(header) {
  if (!header || typeof header !== 'string') return null;
  // Normalize Unicode comparison operators to ASCII so the loan-amount regex
  // can match sections like "30/25 Year Fixed ≤$275K" (Windsor uses ≤ U+2264).
  let s = header.trim()
    .replace(/[\^*]+/g, '')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .trim();

  let loanType = 'conventional';
  let isStreamline = false;
  let isHighBalance = false;
  let isHomeReady = false;
  let variant = null;
  let productType = 'fixed';
  let armStructure = null;
  let term = null;
  let isJumbo = false;
  let jumboTier = null;

  // Jumbo detection — Windsor has "Prime Jumbo 1/2/3/4" sheets, each a different product tier
  const jumboMatch = s.match(/\bPrime\s*Jumbo\s*(\d+)\b/i);
  if (jumboMatch) {
    isJumbo = true;
    jumboTier = jumboMatch[1];
  }

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

  const armMatch = s.match(/(\d+)\/(\d+)m?\s*(SOFR|CMT)?\s*(High\s*Balance\s*)?ARM/i);
  if (armMatch) {
    productType = 'arm';
    armStructure = `${armMatch[1]}/${armMatch[2]}`;
    term = 30;
  }

  if (!term) {
    const termMatch = s.match(/(\d+)(?:\/\d+)?\s*(?:Year|Yr)\b/i);
    if (termMatch) {
      const t = parseInt(termMatch[1], 10);
      if (t >= 10 && t <= 40) term = t;
    }
  }
  if (!term) term = 30;

  let loanAmountLabel = null;
  const amtMatch = s.match(/(>|<=?)\s*\$?(\d+)K?\b/gi);
  if (amtMatch) loanAmountLabel = amtMatch.join(' ').replace(/\$/g, '');

  let occupancy = 'primary';
  if (/\bSecond\s*Home\b/i.test(s)) occupancy = 'secondary';
  if (/\bInvestment\b/i.test(s)) occupancy = 'investment';

  // Detect state-specific rows (e.g., "30/25 Year Fixed Florida >$350K")
  // Windsor has special pricing for FL — store as a state filter so the
  // engine can match it only when state === 'FL'.
  let state = null;
  if (/\bFlorida\b/i.test(s) || /\bFL\b/.test(s)) state = 'FL';
  // Add other states as Windsor adds them.

  return { loanType, term, productType, armStructure, isHighBalance, isStreamline, isHomeReady, variant, occupancy, loanAmountLabel, state, isJumbo, jumboTier };
}

/**
 * Convert a loan amount label like ">350K", "<=275K", "> 250K <= 275K"
 * into a {min, max} range in dollars. Returns null if no parseable info.
 */
function parseLoanAmountRange(label) {
  if (!label) return null;
  // Find all numeric tokens with K suffix and their preceding operator
  const matches = [...label.matchAll(/(>=?|<=?)\s*\$?(\d+)K?/gi)];
  if (matches.length === 0) return null;
  let min = null;
  let max = null;
  for (const m of matches) {
    const op = m[1];
    const dollars = parseInt(m[2], 10) * 1000;
    if (op === '>') min = dollars + 1;
    else if (op === '>=') min = dollars;
    else if (op === '<=') max = dollars;
    else if (op === '<') max = dollars - 1;
  }
  return { min, max };
}

function makeId(parsed) {
  const parts = [];
  if (parsed.isJumbo) parts.push(`jumbo${parsed.jumboTier || ''}`);
  else parts.push(parsed.loanType);
  parts.push(`${parsed.term}yr`, parsed.productType);
  if (parsed.armStructure) parts.push(parsed.armStructure.replace('/', '-'));
  if (parsed.isHighBalance) parts.push('highbal');
  if (parsed.isStreamline) parts.push('streamline');
  if (parsed.isHomeReady) parts.push('homeready');
  if (parsed.occupancy === 'secondary') parts.push('2ndhome');
  if (parsed.occupancy === 'investment') parts.push('investment');
  if (parsed.state) parts.push(parsed.state.toLowerCase());
  if (parsed.loanAmountLabel) {
    const amt = parsed.loanAmountLabel.replace(/[><=\s]/g, '').replace(/K/gi, 'k');
    parts.push(amt);
  }
  return parts.join('_');
}

function makeProgramName(parsed) {
  const parts = [];
  if (parsed.isJumbo) {
    parts.push(`Prime Jumbo ${parsed.jumboTier || ''}`.trim());
  } else {
    switch (parsed.loanType) {
      case 'conventional': parts.push('Conventional'); break;
      case 'fha': parts.push('FHA'); break;
      case 'va': parts.push('VA'); break;
      case 'usda': parts.push('USDA'); break;
      default: parts.push(parsed.loanType);
    }
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
  if (parsed.occupancy === 'investment') parts.push('Investment');
  if (parsed.state) parts.push(parsed.state);
  if (parsed.loanAmountLabel) parts.push(parsed.loanAmountLabel);
  return parts.join(' ');
}

function parseSheet(ws, sheetLabel) {
  const programs = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxRow = range.e.r;

  const colGroups = [
    { rateCol: 0, lockCols: [{ col: 1, days: 15 }, { col: 2, days: 30 }, { col: 3, days: 45 }, { col: 4, days: 60 }] },
    { rateCol: 5, lockCols: [{ col: 6, days: 15 }, { col: 7, days: 30 }, { col: 8, days: 45 }, { col: 9, days: 60 }] },
    { rateCol: 10, lockCols: [{ col: 11, days: 15 }, { col: 12, days: 30 }, { col: 13, days: 45 }, { col: 14, days: 60 }] },
    { rateCol: 15, lockCols: [{ col: 16, days: 15 }, { col: 17, days: 30 }, { col: 18, days: 45 }, { col: 19, days: 60 }] },
  ];

  for (let r = 0; r <= maxRow; r++) {
    const hasRateHeader = colGroups.some(g => /^Rate$/i.test(cellStr(ws, r, g.rateCol)));
    if (!hasRateHeader) continue;

    const nameRow = r - 1;
    for (const group of colGroups) {
      if (!/^Rate$/i.test(cellStr(ws, r, group.rateCol))) continue;

      const productName = cellStr(ws, nameRow, group.rateCol);
      if (!productName || productName.length < 5) continue;

      const parsed = parseProductHeader(productName);
      if (!parsed) continue;

      // Skip state-specific rows — engine doesn't filter by state at the
      // product level, and these would shadow the base product for non-matching
      // borrowers. TODO: revisit when engine supports state filtering on products.
      if (parsed.state) continue;

      const rates = extractRates(ws, r + 1, group.rateCol, group.lockCols);
      if (rates.length === 0) continue;

      const id = makeId(parsed);
      const lockDays = [...new Set(rates.map(x => x.lockDays))].sort((a, b) => a - b);
      let subcategory = parsed.loanType;
      if (parsed.isJumbo) subcategory = 'jumbo';
      else if (parsed.loanType === 'conventional' && parsed.isHighBalance) subcategory = 'conventional';

      const loanAmountRange = parseLoanAmountRange(parsed.loanAmountLabel);
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
        loanAmountRange,
        sheetSource: sheetLabel || null,
      });
    }
  }

  return programs;
}

// ---------------------------------------------------------------------------
// Conv LLPA parsing
// ---------------------------------------------------------------------------

/**
 * Parse a FICO/LTV grid from the Conv LLPA sheet.
 * FICO labels in col B (1), LTV bands in cols D-L (3-11).
 * @param {object} ws - worksheet
 * @param {number} headerRow - 0-indexed row with LTV band headers (e.g. "<=30")
 * @param {number} maxFicoRows - max FICO data rows
 * @returns {{ matrix, ltvBands }} or null
 */
function parseConvLlpaMatrix(ws, headerRow, maxFicoRows = 12) {
  const ltvBands = [];
  for (let c = 3; c <= 12; c++) {
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
    if (!label) continue;
    if (!/\d/.test(label)) continue;
    if (/purchase|refinance|cashout|product\s*feature|llpa/i.test(label)) break;

    const values = ltvBands.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
    if (values.some(v => v !== null)) {
      const normalizedLabel = label.replace(/\s*[-–]\s*/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=');
      matrix[normalizedLabel] = values;
    }
  }

  return { matrix, ltvBands: ltvBands.map(lb => lb.band) };
}

/**
 * Parse product feature adjustment grid (ARM, Condo, Investment, etc.)
 * Same column layout as FICO/LTV grids.
 */
function parseProductFeatureGrid(ws, headerRow, numLtvCols) {
  const additional = {};
  for (let r = headerRow + 1; r < headerRow + 15; r++) {
    const label = cellStr(ws, r, 1);
    if (!label) continue;
    if (/fico|purchase|refinance|cashout|other\s*adj|llpa\s*cap|lender/i.test(label)) break;
    if (/product\s*feature|^ltv$/i.test(label)) continue;

    const values = [];
    for (let c = 3; c < 3 + numLtvCols; c++) {
      values.push(parseLlpa(cellVal(ws, r, c)));
    }

    const key = label.toLowerCase();
    if (/^arm/i.test(key)) additional.arm = values;
    else if (/condo/i.test(key)) additional.condo = values;
    else if (/investment/i.test(key)) additional.investment = values;
    else if (/second\s*home/i.test(key)) additional.secondHome = values;
    else if (/manufactured/i.test(key)) additional.manufactured = values;
    else if (/2[-–]4\s*unit/i.test(key)) additional['2to4unit'] = values;
    else if (/high\s*bal.*fixed|hb.*fixed/i.test(key)) additional.highBalFixed = values;
    else if (/high\s*bal.*arm|hb.*arm/i.test(key)) additional.highBalArm = values;
    else if (/secondary\s*fin|sub\s*fin/i.test(key)) additional.subFinancing = values;
    else if (/dti/i.test(key)) additional.dtiOver40 = values;
  }
  return additional;
}

/**
 * Parse Conv LLPA sheet — FICO/LTV grids, product features, state tiers, fees.
 */
function parseConvLlpas(ws) {
  if (!ws) return null;

  const result = {
    ficoLtvGrids: { purchase: {}, refinance: {}, cashout: {} },
    additionalAdjustments: { purchase: {}, refinance: {}, cashout: {} },
    ltvBuckets: { purchaseRefi: [], cashout: [] },
    stateAdj: {},
    lenderFee: 1295,
    otherAdj: {},
    special: null,
  };

  // Purchase FICO/LTV grid — find "Purchase FICO" section
  // Layout: "Purchase FICO..." label, then blank row with "LTV", then FICO/LTV header row
  const purchaseRow = findRow(ws, 'Purchase', { startRow: 13, endRow: 22, cols: [1, 2] });
  if (purchaseRow !== -1) {
    // Header with LTV bands is 2 rows below the "Purchase FICO" label
    const purchaseHeaderRow = findRow(ws, 'FICO', { startRow: purchaseRow + 1, endRow: purchaseRow + 4, cols: [1] });
    if (purchaseHeaderRow !== -1) {
      const grid = parseConvLlpaMatrix(ws, purchaseHeaderRow);
      if (grid) {
        result.ficoLtvGrids.purchase = grid.matrix;
        result.ltvBuckets.purchaseRefi = grid.ltvBands;
      }
    }
  }

  // Non Cashout Refinance grid
  const refiRow = findRow(ws, 'Non Cashout Refinance', { startRow: 27, endRow: 38, cols: [1, 2] });
  if (refiRow !== -1) {
    const refiHeaderRow = findRow(ws, 'FICO', { startRow: refiRow + 1, endRow: refiRow + 4, cols: [1] });
    if (refiHeaderRow !== -1) {
      const grid = parseConvLlpaMatrix(ws, refiHeaderRow);
      if (grid) result.ficoLtvGrids.refinance = grid.matrix;
    }
  }

  // Cash Out Refinance grid
  const cashoutRow = findRow(ws, 'Cash Out Refinance', { startRow: 41, endRow: 52, cols: [1, 2] });
  if (cashoutRow !== -1) {
    const cashoutHeaderRow = findRow(ws, 'FICO', { startRow: cashoutRow + 1, endRow: cashoutRow + 4, cols: [1] });
    if (cashoutHeaderRow !== -1) {
      const grid = parseConvLlpaMatrix(ws, cashoutHeaderRow);
      if (grid) {
        result.ficoLtvGrids.cashout = grid.matrix;
        result.ltvBuckets.cashout = grid.ltvBands;
      }
    }
  }

  // Product Feature grids — Purchase, Refi, Cashout
  // Product Feature grids: label row, "LTV" row, "Product Feature" header with LTV bands, then data
  const purchFeatureRow = findRow(ws, 'Purchase - LLPAs by Product Feature', { startRow: 55, endRow: 65, cols: [1, 2] });
  if (purchFeatureRow !== -1) {
    const headerRow = findRow(ws, 'Product Feature', { startRow: purchFeatureRow + 1, endRow: purchFeatureRow + 4, cols: [1] });
    if (headerRow !== -1) result.additionalAdjustments.purchase = parseProductFeatureGrid(ws, headerRow, result.ltvBuckets.purchaseRefi.length);
  }

  const refiFeatureRow = findRow(ws, 'Non Cashout Refinance - LLPAs by Product Feature', { startRow: 69, endRow: 80, cols: [1, 2] });
  if (refiFeatureRow !== -1) {
    const headerRow = findRow(ws, 'Product Feature', { startRow: refiFeatureRow + 1, endRow: refiFeatureRow + 4, cols: [1] });
    if (headerRow !== -1) result.additionalAdjustments.refinance = parseProductFeatureGrid(ws, headerRow, result.ltvBuckets.purchaseRefi.length);
  }

  const cashoutFeatureRow = findRow(ws, 'Cashout Refinance - LLPAs by Product Feature', { startRow: 83, endRow: 95, cols: [1, 2] });
  if (cashoutFeatureRow !== -1) {
    const headerRow = findRow(ws, 'Product Feature', { startRow: cashoutFeatureRow + 1, endRow: cashoutFeatureRow + 4, cols: [1] });
    if (headerRow !== -1) result.additionalAdjustments.cashout = parseProductFeatureGrid(ws, headerRow, result.ltvBuckets.cashout.length);
  }

  // Other Adjustments — scan for specific items
  const otherRow = findRow(ws, 'Other Adjustments', { startRow: 96, endRow: 110, cols: [0, 1, 2] });
  if (otherRow !== -1) {
    for (let r = otherRow + 1; r < otherRow + 12; r++) {
      const label = cellStr(ws, r, 1) || cellStr(ws, r, 0);
      if (!label) continue;
      if (/state\s*tier|conforming.*special/i.test(label)) break;

      const val = parseAdj(cellVal(ws, r, 4)) || parseAdj(cellVal(ws, r, 3));

      if (/lender.*admin.*fee/i.test(label)) {
        // Extract dollar amount
        const feeMatch = label.match(/\$?([\d,]+)/);
        if (feeMatch) result.lenderFee = parseInt(feeMatch[1].replace(/,/g, ''), 10);
        else if (val !== null) result.lenderFee = Math.abs(val);
        continue;
      }

      if (/escrow\s*waiver/i.test(label) && val !== null) {
        result.otherAdj.escrowWaiver = -val; // negate: negative in sheet = cost
      } else if (/texas.*cash.?out|50\(a\)/i.test(label) && val !== null) {
        result.otherAdj.texasCashout = -val;
      } else if (/buydown/i.test(label) && val !== null) {
        result.otherAdj.tempBuydown = -val;
      }
    }
  }

  // State Tier adjustments — col 1 = adjustment value, col 2 = state codes
  const stateRow = findRow(ws, 'State Tier', { startRow: 105, endRow: 120, cols: [1, 2] });
  if (stateRow !== -1) {
    for (let r = stateRow + 1; r < stateRow + 10; r++) {
      const adjVal = parseAdj(cellVal(ws, r, 1));
      if (adjVal === null) continue;
      const stateStr = cellStr(ws, r, 2);
      if (!stateStr) continue;

      const states = stateStr.split(/[,\s]+/).filter(s => /^[A-Z]{2}$/.test(s));
      for (const st of states) {
        result.stateAdj[st] = {
          adj30yr: adjVal,
          adj15yr: adjVal,
        };
      }
    }
  }

  // Conforming Conventional Special ($350K+, 680 FICO)
  const specialRow = findRow(ws, 'Conforming Conventional Special', { startRow: 108, endRow: 120, cols: [7, 8, 9] });
  if (specialRow !== -1) {
    const val = parseAdj(cellVal(ws, specialRow + 1, 9)) || parseAdj(cellVal(ws, specialRow + 1, 10));
    if (val !== null) {
      result.special = { label: 'Conforming Conv $350K+ 680 FICO', value: val };
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Gov LLPA parsing
// ---------------------------------------------------------------------------

/**
 * Parse Gov LLPA sheet — 1D FICO grid, VA/FHA/USDA adjustments, state tiers.
 */
function parseGovLlpas(ws) {
  if (!ws) return null;

  const result = {
    ficoAdj: { conforming: {}, highBalance: {} },
    vaAdj: {},
    fhaAdj: {},
    usdaAdj: {},
    vaIrrrl: {},
    stateAdj: {},
    lenderFee: 1295,
    streamlineFee: 659,
    irrrlFee: 595,
    manufacturedAdj: 0,
    otherAdj: {},
  };

  // FICO grid — col B = FICO label, col D = Conforming, col E = High Balance
  const ficoRow = findRow(ws, 'Government FICO Adjustments', { startRow: 12, endRow: 20, cols: [1, 2] });
  if (ficoRow !== -1) {
    const headerRow = ficoRow + 1; // LTV headers (but Gov is just Conforming/HB)
    for (let r = headerRow + 1; r < headerRow + 14; r++) {
      const label = cellStr(ws, r, 1);
      if (!label || !/\d/.test(label)) continue;
      if (/price\s*adj|va\s|fha\s/i.test(label)) break;

      const confVal = parseLlpa(cellVal(ws, r, 3));
      const hbVal = parseLlpa(cellVal(ws, r, 4));

      const normalizedLabel = label.replace(/\s*[-–]\s*/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=');
      if (confVal !== null) result.ficoAdj.conforming[normalizedLabel] = confVal;
      if (hbVal !== null) result.ficoAdj.highBalance[normalizedLabel] = hbVal;
    }
  }

  // VA Price Adjustments — labels in col 1, values in col 5
  const vaRow = findRow(ws, 'VA Price Adjustments', { startRow: 28, endRow: 40, cols: [1, 2] });
  if (vaRow !== -1) {
    for (let r = vaRow + 1; r < vaRow + 10; r++) {
      const label = cellStr(ws, r, 1);
      if (!label) continue;
      if (/^va\s*irrrl$/i.test(label) || /fha\s*price|usda|state|other/i.test(label)) break;
      const val = parseLlpa(cellVal(ws, r, 5));
      if (val !== null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.vaAdj[key] = val;
      }
    }
  }

  // FHA Price Adjustments — labels in col 7, values in col 10
  const fhaRow = findRow(ws, 'FHA Price Adjustments', { startRow: 28, endRow: 42, cols: [7] });
  if (fhaRow !== -1) {
    for (let r = fhaRow + 1; r < fhaRow + 10; r++) {
      const label = cellStr(ws, r, 7);
      if (!label) continue;
      if (/usda|state|other/i.test(label)) break;
      const val = parseLlpa(cellVal(ws, r, 10));
      if (val !== null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.fhaAdj[key] = val;
      }
    }
  }

  // USDA Adjustments — labels in col 7, values in col 10
  const usdaRow = findRow(ws, 'USDA Price Adjustments', { startRow: 36, endRow: 48, cols: [7] });
  if (usdaRow !== -1) {
    for (let r = usdaRow + 1; r < usdaRow + 5; r++) {
      const label = cellStr(ws, r, 7);
      if (!label) continue;
      const val = parseLlpa(cellVal(ws, r, 10));
      if (val !== null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.usdaAdj[key] = val;
      }
    }
  }

  // VA IRRRL adjustments — labels in col 1, values in col 5
  const irrlRow = findRow(ws, 'VA IRRRL', { startRow: 38, endRow: 52, cols: [1, 2] });
  if (irrlRow !== -1) {
    for (let r = irrlRow + 1; r < irrlRow + 12; r++) {
      const label = cellStr(ws, r, 1);
      if (!label) continue;
      if (/state\s*adj|other\s*adj|manufactured/i.test(label)) break;
      const val = parseLlpa(cellVal(ws, r, 5));
      if (val !== null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.vaIrrrl[key] = val;
      }
    }
  }

  // State Adjuster — values in col 8, states in col 1
  const stateRow = findRow(ws, 'State Adjuster', { startRow: 48, endRow: 60, cols: [8] });
  if (stateRow !== -1) {
    for (let r = stateRow + 1; r < stateRow + 8; r++) {
      const stateStr = cellStr(ws, r, 1);
      if (!stateStr) continue;
      const adjVal = parseAdj(cellVal(ws, r, 8));
      if (adjVal === null) continue;
      const states = stateStr.split(/[,\s]+/).filter(s => /^[A-Z]{2}$/.test(s));
      for (const st of states) {
        result.stateAdj[st] = { adj30yr: adjVal, adj15yr: adjVal };
      }
    }
  }

  // Other Adjustments + Lender Fees
  const otherRow = findRow(ws, 'Other Adjustments', { startRow: 55, endRow: 70, cols: [0, 1, 2] });
  if (otherRow !== -1) {
    for (let r = otherRow + 1; r < otherRow + 15; r++) {
      const label = cellStr(ws, r, 1) || cellStr(ws, r, 0);
      if (!label) continue;

      // Manufactured Home
      if (/manufactured/i.test(label)) {
        const val = parseLlpa(cellVal(ws, r, 4));
        if (val !== null) result.manufacturedAdj = val;
        continue;
      }

      // Lender Administration Fee — multiple tiers
      if (/lender.*admin.*fee/i.test(label)) {
        const feeMatch = label.match(/\$?([\d,]+)/);
        if (feeMatch) {
          const fee = parseInt(feeMatch[1].replace(/,/g, ''), 10);
          if (/streamline|irrrl/i.test(label)) result.irrrlFee = fee;
          else if (/fha\s*flex/i.test(label)) result.streamlineFee = fee;
          else result.lenderFee = fee;
        }
        continue;
      }

      const val = parseAdj(cellVal(ws, r, 4));
      if (val !== null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.otherAdj[key] = val;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Jumbo 4 LLPA parsing
// ---------------------------------------------------------------------------

/**
 * Parse Jumbo 4 LLPA sheet — FICO/LTV grid, flat adjusters, per-state adjusters.
 */
function parseJumbo4Llpas(ws) {
  if (!ws) return null;

  const result = {
    ficoLtvGrid: {},
    ltvBands: [],
    miscAdj: {},
    stateAdj: {},
    lenderFee: 1295,
    maxNetPrice: null,
  };

  // FICO/LTV grid — header row has exactly "FICO" in col 1, LTV bands in cols 2-8
  // Use findRow with '0-50' to find the LTV band row (avoids matching "FICO/LTV/CLTV..." title)
  let ficoHeaderRow = -1;
  for (let r = 14; r <= 22; r++) {
    const v = cellStr(ws, r, 1);
    if (v === 'FICO') { ficoHeaderRow = r; break; }
  }
  if (ficoHeaderRow !== -1) {
    const ltvBandCols = [];
    for (let c = 2; c <= 8; c++) {
      const v = cellVal(ws, ficoHeaderRow, c);
      if (v === null) break;
      const band = normalizeLtvBand(v);
      if (band) ltvBandCols.push({ col: c, band });
    }
    result.ltvBands = ltvBandCols.map(lb => lb.band);

    for (let r = ficoHeaderRow + 1; r < ficoHeaderRow + 8; r++) {
      const ficoLabel = cellStr(ws, r, 1);
      if (!ficoLabel || !/\d/.test(ficoLabel)) continue;
      if (/state|misc|adj/i.test(ficoLabel)) break;

      const values = ltvBandCols.map(lb => parseLlpa(cellVal(ws, r, lb.col)));
      if (values.some(v => v !== null)) {
        const normalized = ficoLabel.replace(/\s*[-–]\s*/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=');
        result.ficoLtvGrid[normalized] = values;
      }
    }
  }

  // Miscellaneous Adjusters — labels in col 10, values in col 12
  const miscRow = findRow(ws, 'Miscellaneous Adjusters', { startRow: 14, endRow: 22, cols: [10] });
  if (miscRow !== -1) {
    for (let r = miscRow + 1; r < miscRow + 15; r++) {
      const label = cellStr(ws, r, 10);
      if (!label) continue;
      if (/state\s*adj|arm\s*info|max\s*net/i.test(label)) break;

      const val = parseLlpa(cellVal(ws, r, 12));
      if (val !== null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        result.miscAdj[key] = val;
      }
    }
  }

  // State Adjusters — two-column layout: cols 1-3 (State, Fixed, ARM) and cols 4-6 (State, Fixed, ARM)
  const stateRow = findRow(ws, 'State Adjusters', { startRow: 22, endRow: 35, cols: [1] });
  if (stateRow !== -1) {
    for (let r = stateRow + 2; r < stateRow + 30; r++) {
      // Left column: state in col 1, fixed in col 2, arm in col 3
      const stLeft = cellStr(ws, r, 1);
      if (stLeft && /^[A-Z]{2}$/.test(stLeft)) {
        const fixedVal = parseLlpa(cellVal(ws, r, 2));
        const armVal = parseLlpa(cellVal(ws, r, 3));
        result.stateAdj[stLeft] = { fixed: fixedVal || 0, arm: armVal || 0 };
      }
      // Right column: state in col 4, fixed in col 5, arm in col 6
      const stRight = cellStr(ws, r, 4);
      if (stRight && /^[A-Z]{2}$/.test(stRight)) {
        const fixedVal = parseLlpa(cellVal(ws, r, 5));
        const armVal = parseLlpa(cellVal(ws, r, 6));
        result.stateAdj[stRight] = { fixed: fixedVal || 0, arm: armVal || 0 };
      }
    }
  }

  // Max Net Price — in the misc adj area
  const maxRow = findRow(ws, 'Max Net Price', { startRow: 52, endRow: 65, cols: [10] });
  if (maxRow !== -1) {
    const fixedMax = parseAdj(cellVal(ws, maxRow, 12));
    if (fixedMax !== null) result.maxNetPrice = { fixed: fixedMax };
  }

  // Lender Admin Fee
  const feeRow = findRow(ws, 'Lender Admin Fee', { startRow: 55, endRow: 65, cols: [10] });
  if (feeRow !== -1) {
    const feeVal = cellVal(ws, feeRow, 12);
    if (feeVal !== null) {
      const feeStr = String(feeVal);
      const feeMatch = feeStr.match(/\$?([\d,]+)/);
      if (feeMatch) result.lenderFee = parseInt(feeMatch[1].replace(/,/g, ''), 10);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

function parseRates(xlsxBuffer) {
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });

  // Extract date
  let sheetDate = null;
  const mainWs = wb.Sheets['Conventional and Government'];
  if (mainWs) {
    const dateVal = cellVal(mainWs, 0, 3);
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

  // Parse main sheet
  if (mainWs) programs.push(...parseSheet(mainWs, 'Conventional and Government'));

  // Parse Gov ARM
  const govArmWs = wb.Sheets['Gov ARM'];
  if (govArmWs) programs.push(...parseSheet(govArmWs, 'Gov ARM'));

  // Parse Jumbo sheets
  const jumboSheets = ['Jumbo 1', 'Jumbo 1 AUS', 'Jumbo 1 15YR', 'Jumbo 1 ARM',
    'Jumbo 2', 'Jumbo 2 AUS', 'Jumbo 3 AUS', 'Jumbo 4', 'Jumbo 4 ARM'];
  for (const name of jumboSheets) {
    const ws = wb.Sheets[name];
    if (ws) {
      const jumboPrograms = parseSheet(ws, name);
      for (const p of jumboPrograms) {
        p.category = 'agency';
        p.subcategory = 'jumbo';
      }
      programs.push(...jumboPrograms);
    }
  }

  // ─── Parse adjustment sections ────────────────────────────────────

  const convLlpas = parseConvLlpas(wb.Sheets['Conv LLPA']);
  const govLlpas = parseGovLlpas(wb.Sheets['Gov LLPA']);
  const jumbo4Llpas = parseJumbo4Llpas(wb.Sheets['Jumbo 4 LLPA']);

  // ─── Build output in standard format ──────────────────────────────

  const llpas = convLlpas ? {
    purchase: convLlpas.ficoLtvGrids.purchase,
    refinance: convLlpas.ficoLtvGrids.refinance,
    cashout: convLlpas.ficoLtvGrids.cashout,
    ltvBands: convLlpas.ltvBuckets.purchaseRefi,
  } : null;

  // Merge state adjustments from conv + gov (conv takes precedence)
  const mergedStateAdj = {};
  if (convLlpas?.stateAdj) Object.assign(mergedStateAdj, convLlpas.stateAdj);

  return {
    sheetDate,
    programs,
    llpas,
    loanAmountAdj: [],  // Windsor doesn't have explicit loan amount tiers in LLPA sheets
    stateAdj: mergedStateAdj,
    specPayups: {},
    pricingSpecials: convLlpas?.special ? { convSpecial: convLlpas.special } : null,
    occupancyAdj: null,  // Handled via additionalAdjustments in product feature grids
    lenderFee: convLlpas?.lenderFee || 1295,
    compCap: { purchase: 4595, refinance: 3595 },
    // Windsor-specific
    convLlpas,
    govAdj: govLlpas,
    jumboAdj: jumbo4Llpas,
  };
}

function parse({ xlsxBuffer }) {
  return parseRates(xlsxBuffer);
}

module.exports = { parseRates, parse, lenderId };
