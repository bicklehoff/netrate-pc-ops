/**
 * Smoke-test the ResiCentral Elite LLPA parser against the live workbook.
 * Reports rule counts by rule_type / tier, raw_label samples, and any
 * unrecognized labels (rows the classifier returned null for).
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

// Elite spot-checks
const elite = out.rules.filter(r => r.tier === 'elite');
const eliteTypes = [...new Set(elite.map(r => r.rule_type))].sort();
console.log(`\nElite rule_types (${eliteTypes.length}):`);
for (const t of eliteTypes) {
  const samples = elite.filter(r => r.rule_type === t).slice(0, 3);
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

// Verify state rows were dropped (no rules with state=CT/IL/NJ/NY)
const outOfLicense = elite.filter(r => /^(CT|IL|NJ|NY)$/.test(r.state || ''));
console.log(`\nElite out-of-license state rules: ${outOfLicense.length} (should be 0)`);

// Verify FICO grid present and correctly bounded (Elite caps at 80% LTV)
const eliteFicoLtv = elite.filter(r => r.rule_type === 'fico_cltv_grid');
const maxCltv = Math.max(...eliteFicoLtv.map(r => r.cltv_max));
console.log(`Elite FICO grid: ${eliteFicoLtv.length} rows; max cltv_max = ${maxCltv} (should be 80)`);
const minFico = Math.min(...eliteFicoLtv.map(r => r.fico_min));
const maxFico = Math.max(...eliteFicoLtv.map(r => r.fico_max));
console.log(`Elite FICO grid: fico range ${minFico}-${maxFico} (should be 600-999)`);

console.log(`\nUnique Elite "feature" values:`);
const features = new Map();
for (const r of elite.filter(r => r.rule_type === 'feature')) {
  features.set(r.feature, (features.get(r.feature) || 0) + 1);
}
for (const [k, n] of features) console.log(`  ${k.padEnd(40)} ${n}`);

console.log(`\nUnique Elite categories seen in raw_label:`);
const cats = new Set();
for (const r of elite) {
  const m = r.raw_label?.match(/^([^/]+) \//);
  if (m) cats.add(m[1].trim());
}
for (const c of [...cats].sort()) console.log(`  ${c}`);
