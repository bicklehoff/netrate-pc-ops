// API: My Rates — borrower-facing saved scenarios
// GET /api/my-rates?token=xxx
// Token-based auth (like quote viewer), no cookie session needed.
//
// Reads from the unified scenarios table; responds in legacy saved_scenarios shape
// via scenarioToSavedShape().

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { scenarioToSavedShape } from '@/lib/scenarios/transform';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 });
  }

  try {
    // Find the lead by view_token
    const leads = await sql`SELECT id::text, email, name FROM leads WHERE view_token::text = ${token} LIMIT 1`;
    const lead = leads?.[0] || null;

    if (!lead || !lead.email) {
      return NextResponse.json({ error: `Invalid token (found ${leads?.length || 0} leads)` }, { status: 401 });
    }

    // Find ALL leads with the same email (borrower may have saved multiple scenarios)
    const allLeads = await sql`SELECT id FROM leads WHERE email = ${lead.email}`;
    const leadIds = allLeads.map(l => l.id);

    // Fetch the LATEST borrower scenario with inlined rates
    const scenarioRows = await sql`
      SELECT s.*,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'rate', sr.rate, 'final_price', sr.final_price,
          'rebate_dollars', sr.rebate_dollars, 'discount_dollars', sr.discount_dollars,
          'lender_fee', sr.lender_fee, 'lender', sr.lender, 'program', sr.program,
          'monthly_pi', sr.monthly_pi
        ) ORDER BY sr.display_order), '[]'::jsonb)
        FROM scenario_rates sr WHERE sr.scenario_id = s.id
        ) AS rates
      FROM scenarios s
      WHERE s.lead_id = ANY(${leadIds}) AND s.owner_type = 'borrower'
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    // Shape each scenario into legacy saved_scenarios format
    const scenarios = scenarioRows.map(s => scenarioToSavedShape({ ...s, rates: s.rates || [] }));

    return NextResponse.json({
      name: lead.name,
      email: lead.email,
      scenarios,
    });
  } catch (err) {
    console.error('My Rates GET error:', err.message, err.stack);
    return NextResponse.json({ error: `Load failed: ${err.message}` }, { status: 500 });
  }
}
