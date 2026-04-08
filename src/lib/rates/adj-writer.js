/**
 * Adjustment Rules DB Writer
 *
 * Takes parsed adjustment data from rate sheet parsers and writes normalized
 * rows to the adjustment_rules table. Replaces the manual seed-adjustment-rules
 * workflow for lenders whose parsers extract adjustment data.
 *
 * Usage:
 *   const { writeAdjustmentsToDB } = require('./adj-writer');
 *   const result = await writeAdjustmentsToDB('swmc', parsedResult);
 */

/* eslint-disable @typescript-eslint/no-require-imports */
try { require('dotenv').config(); } catch { /* dotenv optional in Next.js runtime */ }
const { Client } = require('pg');

const DB_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;

// ─── Parse helpers (same logic as seed-adjustment-rules.mjs) ────────

function parseFico(band) {
  const ge = band.match(/>=\s*(\d+)/);
  if (ge) return { ficoMin: parseInt(ge[1]), ficoMax: 999 };
  const le = band.match(/<=\s*(\d+)/);
  if (le) return { ficoMin: 0, ficoMax: parseInt(le[1]) };
  const range = band.match(/(\d+)-(\d+)/);
  if (range) return { ficoMin: parseInt(range[1]), ficoMax: parseInt(range[2]) };
  return null;
}

function parseLtv(band) {
  const le = band.match(/<=\s*([\d.]+)/);
  if (le && !band.includes('-')) return { ltvMin: 0, ltvMax: parseFloat(le[1]) };
  const range = band.match(/([\d.]+)-([\d.]+)/);
  if (range) return { ltvMin: parseFloat(range[1]), ltvMax: parseFloat(range[2]) };
  const gt = band.match(/^>\s*([\d.]+)$/);
  if (gt) return { ltvMin: parseFloat(gt[1]) + 0.01, ltvMax: 100 };
  return null;
}

// ─── Row builder ────────────────────────────────────────────────────

function makeRow(data) {
  return {
    adjustment_type: data.adjustmentType,
    loan_type: data.loanType || 'conventional',
    purpose: data.purpose || null,
    agency: data.agency || null,
    tier: data.tier || null,
    state: data.state || null,
    escrow_type: data.escrowType || null,
    product_group: data.productGroup || null,
    term_group: data.termGroup || null,
    feature_name: data.featureName || null,
    fico_min: data.ficoMin ?? null,
    fico_max: data.ficoMax ?? null,
    ltv_min: data.ltvMin ?? null,
    ltv_max: data.ltvMax ?? null,
    loan_amount_min: data.loanAmountMin ?? null,
    loan_amount_max: data.loanAmountMax ?? null,
    term_min: data.termMin ?? null,
    term_max: data.termMax ?? null,
    value: data.value,
    source: data.source || 'parsed',
  };
}

// ─── SWMC adjustment builders ────────────────────────────────────────

function buildSwmcConvLlpaRows(agencyAdj) {
  const rows = [];
  if (!agencyAdj?.ficoLtvGrids) return rows;

  const ltvBands = agencyAdj.ltvBuckets?.purchaseRefi || [];

  for (const purpose of ['purchase', 'refinance', 'cashout']) {
    const grid = agencyAdj.ficoLtvGrids[purpose];
    if (!grid) continue;

    const bands = purpose === 'cashout'
      ? (agencyAdj.ltvBuckets?.cashout || ltvBands)
      : ltvBands;

    for (const [ficoBand, values] of Object.entries(grid)) {
      const fico = parseFico(ficoBand);
      if (!fico) continue;

      for (let i = 0; i < values.length && i < bands.length; i++) {
        if (values[i] === null || values[i] === undefined) continue;
        const ltv = parseLtv(bands[i]);
        if (!ltv) continue;
        rows.push(makeRow({
          adjustmentType: 'ficoLtv',
          loanType: 'conventional',
          purpose,
          termGroup: '>15yr',
          ...fico, ...ltv,
          value: values[i],
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  // Additional adjustments (ARM, Condo, Investment, etc.)
  for (const purpose of ['purchase', 'refinance', 'cashout']) {
    const addAdj = agencyAdj.additionalAdjustments?.[purpose];
    if (!addAdj) continue;

    const bands = purpose === 'cashout'
      ? (agencyAdj.ltvBuckets?.cashout || ltvBands)
      : ltvBands;

    for (const [key, values] of Object.entries(addAdj)) {
      if (!Array.isArray(values)) continue;
      for (let i = 0; i < values.length && i < bands.length; i++) {
        if (values[i] === null || values[i] === undefined) continue;
        const ltv = parseLtv(bands[i]);
        if (!ltv) continue;
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: 'conventional',
          purpose,
          featureName: 'additionalAdj',
          productGroup: key,
          ...ltv,
          value: values[i],
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  // State adjustments (all-terms)
  if (agencyAdj.stateAdj) {
    for (const [state, adj] of Object.entries(agencyAdj.stateAdj)) {
      if (!adj || adj.adj30yr === null) continue;
      rows.push(makeRow({
        adjustmentType: 'productFeature',
        loanType: 'conventional',
        featureName: 'stateAdj',
        state,
        value: adj.adj30yr,
        source: 'swmc/parsed-sheet',
      }));
    }
  }

  // All-terms adjustments (buydowns, renovation, LPMI, etc.)
  if (agencyAdj.allTermsAdj) {
    for (const [key, values] of Object.entries(agencyAdj.allTermsAdj)) {
      if (!Array.isArray(values)) continue;
      for (let i = 0; i < values.length && i < ltvBands.length; i++) {
        if (values[i] === null || values[i] === undefined) continue;
        const ltv = parseLtv(ltvBands[i]);
        if (!ltv) continue;
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: 'conventional',
          featureName: 'allTermsAdj',
          productGroup: key,
          ...ltv,
          value: values[i],
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  return rows;
}

function buildSwmcGovAdjRows(govAdj) {
  const rows = [];
  if (!govAdj) return rows;

  const govLoanTypes = ['fha', 'va'];

  // FICO adjustments — NEGATE: sheet uses positive=cost, engine productFeature uses positive=credit
  if (govAdj.ficoAdj) {
    for (const [band, value] of Object.entries(govAdj.ficoAdj)) {
      if (value === 0 || value === null) continue;
      const fico = parseFico(band);
      if (!fico) continue;
      for (const lt of govLoanTypes) {
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: lt,
          featureName: 'ficoAdj',
          ...fico,
          value: -value, // negate: sheet positive=cost → engine negative=cost
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  // State adjustments — NEGATE
  if (govAdj.stateAdj) {
    for (const [state, adj] of Object.entries(govAdj.stateAdj)) {
      if (!adj || adj.adj30yr === 0 || adj.adj30yr === null) continue;
      for (const lt of govLoanTypes) {
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: lt,
          featureName: 'stateAdj',
          state,
          value: -adj.adj30yr, // negate
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  // Property adjustments — NEGATE
  if (govAdj.propertyAdj) {
    const propMap = {
      'manufactured_home': 'manufactured',
      '3__4_units': '3-4unit',
      'second_home': 'secondHome',
      'investment_property': 'investment',
    };
    for (const [rawKey, value] of Object.entries(govAdj.propertyAdj)) {
      if (value === 0 || value === null) continue;
      const productGroup = propMap[rawKey] || rawKey;
      for (const lt of govLoanTypes) {
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: lt,
          featureName: 'propertyType',
          productGroup,
          value: -value, // negate
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  // Loan amount adjustments
  if (govAdj.loanAmtAdj) {
    for (const entry of govAdj.loanAmtAdj) {
      if (entry.adj30yr === 0 || entry.adj30yr === null) continue;
      for (const lt of govLoanTypes) {
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: lt,
          featureName: 'loanAmtAdj',
          loanAmountMin: 0,
          loanAmountMax: entry.max,
          value: -entry.adj30yr, // negate
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  // Other adjustments (condo, construction, etc.) — NEGATE
  if (govAdj.otherAdj) {
    for (const [key, value] of Object.entries(govAdj.otherAdj)) {
      if (value === 0 || value === null) continue;
      for (const lt of govLoanTypes) {
        rows.push(makeRow({
          adjustmentType: 'productFeature',
          loanType: lt,
          featureName: 'otherAdj',
          productGroup: key,
          value: -value, // negate
          source: 'swmc/parsed-sheet',
        }));
      }
    }
  }

  return rows;
}

function buildSwmcPromoRows(fees) {
  const rows = [];
  if (!fees?.promos) return rows;

  for (const promo of fees.promos) {
    // Promos are credits — positive value = price improvement
    rows.push(makeRow({
      adjustmentType: 'productFeature',
      loanType: promo.type === 'fha_usda' ? 'fha' : (promo.type || 'conventional'),
      featureName: 'promo',
      productGroup: promo.label?.substring(0, 80) || 'monthly-promo',
      value: promo.points, // positive = credit (price improvement)
      source: 'swmc/parsed-sheet',
    }));
    // USDA gets same promo as FHA
    if (promo.type === 'fha_usda') {
      rows.push(makeRow({
        adjustmentType: 'productFeature',
        loanType: 'usda',
        featureName: 'promo',
        productGroup: promo.label?.substring(0, 80) || 'monthly-promo',
        value: promo.points,
        source: 'swmc/parsed-sheet',
      }));
    }
  }

  return rows;
}

// ─── Main writer ────────────────────────────────────────────────────

/**
 * Write parsed adjustment data to DB for a given lender.
 *
 * @param {string} lenderCode - e.g. 'swmc'
 * @param {object} parsedResult - full output from parseRates() containing agencyAdj, govAdj, fees
 * @param {string} [sheetDate] - effective date for the rules (defaults to today)
 * @returns {{ inserted: number, lenderCode: string }}
 */
async function writeAdjustmentsToDB(lenderCode, parsedResult, sheetDate) {
  const { agencyAdj, govAdj, fees } = parsedResult;

  // Build rows based on lender
  let rows = [];
  if (lenderCode === 'swmc') {
    rows = [
      ...buildSwmcConvLlpaRows(agencyAdj),
      ...buildSwmcGovAdjRows(govAdj),
      ...buildSwmcPromoRows(fees),
    ];
  } else {
    throw new Error(`adj-writer: no builder for lender "${lenderCode}" — use seed-adjustment-rules.mjs`);
  }

  if (rows.length === 0) {
    console.log(`[adj-writer] No adjustment rows built for ${lenderCode}`);
    return { inserted: 0, lenderCode };
  }

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    const key = [r.adjustment_type, r.loan_type, r.purpose, r.agency, r.tier, r.state,
      r.escrow_type, r.product_group, r.term_group, r.feature_name,
      r.fico_min, r.fico_max, r.ltv_min, r.ltv_max,
      r.loan_amount_min, r.loan_amount_max, r.term_min, r.term_max, r.value].join('|');
    if (!seen.has(key)) { seen.add(key); unique.push(r); }
  }

  const effectiveDate = sheetDate || new Date().toISOString().split('T')[0];
  console.log(`[adj-writer] ${lenderCode}: ${unique.length} rules (deduped from ${rows.length}), effective ${effectiveDate}`);

  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Get lender ID
    const lenderRes = await client.query('SELECT id FROM rate_lenders WHERE code = $1', [lenderCode]);
    if (lenderRes.rows.length === 0) throw new Error(`No rate_lender with code "${lenderCode}"`);
    const lenderId = lenderRes.rows[0].id;

    // Clear existing rules from parsed source (preserve manually seeded rules)
    const delRes = await client.query(
      "DELETE FROM adjustment_rules WHERE lender_id = $1 AND source LIKE '%/parsed-sheet'",
      [lenderId]
    );
    console.log(`[adj-writer] Cleared ${delRes.rowCount} existing parsed rules`);

    // Batch insert — 50 rows per query
    const BATCH_SIZE = 50;
    let inserted = 0;
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const batchJson = JSON.stringify(batch);

      await client.query(`
        INSERT INTO adjustment_rules (
          id, lender_id, adjustment_type, loan_type,
          purpose, agency, tier, state, escrow_type, product_group, term_group, feature_name,
          fico_min, fico_max, ltv_min, ltv_max,
          loan_amount_min, loan_amount_max, term_min, term_max,
          value, effective_date, status, source,
          created_at, updated_at
        )
        SELECT
          gen_random_uuid(), $1, r.adjustment_type, r.loan_type,
          r.purpose, r.agency, r.tier, r.state, r.escrow_type, r.product_group, r.term_group, r.feature_name,
          r.fico_min, r.fico_max, r.ltv_min, r.ltv_max,
          r.loan_amount_min, r.loan_amount_max, r.term_min, r.term_max,
          r.value, $2::date, 'active', r.source,
          NOW(), NOW()
        FROM json_to_recordset($3::json) AS r(
          adjustment_type text, loan_type text,
          purpose text, agency text, tier text, state text, escrow_type text,
          product_group text, term_group text, feature_name text,
          fico_min numeric, fico_max numeric, ltv_min numeric, ltv_max numeric,
          loan_amount_min numeric, loan_amount_max numeric, term_min numeric, term_max numeric,
          value numeric, source text
        )
      `, [lenderId, effectiveDate, batchJson]);

      inserted += batch.length;
    }

    // Verify
    const countRes = await client.query(
      "SELECT COUNT(*) as cnt FROM adjustment_rules WHERE lender_id = $1 AND source LIKE '%/parsed-sheet'",
      [lenderId]
    );
    console.log(`[adj-writer] ${lenderCode}: inserted ${inserted} rules, verified ${countRes.rows[0].cnt} in DB`);

    return { inserted, lenderCode };
  } finally {
    await client.end();
  }
}

module.exports = { writeAdjustmentsToDB };
