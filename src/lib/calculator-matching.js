/**
 * Calculator Matching — maps a saved scenario to relevant calculators with pre-fill params.
 *
 * Rules:
 *   Purchase (conv/FHA/VA)  → Purchase Calculator, Cost of Waiting
 *   Refi (conv/FHA/VA)      → Refi Analyzer, Cost of Waiting
 *   Cashout                 → Refi Analyzer
 *   Investment / DSCR       → DSCR Calculator
 *   Never: Reverse Mortgage, Second Lien, HECM (too specialized)
 */

function buildQueryString(params) {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

/**
 * @param {object} scenarioData — the scenario inputs from SavedScenario.scenarioData
 * @param {number} [bestRate] — the current best rate from lastPricingData (optional)
 * @returns {Array<{name: string, path: string, label: string, url: string}>}
 */
export function getMatchedCalculators(scenarioData, bestRate) {
  if (!scenarioData) return [];

  const sd = scenarioData;
  const purpose = sd.purpose || '';
  const loanType = (sd.loanType || '').toLowerCase();
  const isInvestment = sd.occupancy === 'investment' || loanType === 'dscr';

  const calcs = [];

  // Investment / DSCR scenarios → DSCR Calculator only
  if (isInvestment) {
    calcs.push({
      name: 'dscr',
      label: 'DSCR Calculator',
      path: '/tools/dscr-calculator',
      url: '/tools/dscr-calculator' + buildQueryString({
        loanAmount: sd.loanAmount,
        rate: bestRate,
        term: sd.term,
      }),
    });
    return calcs;
  }

  // Purchase scenarios
  if (purpose === 'purchase') {
    calcs.push({
      name: 'purchase',
      label: 'Purchase Calculator',
      path: '/tools/purchase-calculator',
      url: '/tools/purchase-calculator' + buildQueryString({
        homePrice: sd.propertyValue,
        downPct: sd.downPaymentPct,
        rate: bestRate,
        term: sd.term,
      }),
    });

    calcs.push({
      name: 'cost-of-waiting',
      label: 'Cost of Waiting',
      path: '/tools/cost-of-waiting',
      url: '/tools/cost-of-waiting' + buildQueryString({
        loanAmount: sd.loanAmount,
        currentRate: bestRate,
        term: sd.term,
      }),
    });

    return calcs;
  }

  // Refi / Cashout scenarios
  if (purpose === 'refi' || purpose === 'cashout') {
    calcs.push({
      name: 'refi',
      label: 'Refi Analyzer',
      path: '/tools/refi-analyzer',
      url: '/tools/refi-analyzer' + buildQueryString({
        balance: sd.loanAmount || sd.currentPayoff,
        currentRate: sd.currentRate,
        newRate: bestRate,
        newTerm: sd.term,
      }),
    });

    if (purpose === 'refi') {
      calcs.push({
        name: 'cost-of-waiting',
        label: 'Cost of Waiting',
        path: '/tools/cost-of-waiting',
        url: '/tools/cost-of-waiting' + buildQueryString({
          loanAmount: sd.loanAmount || sd.currentPayoff,
          currentRate: bestRate,
          term: sd.term,
        }),
      });
    }

    return calcs;
  }

  return calcs;
}
