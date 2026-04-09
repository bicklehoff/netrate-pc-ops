// API: Update an existing saved scenario (BRP reprice flow)
// POST /api/saved-scenario/update { token, scenarioData }
// Token-based auth — validates borrower owns the scenario, updates it with new inputs + fresh pricing.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { calcMonthlyPI } from '@/lib/rates/math';

export async function POST(request) {
  try {
    const { token, scenarioData, selectedRates } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }
    if (!scenarioData || !scenarioData.loanAmount) {
      return NextResponse.json({ error: 'Scenario data is required' }, { status: 400 });
    }

    // Validate token → get lead email
    const leads = await sql`
      SELECT id::text, email, name FROM leads WHERE view_token::text = ${token} LIMIT 1
    `;
    const lead = leads?.[0];

    if (!lead?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find all leads with this email (same borrower may have multiple lead records)
    const allLeads = await sql`SELECT id FROM leads WHERE email = ${lead.email}`;
    const leadIds = allLeads.map(l => l.id);

    // Find the latest saved scenario for this borrower
    const existingRows = await sql`
      SELECT id, alert_frequency, alert_days
      FROM saved_scenarios
      WHERE lead_id = ANY(${leadIds})
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!existingRows.length) {
      return NextResponse.json({ error: 'No saved scenario found' }, { status: 404 });
    }
    const existingScenario = existingRows[0];

    // Use client-side selected rates if provided, otherwise run server-side pricing
    let pricingData = null;
    if (selectedRates?.length > 0) {
      pricingData = selectedRates;
    } else {
      try {
        const pricingInput = {
          loanAmount: scenarioData.loanAmount,
          propertyValue: scenarioData.propertyValue,
          loanPurpose: scenarioData.purpose,
          loanType: scenarioData.loanType,
          creditScore: scenarioData.fico,
          state: scenarioData.state,
          county: scenarioData.county,
          term: scenarioData.term,
        };
        const result = await priceScenario(pricingInput);
        const loanAmt = scenarioData.loanAmount;
        const term = scenarioData.term || 30;
        pricingData = (result.results || [])
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 3)
          .map(r => ({
            rate: r.rate,
            apr: r.apr || null,
            monthlyPI: r.monthlyPI || calcMonthlyPI(r.rate, loanAmt, term),
            price: r.finalPrice || r.price || null,
            lenderName: r.lender || r.lenderName || null,
            program: r.program || null,
            rebateDollars: r.rebateDollars,
            discountDollars: r.discountDollars,
            lenderFee: r.lenderFee,
          }));
      } catch (err) {
        console.error('Update pricing failed:', err.message);
      }
    }

    // Update the scenario with new inputs + pricing
    await sql`
      UPDATE saved_scenarios
      SET scenario_data = ${JSON.stringify(scenarioData)},
          last_pricing_data = ${pricingData ? JSON.stringify(pricingData) : null},
          last_priced_at = ${pricingData ? new Date() : null},
          updated_at = NOW()
      WHERE id = ${existingScenario.id}
    `;

    // Also update the lead record with latest scenario details
    await sql`
      UPDATE leads
      SET scenario_data = ${JSON.stringify(scenarioData)},
          loan_purpose = ${scenarioData.purpose || null},
          loan_amount = ${scenarioData.loanAmount || null},
          property_state = ${scenarioData.state || null},
          property_value = ${scenarioData.propertyValue || null},
          property_county = ${scenarioData.county || null},
          credit_score = ${scenarioData.fico || null},
          updated_at = NOW()
      WHERE id::text = ${lead.id}
    `;

    return NextResponse.json({
      success: true,
      scenarioId: existingScenario.id,
      viewToken: token,
    });
  } catch (err) {
    console.error('Update scenario error:', err.message, err.stack);
    return NextResponse.json({ error: `Update failed: ${err.message}` }, { status: 500 });
  }
}
