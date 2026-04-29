// API: Update an existing saved scenario (BRP reprice flow)
// POST /api/saved-scenario/update { token, scenarioData }
// Token-based auth — validates borrower owns the scenario, updates it with new inputs + fresh pricing.
//
// Reads/writes the unified scenarios table (owner_type='borrower').

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { calcMonthlyPI } from '@/lib/rates/math';
import { updateScenario, replaceScenarioRates } from '@/lib/scenarios/db';
import { getRateAlertByScenarioId, updateRateAlert } from '@/lib/rate-alerts';
import { apiError } from '@/lib/api/safe-error';
import { rateLimit } from '@/lib/api/rate-limit';

export async function POST(request) {
  const limited = await rateLimit(request, { scope: 'saved-scenario-update', limit: 10, window: '1 m' });
  if (limited) return limited;

  try {
    const { token, scenarioData, selectedRates } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }
    if (!scenarioData || !scenarioData.loanAmount) {
      return NextResponse.json({ error: 'Scenario data is required' }, { status: 400 });
    }

    // Validate token → get lead email + org
    const leads = await sql`
      SELECT id::text, email, name, organization_id FROM leads WHERE view_token::text = ${token} LIMIT 1
    `;
    const lead = leads?.[0];

    if (!lead?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find all leads with this email (same borrower may have multiple lead records)
    const allLeads = await sql`SELECT id FROM leads WHERE email = ${lead.email}`;
    const leadIds = allLeads.map(l => l.id);

    // Find the latest borrower scenario for this borrower
    const existingRows = await sql`
      SELECT id, alert_frequency, alert_days, organization_id
      FROM scenarios
      WHERE lead_id = ANY(${leadIds}) AND owner_type = 'borrower'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!existingRows.length) {
      return NextResponse.json({ error: 'No saved scenario found' }, { status: 404 });
    }
    const existingScenario = existingRows[0];
    const scenarioOrgId = existingScenario.organization_id;

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
            finalPrice: r.finalPrice || r.price || null,
            lender: r.lender || r.lenderName || null,
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

    // Update the scenario with new inputs via DAL.
    // Per UAD AD-10a (D9c Phase 3a, 2026-04-30): pricing-cycle fields
    // (last_priced_at) live on rate_alerts now — updated below.
    await updateScenario(existingScenario.id, scenarioOrgId, {
      loan_purpose: scenarioData.purpose || null,
      loan_type: scenarioData.loanType || null,
      loan_amount: scenarioData.loanAmount || null,
      property_value: scenarioData.propertyValue || null,
      ltv: scenarioData.ltv || null,
      fico: scenarioData.fico || null,
      state: scenarioData.state || null,
      county: scenarioData.county || null,
      term: scenarioData.term || null,
      product_type: scenarioData.productType || null,
      property_type: scenarioData.propertyType || null,
      current_rate: scenarioData.currentRate || null,
      current_balance: scenarioData.currentPayoff || scenarioData.currentBalance || null,
    });

    // Replace rates if we have fresh pricing
    if (pricingData && pricingData.length > 0) {
      await replaceScenarioRates(existingScenario.id, pricingData);

      // Touch the rate-alert subscription's last_priced_at. Backfill from
      // migration 053 guarantees a rate_alert row exists for every borrower
      // scenario; defensively no-op if the lookup misses.
      const rateAlert = await getRateAlertByScenarioId(existingScenario.id, scenarioOrgId);
      if (rateAlert) {
        await updateRateAlert(rateAlert.id, scenarioOrgId, {
          last_priced_at: new Date(),
        });
      }
    }

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
    return apiError(err, 'Update failed', 500, { scope: 'saved-scenario-update' });
  }
}
