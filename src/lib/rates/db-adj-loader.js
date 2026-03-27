/**
 * Load lender adjustments from the adjustment_rules DB table.
 *
 * Replaces lender-adj-loader.js (which reads static JSON files).
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
  if (ficoMax >= 999) return `>=${ficoMin}`;
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
    ficoLtvGrids: { purchase: {}, refinance: {}, cashout: {} },
    srp: {
      core: { withImpounds: {}, withoutImpounds: {} },
      elite: { withImpounds: {}, withoutImpounds: {} },
    },
    riskBased: {},
    loanAmountAdj: {},
    investorAdj: { fnma: {}, fhlmc: {} },
    fhlmcSpecial: [],
    productFeatures: [],
  };

  for (const row of allRows) {
    const val = Number(row.value);

    switch (row.adjustmentType) {
      case 'ficoLtv': {
        const ficoBand = formatFicoBand(row.ficoMin, row.ficoMax);
        const ltvKey = formatLtvBand(row.ltvMin, row.ltvMax);
        if (row.purpose) {
          // Purpose-specific (conventional)
          const grid = adj.ficoLtvGrids[row.purpose];
          if (!grid[ficoBand]) grid[ficoBand] = {};
          grid[ficoBand][ltvKey] = val;
        } else {
          // No purpose = applies to all (FHA)
          for (const p of ['purchase', 'refinance', 'cashout']) {
            if (!adj.ficoLtvGrids[p][ficoBand]) adj.ficoLtvGrids[p][ficoBand] = {};
            adj.ficoLtvGrids[p][ficoBand][ltvKey] = val;
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
        adj.srp[tier][escrow][state][productGroup] = val;
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
          purpose: row.purpose,
          state: row.state,
          productGroup: row.productGroup,
          ficoMin: row.ficoMin,
          ficoMax: row.ficoMax,
          value: val,
        });
        break;
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
