// API: My Rates — borrower-facing saved scenarios
// GET /api/my-rates?token=xxx
// Token-based auth (like quote viewer), no cookie session needed.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';

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

    // Fetch the LATEST saved scenario for this borrower (one email = one active scenario)
    const scenarios = await sql`
      SELECT id, scenario_data, alert_frequency, alert_days, alert_status,
             last_pricing_data, last_priced_at, last_sent_at, send_count, created_at
      FROM saved_scenarios
      WHERE lead_id = ANY(${leadIds})
      ORDER BY created_at DESC
      LIMIT 1
    `;

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
