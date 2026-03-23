#!/usr/bin/env node
/**
 * extract-lender-llpas.js
 *
 * Reads rate sheet XLSX files and extracts lender-specific LLPA data into JSON files.
 * Output: src/data/lender-llpas/{lenderId}.json
 *
 * Usage: node scripts/extract-lender-llpas.js
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const SHEETS_DIR = path.join(__dirname, '..', 'Work', 'Dev', 'Products', 'rate-sheets-analysis');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'lender-llpas');

// LTV column headers used across all lenders (standard GSE buckets)
const LTV_COLS_10 = ['<=30', '30.01-60', '60.01-70', '70.01-75', '75.01-80', '80.01-85', '85.01-90', '90.01-95', '95.01-97', '>97'];
const LTV_COLS_9 = ['<=30', '30.01-60', '60.01-70', '70.01-75', '75.01-80', '80.01-85', '85.01-90', '90.01-95', '95.01-97'];
const LTV_COLS_5 = ['<=30', '30.01-60', '60.01-70', '70.01-75', '75.01-80'];

// --- Helpers ---

function round(val, decimals = 4) {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function negate(val) {
  if (typeof val !== 'number' || isNaN(val)) return null;
  return round(-val);
}

function asNum(val) {
  if (typeof val === 'number' && !isNaN(val)) return round(val);
  if (typeof val === 'string') {
    const n = parseFloat(val);
    if (!isNaN(n)) return round(n);
  }
  return null;
}

function readSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

/**
 * Extract a FICO x LTV grid from rows.
 * @param {Array[]} rows - Array of row arrays
 * @param {number} startRow - 0-indexed row where FICO labels start (first data row)
 * @param {number} endRow - 0-indexed row after last data row (exclusive)
 * @param {number} dataColStart - column index where first LTV bucket value starts
 * @param {number} numCols - number of LTV columns
 * @param {number} labelCol - column index for FICO label
 * @param {Function} transform - optional transform for each value (e.g., negate)
 * @returns {Object} FICO tier -> array of values per LTV bucket
 */
function extractGrid(rows, startRow, endRow, dataColStart, numCols, labelCol, transform) {
  const grid = {};
  for (let r = startRow; r < endRow; r++) {
    const row = rows[r];
    if (!row) continue;
    const label = String(row[labelCol] || '').trim();
    if (!label) continue;
    const values = [];
    for (let c = dataColStart; c < dataColStart + numCols; c++) {
      const raw = row[c];
      let val = asNum(raw);
      if (transform && val !== null) val = transform(val);
      values.push(val);
    }
    grid[label] = values;
  }
  return grid;
}

/**
 * Extract attribute adjustments (condo, manufactured, etc.) from rows.
 * Returns an object keyed by normalized attribute name.
 */
function extractAttributes(rows, startRow, endRow, dataColStart, numCols, labelCol, transform) {
  const attrs = {};
  const nameMap = {
    'arms': 'arm',
    'arm': 'arm',
    'attached  condo': 'condo',
    'attached condo': 'condo',
    'condo': 'condo',
    '2 units': '2unit',
    '2-4 units': '2to4unit',
    '2 - 4 units': '2to4unit',
    '3-4 units': '3to4unit',
    'investment property': 'investment',
    'n/o/o': 'investment',
    'second homes': 'secondHome',
    'second home': 'secondHome',
    'second home ': 'secondHome',
    'loans w/ secondary financing': 'subFinancing',
    'sub financing': 'subFinancing',
    'subordinate financing': 'subFinancing',
    'highbal frm': 'highBalanceFRM',
    'highbal fixed': 'highBalanceFRM',
    'high balance fixed (term > 15 year fixed)': 'highBalanceFRM',
    'high balance fixed (term <= 15 year fixed)': 'highBalanceFRM15',
    'highbal arm': 'highBalanceARM',
    'high balance arm': 'highBalanceARM',
    'manufactured homes(1)': 'manufactured',
    'manufactured home': 'manufactured',
    'baltimore county-md': 'baltimoreCountyMD',
    'owner occupied (2 - 4 units), not included in llpa waiver': 'ownerOcc2to4unit',
  };
  for (let r = startRow; r < endRow; r++) {
    const row = rows[r];
    if (!row) continue;
    const rawLabel = String(row[labelCol] || '').trim();
    if (!rawLabel) continue;
    const key = nameMap[rawLabel.toLowerCase()] || null;
    if (!key) continue;
    const values = [];
    for (let c = dataColStart; c < dataColStart + numCols; c++) {
      const raw = row[c];
      if (raw === 'N/A' || raw === '') {
        values.push(null);
      } else {
        let val = asNum(raw);
        if (transform && val !== null) val = transform(val);
        values.push(val);
      }
    }
    attrs[key] = values;
  }
  return attrs;
}

function writeJSON(filename, data) {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  Written: ${filePath}`);
}

// --- EverStream ---

function extractEverStream() {
  console.log('\n=== Extracting EverStream LLPAs ===');
  const file = path.join(SHEETS_DIR, '96596_03202026_1533071001.xlsx');

  // --- Elite FNMA LLPA sheet: FICO x LTV grids + attribute adjustments ---
  const fnma = readSheet(file, 'Elite FNMA LLPA');

  // EverStream uses NEGATIVE = cost. We negate to our convention (POSITIVE = cost).
  const neg = negate;

  // Purchase FICO grid: rows 7-16, cols B(1)-J(9) = indices 1..9, data at cols 1..9
  // Actually: row 6 = headers, rows 7-16 = data. Col 0 = FICO label, cols 1-9 = LTV values
  const purchaseGrid = extractGrid(fnma, 7, 17, 1, 9, 0, neg);

  // Purchase attribute adjustments: rows 21-30
  const purchaseAttrs = extractAttributes(fnma, 21, 31, 1, 9, 0, neg);

  // Rate/Term Refi FICO grid: rows 36-45
  const refiGrid = extractGrid(fnma, 36, 46, 1, 9, 0, neg);

  // Rate/Term Refi attribute adjustments: rows 50-60
  const refiAttrs = extractAttributes(fnma, 50, 60, 1, 9, 0, neg);

  // Cash Out FICO grid: rows 65-74
  const cashoutGrid = extractGrid(fnma, 65, 75, 1, 9, 0, neg);

  // Cash Out attribute adjustments: rows 79-89
  const cashoutAttrs = extractAttributes(fnma, 79, 89, 1, 9, 0, neg);

  // --- Product Loan Amount LLPAs sheet: loan amount bands + other adjustments ---
  const prodSheet = readSheet(file, 'Product Loan Amount LLPAs');

  // Row 3 has min values for loan amount bands, row 4 has max values
  // We focus on FNMA Elite FRM 25/30Yr (row 33) as the primary conventional product
  const bandMins = prodSheet[3];
  const bandMaxs = prodSheet[4];

  // Build loan amount adjustment array from FNMA Elite FRM 30Yr (row 33)
  // Columns 2..28 are the loan amount bands
  const loanAmountAdj = [];
  for (let c = 2; c <= 28; c++) {
    const min = asNum(bandMins[c]);
    const max = asNum(bandMaxs[c]);
    const val = asNum(prodSheet[33][c]);
    if (min !== null && max !== null && val !== null) {
      loanAmountAdj.push({ min, max, adj: neg(val) });
    }
  }

  // Right-side columns from row 3 header:
  // Col 32 = "Property Type" -> Col 34 = Condo, Col 35 = Manufactured
  // Col 37 = "LTV > 95.00 & Fico <700", Col 38 = "LTV > 95.00", Col 39 = "LTV >85"
  // Col 40 = "Florida Condo LTV 85.01-90"
  // Col 42 = "AUS Type" -> Col 44 = "Manual UW"
  // Col 47-50 = FICO tiers: 0-619, 620-639, 640-699, 700+
  // Col 52 = "Purchase", Col 53 = "Rate/Term", Col 54 = "Cash Out"
  // Col 56 = "State" -> MI (Col 58)

  // Extract from representative row (row 6 = FHA Elite FRM 10Yr has all values)
  // But we want FNMA Elite FRM 30Yr (row 33)
  const refRow = prodSheet[6]; // Use first data row that has all adjustments populated

  // Right-side columns (verified exact positions from spreadsheet):
  // Col 32 = Condo, Col 33 = Manufactured
  // Col 35 = LTV>95 & FICO<700, Col 36 = LTV>95, Col 37 = LTV>85
  // Col 38 = Florida Condo LTV 85.01-90
  // Col 40 = Manual UW
  // Col 44 = FICO 0-619, Col 45 = FICO 620-639, Col 46 = FICO 640-699, Col 47 = FICO 700+
  // Col 48 = FICO <=680 (additional)
  // Col 50 = Purchase, Col 51 = Rate/Term, Col 52 = Cash Out
  // Col 54 = State MI adj

  const propertyTypeAdj = {
    condo: neg(asNum(refRow[32])),
    manufactured: neg(asNum(refRow[33])),
  };

  const ltvSpecialAdj = {
    'ltv95_fico700': neg(asNum(refRow[35])),
    'ltv95': neg(asNum(refRow[36])),
    'ltv85': neg(asNum(refRow[37])),
    'floridaCondoLtv85to90': neg(asNum(refRow[38])),
  };

  const ausAdj = {
    manualUW: neg(asNum(refRow[40])),
  };

  const ficoTierAdj = {
    '0-619': neg(asNum(refRow[44])),
    '620-639': neg(asNum(refRow[45])),
    '640-699': neg(asNum(refRow[46])),
    '700+': neg(asNum(refRow[47])),
  };

  const purposeAdj = {
    purchase: neg(asNum(refRow[50])),
    refinance: neg(asNum(refRow[51])),
    cashout: neg(asNum(refRow[52])),
  };

  const stateAdj = {
    MI: neg(asNum(refRow[54])),
  };

  const result = {
    lenderId: 'everstream',
    lenderName: 'EverStream Lending',
    lastUpdated: '2026-03-20',
    source: '96596_03202026_1533071001.xlsx',
    notes: 'EverStream uses negative=cost convention. All values negated to positive=cost.',
    ltvBuckets: LTV_COLS_9,
    ficoLtvGrids: {
      purchase: purchaseGrid,
      refinance: refiGrid,
      cashout: cashoutGrid,
    },
    additionalAdjustments: {
      purchase: purchaseAttrs,
      refinance: refiAttrs,
      cashout: cashoutAttrs,
    },
    loanAmountAdj,
    ficoTierAdj,
    purposeAdj,
    propertyTypeAdj,
    ltvSpecialAdj,
    ausAdj,
    stateAdj,
  };

  writeJSON('everstream.json', result);
  console.log(`  Purchase FICO tiers: ${Object.keys(purchaseGrid).length}`);
  console.log(`  Refi FICO tiers: ${Object.keys(refiGrid).length}`);
  console.log(`  Cashout FICO tiers: ${Object.keys(cashoutGrid).length}`);
  console.log(`  Loan amount bands: ${loanAmountAdj.length}`);
}

// --- AmWest ---

function extractAmWest() {
  console.log('\n=== Extracting AmWest LLPAs ===');
  const file = path.join(SHEETS_DIR, '47006_03202026_1444577602.xlsx');

  // AmWest already uses POSITIVE = cost convention, no negation needed
  const identity = (v) => v;

  // --- Standard LLPAS sheet ---
  const llpas = readSheet(file, 'LLPAS');

  // Purchase FICO grid: rows 18-27, col 1=FICO label, cols 2-10=LTV values (10 buckets incl >95)
  const purchaseGrid = extractGrid(llpas, 18, 28, 2, 10, 1, identity);
  const purchaseAttrs = extractAttributes(llpas, 30, 39, 2, 10, 1, identity);

  // Rate/Term Refi FICO grid: rows 41-50
  const refiGrid = extractGrid(llpas, 41, 51, 2, 10, 1, identity);
  const refiAttrs = extractAttributes(llpas, 53, 62, 2, 10, 1, identity);

  // Cash Out FICO grid: rows 64-73
  const cashoutGrid = extractGrid(llpas, 64, 74, 2, 5, 1, identity);
  const cashoutAttrs = extractAttributes(llpas, 76, 85, 2, 5, 1, identity);

  // NOO additional adjustments (right side, cols 13-18)
  // Row 17: header LTV, row 18-22: Purchase, Rate&Term, Cash Out, High Balance, Fico 680-719
  const nooAdj = {};
  for (let r = 18; r <= 22; r++) {
    const row = llpas[r];
    const label = String(row[13] || '').trim();
    if (!label) continue;
    const values = [];
    for (let c = 14; c <= 19; c++) {
      values.push(asNum(row[c]));
    }
    nooAdj[label] = values;
  }

  // 2nd Home additional adjustments (rows 26-27 on right side)
  const secondHomeAdj = {};
  for (let r = 26; r <= 27; r++) {
    const row = llpas[r];
    const label = String(row[13] || '').trim();
    if (!label) continue;
    const values = [];
    for (let c = 14; c <= 19; c++) {
      values.push(asNum(row[c]));
    }
    secondHomeAdj[label] = values;
  }

  // Other price adjustments (right side rows 40-45, values at col 19)
  const loanAmountAdj = [
    { min: 50000, max: 74999, adj: asNum(llpas[40][19]) },
    { min: 75000, max: 99999, adj: asNum(llpas[41][19]) },
    { min: 100000, max: 149999, adj: asNum(llpas[42][19]) },
  ];

  const otherAdj = {
    texas50a6: asNum(llpas[43][19]),
    oneYearTaxReturn90LTV: asNum(llpas[44][19]),
    sixtyDayLock: asNum(llpas[45][19]),
  };

  // State adjuster (right side row 50, col 18 = 30/20Y, col 19 = 15/10Y)
  // Both are -0.125 meaning a credit; keep as-is (negative = benefit to borrower)
  const stateAdj = {
    TX: asNum(llpas[50][18]),
  };

  // --- Fast Track LLPAS sheet ---
  const ftSheet = readSheet(file, 'FT_LLPAS');

  const ftPurchaseGrid = extractGrid(ftSheet, 18, 28, 2, 10, 1, identity);
  const ftPurchaseAttrs = extractAttributes(ftSheet, 30, 36, 2, 10, 1, identity);

  const ftRefiGrid = extractGrid(ftSheet, 38, 48, 2, 10, 1, identity);
  const ftRefiAttrs = extractAttributes(ftSheet, 50, 56, 2, 10, 1, identity);

  const ftCashoutGrid = extractGrid(ftSheet, 58, 68, 2, 5, 1, identity);
  const ftCashoutAttrs = extractAttributes(ftSheet, 70, 76, 2, 5, 1, identity);

  const ftLoanAmountAdj = [
    { min: 50000, max: 74999, adj: asNum(ftSheet[29][19]) },
    { min: 75000, max: 99999, adj: asNum(ftSheet[30][19]) },
    { min: 100000, max: 149999, adj: asNum(ftSheet[31][19]) },
  ];

  const ftStateAdj = {
    TX: asNum(ftSheet[39][18]),
  };

  const result = {
    lenderId: 'amwest',
    lenderName: 'AmWest Funding',
    lastUpdated: '2026-03-20',
    source: '47006_03202026_1444577602.xlsx',
    notes: 'AmWest uses positive=cost convention (matches our engine). Includes standard and Fast Track programs.',
    ltvBuckets: {
      purchaseRefi: [...LTV_COLS_9, '>95'],
      cashout: LTV_COLS_5,
    },
    standard: {
      ficoLtvGrids: {
        purchase: purchaseGrid,
        refinance: refiGrid,
        cashout: cashoutGrid,
      },
      additionalAdjustments: {
        purchase: purchaseAttrs,
        refinance: refiAttrs,
        cashout: cashoutAttrs,
      },
      nooAdditional: nooAdj,
      secondHomeAdditional: secondHomeAdj,
    },
    fastTrack: {
      ficoLtvGrids: {
        purchase: ftPurchaseGrid,
        refinance: ftRefiGrid,
        cashout: ftCashoutGrid,
      },
      additionalAdjustments: {
        purchase: ftPurchaseAttrs,
        refinance: ftRefiAttrs,
        cashout: ftCashoutAttrs,
      },
    },
    loanAmountAdj,
    otherAdj,
    stateAdj,
    fastTrackLoanAmountAdj: ftLoanAmountAdj,
    fastTrackStateAdj: ftStateAdj,
  };

  writeJSON('amwest.json', result);
  console.log(`  Standard Purchase tiers: ${Object.keys(purchaseGrid).length}`);
  console.log(`  Standard Refi tiers: ${Object.keys(refiGrid).length}`);
  console.log(`  Standard Cashout tiers: ${Object.keys(cashoutGrid).length}`);
  console.log(`  Fast Track Purchase tiers: ${Object.keys(ftPurchaseGrid).length}`);
}

// --- SWMC ---

function extractSWMC() {
  console.log('\n=== Extracting SWMC LLPAs ===');
  const file = path.join(SHEETS_DIR, '99522_03202026_1312286605.xlsx');
  const data = readSheet(file, 'RATESHEET');

  // SWMC uses POSITIVE = cost convention (matches our engine)
  const identity = (v) => v;

  // LTV columns: cols 10-18 (9 buckets: <=30 through >95)
  // FICO label in col 1

  // Purchase FICO grid: rows 1317-1325
  const purchaseGrid = extractGrid(data, 1317, 1326, 10, 9, 1, identity);

  // Purchase attribute adjustments: rows 1346-1356
  const purchaseAttrs = extractAttributes(data, 1346, 1357, 10, 9, 1, identity);

  // Limited Cashout Refi FICO grid: rows 1376-1384
  const refiGrid = extractGrid(data, 1376, 1385, 10, 9, 1, identity);

  // Refi attribute adjustments: rows 1405-1415
  const refiAttrs = extractAttributes(data, 1405, 1416, 10, 9, 1, identity);

  // Cashout FICO grid: rows 1435-1443
  const cashoutGrid = extractGrid(data, 1435, 1444, 10, 9, 1, identity);

  // Cashout attribute adjustments: rows 1464-1474
  const cashoutAttrs = extractAttributes(data, 1464, 1475, 10, 9, 1, identity);

  // General adjustments: rows 1493-1499+
  const generalAttrs = {};
  for (let r = 1493; r < 1510; r++) {
    const row = data[r];
    if (!row || !row[1]) continue;
    const label = String(row[1]).trim();
    if (label.startsWith('Other Adjustments')) continue;
    const values = [];
    for (let c = 10; c < 19; c++) {
      const raw = row[c];
      if (raw === 'N/A' || raw === '') {
        values.push(null);
      } else {
        values.push(asNum(raw));
      }
    }
    generalAttrs[label] = values;
  }

  const result = {
    lenderId: 'swmc',
    lenderName: 'Sun West Mortgage Company',
    lastUpdated: '2026-03-20',
    source: '99522_03202026_1312286605.xlsx',
    notes: 'SWMC uses positive=cost convention (matches our engine). FICO "<= 639 or NTC" is the lowest tier.',
    ltvBuckets: [...LTV_COLS_9.slice(0, 8), '>95'],
    ficoLtvGrids: {
      purchase: purchaseGrid,
      refinance: refiGrid,
      cashout: cashoutGrid,
    },
    additionalAdjustments: {
      purchase: purchaseAttrs,
      refinance: refiAttrs,
      cashout: cashoutAttrs,
    },
    generalAdjustments: generalAttrs,
  };

  writeJSON('swmc.json', result);
  console.log(`  Purchase FICO tiers: ${Object.keys(purchaseGrid).length}`);
  console.log(`  Refi FICO tiers: ${Object.keys(refiGrid).length}`);
  console.log(`  Cashout FICO tiers: ${Object.keys(cashoutGrid).length}`);
}

// --- Main ---

function main() {
  console.log('Lender LLPA Extraction');
  console.log('======================');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    extractEverStream();
  } catch (e) {
    console.error('ERROR extracting EverStream:', e.message);
  }

  try {
    extractAmWest();
  } catch (e) {
    console.error('ERROR extracting AmWest:', e.message);
  }

  try {
    extractSWMC();
  } catch (e) {
    console.error('ERROR extracting SWMC:', e.message);
  }

  console.log('\nDone.');
}

main();
