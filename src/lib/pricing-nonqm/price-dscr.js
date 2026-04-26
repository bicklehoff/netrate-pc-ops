/**
 * DSCR pricer — Non-QM product family.
 *
 * Given a scenario (loan inputs) and an active rate sheet, returns a priced
 * rate ladder across all available Elite tiers. Applies FICO×CLTV grid
 * LLPAs, property-type / loan-size / DSCR-ratio / feature / prepay / state SRP
 * adjustments, and price caps.
 *
 * Separation of concerns:
 *   loadActiveDscrSheet(sql, lender_code) → { sheet, products, rules }
 *   priceDscrScenario(sheet, scenario)    → { priced[], skipped, meta }
 *
 * The DB fetch is split from the pure pricing logic so the pricer can be unit
 * tested without a live database and the fetch cached by API routes.
 *
 * Core DSCR tier (DSCR Plus) is currently returned base-price-only — its LLPAs
 * live on the `Core Non-QM` sheet which isn't ingested yet. A `warnings` array
 * on each Core result flags this, so UIs can hide them or show a caveat.
 */

const LENDER_CODE = 'everstream';

// Order matters: UIs typically want Elite tiers listed tightest → loosest.
const ELITE_TIERS = ['elite_1', 'elite_2', 'elite_5'];
const CORE_TIERS  = ['core'];

// ── Internal loaders (shared by single- and multi-lender entry points) ───

async function loadDscrProducts(sql, sheetId) {
  return sql`
    SELECT id, loan_type, tier, product_type, term, arm_fixed_period,
           arm_adj_period, lock_days, note_rate, final_base_price, raw_product_name
      FROM nonqm_rate_products
     WHERE rate_sheet_id = ${sheetId} AND loan_type = 'dscr'
  `;
}

async function loadDscrRules(sql, sheetId) {
  return sql`
    SELECT tier, product_type, rule_type,
           occupancy, loan_purpose, fico_min, fico_max, cltv_min, cltv_max,
           property_type, loan_size_min, loan_size_max,
           dscr_ratio_min, dscr_ratio_max, prepay_years, state, doc_type, feature,
           llpa_points, price_cap, not_offered
      FROM nonqm_adjustment_rules
     WHERE rate_sheet_id = ${sheetId}
  `;
}

/**
 * Load the currently-active DSCR rate sheet + all its products and rules
 * for a single lender.
 *
 * @deprecated Use loadActiveDscrSheets() for multi-lender support
 *   (Work/Dev/PRICING-ARCHITECTURE.md §10 AD-1). Kept while the API route,
 *   scripts, and tests migrate to the multi-result shape.
 */
export async function loadActiveDscrSheet(sql, lender_code = LENDER_CODE) {
  const sheets = await sql`
    SELECT id, lender_code, effective_at, product_count, llpa_count
      FROM nonqm_rate_sheets
     WHERE lender_code = ${lender_code} AND is_active = TRUE
     LIMIT 1
  `;
  if (!sheets.length) {
    throw new Error(`No active rate sheet for lender "${lender_code}"`);
  }
  const sheet = sheets[0];
  const [products, rules] = await Promise.all([
    loadDscrProducts(sql, sheet.id),
    loadDscrRules(sql, sheet.id),
  ]);
  return { sheet, products, rules };
}

/**
 * Load all currently-active DSCR rate sheets across every lender, with
 * their products and rules. Filters on nonqm_rate_sheets.has_dscr = TRUE
 * (added in migration 050) so non-DSCR sheets (e.g. a future Core Non-QM-
 * only sheet) are skipped without paying for product/rule fetches.
 *
 * Returns an array of `{ sheet, products, rules }`, one per active DSCR
 * sheet. Today's distribution: 1 entry (Everstream). Future state: one
 * entry per active lender (Everstream + ResiCentral when D9c.7 lands).
 *
 * Per Work/Dev/PRICING-ARCHITECTURE.md §10 AD-1.
 */
export async function loadActiveDscrSheets(sql) {
  const sheets = await sql`
    SELECT id, lender_code, effective_at, product_count, llpa_count
      FROM nonqm_rate_sheets
     WHERE is_active = TRUE AND has_dscr = TRUE
  `;
  return Promise.all(sheets.map(async (sheet) => {
    const [products, rules] = await Promise.all([
      loadDscrProducts(sql, sheet.id),
      loadDscrRules(sql, sheet.id),
    ]);
    return { sheet, products, rules };
  }));
}

/**
 * Price a scenario across all available DSCR tiers.
 *
 * @param {object} arg
 * @param {object[]} arg.products  rows from nonqm_rate_products (DSCR only)
 * @param {object[]} arg.rules     rows from nonqm_adjustment_rules
 * @param {object}   arg.sheet     rate sheet header
 * @param {object}   scenario
 * @param {'fixed'|'arm'} scenario.product_type
 * @param {number}   scenario.term              e.g. 30
 * @param {number}  [scenario.arm_fixed_period] 5/7/10 if arm
 * @param {number}   scenario.lock_days         15/30/45/60/75
 * @param {number}   scenario.fico
 * @param {number}   scenario.cltv              percent, e.g. 70
 * @param {string}   scenario.state             2-letter
 * @param {'primary'|'secondary'|'investment'} scenario.occupancy
 * @param {'purchase'|'rate_term'|'cashout'} scenario.loan_purpose
 * @param {string}   scenario.property_type     'sfr'|'pud'|'condo'|'2unit'|...
 * @param {number}   scenario.loan_size         loan amount in dollars
 * @param {number}  [scenario.dscr_ratio]       e.g. 1.20 — required UNLESS dscr_inputs provided
 * @param {number}   scenario.prepay_years      0-5
 * @param {string}  [scenario.prepay_structure] e.g. 'fixed_5', 'no_penalty'
 * @param {string[]} [scenario.features]         e.g. ['io', 'short_term_rental']
 * @param {object}  [scenario.dscr_inputs]      When present, DSCR is computed per-rate
 *                                              from these inputs and overrides dscr_ratio.
 *                                              Required shape: { monthly_rent, monthly_escrow,
 *                                              monthly_hoa, loan_amount }. The pricer uses each
 *                                              product's note_rate to compute P&I (fully
 *                                              amortizing over scenario.term years), derives
 *                                              PITIA = P&I + escrow + HOA, then DSCR = rent ÷ PITIA.
 *                                              Each priced row gets pi/pitia/dscr attached.
 * @returns {{ priced: object[], skipped: object[], meta: object }}
 */
export function priceDscrScenario({ products, rules, sheet }, scenario) {
  const priced = [];
  const skipped = [];

  const tiersToPrice = [...ELITE_TIERS, ...CORE_TIERS];
  const dscrInputs = scenario.dscr_inputs || null;

  for (const tier of tiersToPrice) {
    const isCore = CORE_TIERS.includes(tier);

    // 1. Filter candidate products for this tier / product_type / term / lock / arm period
    const candidates = products.filter(p =>
      p.tier === tier &&
      p.product_type === scenario.product_type &&
      Number(p.term) === Number(scenario.term) &&
      Number(p.lock_days) === Number(scenario.lock_days) &&
      (scenario.product_type === 'fixed'
        ? p.arm_fixed_period === null
        : Number(p.arm_fixed_period) === Number(scenario.arm_fixed_period))
    );

    if (!candidates.length) continue;

    // 2. Partition rules for this tier
    const tierRules = rules.filter(r => r.tier === tier);

    // 3. Price each rate in the ladder
    for (const product of candidates) {
      // Compute DSCR per-rate if rent/escrow inputs were supplied. DSCR depends on
      // rate (via P&I), so every rung of the ladder can land in a different ratio band.
      let effectiveScenario = scenario;
      let paymentAttr = null;
      if (dscrInputs) {
        const pi = calcMonthlyPI(dscrInputs.loan_amount, Number(product.note_rate), Number(scenario.term));
        const pitia = pi + (dscrInputs.monthly_escrow || 0) + (dscrInputs.monthly_hoa || 0);
        const dscr = pitia > 0 ? (dscrInputs.monthly_rent || 0) / pitia : 0;
        const dscrRounded = Math.round(dscr * 100) / 100;
        effectiveScenario = { ...scenario, dscr_ratio: dscrRounded };
        paymentAttr = { pi, pitia, dscr: dscrRounded };
      }

      const result = priceOne(product, tierRules, effectiveScenario, { isCore });
      if (result.gated) {
        skipped.push({
          tier, note_rate: Number(product.note_rate),
          reason: result.gate_reason, raw_product_name: product.raw_product_name,
          ...(paymentAttr && { dscr: paymentAttr.dscr, pitia: paymentAttr.pitia }),
        });
        continue;
      }
      if (paymentAttr) {
        result.row.pi = Math.round(paymentAttr.pi * 100) / 100;
        result.row.pitia = Math.round(paymentAttr.pitia * 100) / 100;
        result.row.dscr = paymentAttr.dscr;
      }
      priced.push(result.row);
    }
  }

  // Sort by final_price desc (best price first — higher = more credit to borrower)
  priced.sort((a, b) => b.final_price - a.final_price);

  return {
    priced,
    skipped,
    meta: {
      lender_code: sheet?.lender_code ?? LENDER_CODE,
      effective_at: sheet?.effective_at ?? null,
      scenario,
    },
  };
}

/**
 * Monthly P&I for a fully-amortizing loan. Standard mortgage formula.
 * Returns 0 for degenerate inputs so callers don't have to guard.
 */
function calcMonthlyPI(loanAmount, annualRatePct, termYears) {
  if (!loanAmount || !annualRatePct || !termYears) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Price a single product row against the scenario. Returns either:
 *   { gated: true, gate_reason }   — product not offered for this scenario
 *   { row: {...} }                 — a priced result object
 */
function priceOne(product, tierRules, scenario, { isCore }) {
  const basePrice = Number(product.final_base_price);
  const adjustments = [];
  const warnings = [];
  let priceCap = null;

  // Core tier: no LLPAs yet — emit base price with warning
  if (isCore) {
    warnings.push({
      code: 'core_llpas_missing',
      message: 'Core tier LLPAs not yet ingested — base price only',
    });
    return {
      row: buildRow(product, basePrice, basePrice, adjustments, warnings, null),
    };
  }

  // Rule match filter: each rule must be applicable to this product_type
  // (NULL product_type = applies to both fixed + arm)
  const applicable = tierRules.filter(r =>
    r.product_type === null || r.product_type === product.product_type
  );

  // ── FICO×CLTV grid (one match) ───────────────────────────────────
  const grid = applicable.find(r =>
    r.rule_type === 'fico_cltv_grid' &&
    r.occupancy === scenario.occupancy &&
    r.loan_purpose === scenario.loan_purpose &&
    inRange(scenario.fico, r.fico_min, r.fico_max) &&
    inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max)
  );

  if (!grid) {
    return { gated: true, gate_reason: 'no_fico_cltv_grid_match' };
  }
  if (grid.not_offered) {
    return { gated: true, gate_reason: 'fico_cltv_grid:not_offered' };
  }
  if (grid.llpa_points !== null) {
    adjustments.push({ rule_type: 'fico_cltv_grid', points: Number(grid.llpa_points), label: 'FICO×CLTV grid' });
  }

  // Price cap is stored as its own rule row (same grid position, populated via
  // the parallel Price Cap block of the sheet). Find the matching cap row.
  const capRule = applicable.find(r =>
    r.rule_type === 'fico_cltv_grid' &&
    r.occupancy === scenario.occupancy &&
    r.loan_purpose === scenario.loan_purpose &&
    inRange(scenario.fico, r.fico_min, r.fico_max) &&
    inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max) &&
    r.price_cap !== null
  );
  if (capRule) priceCap = Number(capRule.price_cap);

  // ── Property type (one match per CLTV band) ──────────────────────
  const propRule = applicable.find(r =>
    r.rule_type === 'property_type' &&
    r.property_type === scenario.property_type &&
    inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max)
  );
  if (propRule?.not_offered) {
    return { gated: true, gate_reason: `property_type:${scenario.property_type}:not_offered` };
  }
  if (propRule?.llpa_points !== null && propRule?.llpa_points !== undefined) {
    adjustments.push({ rule_type: 'property_type', points: Number(propRule.llpa_points), label: `Property: ${scenario.property_type}` });
  }

  // ── Loan size ────────────────────────────────────────────────────
  const sizeRule = applicable.find(r =>
    r.rule_type === 'loan_size' &&
    (r.loan_size_min === null || Number(scenario.loan_size) >= Number(r.loan_size_min)) &&
    (r.loan_size_max === null || Number(scenario.loan_size) <= Number(r.loan_size_max)) &&
    inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max)
  );
  if (sizeRule?.not_offered) {
    return { gated: true, gate_reason: 'loan_size:not_offered' };
  }
  if (sizeRule?.llpa_points !== null && sizeRule?.llpa_points !== undefined) {
    adjustments.push({ rule_type: 'loan_size', points: Number(sizeRule.llpa_points), label: `Loan size: $${scenario.loan_size}` });
  }

  // ── DSCR ratio ───────────────────────────────────────────────────
  if (scenario.dscr_ratio !== undefined && scenario.dscr_ratio !== null) {
    const dscrRule = applicable.find(r =>
      r.rule_type === 'dscr_ratio' &&
      (r.dscr_ratio_min === null || Number(scenario.dscr_ratio) >= Number(r.dscr_ratio_min)) &&
      (r.dscr_ratio_max === null || Number(scenario.dscr_ratio) <  Number(r.dscr_ratio_max)) &&
      inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max)
    );
    if (dscrRule?.not_offered) {
      return { gated: true, gate_reason: `dscr:${scenario.dscr_ratio}:not_offered` };
    }
    if (dscrRule?.llpa_points !== null && dscrRule?.llpa_points !== undefined) {
      adjustments.push({ rule_type: 'dscr_ratio', points: Number(dscrRule.llpa_points), label: `DSCR: ${scenario.dscr_ratio}` });
    }
  }

  // ── State SRP ────────────────────────────────────────────────────
  if (scenario.state) {
    const srpRule = applicable.find(r =>
      r.rule_type === 'state_srp' &&
      r.state === scenario.state &&
      inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max)
    );
    if (srpRule?.not_offered) {
      return { gated: true, gate_reason: `state:${scenario.state}:not_offered` };
    }
    if (srpRule?.llpa_points !== null && srpRule?.llpa_points !== undefined) {
      adjustments.push({ rule_type: 'state_srp', points: Number(srpRule.llpa_points), label: `State: ${scenario.state}` });
    }
  }

  // ── Prepay ───────────────────────────────────────────────────────
  if (scenario.prepay_years !== undefined && scenario.prepay_years !== null) {
    const prepayRule = applicable.find(r =>
      r.rule_type === 'prepay' &&
      Number(r.prepay_years) === Number(scenario.prepay_years) &&
      (!scenario.prepay_structure || r.feature === scenario.prepay_structure)
    );
    if (prepayRule?.not_offered) {
      return { gated: true, gate_reason: `prepay:${scenario.prepay_years}yr:not_offered` };
    }
    if (prepayRule?.llpa_points !== null && prepayRule?.llpa_points !== undefined) {
      adjustments.push({
        rule_type: 'prepay',
        points: Number(prepayRule.llpa_points),
        label: `Prepay: ${scenario.prepay_structure || scenario.prepay_years + 'yr'}`,
      });
    }
  }

  // ── Features (multiple matches possible) ─────────────────────────
  for (const feature of scenario.features || []) {
    const featRule = applicable.find(r =>
      r.rule_type === 'feature' &&
      r.feature === feature &&
      inCltvRange(scenario.cltv, r.cltv_min, r.cltv_max)
    );
    if (featRule?.not_offered) {
      return { gated: true, gate_reason: `feature:${feature}:not_offered` };
    }
    if (featRule?.llpa_points !== null && featRule?.llpa_points !== undefined) {
      adjustments.push({ rule_type: 'feature', points: Number(featRule.llpa_points), label: `Feature: ${feature}` });
    }
  }

  // ── Sum + cap ────────────────────────────────────────────────────
  const llpaTotal = adjustments.reduce((s, a) => s + a.points, 0);
  let finalPrice = basePrice + llpaTotal;
  if (priceCap !== null && finalPrice > priceCap) {
    finalPrice = priceCap;
    warnings.push({ code: 'price_cap_applied', message: `Capped at ${priceCap}` });
  }

  return {
    row: buildRow(product, basePrice, finalPrice, adjustments, warnings, priceCap),
  };
}

function buildRow(product, basePrice, finalPrice, adjustments, warnings, priceCap) {
  return {
    lender_code: LENDER_CODE,
    tier: product.tier,
    loan_type: 'dscr',
    product_type: product.product_type,
    term: Number(product.term),
    arm_fixed_period: product.arm_fixed_period !== null ? Number(product.arm_fixed_period) : null,
    arm_adj_period:   product.arm_adj_period   !== null ? Number(product.arm_adj_period)   : null,
    lock_days: Number(product.lock_days),
    note_rate: Number(product.note_rate),
    base_price: basePrice,
    final_price: Math.round(finalPrice * 1_000_000) / 1_000_000,
    llpa_total: Math.round(adjustments.reduce((s, a) => s + a.points, 0) * 1_000_000) / 1_000_000,
    price_cap: priceCap,
    adjustments,
    warnings,
    raw_product_name: product.raw_product_name,
  };
}

// ── Range helpers ─────────────────────────────────────────────────────

function inRange(value, min, max) {
  if (value === undefined || value === null) return false;
  const v = Number(value);
  if (min !== null && v < Number(min)) return false;
  if (max !== null && v > Number(max)) return false;
  return true;
}

/**
 * CLTV ranges in the sheet are half-open: the first band is [0, 50], subsequent
 * bands are (50, 55], (55, 60], etc. A CLTV of exactly 50 should match the
 * first band, 50.01 the second, etc. Our cltv_min values reflect that (0, 50.01,
 * 55.01, ...), but floating-point comparison against 50.01 is flaky, so we
 * round to 2 decimals first.
 */
function inCltvRange(cltv, cltvMin, cltvMax) {
  if (cltv === undefined || cltv === null) return false;
  const v = Math.round(Number(cltv) * 100) / 100;
  if (cltvMin !== null && v < Number(cltvMin)) return false;
  if (cltvMax !== null && v > Number(cltvMax)) return false;
  return true;
}
