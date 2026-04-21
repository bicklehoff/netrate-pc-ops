/**
 * Load lender adjustments from the adjustment_rules DB table.
 *
 * Loads adjustment data from the DB (seeded via seed-adjustment-rules.mjs).
 * Returns the EXACT SAME shape that pricing-v2.js expects.
 *
 * Caches results for 5 minutes — adjustment configs change at most daily.
 */

import sql from '@/lib/db';

// ─── Cache ──────────────────────────────────────────────────────────

const cache = new Map(); // lenderCode → { data, expiresAt }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── String key formatters ──────────────────────────────────────────
// These reconstruct the exact string keys pricing-v2.js expects.

function formatFicoBand(ficoMin, ficoMax) {
  // Normalize to match pricing-v2.js `ficoBandKey()` output.
  // Lookup keys merge 780+ into ">=780" (both 780-799 and >=800 buckets
  // fold together) because rate sheet parsers serialize the top tier
  // that way. Distinct from engine.js `getFicoBand()` which is for UI
  // display and keeps 800+ separate from 780-799.
  if (ficoMax >= 999 || ficoMin >= 780) return '>=780';
  if (ficoMin === 0) return `< ${ficoMax + 1}(1)`;
  return `${ficoMin}-${ficoMax}`;
}

function formatFicoBandRiskBased(ficoMin, ficoMax) {
  if (ficoMax >= 999) return `>= ${ficoMin}`;
  if (ficoMin === 0) return `< ${ficoMax + 1}(1)`;
  return `${ficoMin} - ${ficoMax}`;
}

function formatLtvBand(ltvMin, ltvMax) {
  if (Number(ltvMin) === 0) return `<= ${Number(ltvMax).toFixed(2)}%`;
  return `${Number(ltvMin).toFixed(2)} - ${Number(ltvMax).toFixed(2)}%`;
}

function formatLoanAmountRange(min, max) {
  if (min === 0) return `<= ${max}`;
  if (max >= 99999999) return `>${min - 1}`;
  return `>${min - 1}<=${max}`;
}

// ─── Build adjustment object from DB rows ───────────────────────────

function buildAdjObject(allRows) {
  const adj = {
    // FICO/LTV grids keyed: tier → termGroup → purpose → ficoBand → ltvBand → value
    // Core has no agency distinction; Elite is per-agency
    ficoLtvGrids: {
      core: { '>15yr': { purchase: {}, refinance: {}, cashout: {} } },
      elite: {
        fnma: { '>15yr': { purchase: {}, refinance: {}, cashout: {} }, allTerms: { purchase: {}, refinance: {}, cashout: {} } },
        fhlmc: { '>15yr': { purchase: {}, refinance: {}, cashout: {} }, allTerms: { purchase: {}, refinance: {}, cashout: {} } },
      },
    },
    // SRP: Core = tier → escrow → state → productGroup → flat value
    //      Elite = tier → escrow → state → productGroup → [{ min, max, value }]
    srp: {
      core: { withImpounds: {}, withoutImpounds: {} },
      elite: { withImpounds: {}, withoutImpounds: {} },
    },
    riskBased: {},
    loanAmountAdj: {},
    investorAdj: { fnma: {}, fhlmc: {} },
    fhlmcSpecial: [],
    productFeatures: [],
    // Per-product loan amount adjustments from "Product Loan Amount LLPAs" sheet
    // Array of { tier, agency, termMin, termMax, loanAmountMin, loanAmountMax, value }
    productLoanAmount: [],
    // Elite FHA: FICO × Loan Amount grid
    eliteFhaFicoLoanAmt: [],
    // Elite FHA: Purpose × State × FICO × LTV grid
    eliteFhaPurposeLtv: [],
  };

  for (const row of allRows) {
    const val = Number(row.value);

    switch (row.adjustment_type) {
      case 'ficoLtv': {
        const ficoBand = formatFicoBand(row.fico_min, row.fico_max);
        const ltvKey = formatLtvBand(row.ltv_min, row.ltv_max);
        const tier = row.tier || 'core';
        const termGroup = row.term_group || '>15yr';

        if (tier === 'elite') {
          // Elite: agency-specific grids
          const agency = row.agency || 'fnma';
          const grid = adj.ficoLtvGrids.elite[agency]?.[termGroup]?.[row.purpose];
          if (grid) {
            if (!grid[ficoBand]) grid[ficoBand] = {};
            grid[ficoBand][ltvKey] = val;
          }
        } else if (row.purpose) {
          // Core: purpose-specific (conventional)
          const grid = adj.ficoLtvGrids.core[termGroup]?.[row.purpose];
          if (grid) {
            if (!grid[ficoBand]) grid[ficoBand] = {};
            grid[ficoBand][ltvKey] = val;
          }
        } else {
          // No purpose = applies to all (FHA) — put in core
          const tg = adj.ficoLtvGrids.core[termGroup];
          if (tg) {
            for (const p of ['purchase', 'refinance', 'cashout']) {
              if (!tg[p][ficoBand]) tg[p][ficoBand] = {};
              tg[p][ficoBand][ltvKey] = val;
            }
          }
        }
        break;
      }

      case 'riskBased': {
        const ficoBand = formatFicoBandRiskBased(row.fico_min, row.fico_max);
        if (!adj.riskBased[ficoBand]) adj.riskBased[ficoBand] = {};
        adj.riskBased[ficoBand][formatLtvBand(row.ltv_min, row.ltv_max)] = val;
        break;
      }

      case 'loanAmount': {
        const rangeKey = formatLoanAmountRange(row.loan_amount_min, row.loan_amount_max);
        adj.loanAmountAdj[rangeKey] = val;
        break;
      }

      case 'srp': {
        const tier = row.tier || 'core';
        const escrow = row.escrow_type || 'withImpounds';
        const state = row.state;
        const productGroup = row.product_group;
        if (!adj.srp[tier]) adj.srp[tier] = {};
        if (!adj.srp[tier][escrow]) adj.srp[tier][escrow] = {};
        if (!adj.srp[tier][escrow][state]) adj.srp[tier][escrow][state] = {};

        if (tier === 'elite' && row.loan_amount_min != null) {
          // Elite SRP: amount-banded — store as sorted array
          if (!Array.isArray(adj.srp[tier][escrow][state][productGroup])) {
            adj.srp[tier][escrow][state][productGroup] = [];
          }
          adj.srp[tier][escrow][state][productGroup].push({
            min: Number(row.loan_amount_min),
            max: Number(row.loan_amount_max),
            value: val,
          });
        } else {
          // Core SRP: flat value
          adj.srp[tier][escrow][state][productGroup] = val;
        }
        break;
      }

      case 'investor': {
        const agency = row.agency;
        const termGroup = row.term_group;
        if (!adj.investorAdj[agency]) adj.investorAdj[agency] = {};
        adj.investorAdj[agency][termGroup] = val;
        break;
      }

      case 'fhlmcSpecial': {
        adj.fhlmcSpecial.push({
          featureName: row.feature_name,
          purpose: row.purpose,
          agency: row.agency,
          tier: row.tier,
          termMin: row.term_min,
          termMax: row.term_max,
          loanAmountMin: row.loan_amount_min,
          loanAmountMax: row.loan_amount_max,
          value: val,
        });
        break;
      }

      case 'productFeature': {
        adj.productFeatures.push({
          featureName: row.feature_name,
          tier: row.tier,
          purpose: row.purpose,
          state: row.state,
          productGroup: row.product_group,
          ficoMin: row.fico_min,
          ficoMax: row.fico_max,
          ltvMin: row.ltv_min,
          ltvMax: row.ltv_max,
          value: val,
        });
        break;
      }

      case 'productLoanAmount': {
        adj.productLoanAmount.push({
          tier: row.tier,
          agency: row.agency,
          productType: row.product_group, // 'fixed' or 'arm'
          termMin: row.term_min,
          termMax: row.term_max,
          loanAmountMin: row.loan_amount_min,
          loanAmountMax: row.loan_amount_max,
          value: val,
        });
        break;
      }

      case 'eliteFhaFicoLoanAmt': {
        adj.eliteFhaFicoLoanAmt.push({
          ficoMin: row.fico_min,
          ficoMax: row.fico_max,
          loanAmountMin: row.loan_amount_min,
          loanAmountMax: row.loan_amount_max,
          value: val,
        });
        break;
      }

      case 'eliteFhaPurposeLtv': {
        adj.eliteFhaPurposeLtv.push({
          purpose: row.purpose,
          state: row.state,
          ficoMin: row.fico_min,
          ficoMax: row.fico_max,
          ltvMin: Number(row.ltv_min),
          ltvMax: Number(row.ltv_max),
          value: val,
        });
        break;
      }
    }
  }

  // Sort Elite SRP amount bands by min for efficient lookup
  for (const escrow of Object.values(adj.srp.elite)) {
    for (const state of Object.values(escrow)) {
      for (const [, bands] of Object.entries(state)) {
        if (Array.isArray(bands)) {
          bands.sort((a, b) => a.min - b.min);
        }
      }
    }
  }

  return adj;
}

// ─── Public API ─────────────────────────────────────────────────────

export async function getDbLenderAdj(lenderCode, loanType = 'conventional') {
  const cacheKey = `${lenderCode}:${loanType}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Find lender
  const lenderRows = await sql`
    SELECT id FROM rate_lenders WHERE code = ${lenderCode} LIMIT 1
  `;
  const lender = lenderRows[0];
  if (!lender) return null;

  // Query active rules for this lender + loan type
  const today = new Date();
  const rules = await sql`
    SELECT * FROM adjustment_rules
    WHERE lender_id = ${lender.id}
      AND loan_type = ${loanType}
      AND status = 'active'
      AND effective_date <= ${today}
      AND (expires_date IS NULL OR expires_date > ${today})
  `;

  if (rules.length === 0) return null;

  const data = buildAdjObject(rules);

  // Cache by lender + loan type
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });

  return data;
}

/** Clear cache — useful after seeding new rules */
export function clearAdjCache() {
  cache.clear();
}
