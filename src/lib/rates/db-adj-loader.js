/**
 * Load lender adjustments from the adjustment_rules DB table.
 *
 * Loads adjustment data from the DB (seeded via seed-adjustment-rules.mjs).
 * Returns the EXACT SAME shape that pricing-v2.js expects.
 *
 * Caches results for 5 minutes — adjustment configs change at most daily.
 */

import prisma from '@/lib/prisma';

// ─── Cache ──────────────────────────────────────────────────────────

const cache = new Map(); // lenderCode → { data, expiresAt }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── String key formatters ──────────────────────────────────────────
// These reconstruct the exact string keys pricing-v2.js expects.

function formatFicoBand(ficoMin, ficoMax) {
  // Normalize to match pricing-v2.js getFicoBand() output.
  // Engine maps 780+ → ">=780", so merge 780-799 and >=800 into ">=780".
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
  };

  for (const row of allRows) {
    const val = Number(row.value);

    switch (row.adjustmentType) {
      case 'ficoLtv': {
        const ficoBand = formatFicoBand(row.ficoMin, row.ficoMax);
        const ltvKey = formatLtvBand(row.ltvMin, row.ltvMax);
        const tier = row.tier || 'core';
        const termGroup = row.termGroup || '>15yr';

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
        const ficoBand = formatFicoBandRiskBased(row.ficoMin, row.ficoMax);
        if (!adj.riskBased[ficoBand]) adj.riskBased[ficoBand] = {};
        adj.riskBased[ficoBand][formatLtvBand(row.ltvMin, row.ltvMax)] = val;
        break;
      }

      case 'loanAmount': {
        const rangeKey = formatLoanAmountRange(row.loanAmountMin, row.loanAmountMax);
        adj.loanAmountAdj[rangeKey] = val;
        break;
      }

      case 'srp': {
        const tier = row.tier || 'core';
        const escrow = row.escrowType || 'withImpounds';
        const state = row.state;
        const productGroup = row.productGroup;
        if (!adj.srp[tier]) adj.srp[tier] = {};
        if (!adj.srp[tier][escrow]) adj.srp[tier][escrow] = {};
        if (!adj.srp[tier][escrow][state]) adj.srp[tier][escrow][state] = {};

        if (tier === 'elite' && row.loanAmountMin != null) {
          // Elite SRP: amount-banded — store as sorted array
          if (!Array.isArray(adj.srp[tier][escrow][state][productGroup])) {
            adj.srp[tier][escrow][state][productGroup] = [];
          }
          adj.srp[tier][escrow][state][productGroup].push({
            min: Number(row.loanAmountMin),
            max: Number(row.loanAmountMax),
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
        const termGroup = row.termGroup;
        if (!adj.investorAdj[agency]) adj.investorAdj[agency] = {};
        adj.investorAdj[agency][termGroup] = val;
        break;
      }

      case 'fhlmcSpecial': {
        adj.fhlmcSpecial.push({
          featureName: row.featureName,
          purpose: row.purpose,
          agency: row.agency,
          tier: row.tier,
          termMin: row.termMin,
          termMax: row.termMax,
          loanAmountMin: row.loanAmountMin,
          loanAmountMax: row.loanAmountMax,
          value: val,
        });
        break;
      }

      case 'productFeature': {
        adj.productFeatures.push({
          featureName: row.featureName,
          tier: row.tier,
          purpose: row.purpose,
          state: row.state,
          productGroup: row.productGroup,
          ficoMin: row.ficoMin,
          ficoMax: row.ficoMax,
          value: val,
        });
        break;
      }

      case 'productLoanAmount': {
        adj.productLoanAmount.push({
          tier: row.tier,
          agency: row.agency,
          productType: row.productGroup, // 'fixed' or 'arm'
          termMin: row.termMin,
          termMax: row.termMax,
          loanAmountMin: row.loanAmountMin,
          loanAmountMax: row.loanAmountMax,
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
  const lender = await prisma.rateLender.findUnique({
    where: { code: lenderCode },
    select: { id: true },
  });
  if (!lender) return null;

  // Query active rules for this lender + loan type
  const today = new Date();
  const rules = await prisma.adjustmentRule.findMany({
    where: {
      lenderId: lender.id,
      loanType,
      status: 'active',
      effectiveDate: { lte: today },
      OR: [
        { expiresDate: null },
        { expiresDate: { gt: today } },
      ],
    },
  });

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
