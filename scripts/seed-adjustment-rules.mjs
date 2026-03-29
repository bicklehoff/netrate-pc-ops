/**
 * Seed adjustment_rules table from everstream-complete.json.
 *
 * Converts static JSON config into normalized DB rows so the pricing engine
 * can query adjustments from the database instead of reading JSON files.
 *
 * Run: node scripts/seed-adjustment-rules.mjs [--dry-run]
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');
const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

// Load config
const cfgPath = join(__dirname, '..', 'src', 'data', 'lender-llpas', 'everstream-complete.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));

const SOURCE = 'everstream-complete.json';
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// ─── Parse helpers ──────────────────────────────────────────────────

/** Parse FICO band string → { ficoMin, ficoMax }
 *  Handles both Core format (">=780", "760-779") and Elite Unicode ("≥800", "780-799") */
function parseFicoBand(band) {
  // ">=780" or ">= 800" or "≥800"
  const geMatch = band.match(/[≥>]=?\s*(\d+)/);
  if (geMatch) return { ficoMin: parseInt(geMatch[1]), ficoMax: 999 };

  // "< 620(1)" or "< 620"
  const ltMatch = band.match(/<\s*(\d+)/);
  if (ltMatch) return { ficoMin: 0, ficoMax: parseInt(ltMatch[1]) - 1 };

  // "760-779" or "760 - 779" or "780 - 799"
  const rangeMatch = band.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) return { ficoMin: parseInt(rangeMatch[1]), ficoMax: parseInt(rangeMatch[2]) };

  console.warn(`  ⚠ Could not parse FICO band: "${band}"`);
  return null;
}

/** Parse LTV band string → { ltvMin, ltvMax }
 *  Handles both Core format ("<= 30.00%", "30.01 - 60.00%") and
 *  Elite format ("≤30", "30.01-60", "75.01-80") */
function parseLtvBand(band) {
  // "≤30" or "≤ 30" (Elite Unicode)
  const leUnicode = band.match(/≤\s*([\d.]+)/);
  if (leUnicode) return { ltvMin: 0, ltvMax: parseFloat(leUnicode[1]) };

  // "<= 30.00%" or "<= 40.00%" (Core)
  const leMatch = band.match(/<=\s*([\d.]+)/);
  if (leMatch && !band.includes('-')) return { ltvMin: 0, ltvMax: parseFloat(leMatch[1]) };

  // "30.01 - 60.00%" (Core) or "30.01-60" (Elite) — range format
  const rangeMatch = band.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (rangeMatch) return { ltvMin: parseFloat(rangeMatch[1]), ltvMax: parseFloat(rangeMatch[2]) };

  console.warn(`  ⚠ Could not parse LTV band: "${band}"`);
  return null;
}

/** Parse loan amount range string → { loanAmountMin, loanAmountMax } */
function parseLoanAmountRange(range) {
  // "<= 50000"
  const leMatch = range.match(/^<=\s*(\d+)$/);
  if (leMatch) return { loanAmountMin: 0, loanAmountMax: parseInt(leMatch[1]) };

  // ">50000<=85000" or ">300000<=400000"
  const rangeMatch = range.match(/>(\d+)<=(\d+)/);
  if (rangeMatch) return { loanAmountMin: parseInt(rangeMatch[1]) + 1, loanAmountMax: parseInt(rangeMatch[2]) };

  // ">1500000" (no upper bound)
  const gtMatch = range.match(/>(\d+)$/);
  if (gtMatch) return { loanAmountMin: parseInt(gtMatch[1]) + 1, loanAmountMax: 99999999 };

  console.warn(`  ⚠ Could not parse loan amount range: "${range}"`);
  return null;
}

// ─── Row builders ───────────────────────────────────────────────────

const rows = [];

function addRow(data) {
  rows.push({
    adjustment_type: data.adjustmentType,
    loan_type: data.loanType || 'conventional',
    purpose: data.purpose || null,
    agency: data.agency || null,
    tier: data.tier || null,
    state: data.state || null,
    escrow_type: data.escrowType || null,
    product_group: data.productGroup || null,
    term_group: data.termGroup || null,
    feature_name: data.featureName || null,
    fico_min: data.ficoMin ?? null,
    fico_max: data.ficoMax ?? null,
    ltv_min: data.ltvMin ?? null,
    ltv_max: data.ltvMax ?? null,
    loan_amount_min: data.loanAmountMin ?? null,
    loan_amount_max: data.loanAmountMax ?? null,
    term_min: data.termMin ?? null,
    term_max: data.termMax ?? null,
    value: data.value,
    source: SOURCE,
  });
}

// ─── 1. FICO/LTV Grids ─────────────────────────────────────────────

function seedFicoLtvGrids() {
  // Core grids — no agency distinction, but these are >15yr grids
  const purposes = [
    { key: 'purchaseFicoLTV', purpose: 'purchase' },
    { key: 'nonCashoutRefiFicoLTV', purpose: 'refinance' },
    { key: 'cashoutRefiFicoLTV', purpose: 'cashout' },
  ];

  for (const { key, purpose } of purposes) {
    const grid = cfg.core?.convLLPA?.[key];
    if (!grid) { console.warn(`  Missing ${key}`); continue; }

    for (const [ficoBand, ltvEntries] of Object.entries(grid)) {
      const fico = parseFicoBand(ficoBand);
      if (!fico) continue;

      for (const [ltvBand, value] of Object.entries(ltvEntries)) {
        if (typeof value !== 'number') continue;
        const ltv = parseLtvBand(ltvBand);
        if (!ltv) continue;

        addRow({
          adjustmentType: 'ficoLtv',
          purpose,
          tier: 'core',
          termGroup: '>15yr',
          ...fico,
          ...ltv,
          value,
        });
      }
    }
  }
}

// ─── 1b. Elite FICO/LTV Grids (FNMA + FHLMC, by purpose + term) ────

function seedEliteFicoLtvGrids() {
  const agencies = [
    { key: 'fnmaLLPA', agency: 'fnma' },
    { key: 'fhlmcLLPA', agency: 'fhlmc' },
  ];

  // Map Elite JSON section names → { purpose, termGroup }
  const sections = [
    { name: 'Purchase LLPAs (Terms > 15 years only)', purpose: 'purchase', termGroup: '>15yr' },
    { name: 'Rate/Term Refinance LLPAs (Terms > 15 years only)', purpose: 'refinance', termGroup: '>15yr' },
    { name: 'Cash Out Refinance LLPAs (all amortizatione terms)', purpose: 'cashout', termGroup: 'allTerms' },  // note: typo in source JSON
  ];

  for (const { key, agency } of agencies) {
    const llpa = cfg.elite?.[key];
    if (!llpa) { console.warn(`  Missing elite.${key}`); continue; }

    for (const { name, purpose, termGroup } of sections) {
      const grid = llpa[name];
      if (!grid) { console.warn(`  Missing elite.${key}["${name}"]`); continue; }

      for (const [ficoBand, ltvEntries] of Object.entries(grid)) {
        const fico = parseFicoBand(ficoBand);
        if (!fico) continue;

        for (const [ltvBand, value] of Object.entries(ltvEntries)) {
          if (typeof value !== 'number') continue;
          const ltv = parseLtvBand(ltvBand);
          if (!ltv) continue;

          addRow({
            adjustmentType: 'ficoLtv',
            purpose,
            agency,
            tier: 'elite',
            termGroup,
            ...fico,
            ...ltv,
            value,
          });
        }
      }
    }
  }
}

// ─── 2. Risk-Based Adjustments ──────────────────────────────────────

function seedRiskBased() {
  const grid = cfg.core?.convLLPA?.riskBasedPriceAdj;
  if (!grid) { console.warn('  Missing riskBasedPriceAdj'); return; }

  for (const [ficoBand, ltvEntries] of Object.entries(grid)) {
    const fico = parseFicoBand(ficoBand);
    if (!fico) continue;

    for (const [ltvBand, value] of Object.entries(ltvEntries)) {
      if (typeof value !== 'number') continue;
      const ltv = parseLtvBand(ltvBand);
      if (!ltv) continue;

      addRow({
        adjustmentType: 'riskBased',
        tier: 'core',
        ...fico,
        ...ltv,
        value,
      });
    }
  }
}

// ─── 3. Loan Amount Adjustments ─────────────────────────────────────

function seedLoanAmount() {
  const adj = cfg.core?.convLLPA?.loanAmountAdj;
  if (!adj) { console.warn('  Missing loanAmountAdj'); return; }

  for (const [range, value] of Object.entries(adj)) {
    if (typeof value !== 'number') continue;
    const parsed = parseLoanAmountRange(range);
    if (!parsed) continue;

    addRow({
      adjustmentType: 'loanAmount',
      tier: 'core',
      ...parsed,
      value,
    });
  }
}

// ─── 4. SRP ─────────────────────────────────────────────────────────

/** Parse Elite SRP loan amount band → { loanAmountMin, loanAmountMax }
 *  Handles: "<=50,000", "50,001-85,000", ">700,000" */
function parseEliteSrpAmountBand(band) {
  const clean = band.replace(/,/g, '');

  const leMatch = clean.match(/^<=\s*(\d+)$/);
  if (leMatch) return { loanAmountMin: 0, loanAmountMax: parseInt(leMatch[1]) };

  const rangeMatch = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) return { loanAmountMin: parseInt(rangeMatch[1]), loanAmountMax: parseInt(rangeMatch[2]) };

  const gtMatch = clean.match(/^>\s*(\d+)$/);
  if (gtMatch) return { loanAmountMin: parseInt(gtMatch[1]) + 1, loanAmountMax: 99999999 };

  console.warn(`  ⚠ Could not parse Elite SRP amount band: "${band}"`);
  return null;
}

function seedSRP() {
  // ── Core SRP: state → productGroup → flat value
  const coreSections = [
    { escrowType: 'withImpounds', data: cfg.core?.convSRP?.withImpounds },
    { escrowType: 'withoutImpounds', data: cfg.core?.convSRP?.withoutImpounds },
  ];

  for (const { escrowType, data } of coreSections) {
    if (!data) { console.warn(`  Missing Core SRP ${escrowType}`); continue; }

    for (const [state, products] of Object.entries(data)) {
      if (typeof products !== 'object') continue;
      for (const [productGroup, value] of Object.entries(products)) {
        if (typeof value !== 'number') continue;

        addRow({
          adjustmentType: 'srp',
          tier: 'core',
          state,
          escrowType,
          productGroup,
          value,
        });
      }
    }
  }

  // ── Elite SRP: productGroup → state → loanAmountBand → value
  const eliteSections = [
    { escrowType: 'withImpounds', data: cfg.elite?.convSRP_withEscrows },
    { escrowType: 'withoutImpounds', data: cfg.elite?.convSRP_withoutEscrows },
  ];

  for (const { escrowType, data } of eliteSections) {
    if (!data) { console.warn(`  Missing Elite SRP ${escrowType}`); continue; }

    for (const [productGroup, states] of Object.entries(data)) {
      // Skip header rows like "Elite Conventional SRPs With Escrows*"
      if (typeof states !== 'object' || !states) continue;

      for (const [state, amountBands] of Object.entries(states)) {
        if (typeof amountBands !== 'object') continue;

        for (const [band, value] of Object.entries(amountBands)) {
          if (typeof value !== 'number') continue;
          const parsed = parseEliteSrpAmountBand(band);
          if (!parsed) continue;

          addRow({
            adjustmentType: 'srp',
            tier: 'elite',
            state,
            escrowType,
            productGroup,
            ...parsed,
            value,
          });
        }
      }
    }
  }
}

// ─── 5. Investor Adjustments (currently hardcoded in lender-adj-loader) ──

function seedInvestorAdj() {
  const investorAdj = {
    fnma: { '21-30yr': 0.220, '20/15/10yr': 0.140, 'arms': 0.220 },
    fhlmc: { '21-30yr': 0.150, '20/15/10yr': 0, 'arms': 0.150 },
  };

  for (const [agency, termGroups] of Object.entries(investorAdj)) {
    for (const [termGroup, value] of Object.entries(termGroups)) {
      addRow({
        adjustmentType: 'investor',
        agency,
        termGroup,
        value,
      });
    }
  }
}

// ─── 6. FHLMC Special Adjustments (currently hardcoded in pricing-v2) ──

function seedFhlmcSpecial() {
  // FHLMC Purpose Adjustments: -0.150 for both purchase and refi
  // (confirmed via LoanSifter — "Loan Purpose is Purchase/Rate/Term Refi" = -0.150)
  addRow({
    adjustmentType: 'fhlmcSpecial',
    agency: 'fhlmc',
    tier: 'core',
    purpose: 'refinance',
    featureName: 'refiPurpose',
    value: -0.150,
  });
  addRow({
    adjustmentType: 'fhlmcSpecial',
    agency: 'fhlmc',
    tier: 'core',
    purpose: 'purchase',
    featureName: 'purchasePurpose',
    value: -0.150,
  });

  // FHLMC Occupancy/Term/Loan Amt Credit: +0.050 for 25/30yr primary, 400K-450K
  addRow({
    adjustmentType: 'fhlmcSpecial',
    agency: 'fhlmc',
    tier: 'core',
    featureName: 'occupancyTerm',
    termMin: 25,
    termMax: 30,
    loanAmountMin: 400001,
    loanAmountMax: 450000,
    value: 0.050,
  });
}

// ─── 6b. Elite Purpose Credits ──────────────────────────────────────

function seedPurposeCredits() {
  // EverStream purchase credit: +0.100 for all tiers
  // (confirmed via LoanSifter — applies to both Core and Elite purchase loans)
  addRow({
    adjustmentType: 'productFeature',
    purpose: 'purchase',
    featureName: 'purposeAdj',
    value: 0.100,
  });
}

// ─── 7. FHA FICO/LTV Adjustments ────────────────────────────────────

/** Parse FHA LTV band string → { ltvMin, ltvMax } */
function parseFhaLtvBand(band) {
  // "<= 85%"
  const leMatch = band.match(/<=\s*([\d.]+)%?/);
  if (leMatch && !band.includes('>')) return { ltvMin: 0, ltvMax: parseFloat(leMatch[1]) };

  // "> 85% <= 95%" or "> 85 <= 95%"
  const rangeMatch = band.match(/>\s*([\d.]+)%?\s*<=\s*([\d.]+)%?/);
  if (rangeMatch) return { ltvMin: parseFloat(rangeMatch[1]) + 0.01, ltvMax: parseFloat(rangeMatch[2]) };

  // "> 95%"
  const gtMatch = band.match(/>\s*([\d.]+)%?$/);
  if (gtMatch) return { ltvMin: parseFloat(gtMatch[1]) + 0.01, ltvMax: 100 };

  console.warn(`  ⚠ Could not parse FHA LTV band: "${band}"`);
  return null;
}

function seedFhaFicoLtv() {
  const grid = cfg.core?.fhaLLPA?.ficoPriceAdj;
  if (!grid) { console.warn('  Missing FHA ficoPriceAdj'); return; }

  for (const [ficoBand, ltvEntries] of Object.entries(grid)) {
    const fico = parseFicoBand(ficoBand);
    if (!fico) continue;

    for (const [ltvBand, value] of Object.entries(ltvEntries)) {
      if (typeof value !== 'number') continue;
      const ltv = parseFhaLtvBand(ltvBand);
      if (!ltv) continue;

      addRow({
        adjustmentType: 'ficoLtv',
        loanType: 'fha',
        tier: 'core',
        ...fico,
        ...ltv,
        value,
      });
    }
  }
}

// ─── 8. FHA Loan Amount Adjustments ─────────────────────────────────

function seedFhaLoanAmount() {
  const adj = cfg.core?.fhaLLPA?.loanAmountAdj;
  if (!adj) { console.warn('  Missing FHA loanAmountAdj'); return; }

  for (const [range, value] of Object.entries(adj)) {
    if (typeof value !== 'number') continue;
    const parsed = parseLoanAmountRange(range);
    if (!parsed) continue;

    addRow({
      adjustmentType: 'loanAmount',
      loanType: 'fha',
      tier: 'core',
      ...parsed,
      value,
    });
  }
}

// ─── 9. FHA SRP ─────────────────────────────────────────────────────

function seedFhaSrp() {
  const data = cfg.core?.fhaSRP;
  if (!data) { console.warn('  Missing FHA SRP'); return; }

  for (const [state, products] of Object.entries(data)) {
    if (typeof products !== 'object') continue;
    for (const [productGroup, value] of Object.entries(products)) {
      if (typeof value !== 'number') continue;

      addRow({
        adjustmentType: 'srp',
        loanType: 'fha',
        tier: 'core',
        state,
        escrowType: 'withImpounds', // FHA SRP doesn't split by escrow — use default
        productGroup,
        value,
      });
    }
  }
}

// ─── 10. FHA Additional Adjustments (from otherAdj + Elite product data) ──

function seedFhaAdditionalAdj() {
  // FICO band adjustments (from Elite FHA 30yr ficoAdjusters — applies to Core too)
  const ficoAdj = { '0-619': -1.1, '620-639': -0.4, '640-699': -0.1, '700-max': 0 };
  for (const [band, value] of Object.entries(ficoAdj)) {
    if (value === 0) continue;
    const match = band.match(/(\d+)-(\d+|max)/);
    if (!match) continue;
    addRow({
      adjustmentType: 'productFeature',
      loanType: 'fha',
      featureName: 'ficoAdj',
      ficoMin: parseInt(match[1]),
      ficoMax: match[2] === 'max' ? 999 : parseInt(match[2]),
      value,
    });
  }

  // Loan purpose adjustment (from Elite FHA 30yr loanPurpose)
  const purposeAdj = { purchase: 0.1, rateTermRefi: 0, cashOut: 0 };
  for (const [purpose, value] of Object.entries(purposeAdj)) {
    if (value === 0) continue;
    const purposeMap = { purchase: 'purchase', rateTermRefi: 'refinance', cashOut: 'cashout' };
    addRow({
      adjustmentType: 'productFeature',
      loanType: 'fha',
      featureName: 'purposeAdj',
      purpose: purposeMap[purpose] || purpose,
      value,
    });
  }

  // State adjustment — specific states get +0.1 for FHA
  const fhaStateAdj = cfg.core?.fhaLLPA?.otherAdj?.['AK, CA, CO, DC, FL, ME, NV, UT, WY Additional'];
  if (typeof fhaStateAdj === 'number' && fhaStateAdj !== 0) {
    const states = ['AK', 'CA', 'CO', 'DC', 'FL', 'ME', 'NV', 'UT', 'WY'];
    for (const state of states) {
      addRow({
        adjustmentType: 'productFeature',
        loanType: 'fha',
        featureName: 'stateAdj',
        state,
        value: fhaStateAdj,
      });
    }
  }

  // Property type adjustments (from Elite FHA 30yr)
  const propAdj = { condo: -0.3, manufactured: -0.5 };
  for (const [propType, value] of Object.entries(propAdj)) {
    if (value === 0) continue;
    addRow({
      adjustmentType: 'productFeature',
      loanType: 'fha',
      featureName: 'propertyType',
      productGroup: propType,
      value,
    });
  }

  // Investment / Second Home (from core otherAdj)
  const investAdj = cfg.core?.fhaLLPA?.otherAdj?.['Investment Prop / Second Home'];
  if (typeof investAdj === 'number' && investAdj !== 0) {
    addRow({
      adjustmentType: 'productFeature',
      loanType: 'fha',
      featureName: 'occupancy',
      productGroup: 'investmentSecondHome',
      value: investAdj,
    });
  }
}

// ─── Execute ────────────────────────────────────────────────────────

async function main() {
  console.log('Seed adjustment_rules for EverStream');
  console.log(`Source: ${cfgPath}`);
  console.log(`Dry run: ${dryRun}\n`);

  // Build all rows — Conventional (Core + Elite)
  seedFicoLtvGrids();
  seedEliteFicoLtvGrids();
  seedRiskBased();
  seedLoanAmount();
  seedSRP();
  seedInvestorAdj();
  seedFhlmcSpecial();
  seedPurposeCredits();

  // Build all rows — FHA
  seedFhaFicoLtv();
  seedFhaLoanAmount();
  seedFhaSrp();
  seedFhaAdditionalAdj();

  // Count by loan type and adjustment type
  const counts = {};
  const byLoanType = {};
  for (const r of rows) {
    counts[r.adjustment_type] = (counts[r.adjustment_type] || 0) + 1;
    const lt = r.loan_type || 'conventional';
    byLoanType[lt] = (byLoanType[lt] || 0) + 1;
  }
  console.log('Row counts by adjustment type:');
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log('Row counts by loan type:');
  for (const [lt, count] of Object.entries(byLoanType)) {
    console.log(`  ${lt}: ${count}`);
  }
  console.log(`  TOTAL: ${rows.length}\n`);

  if (dryRun) {
    console.log('Dry run — no rows inserted.');
    return;
  }

  // Get EverStream lender ID
  const [lender] = await sql`SELECT id FROM rate_lenders WHERE code = 'everstream'`;
  if (!lender) {
    console.error('ERROR: No rate_lender with code "everstream" found.');
    process.exit(1);
  }
  const lenderId = lender.id;
  console.log(`EverStream lender ID: ${lenderId}`);

  // Clear existing rules for this lender
  const deleted = await sql`
    DELETE FROM adjustment_rules WHERE lender_id = ${lenderId}
  `;
  console.log(`Cleared existing rules: ${deleted.length || 0} deleted`);

  // Insert in batches of 100
  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    for (const r of batch) {
      await sql`
        INSERT INTO adjustment_rules (
          id, lender_id, adjustment_type, loan_type,
          purpose, agency, tier, state, escrow_type, product_group, term_group, feature_name,
          fico_min, fico_max, ltv_min, ltv_max,
          loan_amount_min, loan_amount_max, term_min, term_max,
          value, effective_date, status, source,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${lenderId}, ${r.adjustment_type}, ${r.loan_type},
          ${r.purpose}, ${r.agency}, ${r.tier}, ${r.state}, ${r.escrow_type}, ${r.product_group}, ${r.term_group}, ${r.feature_name},
          ${r.fico_min}, ${r.fico_max}, ${r.ltv_min}, ${r.ltv_max},
          ${r.loan_amount_min}, ${r.loan_amount_max}, ${r.term_min}, ${r.term_max},
          ${r.value}, ${TODAY}, 'active', ${r.source},
          NOW(), NOW()
        )
      `;
      inserted++;
    }

    process.stdout.write(`  Inserted ${inserted}/${rows.length}\r`);
  }

  console.log(`\nDone! Inserted ${inserted} adjustment rules for EverStream.`);

  // Verify
  const [count] = await sql`SELECT COUNT(*) as cnt FROM adjustment_rules WHERE lender_id = ${lenderId}`;
  console.log(`Verification: ${count.cnt} rows in adjustment_rules for EverStream`);
}

main().catch(err => {
  console.error('SEED ERROR:', err);
  process.exit(1);
});
