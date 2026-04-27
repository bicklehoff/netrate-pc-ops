/**
 * Smoke-test the ResiCentral Select LLPA parser against the live workbook.
 */

import fs from 'node:fs';
import { parseResicentralLlpasXlsx } from '../src/lib/pricing-nonqm/parsers/resicentral-llpas.js';

const PATH = 'C:/Users/bickl/Downloads/67370_04242026_1128199760.xlsx';
const buf = fs.readFileSync(PATH);

const out = parseResicentralLlpasXlsx(buf);
console.log(`Tiers seen: ${out.tiers_seen.join(', ')}`);
console.log(`Skipped:    ${out.skipped.join('\n            ') || '(none)'}`);
console.log(`Total rules: ${out.rules.length}`);

const byTier = {};
const byTierType = {};
for (const r of out.rules) {
  byTier[r.tier] = (byTier[r.tier] || 0) + 1;
  const k = `${r.tier}/${r.rule_type}`;
  byTierType[k] = (byTierType[k] || 0) + 1;
}
console.log(`\nRules by tier:`);
for (const [t, n] of Object.entries(byTier).sort()) console.log(`  ${t.padEnd(20)} ${n}`);

console.log(`\nRules by tier/rule_type:`);
for (const [k, n] of Object.entries(byTierType).sort()) console.log(`  ${k.padEnd(40)} ${n}`);

// Select spot-checks
const select = out.rules.filter(r => r.tier === 'select');
const selectTypes = [...new Set(select.map(r => r.rule_type))].sort();
console.log(`\nSelect rule_types (${selectTypes.length}):`);
for (const t of selectTypes) {
  const samples = select.filter(r => r.rule_type === t).slice(0, 3);
  console.log(`  ${t}:`);
  for (const s of samples) {
    const keys = Object.fromEntries(
      Object.entries(s).filter(([k]) =>
        !['lender_code','tier','product_type','occupancy','raw_label','not_offered'].includes(k)
        && s[k] != null
      )
    );
    console.log(`    ${JSON.stringify(keys)}  raw=${s.raw_label}`);
  }
}

// Verify Florida-specific rows are dropped
const florida = select.filter(r => /florida/i.test(r.raw_label || ''));
console.log(`\nSelect rules referencing Florida: ${florida.length} (should be 0)`);

// Verify FICO grid
const selectFicoLtv = select.filter(r => r.rule_type === 'fico_cltv_grid');
const naCount = selectFicoLtv.filter(r => r.not_offered).length;
console.log(`Select FICO grid: ${selectFicoLtv.length} rows; not_offered=${naCount} (lowest band 640-659 should be all 7 NA)`);

// Verify "2-4yr PPP" expansion in Max Price
const selectPriceCaps = select.filter(r => r.rule_type === 'prepay_term' && r.price_cap != null);
const yearsCovered = [...new Set(selectPriceCaps.map(r => r.prepay_years))].sort((a, b) => a - b);
console.log(`Select Max Price years covered: [${yearsCovered.join(', ')}] (should include 0,1,2,3,4,5)`);

// Verify Premier+InvPremier+Elite counts unchanged
console.log(`\nNon-Select counts (regression check):`);
console.log(`  premier:          ${byTier.premier} (expected 400)`);
console.log(`  investor_premier: ${byTier.investor_premier} (expected 369)`);
console.log(`  elite:            ${byTier.elite} (expected 348)`);
