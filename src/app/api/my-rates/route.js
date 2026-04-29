// API: My Rates — borrower-facing saved scenarios
// GET /api/my-rates?token=xxx
// Token-based auth (like quote viewer), no cookie session needed.
//
// Reads from the unified scenarios table; responds in the legacy saved-scenario
// shape (pre-unification) via scenarioToSavedShape().

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { scenarioToSavedShape } from '@/lib/rate-alerts';
import { apiError } from '@/lib/api/safe-error';
import { rateLimit } from '@/lib/api/rate-limit';

export async function GET(request) {
  const limited = await rateLimit(request, { scope: 'my-rates', limit: 30, window: '1 m' });
  if (limited) return limited;

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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find ALL leads with the same email (borrower may have saved multiple scenarios)
    const allLeads = await sql`SELECT id FROM leads WHERE email = ${lead.email}`;
    const leadIds = allLeads.map(l => l.id);

    // Fetch the LATEST borrower scenario with inlined rates and the rate-alert
    // subscription row (post-D9c Phase 3a, alert lifecycle lives on rate_alerts).
    const scenarioRows = await sql`
      SELECT s.*,
        ra.id              AS _ra_id,
        ra.alert_status    AS _ra_alert_status,
        ra.alert_frequency AS _ra_alert_frequency,
        ra.alert_days      AS _ra_alert_days,
        ra.last_priced_at  AS _ra_last_priced_at,
        ra.last_sent_at    AS _ra_last_sent_at,
        ra.send_count      AS _ra_send_count,
        ra.unsub_token     AS _ra_unsub_token,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'rate', sr.rate, 'final_price', sr.final_price,
          'rebate_dollars', sr.rebate_dollars, 'discount_dollars', sr.discount_dollars,
          'lender_fee', sr.lender_fee, 'lender', sr.lender, 'program', sr.program,
          'monthly_pi', sr.monthly_pi
        ) ORDER BY sr.display_order), '[]'::jsonb)
        FROM scenario_rates sr WHERE sr.scenario_id = s.id
        ) AS rates
      FROM scenarios s
      LEFT JOIN rate_alerts ra ON ra.scenario_id = s.id
      WHERE s.lead_id = ANY(${leadIds}) AND s.owner_type = 'borrower'
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    // Shape each scenario into the legacy saved-scenario response format.
    // Pass the rate_alert row (de-aliased) as the 2nd arg so the transform
    // reads alert lifecycle from rate_alerts, not the soft-deprecated
    // scenarios columns.
    const scenarios = scenarioRows.map((s) => {
      const rateAlert = s._ra_id
        ? {
            id: s._ra_id,
            alert_status: s._ra_alert_status,
            alert_frequency: s._ra_alert_frequency,
            alert_days: s._ra_alert_days,
            last_priced_at: s._ra_last_priced_at,
            last_sent_at: s._ra_last_sent_at,
            send_count: s._ra_send_count,
            unsub_token: s._ra_unsub_token,
          }
        : null;
      return scenarioToSavedShape({ ...s, rates: s.rates || [] }, rateAlert);
    });

    return NextResponse.json({
      name: lead.name,
      email: lead.email,
      scenarios,
    });
  } catch (err) {
    return apiError(err, 'Load failed', 500, { scope: 'my-rates' });
  }
}
