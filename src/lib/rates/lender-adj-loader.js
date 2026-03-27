/**
 * Load lender adjustments in the shape pricing-v2 expects.
 *
 * For now, reads from the static config JSON files.
 * Future: read from lender_adjustments table in DB.
 */

import everstreamCfg from '@/data/lender-llpas/everstream-complete.json';

// EverStream adjustment loader
function loadEverStreamAdj() {
  const cfg = everstreamCfg;
  if (!cfg) return null;

  return {
    ficoLtvGrids: {
      purchase: cfg.core?.convLLPA?.purchaseFicoLTV || {},
      refinance: cfg.core?.convLLPA?.nonCashoutRefiFicoLTV || {},
      cashout: cfg.core?.convLLPA?.cashoutRefiFicoLTV || {},
    },
    srp: {
      core: {
        withImpounds: cfg.core?.convSRP?.withImpounds || {},
        withoutImpounds: cfg.core?.convSRP?.withoutImpounds || {},
      },
      elite: {
        withImpounds: cfg.elite?.convSRP_withEscrows || {},
        withoutImpounds: cfg.elite?.convSRP_withoutEscrows || {},
      },
    },
    riskBased: cfg.core?.convLLPA?.riskBasedPriceAdj || {},
    loanAmountAdj: cfg.core?.convLLPA?.loanAmountAdj || {},
    investorAdj: {
      fnma: {
        '21-30yr': 0.220,
        '20/15/10yr': 0.140,
        'arms': 0.220,
      },
      fhlmc: {
        '21-30yr': 0.150,
        '20/15/10yr': 0,
        'arms': 0.150,
      },
    },
  };
}

const LENDER_ADJ = {
  everstream: loadEverStreamAdj(),
};

export function getLenderAdj(lenderId) {
  return LENDER_ADJ[lenderId] || null;
}
