/**
 * Quick validation script for the DSCR pricer against live ingested data.
 *
 *   node scripts/_test-price-dscr.mjs
 *
 * Exercises a realistic NOO purchase DSCR scenario and prints the top 5
 * priced options + sanity checks. Not a unit test — just a smoke check that
 * the load/price pipeline produces sensible numbers.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { loadActiveDscrSheet, priceDscrScenario } from '../src/lib/pricing-nonqm/price-dscr.js';

const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

const scenario = {
  product_type: 'fixed',
  term: 30,
  lock_days: 30,
  fico: 740,
  cltv: 70,
  state: 'CO',
  occupancy: 'investment',
  loan_purpose: 'purchase',
  property_type: 'sfr',
  loan_size: 500_000,
  dscr_ratio: 1.20,
  prepay_years: 5,
  prepay_structure: 'fixed_5',
  features: [],
};

console.log('Loading active Everstream DSCR sheet…');
const sheet = await loadActiveDscrSheet(sql);
console.log(`  sheet: ${sheet.sheet.effective_at}`);
console.log(`  products: ${sheet.products.length}`);
console.log(`  rules: ${sheet.rules.length}`);

console.log('\nScenario:', scenario);

const { priced, skipped, meta } = priceDscrScenario(sheet, scenario);

console.log(`\nPriced options: ${priced.length}`);
console.log(`Skipped: ${skipped.length}`);
// Split Core (base-only) from Elite (fully priced) for clarity
const elite = priced.filter(r => r.tier !== 'core');
const core  = priced.filter(r => r.tier === 'core');
console.log(`\n  Elite candidates: ${elite.length}`);
console.log(`  Core  candidates: ${core.length} (base-price only until Core LLPAs land)`);

console.log('\nTop 5 Elite by final_price:');
for (const row of elite.slice(0, 5)) {
  console.log(
    `  ${row.tier.padEnd(8)} ${row.note_rate.toFixed(3)}%  base ${row.base_price.toFixed(4)}  ` +
    `llpa ${row.llpa_total >= 0 ? '+' : ''}${row.llpa_total.toFixed(3)}  ` +
    `final ${row.final_price.toFixed(4)}` +
    (row.warnings.length ? `  ⚠ ${row.warnings.map(w => w.code).join(',')}` : '')
  );
}

// Show adjustments for the single best Elite option
if (elite.length) {
  const best = elite[0];
  console.log(`\nBreakdown for best: ${best.tier} @ ${best.note_rate}%`);
  console.log(`  base_price:  ${best.base_price}`);
  for (const a of best.adjustments) {
    console.log(`  ${a.points >= 0 ? '+' : ''}${a.points.toFixed(3)}  ${a.label}`);
  }
  console.log(`  llpa_total:  ${best.llpa_total >= 0 ? '+' : ''}${best.llpa_total}`);
  console.log(`  price_cap:   ${best.price_cap ?? '(none)'}`);
  console.log(`  final_price: ${best.final_price}`);
}

// Spot-check gate reasons
if (skipped.length) {
  const reasons = skipped.reduce((acc, s) => {
    acc[s.reason] = (acc[s.reason] || 0) + 1;
    return acc;
  }, {});
  console.log('\nSkip reasons:', reasons);
}

// Second scenario: Investment cash-out refi 5/6 ARM, FICO 700, CLTV 75
const armScenario = {
  ...scenario,
  product_type: 'arm',
  arm_fixed_period: 5,
  loan_purpose: 'cashout',
  fico: 700,
  cltv: 75,
};

console.log('\n─── ARM scenario ───');
console.log(armScenario);
const arm = priceDscrScenario(sheet, armScenario);
console.log(`Priced: ${arm.priced.length}  Skipped: ${arm.skipped.length}`);
for (const row of arm.priced.slice(0, 3)) {
  console.log(`  ${row.tier.padEnd(8)} ${row.note_rate}%  final ${row.final_price.toFixed(4)}`);
}
