/**
 * Ingest Everstream rate sheet + LLPA workbook into Neon.
 *
 * Usage:
 *   node scripts/ingest-everstream.mjs <rates.csv> <llpas.xlsx>
 *
 * Reads both files, parses, writes to nonqm_rate_* tables, prints counts.
 * Safe to re-run — re-ingesting the same effective_at replaces existing rows.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { parseEverstreamRatesCsv } from '../src/lib/pricing-nonqm/parsers/everstream-rates.js';
import { parseEverstreamLlpasXlsx } from '../src/lib/pricing-nonqm/parsers/everstream-llpas.js';
import { ingestEverstreamSheet } from '../src/lib/pricing-nonqm/ingest.js';

const [csvPath, xlsxPath] = process.argv.slice(2);
if (!csvPath || !xlsxPath) {
  console.error('Usage: node scripts/ingest-everstream.mjs <rates.csv> <llpas.xlsx>');
  process.exit(1);
}

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('PC_DATABASE_URL or DATABASE_URL must be set');
  process.exit(1);
}

console.log(`Ingesting Everstream sheet:`);
console.log(`  rates: ${csvPath}`);
console.log(`  llpas: ${xlsxPath}`);

// ─── Parse ────────────────────────────────────────────────────────
const csvText = fs.readFileSync(csvPath, 'utf8');
const rates = parseEverstreamRatesCsv(csvText);
console.log(`\nParsed rate CSV:`);
console.log(`  total rows:  ${rates.total_rows}`);
console.log(`  Non-QM rows: ${rates.nonqm_count}`);
console.log(`  effective_at: ${rates.effective_at}`);
if (rates.skipped.length) {
  console.log(`  ⚠ skipped ${rates.skipped.length} malformed rows`);
}

// Tier breakdown
const byTier = rates.products.reduce((acc, p) => {
  const k = `${p.loan_type}/${p.tier}`;
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log(`  by tier:`, byTier);

const xlsxBuf = fs.readFileSync(xlsxPath);
const llpas = parseEverstreamLlpasXlsx(xlsxBuf);
console.log(`\nParsed LLPA XLSX:`);
console.log(`  tiers:  ${llpas.tiers_seen.join(', ')}`);
console.log(`  rules:  ${llpas.rules.length}`);
if (llpas.skipped.length) {
  console.log(`  ⚠ ${llpas.skipped.length} skips:`, llpas.skipped.slice(0, 5));
}

// Rule breakdown by type
const byRuleType = llpas.rules.reduce((acc, r) => {
  acc[r.rule_type] = (acc[r.rule_type] || 0) + 1;
  return acc;
}, {});
console.log(`  by rule_type:`, byRuleType);

// ─── Ingest ───────────────────────────────────────────────────────
const sql = neon(DATABASE_URL);

const sourceFiles = [path.basename(csvPath), path.basename(xlsxPath)];
const result = await ingestEverstreamSheet(sql, {
  rates,
  llpas,
  sourceFiles,
  activate: true,
});

console.log(`\n✅ Ingest complete:`);
console.log(`   rate_sheet_id:  ${result.rateSheetId}`);
console.log(`   products:       ${result.productCount}`);
console.log(`   llpa rules:     ${result.llpaCount}`);
console.log(`   ${result.replaced ? 'replaced existing sheet' : 'new sheet'}`);
console.log(`   marked active: true`);

// ─── Verify ───────────────────────────────────────────────────────
const check = await sql`
  SELECT
    (SELECT count(*)::int FROM nonqm_rate_products    WHERE rate_sheet_id = ${result.rateSheetId}) AS products,
    (SELECT count(*)::int FROM nonqm_adjustment_rules WHERE rate_sheet_id = ${result.rateSheetId}) AS rules,
    (SELECT is_active FROM nonqm_rate_sheets WHERE id = ${result.rateSheetId}) AS active
`;
console.log(`\n--- Verification ---`);
console.log(`  DB product rows: ${check[0].products}`);
console.log(`  DB rule rows:    ${check[0].rules}`);
console.log(`  is_active:       ${check[0].active}`);
