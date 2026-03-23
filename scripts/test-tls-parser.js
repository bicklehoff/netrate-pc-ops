/**
 * Test script for The Loan Store (TLS) rate sheet parser.
 * Run: node scripts/test-tls-parser.js
 */

const fs = require('fs');
const path = require('path');
const { parseRates, decodeProductCode } = require('../src/lib/rates/parsers/tls');

const csvPath = path.join(__dirname, '../Work/Dev/Products/rate-sheets-analysis/61534_03202026_1630310061.csv');

if (!fs.existsSync(csvPath)) {
  console.error('Rate sheet not found:', csvPath);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, 'utf-8');
const result = parseRates(csv);

console.log(`Sheet Date: ${result.sheetDate}`);
console.log(`Total Programs: ${result.programs.length}`);
console.log();

// Group by category
const byCategory = {};
for (const p of result.programs) {
  const key = `${p.category}/${p.subcategory}`;
  if (!byCategory[key]) byCategory[key] = [];
  byCategory[key].push(p);
}

console.log('=== PROGRAMS BY CATEGORY ===');
for (const [cat, progs] of Object.entries(byCategory).sort()) {
  console.log(`\n  ${cat} (${progs.length} programs):`);
  for (const p of progs.slice(0, 5)) {
    // Find par rate (closest to 0 for discount format)
    const thirtyDay = p.rates.filter(r => r.lockDays === 30);
    const par = thirtyDay.length > 0
      ? thirtyDay.reduce((best, r) => Math.abs(r.price) < Math.abs(best.price) ? r : best)
      : null;
    const parStr = par ? `par: ${par.rate}% @ ${par.price.toFixed(3)} pts` : 'no 30-day data';
    console.log(`    ${p.name} [${p.productCode}] — ${parStr}`);
  }
  if (progs.length > 5) {
    console.log(`    ... and ${progs.length - 5} more`);
  }
}

// Verify key products
console.log('\n=== KEY PRODUCT PAR RATES (30-day) ===');
const keyProducts = ['CONF30', 'FHA30', 'VA30', 'USDA30', 'CONF30HB', 'J30_E2', 'N30_E35_DSCR', 'N30_E35_BKST', 'H1M_WB_HELOC'];
for (const code of keyProducts) {
  const prog = result.programs.find(p => p.productCode === code);
  if (!prog) {
    console.log(`  ${code}: NOT FOUND`);
    continue;
  }
  const thirtyDay = prog.rates.filter(r => r.lockDays === 30);
  const par = thirtyDay.length > 0
    ? thirtyDay.reduce((best, r) => Math.abs(r.price) < Math.abs(best.price) ? r : best)
    : null;
  console.log(`  ${code} → ${prog.name}: ${par ? `${par.rate}% @ ${par.price.toFixed(3)} pts` : 'N/A'}`);
}

// Check for unknowns
const unknowns = result.programs.filter(p => p.category === 'unknown');
if (unknowns.length > 0) {
  console.log(`\n=== UNKNOWN PRODUCT CODES (${unknowns.length}) ===`);
  for (const p of unknowns) {
    console.log(`  ${p.productCode}`);
  }
}

// Stats
console.log('\n=== STATS ===');
const totalRates = result.programs.reduce((sum, p) => sum + p.rates.length, 0);
console.log(`  Programs: ${result.programs.length}`);
console.log(`  Total rate entries: ${totalRates}`);
console.log(`  Categories: ${[...new Set(result.programs.map(p => p.category))].join(', ')}`);
console.log(`  Subcategories: ${[...new Set(result.programs.map(p => p.subcategory))].join(', ')}`);
console.log(`  Lock periods: ${[...new Set(result.programs.flatMap(p => p.lockDays))].sort((a,b)=>a-b).join(', ')} days`);
