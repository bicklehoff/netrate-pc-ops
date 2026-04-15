// API: MLO Scenario Alert Queue
// GET  /api/portal/mlo/scenario-alerts — list queue items with filters
// PATCH /api/portal/mlo/scenario-alerts — approve/decline queue items
//
// Queue items live in scenario_alert_queue (operational); each references a
// scenarios row (owner_type='borrower') via scenario_id.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendEmail } from '@/lib/resend';
import { scenarioAlertTemplate } from '@/lib/email-templates/borrower';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

const SITE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

export async function GET(request) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const q = searchParams.get('q');
    const view = searchParams.get('view');
    const searchPattern = q ? `%${q}%` : null;

    // Management view: list all borrower-saved scenarios
    if (view === 'scenarios') {
      const scenarios = await sql`
        SELECT s.*,
          jsonb_build_object(
            'purpose', s.loan_purpose, 'loanAmount', s.loan_amount,
            'propertyValue', s.property_value, 'loanType', s.loan_type,
            'fico', s.fico, 'ltv', s.ltv, 'state', s.state, 'county', s.county,
            'term', s.term, 'productType', s.product_type,
            'currentRate', s.current_rate, 'currentPayoff', s.current_balance
          ) AS scenario_data,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'rate', sr.rate, 'price', sr.final_price,
            'rebateDollars', sr.rebate_dollars, 'discountDollars', sr.discount_dollars,
            'lenderFee', sr.lender_fee, 'lenderName', sr.lender,
            'program', sr.program, 'monthlyPI', sr.monthly_pi
          ) ORDER BY sr.display_order), '[]'::jsonb)
           FROM scenario_rates sr WHERE sr.scenario_id = s.id
          ) AS last_pricing_data,
          json_build_object('name', l.name, 'email', l.email, 'phone', l.phone) AS lead,
          (SELECT COUNT(*)::int FROM scenario_alert_queue WHERE scenario_id = s.id) AS alert_queue_count
        FROM scenarios s
        LEFT JOIN leads l ON l.id = s.lead_id
        WHERE s.organization_id = ${orgId} AND s.owner_type = 'borrower'
          AND (${searchPattern}::text IS NULL OR l.name ILIKE ${searchPattern} OR l.email ILIKE ${searchPattern})
        ORDER BY s.created_at DESC
      `;

      return NextResponse.json({
        scenarios: scenarios.map(s => ({
          ...s,
          _count: { alertQueue: s.alert_queue_count },
        })),
      });
    }

    // Default view: alert queue items
    const effectiveStatus = (statusFilter && statusFilter !== 'all') ? statusFilter : null;

    const queueItems = await sql`
      SELECT saq.*,
        json_build_object(
          'id', s.id,
          'scenario_data', jsonb_build_object(
            'purpose', s.loan_purpose, 'loanAmount', s.loan_amount,
            'propertyValue', s.property_value, 'loanType', s.loan_type,
            'fico', s.fico, 'ltv', s.ltv, 'state', s.state, 'county', s.county,
            'term', s.term
          ),
          'unsub_token', s.unsub_token,
          'lead', json_build_object('id', l.id, 'name', l.name, 'email', l.email, 'phone', l.phone)
        ) AS scenario
      FROM scenario_alert_queue saq
      LEFT JOIN scenarios s ON s.id = saq.scenario_id AND s.owner_type = 'borrower'
      LEFT JOIN leads l ON l.id = s.lead_id
      WHERE (${effectiveStatus}::text IS NULL OR saq.status = ${effectiveStatus})
        AND (${searchPattern}::text IS NULL OR l.name ILIKE ${searchPattern} OR l.email ILIKE ${searchPattern})
      ORDER BY saq.created_at DESC
    `;

    return NextResponse.json({ items: queueItems });
  } catch (err) {
    console.error('Scenario alerts GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { ids, action, mloNotes } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    if (!['approve', 'decline', 'pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Handle pause/resume — these act on the borrower scenario, not queue items
    if (action === 'pause' || action === 'resume') {
      await sql`
        UPDATE scenarios
        SET alert_status = ${action === 'pause' ? 'paused' : 'active'}, updated_at = NOW()
        WHERE id = ANY(${ids}) AND owner_type = 'borrower' AND organization_id = ${orgId}
      `;
      return NextResponse.json({ success: true, action, count: ids.length });
    }

    const results = { sent: 0, declined: 0, errors: [] };

    for (const id of ids) {
      try {
        const itemRows = await sql`
          SELECT saq.*,
            s.id AS scenario_ref_id, s.unsub_token,
            s.loan_purpose, s.loan_amount, s.property_value, s.loan_type,
            s.fico, s.ltv, s.state, s.county, s.term,
            l.id AS lead_ref_id, l.name AS lead_name, l.email AS lead_email, l.view_token AS lead_view_token
          FROM scenario_alert_queue saq
          LEFT JOIN scenarios s ON s.id = saq.scenario_id AND s.owner_type = 'borrower'
          LEFT JOIN leads l ON l.id = s.lead_id
          WHERE saq.id = ${id}
          LIMIT 1
        `;
        const item = itemRows[0];

        if (!item || item.status !== 'pending') continue;

        if (action === 'decline') {
          await sql`
            UPDATE scenario_alert_queue
            SET status = 'declined', reviewed_by = ${mloId}, reviewed_at = NOW(), mlo_notes = ${mloNotes || null}
            WHERE id = ${id}
          `;
          results.declined++;
          continue;
        }

        // Approve: send email then update records
        if (!item.lead_email) {
          results.errors.push(`${id}: no borrower email`);
          continue;
        }

        const firstName = item.lead_name?.split(' ')[0] || 'there';
        const leadViewToken = item.lead_view_token || null;
        const viewLink = leadViewToken
          ? `${SITE_URL}/portal/my-rates?token=${leadViewToken}`
          : `${SITE_URL}/rates`;
        const unsubscribeLink = `${SITE_URL}/api/saved-scenario/unsubscribe?token=${item.unsub_token}`;

        const emailData = scenarioAlertTemplate({
          firstName,
          scenarioSummary: {
            purpose: item.loan_purpose,
            loanAmount: item.loan_amount,
            fico: item.fico,
            ltv: item.ltv,
            state: item.state,
          },
          currentRates: item.pricing_data || [],
          previousRates: item.previous_data || [],
          viewLink,
          unsubscribeLink,
          mloNotes: mloNotes || null,
        });

        await sendEmail({
          to: item.lead_email,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        });

        // Update queue item
        await sql`
          UPDATE scenario_alert_queue
          SET status = 'sent', reviewed_by = ${mloId}, reviewed_at = NOW(),
            sent_at = NOW(), mlo_notes = ${mloNotes || null}
          WHERE id = ${id}
        `;

        // Update scenario — bump last_sent_at, send_count (rates already tracked per-send)
        await sql`
          UPDATE scenarios
          SET last_sent_at = NOW(),
              send_count = COALESCE(send_count, 0) + 1,
              updated_at = NOW()
          WHERE id = ${item.scenario_ref_id} AND organization_id = ${orgId}
        `;

        results.sent++;
      } catch (err) {
        results.errors.push(`${id}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    console.error('Scenario alerts PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
