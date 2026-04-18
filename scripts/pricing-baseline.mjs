#!/usr/bin/env node
/**
 * Pricing Baseline Script — safety net for D9b pricing unification.
 *
 * End-to-end HTTP harness. Captures current output from BOTH pricing
 * engines for the 4 standard homepage scenarios so subsequent refactors
 * can be verified against pre-refactor behavior.
 *
 * Targets the live site by default (https://www.netratemortgage.com).
 * Override with BASE_URL env var for staging/preview builds.
 *
 * Usage:
 *   node scripts/pricing-baseline.mjs --record
 *     Run both engines, save outputs to scripts/pricing-baselines/*.json.
 *     Run this ONCE, on a clean main, before any pricing refactor.
 *
 *   node scripts/pricing-baseline.mjs --check
 *     Re-run both engines, diff against the saved baselines.
 *     Exit 0 if identical, 1 if drift detected.
 *
 *   node scripts/pricing-baseline.mjs --compare
 *     Run both engines and print where homepage diverges from
 *     priceScenario TODAY. Critical artifact for planning D9b.3.
 *
 * Scenarios covered: Conv 30yr, Conv 15yr, FHA 30yr, VA 30yr — all at
 * the DEFAULT_SCENARIO values ($400K / 75LTV / 780 FICO / CO / purchase).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASELINES_DIR = path.join(__dirname, 'pricing-baselines');
const BASE_URL = process.env.BASE_URL || 'https://www.netratemortgage.com';

// ── Canonical scenarios matching DEFAULT_SCENARIO from src/lib/rates/defaults.js ──
const SCENARIO_BASE = {
  fico: 780,
  loanAmount: 400000,
  ltv: 75,
  propertyValue: 533334,
  loanPurpose: 'purchase',
  propertyType: 'sfr',
  state: 'CO',
  lockDays: 30,
  borrowerPaid: true,
  includeBuydowns: false,
  includeIO: false,
};

const SCENARIOS = [
  { key: 'conv30', loanType: 'conventional', term: 30, productType: 'fixed' },
  { key: 'conv15', loanType: 'conventional', term: 15, productType: 'fixed' },
  { key: 'fha30', loanType: 'fha', term: 30, productType: 'fixed' },
  { key: 'va30', loanType: 'va', term: 30, productType: 'fixed' },
];

// ── Helpers ────────────────────────────────────────────────────
function round(n, places) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const factor = 10 ** places;
  return Math.round(Number(n) * factor) / factor;
}

// Apply the canonical par-rate rule: lowest rate with finalPrice >= 100
// across the full ladder. Matches pickParRate() + LoanSifter default + MND.
function pickParFromLadder(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const par = results
    .filter((r) => r.finalPrice != null && r.finalPrice >= 100)
    .sort((a, b) => a.rate - b.rate)[0];
  return par || null;
}

function normalizeCanonical(result, key) {
  if (!result?.results) return { error: 'no results', scenarioKey: key };
  const par = pickParFromLadder(result.results);
  return {
    scenarioKey: key,
    effectiveDate: result.effectiveDate,
    resultCount: result.resultCount,
    // par rate — apples-to-apples with homepage's pickParRate()
    par: par
      ? {
          lender: par.lender,
          product: par.product || par.programName,
          rate: round(par.rate, 3),
          finalPrice: round(par.finalPrice, 4),
          monthlyPI: round(par.monthlyPI, 2),
        }
      : null,
    // raw top-5 by rate — captures ladder shape for drift detection
    top5: (result.results || []).slice(0, 5).map((r) => ({
      lender: r.lender,
      product: r.product || r.programName,
      rate: round(r.rate, 3),
      finalPrice: round(r.finalPrice, 4),
      monthlyPI: round(r.monthlyPI, 2),
    })),
  };
}

// ── Pull canonical output from /api/pricing ────────────────────
async function fetchCanonical(scenario) {
  const body = { ...SCENARIO_BASE, ...scenario };
  const res = await fetch(`${BASE_URL}/api/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: `${res.status} ${res.statusText}`, scenarioKey: scenario.key };
  const json = await res.json();
  return normalizeCanonical(json, scenario.key);
}

// ── Scrape homepage rates from rendered HTML ───────────────────
// The homepage embeds 4 product rates + payments in JSX rendered server-side.
// We extract them from the HTML. This is brittle by design — if the homepage
// markup changes, the test fails, alerting that we may have also changed what
// we show. That's the whole point of a snapshot.
async function fetchHomepage() {
  const res = await fetch(`${BASE_URL}/`);
  if (!res.ok) return { error: `${res.status} ${res.statusText}` };
  const html = await res.text();

  // Try to parse rates from the page. The homepage uses live server-side
  // rates; their exact positions depend on the current markup. Capture raw
  // rate/payment tokens as a simple fingerprint rather than parsing specific
  // product slots — if any of them change, the fingerprint changes.
  const rateTokens = [...html.matchAll(/(\d\.\d{3})%/g)].map((m) => m[1]);
  const dollarTokens = [...html.matchAll(/\$([0-9]{1,3}(?:,[0-9]{3})*)/g)]
    .map((m) => m[1])
    .filter((v) => {
      const n = parseInt(v.replace(/,/g, ''), 10);
      return n > 100 && n < 10000; // typical monthly PI range
    });

  // byteLength intentionally omitted — ISR render noise (timestamps, cache-
  // buster tokens) changes it without any rate-level change. Fingerprint
  // should only flip on actual rate/payment changes.
  return {
    distinctRates: [...new Set(rateTokens)].slice(0, 16),
    distinctPayments: [...new Set(dollarTokens)].slice(0, 16),
  };
}

// ── Run both engines ───────────────────────────────────────────
async function runBoth() {
  const canonical = {};
  for (const s of SCENARIOS) {
    canonical[s.key] = await fetchCanonical(s);
  }
  const homepage = await fetchHomepage();
  return { homepage, canonical };
}

// ── Fixture I/O ────────────────────────────────────────────────
const FIXTURE_HOMEPAGE = path.join(BASELINES_DIR, 'homepage.json');
const FIXTURE_CANONICAL = path.join(BASELINES_DIR, 'canonical.json');

function save(file, data) {
  if (!fs.existsSync(BASELINES_DIR)) fs.mkdirSync(BASELINES_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function load(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffMsg(label, a, b) {
  if (deepEqual(a, b)) return null;
  return `  ${label}:\n    baseline: ${JSON.stringify(a)}\n    current:  ${JSON.stringify(b)}`;
}

// ── Modes ──────────────────────────────────────────────────────
const MODE = process.argv[2];

if (MODE === '--record') {
  console.log(`[baseline] recording pricing output from ${BASE_URL}...`);
  const { homepage, canonical } = await runBoth();
  save(FIXTURE_HOMEPAGE, homepage);
  save(FIXTURE_CANONICAL, canonical);
  console.log(`[baseline] wrote ${FIXTURE_HOMEPAGE}`);
  console.log(`[baseline] wrote ${FIXTURE_CANONICAL}`);
  process.exit(0);
} else if (MODE === '--check') {
  console.log(`[baseline] checking ${BASE_URL} against saved baselines...`);
  const baselineHomepage = load(FIXTURE_HOMEPAGE);
  const baselineCanonical = load(FIXTURE_CANONICAL);
  if (!baselineHomepage || !baselineCanonical) {
    console.error('[baseline] no baselines found; run --record first');
    process.exit(2);
  }
  const { homepage, canonical } = await runBoth();
  const drifts = [];
  const hDiff = diffMsg('homepage fingerprint', baselineHomepage, homepage);
  if (hDiff) drifts.push(hDiff);
  for (const key of SCENARIOS.map((s) => s.key)) {
    const d = diffMsg(`canonical.${key}`, baselineCanonical[key], canonical[key]);
    if (d) drifts.push(d);
  }
  if (drifts.length === 0) {
    console.log('[baseline] ✓ no drift');
    process.exit(0);
  }
  console.error(`[baseline] ✗ ${drifts.length} drift(s):\n\n${drifts.join('\n\n')}`);
  console.error('\n[baseline] If intentional (rate sheet, policy change), re-record with --record');
  process.exit(1);
} else if (MODE === '--compare') {
  console.log(`[baseline] comparing homepage vs /api/pricing at ${BASE_URL}\n`);
  const { homepage, canonical } = await runBoth();
  console.log('HOMEPAGE FINGERPRINT:');
  console.log(`  distinct rates seen: ${homepage.distinctRates?.join(', ')}`);
  console.log(`  distinct payments seen: $${homepage.distinctPayments?.join(', $')}\n`);
  for (const { key } of SCENARIOS) {
    const c = canonical[key];
    const par = c?.par;
    const cheapest = c?.top5?.[0];
    console.log(`=== ${key} ===`);
    if (par) {
      console.log(`  /api/pricing PAR      rate=${par.rate}%  price=${par.finalPrice}  PI=$${par.monthlyPI}  lender=${par.lender}`);
    } else {
      console.log(`  /api/pricing PAR      (no rate at/above par found)`);
    }
    if (cheapest) {
      console.log(`  /api/pricing cheapest rate=${cheapest.rate}%  price=${cheapest.finalPrice}  (likely below par)`);
    }
    console.log();
  }
  console.log('Homepage currently rendered rates (from HTML scrape):');
  console.log(`  ${homepage.distinctRates?.join('%, ')}%`);
  console.log('\nInterpretation:');
  console.log('  If a PAR rate above matches a homepage rate → engines agree for that product.');
  console.log('  Confirm homepage is live (not fallback) by checking for today\'s date in');
  console.log('  distinctPayments OR an effective-date string in the HTML. If the homepage');
  console.log('  rate is different from the /api/pricing par even on live data, the two');
  console.log('  engines have drifted — D9b.3 needs to reconcile product filters / comp caps.');
  process.exit(0);
} else {
  console.error('Usage:');
  console.error('  node scripts/pricing-baseline.mjs --record    # save baseline');
  console.error('  node scripts/pricing-baseline.mjs --check     # verify no drift (exit 1 if drift)');
  console.error('  node scripts/pricing-baseline.mjs --compare   # show homepage vs canonical today');
  console.error('\nEnv: BASE_URL (default https://www.netratemortgage.com)');
  process.exit(2);
}
