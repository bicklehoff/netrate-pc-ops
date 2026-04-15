// API: Reprice a saved scenario on demand
// POST /api/my-rates/reprice { token, scenarioId }
// Token-based auth — validates borrower owns the scenario.
//
// Reads/writes unified scenarios table.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { calcMonthlyPI } from '@/lib/rates/math';
import { updateScenario, replaceScenarioRates } from '@/lib/scenarios/db';

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
    const topRates = (result.results || [])
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map(r => ({
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
      }));

    // Replace rates + update last_priced_at
    await replaceScenarioRates(scenarioId, topRates);
    await updateScenario(scenarioId, scenario.organization_id, {
      last_priced_at: new Date(),
    });

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
