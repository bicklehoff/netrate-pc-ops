// API: Reprice a saved scenario on demand
// POST /api/my-rates/reprice { token, scenarioId }
// Token-based auth — validates borrower owns the scenario.
//
// Reads/writes unified scenarios table.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { calcMonthlyPI } from '@/lib/rates/math';
import { replaceScenarioRates } from '@/lib/scenarios/db';
import { getRateAlertByScenarioId, updateRateAlert } from '@/lib/rate-alerts';

export async function POST(request) {
  try {
    const { token, scenarioId } = await request.json();

    if (!token || !scenarioId) {
      return NextResponse.json({ error: 'Token and scenarioId required' }, { status: 400 });
    }

    // Validate token → get email
    const leads = await sql`SELECT email FROM leads WHERE view_token::text = ${token} LIMIT 1`;
    const lead = leads?.[0] || null;

    if (!lead?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch the scenario and verify ownership via email
    const scenarioRows = await sql`
      SELECT s.*, l.email AS lead_email
      FROM scenarios s
      LEFT JOIN leads l ON s.lead_id = l.id
      WHERE s.id = ${scenarioId} AND s.owner_type = 'borrower'
      LIMIT 1
    `;

    const scenario = scenarioRows[0];
    if (!scenario || scenario.lead_email !== lead.email) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Rebuild scenario_data-shaped input from columns
    const loanAmt = Number(scenario.loan_amount);
    if (!loanAmt) {
      return NextResponse.json({ error: 'Invalid scenario data' }, { status: 400 });
    }

    const pricingInput = {
      loanAmount: loanAmt,
      propertyValue: Number(scenario.property_value) || null,
      loanPurpose: scenario.loan_purpose,
      loanType: scenario.loan_type,
      creditScore: scenario.fico,
      state: scenario.state,
      county: scenario.county,
      term: scenario.term,
    };

    const result = await priceScenario(pricingInput);
    const term = scenario.term || 30;

    // Par-anchored ladder: row 0 is the par rate (the rate borrower would
    // actually take — lowest rate at or above par). Rows 1-2 are the next
    // two rates at or above par, sorted by rate ascending. Falls back to
    // closest-to-par + next rows if nothing reaches par. Replaces the old
    // `.sort.slice(0,3)` which returned 3 deeply-discounted rates that
    // required borrower to pay thousands in points. Portal displays
    // scenario.last_pricing_data[0] as "best rate" — now par, not discount.
    const allResults = result.results || [];
    const parRow = result.parRow || null;
    const aboveParOrdered = allResults
      .filter((r) => r.finalPrice >= 100 && r !== parRow)
      .sort((a, b) => a.rate - b.rate);
    const fallbackOrdered = allResults
      .filter((r) => r !== parRow)
      .sort((a, b) => a.rate - b.rate);
    const sourceLadder = parRow
      ? [parRow, ...aboveParOrdered, ...fallbackOrdered]
      : fallbackOrdered;
    // Dedupe while preserving order (parRow appears once at head)
    const seen = new Set();
    const topRates = [];
    for (const r of sourceLadder) {
      const key = `${r.rate}:${r.finalPrice}:${r.lender}:${r.program}`;
      if (seen.has(key)) continue;
      seen.add(key);
      topRates.push({
        rate: r.rate,
        apr: r.apr || null,
        monthlyPI: r.monthlyPI || calcMonthlyPI(r.rate, loanAmt, term),
        price: r.finalPrice || r.price || null,
        finalPrice: r.finalPrice || r.price || null,
        lender: r.lender || r.lenderName || null,
        lenderName: r.lender || r.lenderName || null,
        program: r.program || null,
        rebateDollars: r.rebateDollars,
        discountDollars: r.discountDollars,
        lenderFee: r.lenderFee,
        isPar: r === parRow,
      });
      if (topRates.length >= 3) break;
    }

    // Replace rates and bump last_priced_at on the rate-alert subscription.
    // Per UAD AD-10a (D9c Phase 3a, 2026-04-30): pricing-cycle fields live on
    // rate_alerts now. Backfill from migration 053 guarantees a rate_alert
    // row exists for every borrower scenario; defensively no-op if missing.
    await replaceScenarioRates(scenarioId, topRates);
    const rateAlert = await getRateAlertByScenarioId(scenarioId, scenario.organization_id);
    if (rateAlert) {
      await updateRateAlert(rateAlert.id, scenario.organization_id, {
        last_priced_at: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      rates: topRates,
      effectiveDate: result.effectiveDate || null,
      pricedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Reprice error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
