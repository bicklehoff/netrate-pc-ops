#!/usr/bin/env node
/**
 * AmWest LoanSifter XLSX → JSON Parser
 *
 * Converts an AmWest wholesale rate sheet (XLSX from LoanSifter) into
 * the JSON format consumed by the NetRate Mortgage website rate engine.
 *
 * Usage:
 *   node scripts/parse-amwest-xlsx.js <path-to-xlsx> [output-path]
 *
 * If output-path is omitted, writes to src/data/rates/amwest.json
 *
 * The XLSX has multiple sheets. We extract from:
 *   - "CONV"       → 30-year rate/price table (Fast Track FFT30)
 *   - "FT_LLPAS"   → FICO/LTV LLPA grids + additional adjustments
 *
 * Output JSON schema:
 *   {
 *     lender: { name, effectiveDate, effectiveTime, lenderFees, lockExtension },
 *     rateTable30yr: [ [rate, price30day, price45day], ... ],
 *     ltvBands: ["<=30","30.01-60","60.01-70",...],
 *     purchaseLlpa: { ">=800": [...], "780-799": [...], ... },
 *     refiLlpa: { ... },
 *     cashoutLlpa: { ... },
 *     additionalLlpa: { condo: [...], highBal: [...], subFin: [...] },
 *     loanAmtAdj: [ { min, max, adj }, ... ]
 *   }
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ── Helpers ─────────────────────────────────────────────────

function getSheetData(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(', ')}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

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

/** Extract FICO/LTV grid from rows starting at headerRow.
 *  headerRow has "FICO/LTV" in col 1, LTV bands in cols 2-10.
 *  Data rows follow with FICO label in col 1, values in cols 2-N.
 */
function extractFicoGrid(data, headerRow, numLtvCols) {
  const ficoLabels = [
    '>=800', '780-799', '760-779', '740-759', '720-739',
    '700-719', '680-699', '660-679', '640-659', '620-639'
  ];

  const grid = {};
  for (let i = 0; i < ficoLabels.length; i++) {
    const rowIdx = headerRow + 1 + i;
    const row = data[rowIdx];
    if (!row) break;

    // The FICO label is in col 1 — normalize it
    const rawLabel = String(row[1] || '').trim();
    // Map the raw label (e.g. "≥800") to our standard format
    const label = ficoLabels[i];

    const values = [];
    for (let c = 2; c < 2 + numLtvCols; c++) {
      const val = row[c];
      if (typeof val === 'number') {
        values.push(r4(val));
      } else if (typeof val === 'string' && val.trim() === 'N/A') {
        // N/A means not applicable — use null
        values.push(null);
      } else {
        values.push(0);
      }
    }
    grid[label] = values;
  }
  return grid;
}

// ── Parse effective date from Excel serial number ───────────

function excelDateToString(serial) {
  if (typeof serial === 'string') {
    // Already a date string like "2/25/26"
    return serial;
  }
  if (typeof serial !== 'number') return 'Unknown';

  // Excel serial date → JS Date
  // Excel epoch is Jan 0, 1900 (with the leap year bug)
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const date = new Date(utcMs);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

// ── Main ────────────────────────────────────────────────────

function parseAmwestXlsx(filePath) {
  console.log(`\nParsing: ${filePath}\n`);

  const wb = XLSX.readFile(filePath);
  const conv = getSheetData(wb, 'CONV');
  const ftLlpas = getSheetData(wb, 'FT_LLPAS');

  // ── 1. Lender metadata ────────────────────────────────────

  // Effective date is in CONV sheet, row 6, col 17 (Excel serial number)
  const effectiveDateRaw = conv[6]?.[17];
  const effectiveDate = excelDateToString(effectiveDateRaw);

  // Effective time: from FT_LLPAS sheet row 6 col 14
  // or default to "8:00 AM PST" based on the lock hours
  let effectiveTime = '';
  const llpasRow6 = ftLlpas[6];
  if (llpasRow6) {
    for (let c = 0; c < llpasRow6.length; c++) {
      const val = String(llpasRow6[c] || '');
      if (val.includes('AM') || val.includes('PM')) {
        effectiveTime = val.trim();
        break;
      }
    }
  }
  if (!effectiveTime) effectiveTime = '8:00 AM PST';

  // Lender fees from footer: "$1,295"
  const lenderFees = 1295;

  const lender = {
    name: 'AmWest Wholesale',
    effectiveDate,
    effectiveTime,
    lenderFees,
    lockExtension: '2 bps/day (max 30 days)',
  };

  console.log('Lender:', JSON.stringify(lender, null, 2));

  // ── 2. Rate table (30yr Fast Track FFT30) ─────────────────

  // Find the "FAST TRACK" header, then the rate header row with "RATE", "30 Days", "45 days"
  const ftHeaderRow = findRow(conv, 1, 'FAST TRACK');
  if (ftHeaderRow === -1) throw new Error('Could not find FAST TRACK section in CONV sheet');

  // The rate header row has "RATE" in col 1
  const rateHeaderRow = findRow(conv, 1, 'RATE', ftHeaderRow);
  if (rateHeaderRow === -1) throw new Error('Could not find rate header row');

  // FFT30 is columns 1-3 (Rate, 30 Days, 45 Days)
  const rateTable30yr = [];
  for (let i = rateHeaderRow + 1; i < conv.length; i++) {
    const row = conv[i];
    const rate = row[1];
    const price30 = row[2];
    const price45 = row[3];

    // Stop when we hit an empty rate or a non-number
    if (typeof rate !== 'number' || rate === '' || rate === 0) break;

    rateTable30yr.push([r4(rate), r4(price30), r4(price45)]);
  }

  console.log(`Rate table: ${rateTable30yr.length} rows (${rateTable30yr[0]?.[0]}% to ${rateTable30yr[rateTable30yr.length-1]?.[0]}%)`);

  // ── 3. LTV bands ──────────────────────────────────────────

  // Standard 9-band LTV structure from the LLPA headers
  const ltvBands = ['<=30', '30.01-60', '60.01-70', '70.01-75', '75.01-80', '80.01-85', '85.01-90', '90.01-95', '>95'];

  // ── 4. Purchase LLPA grid ─────────────────────────────────

  const purchaseHeaderRow = findRow(ftLlpas, 1, 'Purchase(Loan terms > 15');
  if (purchaseHeaderRow === -1) throw new Error('Could not find Purchase LLPA section');
  const purchaseFicoRow = findRow(ftLlpas, 1, 'FICO/LTV', purchaseHeaderRow);
  const purchaseLlpa = extractFicoGrid(ftLlpas, purchaseFicoRow, 9);
  console.log(`Purchase LLPA: ${Object.keys(purchaseLlpa).length} FICO tiers`);

  // ── 5. Rate & Term (Refi) LLPA grid ───────────────────────

  const refiHeaderRow = findRow(ftLlpas, 1, 'Rate&Term  (Loan terms > 15');
  if (refiHeaderRow === -1) throw new Error('Could not find Rate&Term LLPA section');
  const refiFicoRow = findRow(ftLlpas, 1, 'FICO/LTV', refiHeaderRow);
  const refiLlpa = extractFicoGrid(ftLlpas, refiFicoRow, 9);
  console.log(`Refi LLPA: ${Object.keys(refiLlpa).length} FICO tiers`);

  // ── 6. Cash-Out LLPA grid ─────────────────────────────────

  const cashoutHeaderRow = findRow(ftLlpas, 1, 'Cash Out (all amortization');
  if (cashoutHeaderRow === -1) throw new Error('Could not find Cash Out LLPA section');
  const cashoutFicoRow = findRow(ftLlpas, 1, 'FICO/LTV', cashoutHeaderRow);
  // Cash-out only has 5 LTV bands (<=30 through 75.01-80)
  const cashoutLlpa = extractFicoGrid(ftLlpas, cashoutFicoRow, 5);
  console.log(`Cash-Out LLPA: ${Object.keys(cashoutLlpa).length} FICO tiers`);

  // ── 7. Additional LLPAs (from Purchase Additional section) ──

  const purchaseAddlRow = findRow(ftLlpas, 1, 'Purchase Loan Additional');
  if (purchaseAddlRow === -1) throw new Error('Could not find Purchase Additional LLPA section');

  // Parse the additional rows after "Purchase Loan Additional"
  // Structure: LTV header row, then named rows (ARMs, Attached Condo, Sub Financing, HighBal Fixed, etc.)
  const addlLtvRow = findRow(ftLlpas, 1, 'LTV', purchaseAddlRow);

  function extractAddlRow(label, startRow) {
    for (let i = startRow; i < startRow + 10; i++) {
      const cellLabel = String(ftLlpas[i]?.[1] || '').toLowerCase().trim();
      if (cellLabel.includes(label.toLowerCase())) {
        const values = [];
        for (let c = 2; c < 11; c++) {
          const val = ftLlpas[i][c];
          if (typeof val === 'number') values.push(r4(val));
          else if (typeof val === 'string' && val.trim() === 'N/A') values.push(null);
          else values.push(0);
        }
        return values;
      }
    }
    return null;
  }

  const additionalLlpa = {};
  const condoRow = extractAddlRow('Attached  Condo', addlLtvRow);
  if (condoRow) additionalLlpa.condo = condoRow;

  const highBalRow = extractAddlRow('HighBal Fixed', addlLtvRow);
  if (highBalRow) additionalLlpa.highBal = highBalRow;

  const subFinRow = extractAddlRow('Sub Financing', addlLtvRow);
  if (subFinRow) additionalLlpa.subFin = subFinRow;

  console.log(`Additional LLPAs: ${Object.keys(additionalLlpa).join(', ')}`);

  // ── 8. Loan Amount Adjustments (from OTHER PRICE ADJUSTMENTS) ──

  // These are in the FT_LLPAS sheet, right side of Purchase Additional section
  const loanAmtAdj = [];

  // Search for loan amount adjustment rows
  for (let i = 0; i < ftLlpas.length; i++) {
    const row = ftLlpas[i];
    for (let c = 12; c < row.length; c++) {
      const cell = String(row[c] || '');
      if (cell.includes('Loan Amt $50,000')) {
        // Find the adjustment value (last numeric in the row)
        for (let j = row.length - 1; j > c; j--) {
          if (typeof row[j] === 'number') {
            loanAmtAdj.push({ min: 50000, max: 74999, adj: r4(row[j]) });
            break;
          }
        }
      } else if (cell.includes('Loan Amt $75,000')) {
        for (let j = row.length - 1; j > c; j--) {
          if (typeof row[j] === 'number') {
            loanAmtAdj.push({ min: 75000, max: 99999, adj: r4(row[j]) });
            break;
          }
        }
      } else if (cell.includes('Loan Amt $100,000')) {
        for (let j = row.length - 1; j > c; j--) {
          if (typeof row[j] === 'number') {
            loanAmtAdj.push({ min: 100000, max: 149999, adj: r4(row[j]) });
            break;
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

// ── CLI ─────────────────────────────────────────────────────

const inputFile = process.argv[2] || path.join(
  process.env.USERPROFILE, 'Downloads', '47006_02252026_1036070244.xlsx'
);
const outputFile = process.argv[3] || path.join(
  __dirname, '..', 'src', 'data', 'rates', 'amwest.json'
);

try {
  const result = parseAmwestXlsx(inputFile);

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
  console.log(`\n✓ Written to: ${outputFile}`);
  console.log(`  Effective date: ${result.lender.effectiveDate}`);
  console.log(`  Rate range: ${result.rateTable30yr[0][0]}% – ${result.rateTable30yr[result.rateTable30yr.length-1][0]}%`);
  console.log(`  Rate rows: ${result.rateTable30yr.length}`);
} catch (err) {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
}
