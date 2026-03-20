#!/usr/bin/env node
/**
 * Test script for the EverStream rate sheet parser.
 * Reads the sample CSV and XLSX files and outputs a summary.
 */

const fs = require('fs');
const path = require('path');
const { parse, parseRates, parseLLPAs } = require('../src/lib/rates/parsers/everstream');

const CSV_PATH = path.join(__dirname, '../Work/Dev/Products/rate-sheets-analysis/96573_03202026_1533061742.csv');
const XLSX_PATH = path.join(__dirname, '../Work/Dev/Products/rate-sheets-analysis/96596_03202026_1533071001.xlsx');

console.log('=== EverStream Rate Sheet Parser Test ===\n');

// Read files
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const xlsxBuffer = fs.readFileSync(XLSX_PATH);

console.log(`CSV file: ${path.basename(CSV_PATH)} (${csvContent.split('\n').length} lines)`);
console.log(`XLSX file: ${path.basename(XLSX_PATH)} (${(xlsxBuffer.length / 1024).toFixed(0)} KB)\n`);

// Parse
const result = parse(csvContent, xlsxBuffer);

// --- Programs summary ---
console.log('--- PROGRAMS ---');
console.log(`Total programs: ${result.programs.length}`);
console.log(`Sheet date: ${result.sheetDate}`);
console.log(`Parsed at: ${result.parsedAt}\n`);

// Category breakdown
const byCategory = {};
const bySubcategory = {};
const byTier = {};
const byProductType = {};
for (const p of result.programs) {
  byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  bySubcategory[p.subcategory] = (bySubcategory[p.subcategory] || 0) + 1;
  byTier[p.tier] = (byTier[p.tier] || 0) + 1;
  byProductType[p.productType] = (byProductType[p.productType] || 0) + 1;
}
console.log('By category:', byCategory);
console.log('By subcategory:', bySubcategory);
console.log('By tier:', byTier);
console.log('By product type:', byProductType);

// Sample programs
console.log('\nSample programs (first 5):');
for (const p of result.programs.slice(0, 5)) {
  console.log(`  ${p.id}`);
  console.log(`    name: ${p.name}`);
  console.log(`    ${p.category}/${p.subcategory}, ${p.term}yr ${p.productType}, tier=${p.tier}, occ=${p.occupancy}`);
  console.log(`    loan range: ${JSON.stringify(p.loanAmountRange)}, highBal=${p.isHighBalance}`);
  console.log(`    rates: ${p.rates.length} entries, lock days: ${JSON.stringify(p.lockDays)}`);
  if (p.rates.length > 0) {
    const sample = p.rates[0];
    console.log(`    sample rate: ${sample.rate}% @ ${sample.price} (${sample.lockDays} days)`);
  }
}

// ARM programs
const armPrograms = result.programs.filter(p => p.productType === 'arm');
console.log(`\nARM programs (${armPrograms.length}):`);
for (const p of armPrograms.slice(0, 3)) {
  console.log(`  ${p.id} — ${p.armStructure} ARM`);
}

// High balance
const highBalPrograms = result.programs.filter(p => p.isHighBalance);
console.log(`\nHigh Balance programs: ${highBalPrograms.length}`);

// FICO-filtered
const ficoFiltered = result.programs.filter(p => p.ficoFilter);
console.log(`FICO-filtered programs: ${ficoFiltered.length}`);
for (const p of ficoFiltered.slice(0, 2)) {
  console.log(`  ${p.id} — FICO max ${p.ficoFilter.max}`);
}

// NOO/SH
const noo = result.programs.filter(p => p.occupancy === 'investment');
const sh = result.programs.filter(p => p.occupancy === 'secondary');
console.log(`Investment (NOO) programs: ${noo.length}`);
console.log(`Second Home (SH) programs: ${sh.length}`);

// --- LLPAs summary ---
console.log('\n--- LLPAs ---');

function summarizeLLPA(obj, prefix = '') {
  if (!obj) return;
  if (obj.error) { console.log(`  ${prefix}: ERROR - ${obj.error}`); return; }

  for (const [key, val] of Object.entries(obj)) {
    if (key === 'ficoLtv' || key === 'attributes') continue;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      if (val.ficoLtv) {
        console.log(`  ${prefix}${key}: ${val.ficoLtv.length} FICO bands, ${val.attributes ? val.attributes.length : 0} attributes`);
      } else {
        summarizeLLPA(val, `${prefix}${key}.`);
      }
    }
  }
}

console.log('\nElite tier LLPA sheets:');
for (const [key, val] of Object.entries(result.llpas.elite || {})) {
  console.log(`\n  ${key}:`);
  if (val.error) {
    console.log(`    ERROR: ${val.error}`);
  } else if (val.fixed || val.arm) {
    // DSCR format
    const fixedPurposes = Object.keys(val.fixed || {});
    const armPurposes = Object.keys(val.arm || {});
    console.log(`    Fixed purposes: ${fixedPurposes.join(', ')}`);
    console.log(`    ARM purposes: ${armPurposes.join(', ')}`);
    if (fixedPurposes.length > 0) {
      const first = val.fixed[fixedPurposes[0]];
      console.log(`    Sample (${fixedPurposes[0]}): ${first.length} FICO bands`);
    }
  } else if (val.ficoLoanAmount) {
    // Govt (FHA/VA) format
    console.log(`    FICO/Loan Amount rows: ${val.ficoLoanAmount.length}`);
    console.log(`    State tiers: ${val.stateTiers.length}`);
    console.log(`    Purpose adjustments: ${Object.keys(val.purposeAdjustments).join(', ')}`);
    for (const [purpose, rows] of Object.entries(val.purposeAdjustments)) {
      console.log(`      ${purpose}: ${rows.length} rows`);
    }
  } else {
    summarizeLLPA(val, '    ');
  }
}

console.log('\nCore tier LLPA sheets:');
for (const [key, val] of Object.entries(result.llpas.core || {})) {
  console.log(`\n  ${key}:`);
  if (val.error) {
    console.log(`    ERROR: ${val.error}`);
  } else if (val.format === 'raw') {
    console.log(`    Format: raw grid (${val.sections.length} sections)`);
    for (const sec of val.sections) {
      console.log(`      "${sec.title}": ${sec.grids.length} rows`);
    }
  } else {
    summarizeLLPA(val, '    ');
  }
}

console.log('\nLoan Amount LLPAs:');
if (result.llpas.loanAmount) {
  if (result.llpas.loanAmount.error) {
    console.log(`  ERROR: ${result.llpas.loanAmount.error}`);
  } else {
    console.log(`  ${result.llpas.loanAmount.loanAmountBands.length} loan amount bands`);
    console.log(`  ${result.llpas.loanAmount.products.length} product rows`);
    if (result.llpas.loanAmount.products.length > 0) {
      const sample = result.llpas.loanAmount.products[0];
      console.log(`  Sample: ${sample.product} (${sample.term})`);
      console.log(`    Loan amount adj keys: ${Object.keys(sample.loanAmountAdj).length}`);
      console.log(`    Additional adj: ${JSON.stringify(sample.additionalAdj)}`);
    }
  }
}

// Verify key data
console.log('\n--- VERIFICATION ---');

// Check that we have actual LLPA values
const eliteFnma = result.llpas.elite?.fnma;
if (eliteFnma?.purchase?.longTerm?.ficoLtv?.length > 0) {
  const first = eliteFnma.purchase.longTerm.ficoLtv[0];
  console.log(`Elite FNMA Purchase (>15yr), FICO ${first.ficoMin}-${first.ficoMax}:`);
  console.log(`  LTV bands: ${JSON.stringify(first.ltvBands)}`);
  console.log(`  FICO rows: ${eliteFnma.purchase.longTerm.ficoLtv.length}, Attributes: ${eliteFnma.purchase.longTerm.attributes.length}`);
} else {
  console.log('WARNING: No Elite FNMA Purchase LLPA data found');
}

// Check FHA govt sheet
const eliteFha = result.llpas.elite?.fha;
if (eliteFha?.ficoLoanAmount?.length > 0) {
  const first = eliteFha.ficoLoanAmount[0];
  console.log(`\nElite FHA FICO/Loan Amount, FICO ${first.ficoMin}-${first.ficoMax}:`);
  console.log(`  Loan amount adj: ${JSON.stringify(first.loanAmountAdj)}`);
  console.log(`  State tiers: ${eliteFha.stateTiers.length}`);
  console.log(`  Purpose adj keys: ${Object.keys(eliteFha.purposeAdjustments).join(', ')}`);
} else {
  console.log('WARNING: No Elite FHA LLPA data found');
}

// Check a DSCR sheet
const eliteDscr1 = result.llpas.elite?.dscr1;
if (eliteDscr1?.fixed) {
  const purposes = Object.keys(eliteDscr1.fixed);
  console.log(`\nElite DSCR 1 Fixed purposes: ${purposes.join(', ')}`);
  const nooP = eliteDscr1.fixed.nooPurchase;
  if (nooP && nooP.length > 0) {
    const first = nooP[0];
    console.log(`  NOO Purchase, FICO ${first.ficoMin}-${first.ficoMax}: ${JSON.stringify(first.cltvBands)}`);
  }
}

console.log('\n=== Test complete ===');
