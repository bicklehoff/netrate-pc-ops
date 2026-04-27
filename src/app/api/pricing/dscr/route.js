/**
 * DSCR Pricing API — public projection.
 *
 * POST /api/pricing/dscr — Price a DSCR scenario against every active DSCR
 * rate sheet across all lenders. Returns one merged ladder sorted by
 * `final_price` desc.
 *
 * **Lender confidentiality boundary** (since 2026-04-27): wholesale lender
 * names + lender-coined tier names are NOT public information. Our wholesale
 * pricing relationships are confidential to the channel and disclosing them
 * publicly is both a wholesale-channel rule violation and a competitive
 * giveaway. The pricer carries `lender_code`, `tier`, and `raw_product_name`
 * internally; the public projection at this route boundary strips them.
 *
 * The MLO calc at `/portal/mlo/dscr` (D9d.1, future) is the only surface
 * that ever sees lender attribution — and it lives behind authentication.
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
 * }
 *
 * Returns: { priced, skipped, meta } where:
 *   priced[]  = product-shape rows (no lender_code, no tier, no raw_product_name)
 *               with rate, prices, payment, dscr, adjustments, warnings
 *   skipped[] = sanitized {note_rate, reason} entries
 *   meta      = { as_of: <max effective_at>, scenario }
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { loadActiveDscrSheets, priceDscrScenario } from '@/lib/pricing-nonqm/price-dscr';
import { apiError } from '@/lib/api/safe-error';
import { rateLimit } from '@/lib/api/rate-limit';

// Cache the sheets in memory per serverless instance. Rate sheets change at most
// daily; we tolerate a minute of staleness in exchange for avoiding a DB round
// trip on every keystroke in the DSCR calculator. Cached as an array — one
// entry per active DSCR-bearing lender — to match the multi-lender loader's
// return shape (D9c.4 / AD-1).
let sheetsCache = null;
let sheetsCacheAt = 0;
const SHEET_TTL_MS = 60_000;

async function getSheets() {
  const now = Date.now();
  if (sheetsCache && now - sheetsCacheAt < SHEET_TTL_MS) return sheetsCache;
  const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
  sheetsCache = await loadActiveDscrSheets(sql);
  sheetsCacheAt = now;
  return sheetsCache;
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

// Warning codes that leak lender-coined tier vocabulary in their text.
// These warnings mark rows the calc should hide anyway (Core-tier rows with
// no LLPAs ingested → base price only, misleading to a borrower). The
// public projection drops the rows entirely; the calc's existing client
// filter becomes a defense-in-depth no-op. Keep this list aligned with
// the warnings emitted by `priceDscrScenario`.
const LENDER_VOCAB_WARNINGS = new Set(['core_llpas_missing']);

/**
 * Strip lender-attributed fields from a single priced row.
 * Removes: lender_code, tier, raw_product_name.
 * Adjustments lose their `label` (some labels embed lender-coined feature
 * names); rule_type + points are preserved so the calc can still display
 * a high-level breakdown if it wants to.
 *
 * Warnings are sanitized: any warning whose `code` lives in
 * LENDER_VOCAB_WARNINGS is filtered out, since the codes/messages embed
 * tier names ("core_llpas_missing", "Core tier LLPAs not yet ingested…").
 * Other warnings (price_cap_applied, etc.) pass through.
 */
function publicPriced(r) {
  return {
    loan_type: r.loan_type,
    product_type: r.product_type,
    term: r.term,
    arm_fixed_period: r.arm_fixed_period,
    arm_adj_period: r.arm_adj_period,
    lock_days: r.lock_days,
    note_rate: r.note_rate,
    base_price: r.base_price,
    final_price: r.final_price,
    llpa_total: r.llpa_total,
    price_cap: r.price_cap,
    adjustments: (r.adjustments || []).map(a => ({
      rule_type: a.rule_type,
      points: a.points,
    })),
    warnings: (r.warnings || []).filter(w => !LENDER_VOCAB_WARNINGS.has(w.code)),
    pi: r.pi,
    pitia: r.pitia,
    dscr: r.dscr,
  };
}

/**
 * True if a row should be dropped from the public projection — currently
 * because it carries a lender-vocabulary warning (Core-tier rows with no
 * LLPAs). These rows aren't useful to a borrower (price would shift once
 * LLPAs land); the calc's own filter already hides them, but the public
 * API is also a curl-able surface, so we filter at the edge too.
 */
function shouldHideFromPublic(r) {
  return (r.warnings || []).some(w => LENDER_VOCAB_WARNINGS.has(w.code));
}

/**
 * Strip lender-attributed fields from a skipped row. We don't expose the
 * raw_product_name or lender_code; just enough for the calc to surface
 * "this scenario doesn't qualify" diagnostics.
 */
function publicSkipped(s) {
  return {
    note_rate: s.note_rate,
    reason: s.reason,
    ...(s.dscr !== undefined && { dscr: s.dscr }),
    ...(s.pitia !== undefined && { pitia: s.pitia }),
  };
}

export async function POST(request) {
  const limited = await rateLimit(request, { scope: 'pricing-dscr', limit: 60, window: '1 m' });
  if (limited) return limited;

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

    const sheets = await getSheets();
    const result = priceDscrScenario(sheets, scenario);

    // Project to the public shape — drop lender_code, tier, raw_product_name,
    // and adjustments[].label. `meta.lenders[]` collapses to a single
    // `as_of` (max effective_at across all active sheets).
    const asOf = sheets
      .map(({ sheet }) => sheet?.effective_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    const publicResult = {
      priced: result.priced.filter(r => !shouldHideFromPublic(r)).map(publicPriced),
      skipped: result.skipped.map(publicSkipped),
      meta: {
        as_of: asOf,
        scenario,
      },
    };

    return NextResponse.json(publicResult, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    return apiError(err, 'DSCR pricing error', 500, { scope: 'pricing-dscr' });
  }
}

export async function GET() {
  try {
    const sheets = await getSheets();
    const asOf = sheets
      .map(({ sheet }) => sheet?.effective_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
    // Aggregate counts across active sheets without naming the underlying
    // sources. Borrower-trust signal ("we shop multiple wholesale lenders")
    // without identifying them.
    const programCount = sheets.length;
    const productCount = sheets.reduce((s, { sheet }) => s + (sheet?.product_count || 0), 0);
    const llpaCount    = sheets.reduce((s, { sheet }) => s + (sheet?.llpa_count    || 0), 0);
    return NextResponse.json({
      engine: 'NetRate DSCR Pricer',
      endpoint: 'POST /api/pricing/dscr',
      as_of: asOf,
      program_count: programCount,
      product_count: productCount,
      llpa_count: llpaCount,
    });
  } catch (err) {
    return apiError(err, 'DSCR sheet unavailable', 500, { scope: 'pricing-dscr-meta' });
  }
}
