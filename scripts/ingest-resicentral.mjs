/**
 * Ingest a ResiCentral DSCR rate sheet workbook into Neon.
 *
 * Usage:
 *   node scripts/ingest-resicentral.mjs <path/to/lender_MMDDYYYY_seq.xlsx>
 *
 * Reads the workbook once, runs both sub-parsers (rates + LLPAs) via the
 * top-level orchestrator, prints summaries, then writes to nonqm_rate_*
 * tables and marks the sheet active. Safe to re-run — re-ingesting the
 * same `effective_at` for `resicentral` replaces existing rows for that
 * sheet, leaving Everstream + other lenders untouched.
 *
 * Per Work/Dev/RESICENTRAL-LLPA-INVENTORY-2026-04-27.md §11 D9c.6.6.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { parseResicentralXlsx } from '../src/lib/pricing-nonqm/parsers/resicentral.js';
import { ingestNonqmSheet } from '../src/lib/pricing-nonqm/ingest.js';

const [xlsxPath, ...flags] = process.argv.slice(2);
if (!xlsxPath) {
  console.error('Usage: node scripts/ingest-resicentral.mjs <xlsx>');
  console.error('  --no-activate    parse + write but do not flip is_active');
  console.error('  --dry-run        parse + print summary, no DB writes');
  process.exit(1);
}

const ACTIVATE = !flags.includes('--no-activate');
const DRY_RUN  = flags.includes('--dry-run');

const DATABASE_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;
if (!DRY_RUN && !DATABASE_URL) {
  console.error('PC_DATABASE_URL or DATABASE_URL must be set (use --dry-run to skip DB)');
  process.exit(1);
}

console.log(`Ingesting ResiCentral sheet:`);
console.log(`  workbook: ${xlsxPath}`);
console.log(`  activate: ${ACTIVATE}`);
console.log(`  dry-run:  ${DRY_RUN}\n`);

// ─── Parse ────────────────────────────────────────────────────────
const buf = fs.readFileSync(xlsxPath);
const filename = path.basename(xlsxPath);
const { rates, llpas } = parseResicentralXlsx(buf, filename);

console.log(`Parsed rates:`);
console.log(`  effective_at: ${rates.effective_at}`);
console.log(`  tiers:        ${rates.tiers_seen.join(', ')}`);
console.log(`  products:     ${rates.products.length}`);
if (rates.skipped.length) {
  console.log(`  ⚠ ${rates.skipped.length} rate skips:`);
  for (const s of rates.skipped) console.log(`     ${s}`);
}

const byTierTerm = rates.products.reduce((acc, p) => {
  const k = `${p.tier}/${p.term}y/${p.lock_days}d`;
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log(`  by tier/term/lock:`);
for (const k of Object.keys(byTierTerm).sort()) console.log(`     ${k}: ${byTierTerm[k]}`);

console.log(`\nParsed LLPAs:`);
console.log(`  tiers: ${llpas.tiers_seen.join(', ')}`);
console.log(`  rules: ${llpas.rules.length}`);
if (llpas.skipped.length) {
  console.log(`  ⚠ ${llpas.skipped.length} LLPA skips:`);
  for (const s of llpas.skipped) console.log(`     ${s}`);
}

const byRuleType = llpas.rules.reduce((acc, r) => {
  const k = `${r.tier}/${r.rule_type}`;
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log(`  by tier/rule_type:`);
for (const k of Object.keys(byRuleType).sort()) console.log(`     ${k}: ${byRuleType[k]}`);

if (DRY_RUN) {
  console.log(`\n[dry-run] no DB writes`);
  process.exit(0);
}

// ─── Ingest ───────────────────────────────────────────────────────
const sql = neon(DATABASE_URL);
const sourceFiles = [filename];

const result = await ingestNonqmSheet(sql, {
  rates,
  llpas,
  sourceFiles,
  activate: ACTIVATE,
});

console.log(`\n✅ Ingest complete:`);
console.log(`   rate_sheet_id:  ${result.rateSheetId}`);
console.log(`   products:       ${result.productCount}`);
console.log(`   llpa rules:     ${result.llpaCount}`);
console.log(`   ${result.replaced ? 'replaced existing sheet' : 'new sheet'}`);
console.log(`   marked active:  ${ACTIVATE}`);

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
