#!/usr/bin/env node
/**
 * Sunwest XLSX → JSON Parser
 *
 * Converts a Sunwest wholesale rate sheet (XLSX) into the JSON format
 * consumed by the NetRate Mortgage website rate engine.
 *
 * Usage:
 *   node scripts/parse-sunwest-xlsx.js <path-to-xlsx> [output-path]
 *
 * If output-path is omitted, writes to src/data/rates/sunwest.json
 *
 * The XLSX has a single "RATESHEET" tab with ~4167 rows x 60 columns.
 * We extract:
 *   - Conforming 30yr rate/price table (rows ~1063-1086)
 *   - Purchase LLPA grid (rows ~1317-1325)
 *   - Refi LLPA grid (rows ~1376-1384)
 *   - Cash-Out LLPA grid (rows ~1435-1443)
 *   - Additional adjustments (condo, high-bal, investment, etc.)
 *   - Promo adjustments (25bps conforming credit, March 2026)
 *
 * Sunwest has 9 FICO tiers (>=780 top) vs AmWest's 10 (>=800 top).
 * We duplicate >=780 into >=800 and 780-799 for engine compatibility.
 *
 * Output JSON matches the schema expected by src/lib/rates/engine.js:
 *   {
 *     lender: { name, effectiveDate, effectiveTime, lenderFees, lockExtension, promo },
 *     rateTable30yr: [ [rate, price30day, price45day], ... ],
 *     ltvBands: ["<=30","30.01-60",...],
 *     purchaseLlpa: { ">=800": [...], "780-799": [...], ... },
 *     refiLlpa: { ... },
 *     cashoutLlpa: { ... },
 *     additionalLlpa: { condo: [...], highBal: [...], ... },
 *     loanAmtAdj: [ { min, max, adj }, ... ]
 *   }
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ── Helpers ─────────────────────────────────────────────────

/** Round to 4 decimal places to avoid floating-point noise */
function r4(n) {
  if (typeof n !== 'number' || isNaN(n)) return n;
  return Math.round(n * 10000) / 10000;
}

/** Find row index where cell in column `col` contains `text` (case-insensitive) */
function findRow(data, col, text, startRow = 0) {
  const lower = text.toLowerCase();
  for (let i = startRow; i < data.length; i++) {
    const cell = String(data[i]?.[col] || '').toLowerCase().trim();
    if (cell.includes(lower)) return i;
  }
  return -1;
}

/** Find row index where cell in column `col` exactly matches `text` (case-insensitive, trimmed) */
function findRowExact(data, col, text, startRow = 0) {
  const lower = text.toLowerCase().trim();
  for (let i = startRow; i < data.length; i++) {
    const cell = String(data[i]?.[col] || '').toLowerCase().trim();
    if (cell === lower) return i;
  }
  return -1;
}

/** Convert Excel serial date number to date string */
function excelDateToString(serial) {
  if (typeof serial === 'string') return serial;
  if (typeof serial !== 'number') return 'Unknown';
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const date = new Date(utcMs);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

/** Convert Excel time fraction to time string (0.25 = 6:00 AM) */
function excelTimeToString(fraction) {
  if (typeof fraction !== 'number') return 'Unknown';
  const totalMinutes = Math.round(fraction * 24 * 60);
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm} PST`;
}

// ── FICO band mapping ───────────────────────────────────────
// Sunwest has 9 tiers: >=780, 760-779, ..., <=639
// Engine expects 10 tiers: >=800, 780-799, 760-779, ..., 620-639
// We duplicate >=780 into both >=800 and 780-799, and map <=639 to 620-639.

const ENGINE_FICO_BANDS = [
  '>=800', '780-799', '760-779', '740-759', '720-739',
  '700-719', '680-699', '660-679', '640-659', '620-639'
];

// Sunwest rows are in order from high to low FICO (9 rows)
const SUNWEST_TO_ENGINE = [
  ['>=800', '780-799'],  // >=780 row → duplicated
  ['760-779'],
  ['740-759'],
  ['720-739'],
  ['700-719'],
  ['680-699'],
  ['660-679'],
  ['640-659'],
  ['620-639'],           // <=639 row → mapped to 620-639
];

/**
 * Extract a FICO/LTV grid from the Sunwest sheet.
 *
 * Sunwest layout:
 *   Header row has LTV band labels in cols 10-18 (9 bands)
 *   Data rows (9 rows) have FICO label in col 1, LTV values in cols 10-18
 *
 * @param {Array} data - Sheet data (array of arrays)
 * @param {number} headerRow - Row index with LTV band headers
 * @param {number} numLtvCols - Number of LTV columns to read (9 for purchase/refi, may differ for cashout)
 * @param {number} dataCol - Starting column for LTV data (default 10)
 * @returns {Object} - { ">=800": [...], "780-799": [...], ... }
 */
function extractSunwestFicoGrid(data, headerRow, numLtvCols, dataCol = 10) {
  const grid = {};

  for (let i = 0; i < 9; i++) {
    const rowIdx = headerRow + 1 + i;
    const row = data[rowIdx];
    if (!row) break;

    // Read LTV values from the data columns
    const values = [];
    for (let c = dataCol; c < dataCol + numLtvCols; c++) {
      const val = row[c];
      if (typeof val === 'number') {
        values.push(r4(val));
      } else if (typeof val === 'string' && (val.trim() === 'N/A' || val.trim() === '')) {
        values.push(null);
      } else {
        values.push(0);
      }
    }

    // Map this Sunwest row to one or two engine FICO bands
    const engineBands = SUNWEST_TO_ENGINE[i];
    for (const band of engineBands) {
      grid[band] = [...values]; // clone so each band has its own array
    }
  }

  return grid;
}

/**
 * Extract additional adjustment row by label.
 * Sunwest additional adjustments are in a grid similar to the FICO/LTV grid
 * but with property-type labels instead of FICO labels.
 *
 * @param {Array} data - Sheet data
 * @param {string} label - Label to search for (e.g. "Investment", "Second Home")
 * @param {number} startRow - Row to start searching from
 * @param {number} endRow - Row to stop searching
 * @param {number} numCols - Number of LTV columns (default 9)
 * @param {number} dataCol - Starting column (default 10)
 * @returns {Array|null} - Array of adjustment values by LTV band, or null
 */
function extractAdditionalRow(data, label, startRow, endRow, numCols = 9, dataCol = 10) {
  const lower = label.toLowerCase();
  for (let i = startRow; i <= endRow && i < data.length; i++) {
    const cellLabel = String(data[i]?.[1] || '').toLowerCase().trim();
    if (cellLabel.includes(lower)) {
      const values = [];
      for (let c = dataCol; c < dataCol + numCols; c++) {
        const val = data[i]?.[c];
        if (typeof val === 'number') values.push(r4(val));
        else if (typeof val === 'string' && (val.trim() === 'N/A' || val.trim() === '')) values.push(null);
        else values.push(0);
      }
      return values;
    }
  }
  return null;
}

// ── Main parser ─────────────────────────────────────────────

function parseSunwestXlsx(filePath) {
  console.log(`\nParsing: ${filePath}\n`);

  const wb = XLSX.readFile(filePath);

  // Sunwest has a single "RATESHEET" tab
  const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('RATESHEET'))
    || wb.SheetNames[0];
  console.log(`Using sheet: "${sheetName}" (available: ${wb.SheetNames.join(', ')})`);

  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`Sheet dimensions: ${data.length} rows`);

  // ── 1. Lender metadata ────────────────────────────────────
  // Row 2 (data[1]): [8]="Date", [10]=46094 (Excel serial)
  // Row 3 (data[2]): [8]="Time (PT)", [10]=0.25 (fraction of day)

  const effectiveDateRaw = data[1]?.[10]; // row 2, col K (index 10)
  const effectiveTimeRaw = data[2]?.[10]; // row 3, col K (index 10)

  const effectiveDate = excelDateToString(effectiveDateRaw);
  const effectiveTime = excelTimeToString(effectiveTimeRaw);

  // UW fees: non-streamline = $1,195 (row 19), streamline = $625 (row 20)
  // Lock extension: 2.5 bps/day (row 15)
  // Promo: 25bps on Conforming (row 18)
  const lenderFees = 1195;
  const promoConforming = 0.25; // 25 bps credit applied to conforming rates

  const lender = {
    name: 'Sunwest Mortgage',
    effectiveDate,
    effectiveTime,
    lenderFees,
    lockExtension: '2.5 bps/day',
    promo: `${promoConforming * 100} bps credit on Conforming (applied to prices)`,
  };

  console.log('Lender:', JSON.stringify(lender, null, 2));

  // ── 2. Rate table (Conforming 30yr) ───────────────────────
  // Conforming section starts around row 1059-1062 with headers
  // Rate data starts at ~row 1063, cols 1-4: Rate, 30day, 45day, 60day

  // Find the conforming 30yr header row.
  // Row 1063 (data[1062]): col 1 = "Rate", col 2 = "30 Day", col 3 = "45 Day", col 4 = "60 Day"
  // Data starts immediately below.
  let confHeaderRow = -1;

  // Strategy 1: Search for "Rate" label in col 1 near the conforming section
  for (let i = 1055; i < 1075; i++) {
    const cell = String(data[i]?.[1] || '').toLowerCase().trim();
    if (cell === 'rate') {
      // Confirm next row has a numeric rate value in col 1
      const nextVal = data[i + 1]?.[1];
      if (typeof nextVal === 'number' && nextVal >= 4 && nextVal <= 12) {
        confHeaderRow = i;
        break;
      }
    }
  }

  // Strategy 2: Find first numeric rate value in col 1 and use row above as header
  if (confHeaderRow === -1) {
    for (let i = 1055; i < 1100; i++) {
      const val1 = data[i]?.[1];
      if (typeof val1 === 'number' && val1 >= 4 && val1 <= 12) {
        confHeaderRow = i - 1;
        break;
      }
    }
  }

  if (confHeaderRow === -1) {
    console.log('Warning: Could not find conforming header dynamically, using row 1062 (0-indexed)');
    confHeaderRow = 1062;
  }

  console.log(`Conforming header row: ${confHeaderRow}`);

  // Extract rates — col 1 = rate, col 2 = 30-day, col 3 = 45-day, col 4 = 60-day
  // We output [rate, price30day, price45day] to match engine format
  const rateTable30yr = [];
  for (let i = confHeaderRow + 1; i < data.length; i++) {
    const row = data[i];
    const rate = row[1];
    const price30 = row[2];
    const price45 = row[3];

    // Stop when we hit an empty rate or non-number
    if (typeof rate !== 'number' || rate === 0) break;

    // Apply promo credit to prices (adds to price = better for borrower)
    const adj30 = typeof price30 === 'number' ? r4(price30 + promoConforming) : price30;
    const adj45 = typeof price45 === 'number' ? r4(price45 + promoConforming) : price45;

    rateTable30yr.push([r4(rate), adj30, adj45]);
  }

  if (rateTable30yr.length === 0) {
    throw new Error('No rate data found in conforming section. Check row positions.');
  }

  console.log(`Rate table: ${rateTable30yr.length} rows (${rateTable30yr[0]?.[0]}% to ${rateTable30yr[rateTable30yr.length - 1]?.[0]}%)`);

  // ── 3. LTV bands ──────────────────────────────────────────
  const ltvBands = ['<=30', '30.01-60', '60.01-70', '70.01-75', '75.01-80', '80.01-85', '85.01-90', '90.01-95', '>95'];

  // ── 4. Purchase LLPA grid ─────────────────────────────────
  // Header at ~row 1316 (FICO/LTV labels), data rows 1317-1325
  // FICO labels in col 1, LTV values in cols 10-18

  // Find purchase LLPA section.
  // The FICO/LTV header row contains "Purchase" in its label:
  // "FICO / LTV (%), Purchase Transaction, Applies to all loans with terms greater than 15 years"
  let purchaseHeaderRow = -1;
  for (let i = 1310; i < 1340; i++) {
    const cell = String(data[i]?.[1] || '').toLowerCase();
    if (cell.includes('fico') && cell.includes('purchase')) {
      purchaseHeaderRow = i;
      break;
    }
  }

  // Broader fallback: find first FICO/LTV header after row 1310
  if (purchaseHeaderRow === -1) {
    for (let i = 1310; i < 1340; i++) {
      const cell = String(data[i]?.[1] || '').toLowerCase();
      if (cell.includes('fico') && cell.includes('ltv')) {
        purchaseHeaderRow = i;
        break;
      }
    }
  }

  if (purchaseHeaderRow === -1) {
    console.log('Warning: Could not find Purchase LLPA header dynamically, using 1316');
    purchaseHeaderRow = 1316;
  }

  console.log(`Purchase LLPA header row: ${purchaseHeaderRow}`);
  const purchaseLlpa = extractSunwestFicoGrid(data, purchaseHeaderRow, 9, 10);
  console.log(`Purchase LLPA: ${Object.keys(purchaseLlpa).length} FICO tiers`);

  // ── 5. Refi LLPA grid ────────────────────────────────────
  // "FICO / LTV (%), Limited Cashout Refinance Transaction, ..."
  // Located ~59 rows after purchase LLPA header
  let refiHeaderRow = -1;
  for (let i = purchaseHeaderRow + 20; i < purchaseHeaderRow + 80; i++) {
    const cell = String(data[i]?.[1] || '').toLowerCase();
    if (cell.includes('fico') && (cell.includes('limited cashout') || cell.includes('refinance')) && !cell.includes('cashout refinance')) {
      refiHeaderRow = i;
      break;
    }
  }

  // Fallback: find second FICO/LTV header after purchase (skip additional adjustments header)
  if (refiHeaderRow === -1) {
    let foundFirst = false;
    for (let i = purchaseHeaderRow + 15; i < purchaseHeaderRow + 80; i++) {
      const cell = String(data[i]?.[1] || '').toLowerCase();
      if (cell.includes('fico') && cell.includes('ltv')) {
        if (cell.includes('other') || cell.includes('adjustment')) continue; // skip additional adjustments
        if (!foundFirst) { foundFirst = true; continue; } // skip first (additional adj header if misdetected)
        refiHeaderRow = i;
        break;
      }
    }
  }

  // Second fallback: just find the refi FICO/LTV row by label
  if (refiHeaderRow === -1) {
    for (let i = purchaseHeaderRow + 15; i < purchaseHeaderRow + 80; i++) {
      const cell = String(data[i]?.[1] || '').toLowerCase();
      if (cell.includes('fico') && cell.includes('ltv') && !cell.includes('purchase') && !cell.includes('other') && !cell.includes('cashout')) {
        refiHeaderRow = i;
        break;
      }
    }
  }

  if (refiHeaderRow === -1) {
    console.log('Warning: Could not find Refi LLPA header dynamically, using 1375');
    refiHeaderRow = 1375;
  }

  console.log(`Refi LLPA header row: ${refiHeaderRow}`);
  const refiLlpa = extractSunwestFicoGrid(data, refiHeaderRow, 9, 10);
  console.log(`Refi LLPA: ${Object.keys(refiLlpa).length} FICO tiers`);

  // ── 6. Cash-Out LLPA grid ─────────────────────────────────
  let cashoutHeaderRow = -1;
  for (let i = refiHeaderRow + 15; i < refiHeaderRow + 80; i++) {
    const cell = String(data[i]?.[1] || '').toLowerCase();
    if (cell.includes('cash') && (cell.includes('out') || cell.includes('o/r'))) {
      for (let j = i; j < i + 10; j++) {
        const hdr = String(data[j]?.[1] || '').toLowerCase();
        if (hdr.includes('fico') && hdr.includes('ltv')) {
          cashoutHeaderRow = j;
          break;
        }
      }
      break;
    }
  }

  // Fallback: find FICO/LTV header with "cashout" after refi
  if (cashoutHeaderRow === -1) {
    for (let i = refiHeaderRow + 15; i < refiHeaderRow + 80; i++) {
      const cell = String(data[i]?.[1] || '').toLowerCase();
      if (cell.includes('fico') && cell.includes('cashout')) {
        cashoutHeaderRow = i;
        break;
      }
    }
  }

  // Broader fallback
  if (cashoutHeaderRow === -1) {
    for (let i = refiHeaderRow + 15; i < refiHeaderRow + 80; i++) {
      const cell = String(data[i]?.[1] || '').toLowerCase();
      if (cell.includes('fico') && cell.includes('ltv')) {
        cashoutHeaderRow = i;
        break;
      }
    }
  }

  if (cashoutHeaderRow === -1) {
    console.log('Warning: Could not find Cashout LLPA header dynamically, using 1434');
    cashoutHeaderRow = 1434;
  }

  console.log(`Cash-Out LLPA header row: ${cashoutHeaderRow}`);

  // Cash-out may have fewer LTV bands (engine caps at index 4 = 75.01-80)
  // But we read all 9 and let the engine handle the capping
  const cashoutLlpaFull = extractSunwestFicoGrid(data, cashoutHeaderRow, 9, 10);

  // Trim cashout to 5 bands to match AmWest format (engine uses max index 4)
  const cashoutLlpa = {};
  for (const [band, values] of Object.entries(cashoutLlpaFull)) {
    // Check if values beyond index 4 are all null/N/A — if so, trim
    const hasHighLtv = values.slice(5).some(v => v !== null && v !== 0);
    if (hasHighLtv) {
      // Keep all 9 — Sunwest may allow higher LTV cashout
      cashoutLlpa[band] = values;
    } else {
      // Trim to 5 bands
      cashoutLlpa[band] = values.slice(0, 5);
    }
  }
  console.log(`Cash-Out LLPA: ${Object.keys(cashoutLlpa).length} FICO tiers, ${Object.values(cashoutLlpa)[0]?.length} LTV bands`);

  // ── 7. Additional LLPAs ───────────────────────────────────
  // Purchase additional adjustments start around row 1345
  // Look for adjustment rows between the LLPA grid end and the next section

  // Purchase additional adjustments are between the purchase LLPA grid and the refi LLPA grid.
  // "Other Adjustments / LTV (%), Purchase Transaction, All loan terms" is the header row,
  // followed by: ARM, Condo, Investment Property, Second Home, Manufactured, 2-4 Units,
  // High Balance Fixed, High Balance ARM, Subordinate Financing, etc.
  const purchaseAddlStart = purchaseHeaderRow + 11; // after the 9 data rows + buffer
  const addlSearchEnd = refiHeaderRow - 2; // don't go past refi section

  const additionalLlpa = {};

  const condoRow = extractAdditionalRow(data, 'condo', purchaseAddlStart, addlSearchEnd);
  if (condoRow) additionalLlpa.condo = condoRow;

  // "High Balance Fixed (Term > 15 Year Fixed)" is the one we want for 30yr
  const highBalRow = extractAdditionalRow(data, 'high balance fixed (term > 15', purchaseAddlStart, addlSearchEnd)
    || extractAdditionalRow(data, 'high balance fixed', purchaseAddlStart, addlSearchEnd);
  if (highBalRow) additionalLlpa.highBal = highBalRow;

  const investmentRow = extractAdditionalRow(data, 'investment', purchaseAddlStart, addlSearchEnd);
  if (investmentRow) additionalLlpa.investment = investmentRow;

  const secondHomeRow = extractAdditionalRow(data, 'second home', purchaseAddlStart, addlSearchEnd);
  if (secondHomeRow) additionalLlpa.secondHome = secondHomeRow;

  const manufacturedRow = extractAdditionalRow(data, 'manufactured', purchaseAddlStart, addlSearchEnd);
  if (manufacturedRow) additionalLlpa.manufactured = manufacturedRow;

  const multiUnitRow = extractAdditionalRow(data, '2 - 4 unit', purchaseAddlStart, addlSearchEnd)
    || extractAdditionalRow(data, '2-4 unit', purchaseAddlStart, addlSearchEnd);
  if (multiUnitRow) additionalLlpa.multiUnit = multiUnitRow;

  const subFinRow = extractAdditionalRow(data, 'subordinate financing', purchaseAddlStart, addlSearchEnd);
  if (subFinRow) additionalLlpa.subFin = subFinRow;

  console.log(`Additional LLPAs: ${Object.keys(additionalLlpa).join(', ') || 'none found'}`);

  // ── 8. Loan amount adjustments ────────────────────────────
  // Sunwest may have these in a different location. Search broadly.
  const loanAmtAdj = [];

  for (let i = 0; i < Math.min(data.length, 100); i++) {
    for (let c = 0; c < (data[i]?.length || 0); c++) {
      const cell = String(data[i]?.[c] || '');
      if (cell.includes('Loan Amt') && cell.includes('$50,000')) {
        for (let j = (data[i]?.length || 0) - 1; j > c; j--) {
          if (typeof data[i][j] === 'number') {
            loanAmtAdj.push({ min: 50000, max: 74999, adj: r4(data[i][j]) });
            break;
          }
        }
      } else if (cell.includes('Loan Amt') && cell.includes('$75,000')) {
        for (let j = (data[i]?.length || 0) - 1; j > c; j--) {
          if (typeof data[i][j] === 'number') {
            loanAmtAdj.push({ min: 75000, max: 99999, adj: r4(data[i][j]) });
            break;
          }
        }
      } else if (cell.includes('Loan Amt') && cell.includes('$100,000')) {
        for (let j = (data[i]?.length || 0) - 1; j > c; j--) {
          if (typeof data[i][j] === 'number') {
            loanAmtAdj.push({ min: 100000, max: 149999, adj: r4(data[i][j]) });
            break;
          }
        }
      }
    }
  }

  // Also search in the conforming area (rows 1000-1060)
  if (loanAmtAdj.length === 0) {
    for (let i = 1000; i < 1065; i++) {
      for (let c = 0; c < (data[i]?.length || 0); c++) {
        const cell = String(data[i]?.[c] || '').toLowerCase();
        if (cell.includes('loan amt') || cell.includes('loan amount')) {
          // Check for adjacent numeric value
          const nextVal = data[i]?.[c + 1];
          if (typeof nextVal === 'number') {
            const label = cell;
            if (label.includes('50') && label.includes('74')) {
              loanAmtAdj.push({ min: 50000, max: 74999, adj: r4(nextVal) });
            } else if (label.includes('75') && label.includes('99')) {
              loanAmtAdj.push({ min: 75000, max: 99999, adj: r4(nextVal) });
            } else if (label.includes('100') && label.includes('149')) {
              loanAmtAdj.push({ min: 100000, max: 149999, adj: r4(nextVal) });
            }
          }
        }
      }
    }
  }

  console.log(`Loan amount adjustments: ${loanAmtAdj.length} tiers`);

  // ── Assemble output ───────────────────────────────────────

  const output = {
    lender,
    rateTable30yr,
    ltvBands,
    purchaseLlpa,
    refiLlpa,
    cashoutLlpa,
    additionalLlpa,
    loanAmtAdj,
  };

  return output;
}

// ── Diagnostic mode ─────────────────────────────────────────
// Run with --diag flag to dump raw row data for debugging

function runDiagnostics(filePath) {
  console.log(`\n=== DIAGNOSTIC MODE ===\n`);
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('RATESHEET')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`Sheet: "${sheetName}", ${data.length} rows`);
  console.log(`\n--- Metadata area (rows 1-25) ---`);
  for (let i = 0; i < 25 && i < data.length; i++) {
    const row = data[i];
    const nonEmpty = row.map((v, c) => [c, v]).filter(([, v]) => v !== '');
    if (nonEmpty.length > 0) {
      console.log(`  Row ${i + 1}: ${nonEmpty.map(([c, v]) => `[${c}]=${JSON.stringify(v)}`).join(', ')}`);
    }
  }

  console.log(`\n--- Conforming area (rows 1059-1090) ---`);
  for (let i = 1058; i < 1090 && i < data.length; i++) {
    const row = data[i];
    const cols04 = row.slice(0, 5).map((v, c) => `[${c}]=${JSON.stringify(v)}`).join(', ');
    console.log(`  Row ${i + 1}: ${cols04}`);
  }

  console.log(`\n--- Purchase LLPA area (rows 1310-1330) ---`);
  for (let i = 1309; i < 1330 && i < data.length; i++) {
    const row = data[i];
    const col1 = `[1]=${JSON.stringify(row[1] || '')}`;
    const cols1018 = row.slice(10, 19).map((v, c) => `[${c + 10}]=${v}`).join(', ');
    console.log(`  Row ${i + 1}: ${col1}  |  ${cols1018}`);
  }

  console.log(`\n--- Refi LLPA area (rows 1370-1390) ---`);
  for (let i = 1369; i < 1390 && i < data.length; i++) {
    const row = data[i];
    const col1 = `[1]=${JSON.stringify(row[1] || '')}`;
    const cols1018 = row.slice(10, 19).map((v, c) => `[${c + 10}]=${v}`).join(', ');
    console.log(`  Row ${i + 1}: ${col1}  |  ${cols1018}`);
  }

  console.log(`\n--- Cashout LLPA area (rows 1430-1450) ---`);
  for (let i = 1429; i < 1450 && i < data.length; i++) {
    const row = data[i];
    const col1 = `[1]=${JSON.stringify(row[1] || '')}`;
    const cols1018 = row.slice(10, 19).map((v, c) => `[${c + 10}]=${v}`).join(', ');
    console.log(`  Row ${i + 1}: ${col1}  |  ${cols1018}`);
  }

  console.log(`\n--- Additional adjustments area (rows 1340-1360) ---`);
  for (let i = 1339; i < 1360 && i < data.length; i++) {
    const row = data[i];
    const col1 = `[1]=${JSON.stringify(row[1] || '')}`;
    const cols1018 = row.slice(10, 19).map((v, c) => `[${c + 10}]=${v}`).join(', ');
    console.log(`  Row ${i + 1}: ${col1}  |  ${cols1018}`);
  }
}

// ── CLI ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const diagMode = args.includes('--diag');
const inputFile = args.find(a => !a.startsWith('--')) || path.join(
  process.env.USERPROFILE || process.env.HOME, 'Downloads', '99522_03132026_0901509110.xlsx'
);
const outputFile = args[1] && !args[1].startsWith('--') ? args[1] : path.join(
  __dirname, '..', 'src', 'data', 'rates', 'sunwest.json'
);

if (diagMode) {
  runDiagnostics(inputFile);
  process.exit(0);
}

try {
  const result = parseSunwestXlsx(inputFile);

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
  console.log(`\n✓ Written to: ${outputFile}`);
  console.log(`  Effective date: ${result.lender.effectiveDate}`);
  console.log(`  Rate range: ${result.rateTable30yr[0][0]}% – ${result.rateTable30yr[result.rateTable30yr.length - 1][0]}%`);
  console.log(`  Rate rows: ${result.rateTable30yr.length}`);
  console.log(`  FICO tiers (purchase): ${Object.keys(result.purchaseLlpa).length}`);
  console.log(`  Promo applied: ${result.lender.promo}`);
} catch (err) {
  console.error('\n✗ Error:', err.message);
  console.error('\nTip: Run with --diag flag to see raw row data:');
  console.error(`  node scripts/parse-sunwest-xlsx.js "${inputFile}" --diag`);
  process.exit(1);
}
