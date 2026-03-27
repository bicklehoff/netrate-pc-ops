/**
 * Pricing Engine v2 — Clean rewrite
 *
 * Works in 100-based math. No discount format conversion.
 * Same logic as the spreadsheet:
 *   Start with base price → add credits → subtract costs → subtract comp → read final price
 *
 * FINAL PRICE > 100 → REBATE → borrower RECEIVES money
 * FINAL PRICE < 100 → DISCOUNT → borrower PAYS money
 * FINAL PRICE = 100 → PAR → no cost, no credit
 */

// ─── Step 1: Get base price from rate_prices ────────────────────────

/**
 * Get the base price for a product at a given rate.
 * This is the FinalBasePrice from the CSV — 100-based.
 * e.g., 98.6732
 */
function getBasePrice(rateEntry) {
  // rate_prices stores 100-based prices
  return rateEntry.price;
}

// ─── Step 2: FICO/LTV Adjustment ────────────────────────────────────

/**
 * Look up the FICO/LTV LLPA from the parsed rate sheet grids.
 * Returns a COST value (positive = cost to borrower = subtract from base).
 *
 * e.g., 780 FICO at 75% LTV on refi → 0.125 (cost)
 */
function getFicoLtvAdjustment(creditScore, ltv, loanPurpose, llpaGrids) {
  if (!llpaGrids) return 0;

  // Pick the right grid for the purpose
  const grid = loanPurpose === 'cashout' ? llpaGrids.cashout
    : loanPurpose === 'purchase' ? llpaGrids.purchase
    : llpaGrids.refinance;

  if (!grid) return 0;

  // Find FICO band
  const ficoBand = getFicoBand(creditScore);
  const ficoRow = grid[ficoBand];
  if (!ficoRow) return 0;

  // ficoRow is an object with LTV band keys like "70.01 - 75.00%"
  // Find the matching LTV band
  for (const [bandKey, value] of Object.entries(ficoRow)) {
    if (typeof value !== 'number') continue;

    // Parse band like "70.01 - 75.00%" or "<= 30.00%"
    const rangeMatch = bandKey.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      if (ltv >= min && ltv <= max) {
        // Sheet stores costs as negative (e.g., -0.125 = cost to borrower)
        // Return as positive cost so caller can subtract from base
        return Math.abs(value);
      }
    }

    const leMatch = bandKey.match(/<=\s*([\d.]+)/);
    if (leMatch && !bandKey.includes('-') && ltv <= parseFloat(leMatch[1])) {
      return Math.abs(value);
    }
  }

  return 0;
}

function getFicoBand(score) {
  if (score >= 780) return '>=780';
  if (score >= 760) return '760-779';
  if (score >= 740) return '740-759';
  if (score >= 720) return '720-739';
  if (score >= 700) return '700-719';
  if (score >= 680) return '680-699';
  if (score >= 660) return '660-679';
  if (score >= 640) return '640-659';
  if (score >= 620) return '620-639';
  return '<620';
}



// ─── Step 3: SRP (Servicing Released Premium) ───────────────────────

/**
 * Look up the SRP from the lender_adjustments table.
 * Returns a CREDIT value (positive = add to base).
 *
 * e.g., CO, Fixed 20/25/30yr, With Impounds → 1.830
 */
function getSRP(state, term, productType, tier, lenderAdj) {
  if (!lenderAdj?.srp) return 0;

  const isArm = productType === 'arm';
  const escrowKey = 'withImpounds';

  // Core vs Elite have different SRP structures
  const srpTable = tier === 'core'
    ? lenderAdj.srp.core?.[escrowKey]
    : lenderAdj.srp.elite?.[escrowKey];

  if (!srpTable?.[state]) return 0;

  const productKey = isArm ? 'ARMs' : (term <= 15 ? 'Fixed 10/15 Yr' : 'Fixed 20/25/30 Yr');
  const srp = srpTable[state][productKey];

  return typeof srp === 'number' ? srp : 0;
}

// ─── Step 4: Risk-Based Price Adjustment ────────────────────────────

/**
 * Look up risk-based adjustment from Core Conv LLPAs.
 * Returns a CREDIT value (positive = add to base).
 *
 * e.g., 780-799 at 70.01-75% → 0.050
 */
function getRiskBasedAdjustment(creditScore, ltv, lenderAdj) {
  if (!lenderAdj?.riskBased) return 0;

  // Find FICO band (different format than LLPA grids)
  let ficoBand = null;
  if (creditScore >= 800) ficoBand = '>= 800';
  else if (creditScore >= 780) ficoBand = '780 - 799';
  else if (creditScore >= 760) ficoBand = '760 - 779';
  else if (creditScore >= 740) ficoBand = '740 - 759';
  else if (creditScore >= 720) ficoBand = '720 - 739';
  else if (creditScore >= 700) ficoBand = '700 - 719';
  else if (creditScore >= 680) ficoBand = '680 - 699';
  else if (creditScore >= 660) ficoBand = '660 - 679';
  else if (creditScore >= 640) ficoBand = '640 - 659';
  else if (creditScore >= 620) ficoBand = '620 - 639';
  else ficoBand = '< 620(1)';

  const ficoRow = lenderAdj.riskBased[ficoBand];
  if (!ficoRow) return 0;

  const ltvBandKey = ltv <= 40 ? '<= 40.00%' : ltv <= 50 ? '40.01 - 50.00%'
    : ltv <= 60 ? '50.01 - 60.00%' : ltv <= 70 ? '60.01 - 70.00%'
    : ltv <= 75 ? '70.01 - 75.00%' : ltv <= 80 ? '75.01 - 80.00%'
    : ltv <= 85 ? '80.01 - 85.00%' : ltv <= 90 ? '85.01 - 90.00%'
    : ltv <= 95 ? '90.01 - 95.00%' : '95.01 - 97.00%';

  const adj = ficoRow[ltvBandKey];
  return typeof adj === 'number' ? adj : 0;
}

// ─── Step 5: Loan Amount Adjustment ─────────────────────────────────

/**
 * Look up loan amount adjustment from Core Conv LLPAs.
 * Returns the adjustment value. Positive = credit (add to base).
 *
 * e.g., >400000<=500000 → 0.030 (credit)
 */
function getLoanAmountAdjustment(loanAmount, lenderAdj) {
  if (!lenderAdj?.loanAmountAdj) return 0;

  for (const [range, adj] of Object.entries(lenderAdj.loanAmountAdj)) {
    // Match ">300000<=400000" format
    const match = range.match(/>([\d]+)<=([\d]+)/);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      if (loanAmount > min && loanAmount <= max) {
        return typeof adj === 'number' ? adj : 0;
      }
    }
    // Match "<= 50000" format
    const leMatch = range.match(/<=\s*([\d]+)/);
    if (leMatch && !range.includes('>')) {
      const max = parseInt(leMatch[1], 10);
      if (loanAmount <= max) {
        return typeof adj === 'number' ? adj : 0;
      }
    }
  }
  return 0;
}

// ─── Step 6: Investor-Specific Adjustment (FNMA/FHLMC) ─────────────

/**
 * Look up FNMA or FHLMC specific adjustment.
 * Returns a COST value (positive = cost = subtract from base).
 *
 * FNMA 21-30yr: 0.220 (cost)
 * FHLMC 21-30yr: 0.150 (cost)
 * FNMA 20/15/10yr: 0.140 (cost)
 * FHLMC 20/15/10yr: 0 (no cost)
 */
function getInvestorAdjustment(investor, term, productType, lenderAdj) {
  if (!lenderAdj?.investorAdj) return 0;

  const isArm = productType === 'arm';
  const adjTable = lenderAdj.investorAdj[investor];
  if (!adjTable) return 0;

  if (term > 15 || isArm) {
    return adjTable['21-30yr'] || 0;
  } else {
    return adjTable['20/15/10yr'] || 0;
  }
}

// ─── Step 7: Broker Comp ────────────────────────────────────────────

/**
 * Calculate broker comp in points.
 * Comp = min(loanAmount × compRate, compCap) / loanAmount × 100
 *
 * e.g., $450K × 2% = $9,000, capped at $3,595 = 0.799%
 */
function getBrokerComp(loanAmount, loanPurpose, brokerConfig) {
  const compRate = brokerConfig.compRate || 0.02;
  const cap = loanPurpose === 'purchase'
    ? brokerConfig.compCapPurchase || 3595
    : brokerConfig.compCapRefi || 3595;

  const compDollars = Math.min(loanAmount * compRate, cap);
  const compPoints = (compDollars / loanAmount) * 100;

  return { compDollars, compPoints };
}

// ─── Main: Price a Single Rate Entry ────────────────────────────────

/**
 * Price one rate entry for one product.
 * Returns the final price and breakdown — all in 100-based math.
 *
 * FINAL PRICE > 100 → REBATE → borrower RECEIVES money
 * FINAL PRICE < 100 → DISCOUNT → borrower PAYS money
 */
export function priceRate(rateEntry, product, scenario, lenderAdj, brokerConfig, llpaGrids) {
  const { creditScore, ltv, loanAmount, loanPurpose, state } = scenario;
  const { term, productType, investor, tier } = product;

  const breakdown = [];

  // Step 1: Base price
  let price = getBasePrice(rateEntry);
  breakdown.push({ label: 'Base price', value: price });

  // Step 2: FICO/LTV — COST → subtract
  // Try lenderAdj grids first, then fall back to parsed rate sheet grids
  const ficoGrids = lenderAdj?.ficoLtvGrids || llpaGrids;
  const ficoLtvCost = getFicoLtvAdjustment(creditScore, ltv, loanPurpose, ficoGrids);
  if (ficoLtvCost !== 0) {
    price -= ficoLtvCost;
    breakdown.push({ label: `FICO/LTV (${getFicoBand(creditScore)}, ${ltv}%)`, value: -ficoLtvCost });
  }

  // Step 3: SRP — CREDIT → add
  const srp = getSRP(state, term, productType, tier, lenderAdj);
  if (srp !== 0) {
    price += srp;
    breakdown.push({ label: `SRP (${state})`, value: +srp });
  }

  // Step 4: Risk-based — CREDIT → add
  const riskAdj = getRiskBasedAdjustment(creditScore, ltv, lenderAdj);
  if (riskAdj !== 0) {
    price += riskAdj;
    breakdown.push({ label: 'Risk-based', value: +riskAdj });
  }

  // Step 5: Loan amount — CREDIT → add
  const loanAmtAdj = getLoanAmountAdjustment(loanAmount, lenderAdj);
  if (loanAmtAdj !== 0) {
    price += loanAmtAdj;
    breakdown.push({ label: 'Loan amount adj', value: +loanAmtAdj });
  }

  // Step 6: Investor-specific — COST → subtract
  const investorCost = getInvestorAdjustment(investor, term, productType, lenderAdj);
  if (investorCost !== 0) {
    price -= investorCost;
    breakdown.push({ label: `${investor.toUpperCase()} adj`, value: -investorCost });
  }

  // Step 6b: FHLMC-specific refi + occupancy adjustments
  // FHLMC has two extra adjustments that FNMA does not:
  //   - Loan Purpose Rate/Term Refi: -0.150 (cost)
  //   - Occupancy/term/loan amt (25/30yr, 400K-450K, primary): +0.050 (credit)
  // Net: -0.100. These are on the Core Conv LLPAs sheet.
  if (investor === 'fhlmc' && tier === 'core') {
    if (loanPurpose === 'refinance') {
      price -= 0.150;
      breakdown.push({ label: 'FHLMC refi purpose adj', value: -0.150 });
    }
    // Occupancy/term/loan amt credit for 25/30yr primary, 400K-450K
    if (term >= 25 && loanAmount > 400000 && loanAmount <= 450000) {
      price += 0.050;
      breakdown.push({ label: 'FHLMC occupancy/term adj', value: +0.050 });
    }
  }

  // Step 7: Broker comp — COST → subtract (always last)
  const { compDollars, compPoints } = getBrokerComp(loanAmount, loanPurpose, brokerConfig);
  price -= compPoints;
  breakdown.push({ label: `Comp ($${compDollars.toFixed(0)})`, value: -compPoints });

  // ─── Read the final price ─────────────────────────────────────
  // > 100 = REBATE (borrower receives)
  // < 100 = DISCOUNT (borrower pays)
  // = 100 = PAR

  const costOrCredit = price - 100; // positive = rebate, negative = discount
  const dollars = (costOrCredit / 100) * loanAmount;

  return {
    rate: rateEntry.rate,
    lender: product.lenderCode,
    program: product.name,
    investor: investor,
    tier: tier,
    finalPrice: Math.round(price * 1000) / 1000,
    isRebate: price > 100,
    isDiscount: price < 100,
    isPar: Math.abs(price - 100) < 0.005,
    rebateDollars: price > 100 ? Math.round(dollars) : 0,
    discountDollars: price < 100 ? Math.round(Math.abs(dollars)) : 0,
    compDollars: Math.round(compDollars),
    lenderFee: product.uwFee || 999,
    breakdown,
  };
}
