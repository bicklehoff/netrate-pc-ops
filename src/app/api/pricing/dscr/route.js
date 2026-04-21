/**
 * DSCR Pricing API
 *
 * POST /api/pricing/dscr — Price a DSCR scenario against the active Everstream
 * rate sheet. Returns the full ladder across Elite tiers (and Core, base-only
 * until Core LLPAs are ingested — see price-dscr.js).
 *
 * Body:
 * {
 *   // product shape
 *   product_type:     "arm" | "fixed",        // default: "arm"
 *   term:             30,                      // default: 30
 *   arm_fixed_period: 7,                       // required if product_type=arm (5|7|10)
 *   lock_days:        30,                      // default: 30
 *
 *   // scenario — required
 *   fico:             760,
 *   cltv:             70,                      // percent
 *   state:            "CO",                    // 2-letter
 *   occupancy:        "investment",            // DSCR is always NOO (canonical: investment)
 *   loan_purpose:     "purchase" | "rate_term" | "cashout",
 *   property_type:    "sfr" | "2unit" | "pud" | "condo" | ...,
 *   loan_size:        320000,
 *
 *   // DSCR — supply ONE of these:
 *   dscr_ratio:       1.25,                    // fixed value
 *   // ... OR ...
 *   dscr_inputs: {                             // compute per-rate
 *     monthly_rent:    3000,
 *     monthly_escrow:  500,
 *     monthly_hoa:     0,
 *     loan_amount:     320000,
 *   },
 *
 *   // optional
 *   prepay_years:      5,
 *   prepay_structure:  "fixed_5",
 *   features:          ["io"],
 *   tier_filter:       ["elite_1", "elite_2"],  // subset of returned tiers
 * }
 *
 * Returns: { priced, skipped, meta } — same shape as priceDscrScenario.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { loadActiveDscrSheet, priceDscrScenario } from '@/lib/pricing-nonqm/price-dscr';

// Cache the sheet in memory per serverless instance. Rate sheets change at most
// daily; we tolerate a minute of staleness in exchange for avoiding a DB round
// trip on every keystroke in the DSCR calculator.
let sheetCache = null;
let sheetCacheAt = 0;
const SHEET_TTL_MS = 60_000;

async function getSheet() {
  const now = Date.now();
  if (sheetCache && now - sheetCacheAt < SHEET_TTL_MS) return sheetCache;
  const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
  sheetCache = await loadActiveDscrSheet(sql);
  sheetCacheAt = now;
  return sheetCache;
}

function validate(body) {
  const errors = [];
  const required = ['fico', 'cltv', 'state', 'occupancy', 'loan_purpose', 'property_type', 'loan_size'];
  for (const f of required) {
    if (body[f] === undefined || body[f] === null || body[f] === '') errors.push(`${f} is required`);
  }
  const productType = body.product_type || 'arm';
  if (productType === 'arm' && !body.arm_fixed_period) {
    errors.push('arm_fixed_period required when product_type=arm');
  }
  const hasRatio = body.dscr_ratio !== undefined && body.dscr_ratio !== null;
  const hasInputs = body.dscr_inputs && typeof body.dscr_inputs === 'object';
  if (!hasRatio && !hasInputs) {
    errors.push('Either dscr_ratio or dscr_inputs must be provided');
  }
  if (hasInputs) {
    const i = body.dscr_inputs;
    if (!i.loan_amount) errors.push('dscr_inputs.loan_amount required');
    if (i.monthly_rent === undefined) errors.push('dscr_inputs.monthly_rent required');
  }
  return errors;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const errors = validate(body);
    if (errors.length) {
      return NextResponse.json({ error: 'Invalid scenario', details: errors }, { status: 400 });
    }

    const scenario = {
      product_type: body.product_type || 'arm',
      term: Number(body.term) || 30,
      arm_fixed_period: body.arm_fixed_period ? Number(body.arm_fixed_period) : null,
      lock_days: Number(body.lock_days) || 30,
      fico: Number(body.fico),
      cltv: Number(body.cltv),
      state: String(body.state).toUpperCase(),
      occupancy: body.occupancy,
      loan_purpose: body.loan_purpose,
      property_type: body.property_type,
      loan_size: Number(body.loan_size),
      dscr_ratio: body.dscr_ratio !== undefined ? Number(body.dscr_ratio) : null,
      dscr_inputs: body.dscr_inputs || null,
      prepay_years: body.prepay_years !== undefined ? Number(body.prepay_years) : null,
      prepay_structure: body.prepay_structure || null,
      features: Array.isArray(body.features) ? body.features : [],
    };

    const sheet = await getSheet();
    const result = priceDscrScenario(sheet, scenario);

    // Optional tier filter (post-pricing — keeps pricer pure)
    if (Array.isArray(body.tier_filter) && body.tier_filter.length) {
      const allowed = new Set(body.tier_filter);
      result.priced = result.priced.filter(r => allowed.has(r.tier));
      result.skipped = result.skipped.filter(r => allowed.has(r.tier));
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    console.error('DSCR pricing API error:', err);
    return NextResponse.json(
      { error: 'DSCR pricing error', message: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { sheet } = await getSheet();
    return NextResponse.json({
      engine: 'NetRate DSCR Pricer',
      endpoint: 'POST /api/pricing/dscr',
      lender_code: sheet.lender_code,
      effective_at: sheet.effective_at,
      product_count: sheet.product_count,
      llpa_count: sheet.llpa_count,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
