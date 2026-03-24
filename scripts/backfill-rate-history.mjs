import 'dotenv/config';
import XLSX from 'xlsx';
import { neon } from '@neondatabase/serverless';
import { readdir } from 'fs/promises';
import path from 'path';

const RATE_SHEETS_DIR = path.resolve('Work/Dev/Products/rate-sheets-historical');
const PRICING_SHEET = 'WS DU & LP Pricing';
const LLPA_SHEET = 'WS DU & LP LLPAs';

// Credit score tiers: label, LLPA row index, LLPA column (75.01-80% LTV, Purchase)
const CREDIT_TIERS = [
  { label: '760+', llpaRow: 37, llpaCol: 9 },
  { label: '740',  llpaRow: 39, llpaCol: 9 },
  { label: '700',  llpaRow: 41, llpaCol: 9 },
];

// 30yr fixed rate data starts at row 8, col C (rate) and col E (30-day price)
const RATE_COL = 2;   // Column C (0-indexed)
const PRICE_COL = 4;  // Column E (30-day lock)
const RATE_START_ROW = 8;

/**
 * Parse date from filename: Rate_Sheet-Excel-Wholesale-YYYY-MM-DD_HH-MM-SS-AM.xlsx
 * Returns { date: 'YYYY-MM-DD', timestamp: Date }
 */
function parseDateFromFilename(filename) {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})-(AM|PM)/);
  if (!match) return null;

  const [, year, month, day, hourStr, min, sec, ampm] = match;
  let hour = parseInt(hourStr, 10);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = `${year}-${month}-${day}`;
  const timestamp = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${min}:${sec}`);
  return { date, timestamp };
}

/**
 * Extract 30yr fixed base rates and prices from pricing sheet.
 * Returns array of { rate: number, price: number }
 */
function extractBaseRates(ws) {
  const rates = [];
  for (let r = RATE_START_ROW; r < 200; r++) {
    const rateCell = ws[XLSX.utils.encode_cell({ r, c: RATE_COL })];
    const priceCell = ws[XLSX.utils.encode_cell({ r, c: PRICE_COL })];
    if (!rateCell || !priceCell) break; // end of rate block
    const rate = parseFloat(rateCell.v);
    const price = parseFloat(priceCell.v);
    if (isNaN(rate) || isNaN(price)) break;
    rates.push({ rate, price });
  }
  return rates;
}

/**
 * Extract LLPA for a given tier from the LLPA sheet.
 * Returns the LLPA value (number to subtract from base price).
 */
function extractLLPA(wsLLPA, tier) {
  const cell = wsLLPA[XLSX.utils.encode_cell({ r: tier.llpaRow, c: tier.llpaCol })];
  if (!cell) return null;
  const val = parseFloat(cell.v);
  return isNaN(val) ? null : val;
}

/**
 * Find the par rate: rate whose adjusted price is closest to 100 (from above, i.e. >= 100 preferred).
 * If no rate is >= 100, take the one closest to 100 from below.
 */
function findParRate(baseRates, llpa) {
  let bestRate = null;
  let bestDiff = Infinity;
  let bestAbove = null;
  let bestAboveDiff = Infinity;

  for (const { rate, price } of baseRates) {
    const adjustedPrice = price - llpa;
    const diff = Math.abs(adjustedPrice - 100);

    // Track the best rate at or above par
    if (adjustedPrice >= 100 && diff < bestAboveDiff) {
      bestAbove = rate;
      bestAboveDiff = diff;
    }

    // Track overall closest
    if (diff < bestDiff) {
      bestRate = rate;
      bestDiff = diff;
    }
  }

  // Prefer the rate closest to 100 from above; fall back to overall closest
  return bestAbove !== null ? bestAbove : bestRate;
}

/**
 * Process a single rate sheet file.
 * Returns array of { date, rate, credit_score_tier } or null on error.
 */
function processFile(filePath) {
  const wb = XLSX.readFile(filePath);
  const wsPricing = wb.Sheets[PRICING_SHEET];
  const wsLLPA = wb.Sheets[LLPA_SHEET];

  if (!wsPricing || !wsLLPA) {
    throw new Error(`Missing required sheets (${PRICING_SHEET} or ${LLPA_SHEET})`);
  }

  const baseRates = extractBaseRates(wsPricing);
  if (baseRates.length === 0) {
    throw new Error('No base rates found in pricing sheet');
  }

  const results = [];
  for (const tier of CREDIT_TIERS) {
    const llpa = extractLLPA(wsLLPA, tier);
    if (llpa === null) {
      console.warn(`  Warning: Could not extract LLPA for tier ${tier.label}`);
      continue;
    }
    const parRate = findParRate(baseRates, llpa);
    if (parRate !== null) {
      results.push({
        rate: parRate,
        credit_score_tier: tier.label,
      });
    }
  }

  return results;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set. Check .env file.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Create table
  console.log('Creating rate_history table if not exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS rate_history (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      rate DECIMAL(5,3) NOT NULL,
      apr DECIMAL(5,3),
      credit_score_tier VARCHAR(20) NOT NULL,
      loan_type VARCHAR(30) NOT NULL DEFAULT '30yr_fixed',
      lender VARCHAR(50) DEFAULT 'amwest',
      source VARCHAR(50) DEFAULT 'rate_sheet',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, credit_score_tier, loan_type, lender)
    )
  `;
  console.log('Table ready.\n');

  // Read all files
  const allFiles = await readdir(RATE_SHEETS_DIR);
  const xlsxFiles = allFiles
    .filter(f => f.endsWith('.xlsx') && f.startsWith('Rate_Sheet'))
    .map(f => {
      const parsed = parseDateFromFilename(f);
      return parsed ? { filename: f, ...parsed } : null;
    })
    .filter(Boolean);

  console.log(`Found ${xlsxFiles.length} rate sheet files.\n`);

  // Group by date, keep latest per date (reprice handling)
  const byDate = new Map();
  for (const file of xlsxFiles) {
    const existing = byDate.get(file.date);
    if (!existing || file.timestamp > existing.timestamp) {
      byDate.set(file.date, file);
    }
  }

  const dedupedFiles = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const repriceCount = xlsxFiles.length - dedupedFiles.length;
  if (repriceCount > 0) {
    console.log(`Deduped ${repriceCount} reprice files (kept latest per date).`);
  }
  console.log(`Processing ${dedupedFiles.length} unique dates.\n`);

  let totalInserted = 0;
  let filesProcessed = 0;
  let filesErrored = 0;
  let minDate = null;
  let maxDate = null;

  for (const file of dedupedFiles) {
    const filePath = path.join(RATE_SHEETS_DIR, file.filename);
    try {
      const results = processFile(filePath);
      filesProcessed++;

      if (!minDate || file.date < minDate) minDate = file.date;
      if (!maxDate || file.date > maxDate) maxDate = file.date;

      for (const r of results) {
        await sql`
          INSERT INTO rate_history (date, rate, credit_score_tier, loan_type, lender, source)
          VALUES (${file.date}, ${r.rate}, ${r.credit_score_tier}, '30yr_fixed', 'amwest', 'rate_sheet')
          ON CONFLICT (date, credit_score_tier, loan_type, lender)
          DO UPDATE SET rate = EXCLUDED.rate, created_at = NOW()
        `;
        totalInserted++;
      }

      console.log(`  ${file.date} — ${file.filename} — ${results.length} rates (${results.map(r => `${r.credit_score_tier}=${r.rate}%`).join(', ')})`);
    } catch (err) {
      filesErrored++;
      console.error(`  ERROR ${file.date} — ${file.filename}: ${err.message}`);
    }
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Total files found:     ${xlsxFiles.length}`);
  console.log(`Reprices skipped:      ${repriceCount}`);
  console.log(`Files processed:       ${filesProcessed}`);
  console.log(`Files errored:         ${filesErrored}`);
  console.log(`Total rates upserted:  ${totalInserted}`);
  console.log(`Date range:            ${minDate} to ${maxDate}`);
  console.log('=============================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
