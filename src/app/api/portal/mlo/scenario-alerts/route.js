// API: MLO Scenario Alert Queue
// GET  /api/portal/mlo/scenario-alerts — list queue items with filters
// PATCH /api/portal/mlo/scenario-alerts — approve/decline queue items

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { sendEmail } from '@/lib/resend';
import { scenarioAlertTemplate } from '@/lib/email-templates/borrower';

const SITE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const q = searchParams.get('q');
    const view = searchParams.get('view');
    const searchPattern = q ? `%${q}%` : null;

    // Management view: list all saved scenarios
    if (view === 'scenarios') {
      const scenarios = await sql`
        SELECT ss.*,
          json_build_object('name', l.name, 'email', l.email, 'phone', l.phone) AS lead,
          (SELECT COUNT(*)::int FROM scenario_alert_queue WHERE scenario_id = ss.id) AS alert_queue_count
        FROM saved_scenarios ss
        LEFT JOIN leads l ON l.id = ss.lead_id
        WHERE (${searchPattern}::text IS NULL OR l.name ILIKE ${searchPattern} OR l.email ILIKE ${searchPattern})
        ORDER BY ss.created_at DESC
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
          'id', ss.id, 'scenario_data', ss.scenario_data, 'unsub_token', ss.unsub_token,
          'lead', json_build_object('id', l.id, 'name', l.name, 'email', l.email, 'phone', l.phone)
        ) AS scenario
      FROM scenario_alert_queue saq
      LEFT JOIN saved_scenarios ss ON ss.id = saq.scenario_id
      LEFT JOIN leads l ON l.id = ss.lead_id
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
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action, mloNotes } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    if (!['approve', 'decline', 'pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Handle pause/resume — these act on SavedScenario, not queue items
    if (action === 'pause' || action === 'resume') {
      await sql`
        UPDATE saved_scenarios
        SET alert_status = ${action === 'pause' ? 'paused' : 'active'}, updated_at = NOW()
        WHERE id = ANY(${ids})
      `;
      return NextResponse.json({ success: true, action, count: ids.length });
    }

    const results = { sent: 0, declined: 0, errors: [] };

    for (const id of ids) {
      try {
        const itemRows = await sql`
          SELECT saq.*,
            ss.id AS scenario_ref_id, ss.scenario_data, ss.unsub_token,
            l.id AS lead_ref_id, l.name AS lead_name, l.email AS lead_email, l.view_token AS lead_view_token
          FROM scenario_alert_queue saq
          LEFT JOIN saved_scenarios ss ON ss.id = saq.scenario_id
          LEFT JOIN leads l ON l.id = ss.lead_id
          WHERE saq.id = ${id}
          LIMIT 1
        `;
        const item = itemRows[0];

        if (!item || item.status !== 'pending') continue;

        if (action === 'decline') {
          await sql`
            UPDATE scenario_alert_queue
            SET status = 'declined', reviewed_by = ${session.user.id}, reviewed_at = NOW(), mlo_notes = ${mloNotes || null}
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
        const sd = item.scenario_data;
        const leadViewToken = item.lead_view_token || null;
        const viewLink = leadViewToken
          ? `${SITE_URL}/portal/my-rates?token=${leadViewToken}`
          : `${SITE_URL}/rates`;
        const unsubscribeLink = `${SITE_URL}/api/saved-scenario/unsubscribe?token=${item.unsub_token}`;

        const emailData = scenarioAlertTemplate({
          firstName,
          scenarioSummary: {
            purpose: sd?.purpose,
            loanAmount: sd?.loanAmount,
            fico: sd?.fico,
            ltv: sd?.ltv,
            state: sd?.state,
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
          SET status = 'sent', reviewed_by = ${session.user.id}, reviewed_at = NOW(),
            sent_at = NOW(), mlo_notes = ${mloNotes || null}
          WHERE id = ${id}
        `;

        // Update saved scenario with latest pricing
        await sql`
          UPDATE saved_scenarios
          SET last_sent_at = NOW(), last_pricing_data = ${JSON.stringify(item.pricing_data)}::jsonb,
            send_count = send_count + 1, updated_at = NOW()
          WHERE id = ${item.scenario_ref_id}
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
