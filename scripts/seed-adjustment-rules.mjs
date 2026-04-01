/**
 * Seed adjustment_rules table from lender adjustment staging files.
 *
 * Reads focused JSON files from src/data/lender-adjustments/{lender}/
 * and inserts normalized rows into the adjustment_rules DB table.
 *
 * Run: node scripts/seed-adjustment-rules.mjs [--lender everstream] [--dry-run]
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const dryRun = process.argv.includes('--dry-run');
const lenderArg = process.argv.find((_, i, a) => a[i - 1] === '--lender') || 'everstream';
const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

const BASE_DIR = join(__dirname, '..', 'src', 'data', 'lender-adjustments', lenderArg);
const TODAY = new Date().toISOString().split('T')[0];

// ─── File loader ────────────────────────────────────────────────────

function loadJson(filename) {
  const path = join(BASE_DIR, filename);
  if (!existsSync(path)) { console.warn(`  Skipping ${filename} (not found)`); return null; }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ─── Parse helpers (normalized keys — no Unicode, no %) ─────────────

/** ">=780" → { ficoMin: 780, ficoMax: 999 }, "760-779" → { ficoMin: 760, ficoMax: 779 } */
function parseFico(band) {
  const ge = band.match(/>=\s*(\d+)/);
  if (ge) return { ficoMin: parseInt(ge[1]), ficoMax: 999 };
  const lt = band.match(/<\s*(\d+)/);
  if (lt) return { ficoMin: 0, ficoMax: parseInt(lt[1]) - 1 };
  const range = band.match(/(\d+)-(\d+)/);
  if (range) return { ficoMin: parseInt(range[1]), ficoMax: parseInt(range[2]) };
  console.warn(`  ⚠ FICO: "${band}"`);
  return null;
}

/** "<= 30" → { ltvMin: 0, ltvMax: 30 }, "30.01-60" → { ltvMin: 30.01, ltvMax: 60 } */
function parseLtv(band) {
  const le = band.match(/<=\s*([\d.]+)/);
  if (le && !band.includes('-')) return { ltvMin: 0, ltvMax: parseFloat(le[1]) };
  const range = band.match(/([\d.]+)-([\d.]+)/);
  if (range) return { ltvMin: parseFloat(range[1]), ltvMax: parseFloat(range[2]) };
  console.warn(`  ⚠ LTV: "${band}"`);
  return null;
}

/** "0-50000" → { loanAmountMin: 0, loanAmountMax: 50000 } */
function parseAmount(band) {
  // "300001-400000"
  const range = band.match(/(\d+)-(\d+)/);
  if (range) return { loanAmountMin: parseInt(range[1]), loanAmountMax: parseInt(range[2]) };
  // "<=110000"
  const le = band.match(/<=\s*(\d+)/);
  if (le) return { loanAmountMin: 0, loanAmountMax: parseInt(le[1]) };
  // "700001+" or ">700000"
  const gt = band.match(/(\d+)\+/);
  if (gt) return { loanAmountMin: parseInt(gt[1]), loanAmountMax: 99999999 };
  const gtOnly = band.match(/>\s*(\d+)/);
  if (gtOnly) return { loanAmountMin: parseInt(gtOnly[1]) + 1, loanAmountMax: 99999999 };
  console.warn(`  ⚠ Amount: "${band}"`);
  return null;
}

/** Parse FHA LTV: "<= 85" or "> 85 <= 95" or "> 95" */
function parseFhaLtv(band) {
  const le = band.match(/<=\s*([\d.]+)/);
  if (le && !band.includes('>')) return { ltvMin: 0, ltvMax: parseFloat(le[1]) };
  const gtLe = band.match(/>\s*([\d.]+)\s*<=\s*([\d.]+)/);
  if (gtLe) return { ltvMin: parseFloat(gtLe[1]) + 0.01, ltvMax: parseFloat(gtLe[2]) };
  const gt = band.match(/>\s*([\d.]+)$/);
  if (gt) return { ltvMin: parseFloat(gt[1]) + 0.01, ltvMax: 100 };
  // Normalized format: "85.01-95"
  const range = band.match(/([\d.]+)-([\d.]+)/);
  if (range) return { ltvMin: parseFloat(range[1]), ltvMax: parseFloat(range[2]) };
  console.warn(`  ⚠ FHA LTV: "${band}"`);
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
    source: `${lenderArg}/${data.sourceFile || 'config'}`,
  });
}

/** Seed a FICO×LTV grid into rows */
function seedGrid(grid, opts) {
  for (const [ficoBand, ltvEntries] of Object.entries(grid)) {
    const fico = parseFico(ficoBand);
    if (!fico) continue;
    for (const [ltvBand, value] of Object.entries(ltvEntries)) {
      if (typeof value !== 'number') continue;
      const ltv = (opts.ltvParser || parseLtv)(ltvBand);
      if (!ltv) continue;
      addRow({ ...opts, ...fico, ...ltv, value });
    }
  }
}

// ─── Conventional: Core LLPA ────────────────────────────────────────

function seedCoreConvLlpa() {
  const data = loadJson('core-conv-llpa.json');
  if (!data) return;

  // FICO/LTV grids
  for (const purpose of ['purchase', 'refinance', 'cashout']) {
    const grid = data.ficoLtv?.[purpose];
    if (!grid) continue;
    seedGrid(grid, { adjustmentType: 'ficoLtv', purpose, tier: 'core', termGroup: '>15yr', sourceFile: 'core-conv-llpa.json' });
  }

  // Risk-based
  if (data.riskBased) {
    seedGrid(data.riskBased, { adjustmentType: 'riskBased', tier: 'core', sourceFile: 'core-conv-llpa.json' });
  }

  // Loan amount
  if (data.loanAmount) {
    for (const [band, value] of Object.entries(data.loanAmount)) {
      if (typeof value !== 'number') continue;
      const parsed = parseAmount(band);
      if (!parsed) continue;
      addRow({ adjustmentType: 'loanAmount', tier: 'core', ...parsed, value, sourceFile: 'core-conv-llpa.json' });
    }
  }
}

// ─── Conventional: Core SRP ─────────────────────────────────────────

function seedCoreConvSrp() {
  const data = loadJson('core-conv-srp.json');
  if (!data) return;

  for (const escrowType of ['withImpounds', 'withoutImpounds']) {
    const section = data[escrowType];
    if (!section) continue;
    for (const [state, products] of Object.entries(section)) {
      if (typeof products !== 'object') continue;
      for (const [productGroup, value] of Object.entries(products)) {
        if (typeof value !== 'number') continue;
        addRow({ adjustmentType: 'srp', tier: 'core', state, escrowType, productGroup, value, sourceFile: 'core-conv-srp.json' });
      }
    }
  }
}

// ─── Conventional: Elite LLPA ───────────────────────────────────────

function seedEliteConvLlpa() {
  const data = loadJson('elite-conv-llpa.json');
  if (!data) return;

  for (const agency of ['fnma', 'fhlmc']) {
    const agencyData = data[agency];
    if (!agencyData) continue;

    // Keys like "purchase_>15yr", "refinance_>15yr", "cashout_allTerms"
    for (const [gridKey, grid] of Object.entries(agencyData)) {
      const [purpose, termGroup] = gridKey.split('_');
      seedGrid(grid, { adjustmentType: 'ficoLtv', purpose, agency, tier: 'elite', termGroup, sourceFile: 'elite-conv-llpa.json' });
    }
  }
}

// ─── Conventional: Elite SRP ────────────────────────────────────────

function seedEliteConvSrp() {
  const data = loadJson('elite-conv-srp.json');
  if (!data) return;

  for (const escrowType of ['withImpounds', 'withoutImpounds']) {
    const section = data[escrowType];
    if (!section) continue;

    for (const [productGroup, states] of Object.entries(section)) {
      if (typeof states !== 'object') continue;
      for (const [state, amountBands] of Object.entries(states)) {
        if (typeof amountBands !== 'object') continue;
        for (const [band, value] of Object.entries(amountBands)) {
          if (typeof value !== 'number') continue;
          const parsed = parseAmount(band);
          if (!parsed) continue;
          addRow({ adjustmentType: 'srp', tier: 'elite', state, escrowType, productGroup, ...parsed, value, sourceFile: 'elite-conv-srp.json' });
        }
      }
    }
  }
}

// ─── FHA: LLPA ──────────────────────────────────────────────────────

function seedFhaLlpa() {
  const data = loadJson('core-fha-llpa.json');
  if (!data) return;

  // FICO/LTV
  if (data.ficoLtv) {
    seedGrid(data.ficoLtv, { adjustmentType: 'ficoLtv', loanType: 'fha', tier: 'core', ltvParser: parseFhaLtv, sourceFile: 'core-fha-llpa.json' });
  }

  // Loan amount
  if (data.loanAmount) {
    for (const [band, value] of Object.entries(data.loanAmount)) {
      if (typeof value !== 'number') continue;
      const parsed = parseAmount(band);
      if (!parsed) continue;
      addRow({ adjustmentType: 'loanAmount', loanType: 'fha', tier: 'core', ...parsed, value, sourceFile: 'core-fha-llpa.json' });
    }
  }
}

// ─── FHA: SRP ───────────────────────────────────────────────────────

function seedFhaSrp() {
  const data = loadJson('core-fha-srp.json');
  if (!data?.srp) return;

  for (const [state, products] of Object.entries(data.srp)) {
    if (typeof products !== 'object') continue;
    for (const [productGroup, value] of Object.entries(products)) {
      if (typeof value !== 'number') continue;
      addRow({ adjustmentType: 'srp', loanType: 'fha', tier: 'core', state, escrowType: 'withImpounds', productGroup, value, sourceFile: 'core-fha-srp.json' });
    }
  }
}

// ─── Elite FHA LLPAs ────────────────────────────────────────────────

function seedEliteFhaLlpa() {
  const data = loadJson('elite-fha-llpa.json');
  if (!data) return;

  const SRC = 'elite-fha-llpa.json';

  // 1. FICO/Loan Amount grid — these are credits/costs based on FICO × base loan amount
  for (const row of data.ficoLoanAmountGrid) {
    for (const [bandKey, value] of Object.entries(row.values)) {
      if (value === 0) continue;
      const amt = parseAmount(bandKey);
      if (!amt) continue;
      addRow({
        adjustmentType: 'eliteFhaFicoLoanAmt',
        loanType: 'fha', tier: 'elite',
        ficoMin: row.ficoMin, ficoMax: row.ficoMax,
        ...amt, value, sourceFile: SRC,
      });
    }
  }

  // 2. Purpose/StateTier/FICO/LTV grids — expand state tiers to individual states
  const purposes = [
    { key: 'purchaseGrid', purpose: 'purchase' },
    { key: 'cashoutGrid', purpose: 'cashout' },
    { key: 'refiGrid', purpose: 'refinance' },
  ];

  // Build reverse map: state → tier
  const stateTiers = data.stateTiers;

  for (const { key, purpose } of purposes) {
    const grid = data[key];
    if (!grid) continue;

    for (const [tierStr, ficoRows] of Object.entries(grid)) {
      const tier = Number(tierStr);
      // Find all states in this tier
      const statesInTier = Object.entries(stateTiers)
        .filter(([_, t]) => t === tier)
        .map(([st]) => st);

      for (const ficoRow of ficoRows) {
        for (const [ltvKey, value] of Object.entries(ficoRow.values)) {
          if (value === 0) continue;
          // Parse LTV band
          let ltvMin, ltvMax;
          if (ltvKey === '<=80') { ltvMin = 0; ltvMax = 80; }
          else if (ltvKey === '80.01-85') { ltvMin = 80.01; ltvMax = 85; }
          else if (ltvKey === '85.01-90') { ltvMin = 85.01; ltvMax = 90; }
          else if (ltvKey === '90.01-95') { ltvMin = 90.01; ltvMax = 95; }
          else if (ltvKey === '>95') { ltvMin = 95.01; ltvMax = 100; }
          else continue;

          // Seed one row per state in this tier
          for (const state of statesInTier) {
            addRow({
              adjustmentType: 'eliteFhaPurposeLtv',
              loanType: 'fha', tier: 'elite',
              purpose, state,
              ficoMin: ficoRow.ficoMin, ficoMax: ficoRow.ficoMax,
              ltvMin, ltvMax, value,
              sourceFile: SRC,
            });
          }
        }
      }
    }
  }
}

// ─── Elite FHA SRP (from Elite Govt SRP sheet) ─────────────────────

function seedEliteFhaSrp() {
  // Elite FHA SRP is in the same JSON structure as elite-conv-srp but from Govt SRP sheet
  // It's amount-banded per state, same as Elite Conv SRP
  const data = loadJson('elite-fha-srp.json');
  if (!data) return;

  const SRC = 'elite-fha-srp.json';
  for (const [productGroup, states] of Object.entries(data)) {
    if (productGroup.startsWith('_')) continue; // skip meta
    if (typeof states !== 'object') continue;

    for (const [state, bands] of Object.entries(states)) {
      if (typeof bands !== 'object') continue;

      for (const [bandKey, value] of Object.entries(bands)) {
        if (typeof value !== 'number' || value === 0) continue;
        const amt = parseAmount(bandKey);
        if (!amt) continue;

        addRow({
          adjustmentType: 'srp',
          loanType: 'fha', tier: 'elite',
          state, escrowType: 'withImpounds',
          productGroup,
          ...amt, value, sourceFile: SRC,
        });
      }
    }
  }
}

// ─── Elite VA LLPAs ─────────────────────────────────────────────────

function seedEliteVaLlpa() {
  const data = loadJson('elite-va-llpa.json');
  if (!data) return;

  const SRC = 'elite-va-llpa.json';

  // 1. FICO/Loan Amount grid
  for (const row of data.ficoLoanAmountGrid) {
    for (const [bandKey, value] of Object.entries(row.values)) {
      if (value === 0) continue;
      const amt = parseAmount(bandKey);
      if (!amt) continue;
      addRow({
        adjustmentType: 'eliteFhaFicoLoanAmt', // reuse same type — works for VA too
        loanType: 'va', tier: 'elite',
        ficoMin: row.ficoMin, ficoMax: row.ficoMax,
        ...amt, value, sourceFile: SRC,
      });
    }
  }

  // 2. Purpose/StateTier/FICO/LTV grids
  const purposes = [
    { key: 'purchaseGrid', purpose: 'purchase' },
    { key: 'refiGrid', purpose: 'refinance' },
    { key: 'irrlGrid', purpose: 'irrrl' },
  ];

  const stateTiers = data.stateTiers;

  for (const { key, purpose } of purposes) {
    const grid = data[key];
    if (!grid) continue;

    for (const [tierStr, ficoRows] of Object.entries(grid)) {
      const tier = Number(tierStr);
      const statesInTier = Object.entries(stateTiers)
        .filter(([_, t]) => t === tier)
        .map(([st]) => st);

      for (const ficoRow of ficoRows) {
        for (const [ltvKey, value] of Object.entries(ficoRow.values)) {
          if (value === 0) continue;
          let ltvMin, ltvMax;
          if (ltvKey === '<=80') { ltvMin = 0; ltvMax = 80; }
          else if (ltvKey === '80.01-85') { ltvMin = 80.01; ltvMax = 85; }
          else if (ltvKey === '85.01-90') { ltvMin = 85.01; ltvMax = 90; }
          else if (ltvKey === '90.01-95') { ltvMin = 90.01; ltvMax = 95; }
          else if (ltvKey === '>95') { ltvMin = 95.01; ltvMax = 100; }
          else continue;

          for (const state of statesInTier) {
            addRow({
              adjustmentType: 'eliteFhaPurposeLtv', // reuse same type
              loanType: 'va', tier: 'elite',
              purpose, state,
              ficoMin: ficoRow.ficoMin, ficoMax: ficoRow.ficoMax,
              ltvMin, ltvMax, value,
              sourceFile: SRC,
            });
          }
        }
      }
    }
  }
}

// ─── Elite VA SRP ───────────────────────────────────────────────────

function seedEliteVaSrp() {
  const data = loadJson('elite-va-srp.json');
  if (!data) return;

  const SRC = 'elite-va-srp.json';
  for (const [productGroup, states] of Object.entries(data)) {
    if (productGroup.startsWith('_')) continue;
    if (typeof states !== 'object') continue;

    for (const [state, bands] of Object.entries(states)) {
      if (typeof bands !== 'object') continue;
      for (const [bandKey, value] of Object.entries(bands)) {
        if (typeof value !== 'number' || value === 0) continue;
        const amt = parseAmount(bandKey);
        if (!amt) continue;
        addRow({
          adjustmentType: 'srp',
          loanType: 'va', tier: 'elite',
          state, escrowType: 'withImpounds',
          productGroup, ...amt, value, sourceFile: SRC,
        });
      }
    }
  }
}

// ─── Core VA LLPAs (feature-based) ─────────────────────────────────

function seedCoreVaLlpa() {
  const data = loadJson('core-va-llpa.json');
  if (!data?.features) return;

  const SRC = 'core-va-llpa.json';

  // Core VA features are scenario-specific (second home, manual UW, high balance, etc.)
  // Only seed features that apply to standard scenarios we can filter on:
  // - VA Refinance: applies when purpose = refinance
  // - VA Cashout Refinance: applies when purpose = cashout
  // Skip: Second Home/Investment, Manual UW, High Balance ≥$1M, IRRRL, Buydowns, LTV>100
  // These require scenario inputs we don't have yet (occupancy, UW type, etc.)
  const allowedFeatures = ['VA Refinance **', 'VA Cashout Refinance', 'VA Streamline/IRRRL'];

  for (const feature of data.features) {
    if (!allowedFeatures.includes(feature.label)) continue;

    const purpose = feature.label.includes('Cashout') ? 'cashout'
      : feature.label.includes('Refinance') ? 'refinance'
      : feature.label.includes('IRRRL') ? 'irrrl'
      : null;

    for (const [ficoBand, value] of Object.entries(feature.values)) {
      if (value === 0) continue;
      const fico = parseFico(ficoBand);
      if (!fico) continue;
      addRow({
        adjustmentType: 'productFeature',
        loanType: 'va', tier: 'core',
        featureName: feature.label,
        purpose,
        ...fico, value, sourceFile: SRC,
      });
    }
  }
}

// ─── Lender Config (investor adj, FHLMC specials, purpose credits, FHA additional) ──

function seedLenderConfig() {
  const cfg = loadJson('lender-config.json');
  if (!cfg) return;

  // Investor adjustments
  if (cfg.investorAdj) {
    for (const [agency, termGroups] of Object.entries(cfg.investorAdj)) {
      for (const [termGroup, value] of Object.entries(termGroups)) {
        addRow({ adjustmentType: 'investor', agency, termGroup, value, sourceFile: 'lender-config.json' });
      }
    }
  }

  // FHLMC special adjustments
  if (cfg.fhlmcSpecial) {
    for (const rule of cfg.fhlmcSpecial) {
      addRow({ adjustmentType: 'fhlmcSpecial', ...rule, sourceFile: 'lender-config.json' });
    }
  }

  // Purpose credits
  if (cfg.purposeCredits) {
    for (const credit of cfg.purposeCredits) {
      addRow({ adjustmentType: 'productFeature', ...credit, sourceFile: 'lender-config.json' });
    }
  }

  // Cashout credits (Core conv only — cashout LTV additional)
  if (cfg.cashoutCredits) {
    for (const credit of cfg.cashoutCredits) {
      addRow({ ...credit, sourceFile: 'lender-config.json' });
    }
  }

  // FHA additional adjustments
  if (cfg.fhaAdditional) {
    const fha = cfg.fhaAdditional;

    // FICO band adjustments
    if (fha.ficoAdj) {
      for (const [band, value] of Object.entries(fha.ficoAdj)) {
        if (value === 0) continue;
        const match = band.match(/(\d+)-(\d+|max)/);
        if (!match) continue;
        addRow({ adjustmentType: 'productFeature', loanType: 'fha', featureName: 'ficoAdj',
          ficoMin: parseInt(match[1]), ficoMax: match[2] === 'max' ? 999 : parseInt(match[2]), value, sourceFile: 'lender-config.json' });
      }
    }

    // Purpose adjustments
    if (fha.purposeAdj) {
      const purposeMap = { purchase: 'purchase', rateTermRefi: 'refinance', cashOut: 'cashout' };
      for (const [purpose, value] of Object.entries(fha.purposeAdj)) {
        if (value === 0) continue;
        addRow({ adjustmentType: 'productFeature', loanType: 'fha', featureName: 'purposeAdj',
          purpose: purposeMap[purpose] || purpose, value, sourceFile: 'lender-config.json' });
      }
    }

    // State adjustments
    if (fha.stateAdj?.states && fha.stateAdj.value !== 0) {
      for (const state of fha.stateAdj.states) {
        addRow({ adjustmentType: 'productFeature', loanType: 'fha', featureName: 'stateAdj',
          state, value: fha.stateAdj.value, sourceFile: 'lender-config.json' });
      }
    }

    // Property type
    if (fha.propertyType) {
      for (const [propType, value] of Object.entries(fha.propertyType)) {
        if (value === 0) continue;
        addRow({ adjustmentType: 'productFeature', loanType: 'fha', featureName: 'propertyType',
          productGroup: propType, value, sourceFile: 'lender-config.json' });
      }
    }

    // Occupancy (investment/second home)
    if (fha.occupancy) {
      for (const [occType, value] of Object.entries(fha.occupancy)) {
        if (value === 0) continue;
        addRow({ adjustmentType: 'productFeature', loanType: 'fha', featureName: 'occupancy',
          productGroup: occType, value, sourceFile: 'lender-config.json' });
      }
    }
  }
}

// ─── Product Loan Amount LLPAs (master per-product adjusters) ───────

function seedProductLoanAmountLlpas() {
  const data = loadJson('product-loan-amount-llpas.json');
  if (!data) return;

  const SRC = 'product-loan-amount-llpas.json';

  /** Map term string from sheet to { termMin, termMax } */
  function parseTerm(t) {
    if (t === '10Yr') return { termMin: 10, termMax: 10 };
    if (t === '15Yr' || t === '10/15Yr' || t === '10/15Yr Streamline') return { termMin: 10, termMax: 15 };
    if (t === '20Yr') return { termMin: 20, termMax: 20 };
    if (t === '25/30Yr') return { termMin: 25, termMax: 30 };
    if (t === '30Yr') return { termMin: 30, termMax: 30 };
    // ARMs — use 30yr term range
    if (t.includes('ARM')) return { termMin: 30, termMax: 30 };
    return null;
  }

  for (const p of data.products) {
    // Skip occupancy, state, and non-owner rows for now — handle separately later
    if (p.isOccupancy || p.isState || p.isNonOwner) continue;
    // Skip non-conventional for now (DSCR, Jumbo, NonQM, VA, FHA have their own seeding)
    if (!['conventional', 'fha', 'va'].includes(p.loanType)) continue;

    const term = parseTerm(p.term);
    if (!term) continue;

    // Loan amount adjustments — per product/tier/agency/term/amount band
    for (const [bandKey, value] of Object.entries(p.loanAmountAdj)) {
      if (value === 0) continue; // Skip zero adjustments
      const amt = parseAmount(bandKey);
      if (!amt) continue;

      addRow({
        adjustmentType: 'productLoanAmount',
        tier: p.tier,
        agency: p.agency,
        loanType: p.loanType,
        productGroup: p.productType, // 'fixed' or 'arm'
        ...amt,
        ...term,
        value,
        sourceFile: SRC,
      });
    }
  }
}

// ─── Execute ────────────────────────────────────────────────────────

async function main() {
  console.log(`Seed adjustment_rules for: ${lenderArg}`);
  console.log(`Source: ${BASE_DIR}`);
  console.log(`Dry run: ${dryRun}\n`);

  // Build all rows
  seedCoreConvLlpa();
  seedCoreConvSrp();
  seedEliteConvLlpa();
  seedEliteConvSrp();
  seedFhaLlpa();
  seedFhaSrp();
  seedEliteFhaLlpa();
  seedEliteFhaSrp();
  seedEliteVaLlpa();
  seedEliteVaSrp();
  seedCoreVaLlpa();
  seedLenderConfig();
  seedProductLoanAmountLlpas();

  // Count by type
  const counts = {};
  const byLoanType = {};
  for (const r of rows) {
    counts[r.adjustment_type] = (counts[r.adjustment_type] || 0) + 1;
    const lt = r.loan_type || 'conventional';
    byLoanType[lt] = (byLoanType[lt] || 0) + 1;
  }
  console.log('Row counts by adjustment type:');
  for (const [type, count] of Object.entries(counts)) console.log(`  ${type}: ${count}`);
  console.log('Row counts by loan type:');
  for (const [lt, count] of Object.entries(byLoanType)) console.log(`  ${lt}: ${count}`);
  console.log(`  TOTAL: ${rows.length}\n`);

  // Deduplicate rows — some seed functions can produce identical rows
  const seen = new Set();
  const uniqueRows = [];
  for (const r of rows) {
    const key = [r.adjustment_type, r.loan_type, r.purpose, r.agency, r.tier, r.state,
      r.escrow_type, r.product_group, r.term_group, r.feature_name,
      r.fico_min, r.fico_max, r.ltv_min, r.ltv_max,
      r.loan_amount_min, r.loan_amount_max, r.term_min, r.term_max, r.value].join('|');
    if (!seen.has(key)) { seen.add(key); uniqueRows.push(r); }
  }
  if (uniqueRows.length < rows.length) {
    console.log(`Deduped: ${rows.length} → ${uniqueRows.length} (removed ${rows.length - uniqueRows.length} duplicates)\n`);
    rows.length = 0;
    rows.push(...uniqueRows);
  }

  if (dryRun) { console.log('Dry run — no rows inserted.'); return; }

  // Get lender ID
  const [lender] = await sql`SELECT id FROM rate_lenders WHERE code = ${lenderArg}`;
  if (!lender) { console.error(`ERROR: No rate_lender with code "${lenderArg}".`); process.exit(1); }
  const lenderId = lender.id;
  console.log(`Lender ID: ${lenderId}`);

  // Clear existing
  await sql`DELETE FROM adjustment_rules WHERE lender_id = ${lenderId}`;
  console.log('Cleared existing rules');

  // Insert
  let inserted = 0;
  for (const r of rows) {
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
    if (inserted % 100 === 0) process.stdout.write(`  Inserted ${inserted}/${rows.length}\r`);
  }

  console.log(`\nDone! Inserted ${inserted} adjustment rules for ${lenderArg}.`);
  const [count] = await sql`SELECT COUNT(*) as cnt FROM adjustment_rules WHERE lender_id = ${lenderId}`;
  console.log(`Verification: ${count.cnt} rows in adjustment_rules`);
}

main().catch(err => { console.error('SEED ERROR:', err); process.exit(1); });
