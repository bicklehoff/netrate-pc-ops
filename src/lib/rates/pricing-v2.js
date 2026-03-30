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
 * Resolve the correct FICO/LTV grid for this product's tier, agency, and term.
 * Returns a purpose-keyed grid object { purchase: {}, refinance: {}, cashout: {} }
 */
function resolveGrids(tier, investor, term, lenderAdj, fallbackGrids) {
  const grids = lenderAdj?.ficoLtvGrids;
  if (!grids) return fallbackGrids;

  if (tier === 'elite') {
    const agency = investor || 'fnma';
    const termGroup = term > 15 ? '>15yr' : 'allTerms';
    const agencyGrids = grids.elite?.[agency]?.[termGroup];
    // If we have Elite grids and they have data, use them
    if (agencyGrids && Object.keys(agencyGrids.purchase || {}).length > 0) {
      return agencyGrids;
    }
  }

  // Core: use >15yr for >15yr products, skip FICO/LTV for <=15yr (returns 0)
  const termGroup = term > 15 ? '>15yr' : null;
  if (termGroup) {
    const coreGrids = grids.core?.[termGroup];
    if (coreGrids && Object.keys(coreGrids.purchase || {}).length > 0) {
      return coreGrids;
    }
  }

  // <=15yr products: no FICO/LTV LLPA applies (return empty grids)
  if (term <= 15) return { purchase: {}, refinance: {}, cashout: {} };

  return fallbackGrids;
}

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

/**
 * Same as getFicoLtvAdjustment but returns the raw signed value.
 * Used for FHA where positive = credit, negative = cost.
 */
function getFicoLtvRawValue(creditScore, ltv, loanPurpose, llpaGrids) {
  if (!llpaGrids) return 0;

  const grid = loanPurpose === 'cashout' ? llpaGrids.cashout
    : loanPurpose === 'purchase' ? llpaGrids.purchase
    : llpaGrids.refinance;

  if (!grid) {
    // FHA grids may not be split by purpose — try the grid directly
    // (FHA ficoPriceAdj is a flat FICO→LTV grid, not purpose-split)
    const ficoBand = getFicoBand(creditScore);
    const ficoRow = grid?.[ficoBand];
    if (!ficoRow) return 0;
  }

  const ficoBand = getFicoBand(creditScore);
  const ficoRow = grid[ficoBand];
  if (!ficoRow) return 0;

  for (const [bandKey, value] of Object.entries(ficoRow)) {
    if (typeof value !== 'number') continue;

    // "70.01 - 75.00%" range format (conventional)
    const rangeMatch = bandKey.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      if (ltv >= min && ltv <= max) return value;
    }

    // "<= 85%" format (FHA/conventional)
    const leMatch = bandKey.match(/^<=\s*([\d.]+)/);
    if (leMatch && ltv <= parseFloat(leMatch[1])) return value;

    // "> 85% <= 95%" format (FHA)
    const gtLeMatch = bandKey.match(/>\s*([\d.]+)%?\s*<=\s*([\d.]+)/);
    if (gtLeMatch) {
      const min = parseFloat(gtLeMatch[1]);
      const max = parseFloat(gtLeMatch[2]);
      if (ltv > min && ltv <= max) return value;
    }

    // "> 95%" format (FHA)
    const gtMatch = bandKey.match(/^>\s*([\d.]+)%?$/);
    if (gtMatch && ltv > parseFloat(gtMatch[1])) return value;
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
 * Core: flat value per state/product (e.g., CO Fixed 20/25/30yr → 1.830)
 * Elite: amount-banded per state/product (e.g., CO $400K Fixed 20/25/30yr → 1.628)
 */
function getSRP(state, term, productType, tier, lenderAdj, loanAmount) {
  if (!lenderAdj?.srp) return 0;

  const isArm = productType === 'arm';
  const escrowKey = 'withImpounds';

  // Core vs Elite have different SRP structures
  const srpTable = tier === 'core'
    ? lenderAdj.srp.core?.[escrowKey]
    : lenderAdj.srp.elite?.[escrowKey];

  if (!srpTable?.[state]) return 0;

  // Elite uses different product group names than Core
  let productKey;
  if (tier === 'elite') {
    productKey = isArm
      ? (term >= 10 ? 'Conventional 10/6 ARM' : term >= 7 ? 'Conventional 7/6 ARM' : 'Conventional 5/6 ARM')
      : (term <= 15 ? 'Conventional 10/15 Year Fixed' : 'Conventional 20/25/30 Year Fixed');
  } else {
    productKey = isArm ? 'ARMs' : (term <= 15 ? 'Fixed 10/15 Yr' : 'Fixed 20/25/30 Yr');
  }

  const srpEntry = srpTable[state][productKey];

  // Core: flat number
  if (typeof srpEntry === 'number') return srpEntry;

  // Elite: array of { min, max, value } — find matching band
  if (Array.isArray(srpEntry) && loanAmount) {
    for (const band of srpEntry) {
      if (loanAmount >= band.min && loanAmount <= band.max) {
        return band.value;
      }
    }
  }

  return 0;
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
  const loanType = scenario.loanType || 'conventional';
  const { term, productType, investor, tier } = product;
  const isConventional = loanType === 'conventional';
  const isFha = loanType === 'fha';

  // FHA: UFMIP (1.75%) is financed into the loan
  const ufmip = isFha ? Math.round(loanAmount * 0.0175) : 0;
  const effectiveLoanAmount = loanAmount + ufmip;

  const breakdown = [];

  // Step 1: Base price
  let price = getBasePrice(rateEntry);
  breakdown.push({ label: 'Base price', value: price });

  // Step 2: FICO/LTV adjustment — resolve tier/agency/term-specific grids
  const ficoGrids = resolveGrids(tier, investor, term, lenderAdj, llpaGrids);
  if (isConventional) {
    // Conventional: values are costs (negative in grid) → subtract
    const ficoLtvCost = getFicoLtvAdjustment(creditScore, ltv, loanPurpose, ficoGrids);
    if (ficoLtvCost !== 0) {
      price -= ficoLtvCost;
      breakdown.push({ label: `FICO/LTV (${getFicoBand(creditScore)}, ${ltv}%)`, value: -ficoLtvCost });
    }
  } else {
    // FHA: values are signed — positive = credit, negative = cost
    const ficoLtvVal = getFicoLtvRawValue(creditScore, ltv, loanPurpose, ficoGrids);
    if (ficoLtvVal !== 0) {
      price += ficoLtvVal;
      breakdown.push({ label: `FICO/LTV (${getFicoBand(creditScore)}, ${ltv}%)`, value: ficoLtvVal });
    }
  }

  // Step 3: SRP — CREDIT → add (pass loanAmount for Elite banded lookup)
  const srp = getSRP(state, term, productType, tier, lenderAdj, loanAmount);
  if (srp !== 0) {
    price += srp;
    breakdown.push({ label: `SRP (${state})`, value: +srp });
  }

  // Step 4: Risk-based — CREDIT → add (Core conventional only; Elite bakes this in)
  if (isConventional && tier !== 'elite') {
    const riskAdj = getRiskBasedAdjustment(creditScore, ltv, lenderAdj);
    if (riskAdj !== 0) {
      price += riskAdj;
      breakdown.push({ label: 'Risk-based', value: +riskAdj });
    }
  }

  // Step 5: Loan amount — CREDIT → add (Core only; Elite bakes this in)
  if (tier !== 'elite') {
    const loanAmtAdj = getLoanAmountAdjustment(effectiveLoanAmount, lenderAdj);
    if (loanAmtAdj !== 0) {
      price += loanAmtAdj;
      breakdown.push({ label: 'Loan amount adj', value: +loanAmtAdj });
    }
  }

  // Step 5a: Per-product loan amount adjustment (from "Product Loan Amount LLPAs" sheet)
  // These are product-specific credits/costs based on tier + agency + productType + term + loan amount
  if (lenderAdj?.productLoanAmount?.length) {
    for (const pla of lenderAdj.productLoanAmount) {
      if (pla.tier && pla.tier !== tier) continue;
      if (pla.agency && pla.agency !== investor) continue;
      if (pla.productType && pla.productType !== productType) continue;
      if (pla.termMin != null && term < pla.termMin) continue;
      if (pla.termMax != null && term > pla.termMax) continue;
      if (pla.loanAmountMin != null && effectiveLoanAmount < pla.loanAmountMin) continue;
      if (pla.loanAmountMax != null && effectiveLoanAmount > pla.loanAmountMax) continue;

      price += pla.value;
      breakdown.push({ label: 'Product loan amt adj', value: pla.value });
      break; // Only one match per product — most specific wins
    }
  }

  // Step 5b: Product feature adjustments (FICO band, purpose, state, tier)
  if (lenderAdj?.productFeatures?.length) {
    const scenarioPropertyType = scenario.propertyType || 'sfr';
    for (const pf of lenderAdj.productFeatures) {
      // Check filters
      if (pf.tier && pf.tier !== tier) continue;
      if (pf.ficoMin != null && creditScore < pf.ficoMin) continue;
      if (pf.ficoMax != null && creditScore > pf.ficoMax) continue;
      if (pf.purpose && pf.purpose !== loanPurpose) continue;
      if (pf.state && pf.state !== state) continue;

      // Property type adjustments only apply if scenario matches
      if (pf.featureName === 'propertyType') {
        if (pf.productGroup === 'condo' && scenarioPropertyType !== 'condo') continue;
        if (pf.productGroup === 'manufactured' && scenarioPropertyType !== 'manufactured') continue;
      }
      // Occupancy adjustments only for non-primary
      if (pf.featureName === 'occupancy') continue; // skip for now — all scenarios are primary

      const label = pf.featureName === 'ficoAdj' ? `FICO ${pf.ficoMin}-${pf.ficoMax} adj`
        : pf.featureName === 'purposeAdj' ? `${pf.purpose} adj`
        : pf.featureName === 'stateAdj' ? `State ${pf.state} adj`
        : pf.featureName === 'propertyType' ? `${pf.productGroup} adj`
        : pf.featureName;
      price += pf.value;
      breakdown.push({ label, value: pf.value });
    }
  }

  // Step 6: Investor-specific — COST → subtract (Core conventional only; Elite bakes this in)
  if (isConventional && tier !== 'elite') {
    const investorCost = getInvestorAdjustment(investor, term, productType, lenderAdj);
    if (investorCost !== 0) {
      price -= investorCost;
      breakdown.push({ label: `${investor.toUpperCase()} adj`, value: -investorCost });
    }
  }

  // Step 6b: FHLMC-specific adjustments (data-driven from adjustment_rules table)
  if (lenderAdj?.fhlmcSpecial?.length) {
    for (const rule of lenderAdj.fhlmcSpecial) {
      // Check filters
      if (rule.agency && rule.agency !== investor) continue;
      if (rule.tier && rule.tier !== tier) continue;
      if (rule.purpose && rule.purpose !== loanPurpose) continue;
      if (rule.termMin != null && term < rule.termMin) continue;
      if (rule.termMax != null && term > rule.termMax) continue;
      if (rule.loanAmountMin != null && loanAmount < rule.loanAmountMin) continue;
      if (rule.loanAmountMax != null && loanAmount > rule.loanAmountMax) continue;

      const adjValue = rule.value;
      if (adjValue < 0) {
        price += adjValue; // cost (negative value = subtract)
      } else {
        price += adjValue; // credit (positive value = add)
      }
      const label = rule.featureName === 'refiPurpose' ? 'FHLMC refi purpose adj'
        : rule.featureName === 'purchasePurpose' ? 'FHLMC purchase purpose adj'
        : rule.featureName === 'occupancyTerm' ? 'FHLMC occupancy/term adj'
        : `FHLMC ${rule.featureName}`;
      breakdown.push({ label, value: adjValue });
    }
  }

  // Step 7: Broker comp — COST → subtract (use effective amount for FHA)
  const { compDollars, compPoints } = getBrokerComp(effectiveLoanAmount, loanPurpose, brokerConfig);
  price -= compPoints;
  breakdown.push({ label: `Comp ($${compDollars.toFixed(0)})`, value: -compPoints });

  // ─── Read the final price ─────────────────────────────────────
  // > 100 = REBATE (borrower receives)
  // < 100 = DISCOUNT (borrower pays)
  // = 100 = PAR

  const costOrCredit = price - 100; // positive = rebate, negative = discount
  const dollars = (costOrCredit / 100) * effectiveLoanAmount;

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
    baseLoanAmount: loanAmount,
    ufmip,
    effectiveLoanAmount,
    breakdown,
  };
}
