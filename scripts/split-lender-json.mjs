/**
 * Split everstream-complete.json into focused, normalized staging files.
 *
 * Run once: node scripts/split-lender-json.mjs
 *
 * Produces:
 *   src/data/lender-adjustments/everstream/
 *     core-conv-llpa.json
 *     core-conv-srp.json
 *     core-fha-llpa.json
 *     core-fha-srp.json
 *     elite-conv-llpa.json
 *     elite-conv-srp.json
 *     lender-config.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, '..', 'src', 'data', 'lender-llpas', 'everstream-complete.json');
const outDir = join(__dirname, '..', 'src', 'data', 'lender-adjustments', 'everstream');

const cfg = JSON.parse(readFileSync(srcPath, 'utf-8'));
const TODAY = new Date().toISOString().split('T')[0];

// ─── Key normalizers ────────────────────────────────────────────────

/** Normalize FICO band: "≥800" → ">=800", "780-799" stays */
function normFico(band) {
  return band.replace(/≥/g, '>=').replace(/\s+/g, '');
}

/** Normalize LTV band: "≤30" → "<= 30", "30.01-60" stays, "30.01 - 60.00%" → "30.01-60" */
function normLtv(band) {
  // Unicode ≤
  let s = band.replace(/≤\s*/g, '<= ');
  // Remove % and trailing .00
  s = s.replace(/%/g, '');
  // Collapse spaces around dash: "30.01 - 60.00" → "30.01-60"
  s = s.replace(/\s*[-–]\s*/g, '-');
  // Remove trailing .00 on whole numbers: "60.00" → "60", but keep "30.01"
  s = s.replace(/\.00(?=$|-)/g, '');
  return s.trim();
}

/** Normalize loan amount band: "<=50,000" → "0-50000", "50,001-85,000" → "50001-85000", ">700,000" → "700001-99999999" */
function normAmount(band) {
  const clean = band.replace(/,/g, '').trim();

  const leMatch = clean.match(/^<=\s*(\d+)$/);
  if (leMatch) return `0-${leMatch[1]}`;

  const rangeMatch = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`;

  const gtMatch = clean.match(/^>\s*(\d+)$/);
  if (gtMatch) return `${parseInt(gtMatch[1]) + 1}-99999999`;

  // Core loan amount format: ">300000<=400000" → "300001-400000"
  const gtLeMatch = clean.match(/^>(\d+)<=(\d+)$/);
  if (gtLeMatch) return `${parseInt(gtLeMatch[1]) + 1}-${gtLeMatch[2]}`;

  // "<= 50000" (with space)
  const leMatch2 = clean.match(/^<=\s*(\d+)$/);
  if (leMatch2) return `0-${leMatch2[1]}`;

  return band; // fallback
}

/** Normalize a FICO→LTV grid object */
function normGrid(grid) {
  if (!grid || typeof grid !== 'object') return {};
  const out = {};
  for (const [ficoBand, ltvEntries] of Object.entries(grid)) {
    const nf = normFico(ficoBand);
    out[nf] = {};
    for (const [ltvBand, value] of Object.entries(ltvEntries)) {
      if (typeof value !== 'number') continue;
      out[nf][normLtv(ltvBand)] = value;
    }
  }
  return out;
}

/** Normalize a loan amount range object */
function normAmountObj(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [range, value] of Object.entries(obj)) {
    if (typeof value !== 'number') continue;
    out[normAmount(range)] = value;
  }
  return out;
}

// ─── 1. Core Conventional LLPA ──────────────────────────────────────

function buildCoreConvLlpa() {
  return {
    _meta: { lender: 'everstream', tier: 'core', loanType: 'conventional', type: 'llpa', updated: TODAY },
    ficoLtv: {
      purchase: normGrid(cfg.core?.convLLPA?.purchaseFicoLTV),
      refinance: normGrid(cfg.core?.convLLPA?.nonCashoutRefiFicoLTV),
      cashout: normGrid(cfg.core?.convLLPA?.cashoutRefiFicoLTV),
    },
    riskBased: normGrid(cfg.core?.convLLPA?.riskBasedPriceAdj),
    loanAmount: normAmountObj(cfg.core?.convLLPA?.loanAmountAdj),
  };
}

// ─── 2. Core Conventional SRP ───────────────────────────────────────

function buildCoreConvSrp() {
  return {
    _meta: { lender: 'everstream', tier: 'core', loanType: 'conventional', type: 'srp', updated: TODAY },
    withImpounds: cfg.core?.convSRP?.withImpounds || {},
    withoutImpounds: cfg.core?.convSRP?.withoutImpounds || {},
  };
}

// ─── 3. Core FHA LLPA ───────────────────────────────────────────────

function buildCoreFhaLlpa() {
  const fha = cfg.core?.fhaLLPA || {};
  return {
    _meta: { lender: 'everstream', tier: 'core', loanType: 'fha', type: 'llpa', updated: TODAY },
    ficoLtv: normGrid(fha.ficoPriceAdj),
    loanAmount: normAmountObj(fha.loanAmountAdj),
    otherAdj: fha.otherAdj || {},
  };
}

// ─── 4. Core FHA SRP ────────────────────────────────────────────────

function buildCoreFhaSrp() {
  return {
    _meta: { lender: 'everstream', tier: 'core', loanType: 'fha', type: 'srp', updated: TODAY },
    srp: cfg.core?.fhaSRP || {},
  };
}

// ─── 5. Elite Conventional LLPA ─────────────────────────────────────

function buildEliteConvLlpa() {
  const sections = [
    { name: 'Purchase LLPAs (Terms > 15 years only)', purpose: 'purchase', termGroup: '>15yr' },
    { name: 'Rate/Term Refinance LLPAs (Terms > 15 years only)', purpose: 'refinance', termGroup: '>15yr' },
    { name: 'Cash Out Refinance LLPAs (all amortizatione terms)', purpose: 'cashout', termGroup: 'allTerms' },
  ];

  const result = {
    _meta: { lender: 'everstream', tier: 'elite', loanType: 'conventional', type: 'llpa', updated: TODAY },
    fnma: {},
    fhlmc: {},
  };

  for (const agency of ['fnma', 'fhlmc']) {
    const key = agency === 'fnma' ? 'fnmaLLPA' : 'fhlmcLLPA';
    const llpa = cfg.elite?.[key];
    if (!llpa) continue;

    for (const { name, purpose, termGroup } of sections) {
      const grid = llpa[name];
      if (!grid) continue;
      const gridKey = `${purpose}_${termGroup}`;
      result[agency][gridKey] = normGrid(grid);
    }
  }

  return result;
}

// ─── 6. Elite Conventional SRP ──────────────────────────────────────

function normEliteSrpState(amountBands) {
  if (!amountBands || typeof amountBands !== 'object') return {};
  const out = {};
  for (const [band, value] of Object.entries(amountBands)) {
    if (typeof value !== 'number') continue;
    out[normAmount(band)] = value;
  }
  return out;
}

function buildEliteConvSrp() {
  const result = {
    _meta: { lender: 'everstream', tier: 'elite', loanType: 'conventional', type: 'srp', updated: TODAY },
    withImpounds: {},
    withoutImpounds: {},
  };

  const sections = [
    { escrow: 'withImpounds', data: cfg.elite?.convSRP_withEscrows },
    { escrow: 'withoutImpounds', data: cfg.elite?.convSRP_withoutEscrows },
  ];

  for (const { escrow, data } of sections) {
    if (!data) continue;
    for (const [productGroup, states] of Object.entries(data)) {
      if (typeof states !== 'object' || !states) continue;
      // Skip header rows
      let hasStateData = false;
      for (const [state, val] of Object.entries(states)) {
        if (typeof val === 'object' && state.length === 2) { hasStateData = true; break; }
      }
      if (!hasStateData) continue;

      for (const [state, amountBands] of Object.entries(states)) {
        if (typeof amountBands !== 'object') continue;
        if (!result[escrow][productGroup]) result[escrow][productGroup] = {};
        result[escrow][productGroup][state] = normEliteSrpState(amountBands);
      }
    }
  }

  return result;
}

// ─── 7. Lender Config ───────────────────────────────────────────────

function buildLenderConfig() {
  return {
    _meta: { lender: 'everstream', type: 'config', updated: TODAY },
    investorAdj: {
      fnma: { '21-30yr': 0.220, '20/15/10yr': 0.140, arms: 0.220 },
      fhlmc: { '21-30yr': 0.150, '20/15/10yr': 0, arms: 0.150 },
    },
    fhlmcSpecial: [
      { featureName: 'refiPurpose', agency: 'fhlmc', tier: 'core', purpose: 'refinance', value: -0.150 },
      { featureName: 'purchasePurpose', agency: 'fhlmc', tier: 'core', purpose: 'purchase', value: -0.150 },
      { featureName: 'occupancyTerm', agency: 'fhlmc', tier: 'core', termMin: 25, termMax: 30, loanAmountMin: 400001, loanAmountMax: 450000, value: 0.050 },
    ],
    purposeCredits: [
      { purpose: 'purchase', featureName: 'purposeAdj', value: 0.100 },
    ],
    fhaAdditional: {
      ficoAdj: { '0-619': -1.1, '620-639': -0.4, '640-699': -0.1 },
      purposeAdj: { purchase: 0.1 },
      stateAdj: { states: ['AK', 'CA', 'CO', 'DC', 'FL', 'ME', 'NV', 'UT', 'WY'], value: 0.1 },
      propertyType: { condo: -0.3, manufactured: -0.5 },
    },
  };
}

// ─── Write files ────────────────────────────────────────────────────

function writeJson(filename, data) {
  const path = join(outDir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  const size = JSON.stringify(data).length;
  console.log(`  ${filename} (${(size / 1024).toFixed(1)} KB)`);
}

console.log('Splitting everstream-complete.json into focused files...\n');

writeJson('core-conv-llpa.json', buildCoreConvLlpa());
writeJson('core-conv-srp.json', buildCoreConvSrp());
writeJson('core-fha-llpa.json', buildCoreFhaLlpa());
writeJson('core-fha-srp.json', buildCoreFhaSrp());
writeJson('elite-conv-llpa.json', buildEliteConvLlpa());
writeJson('elite-conv-srp.json', buildEliteConvSrp());
writeJson('lender-config.json', buildLenderConfig());

console.log(`\nDone! Files written to: ${outDir}`);
