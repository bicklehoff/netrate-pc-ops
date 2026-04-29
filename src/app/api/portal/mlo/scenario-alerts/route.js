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
import { updateRateAlert } from '@/lib/rate-alerts';

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

    // Management view: list all borrower-saved scenarios.
    // Per UAD AD-10a (D9c Phase 3c): subscription lifecycle lives on
    // rate_alerts. JOIN it and override the scenario row's stale
    // alert_* + last_*/send_count + unsub_token fields with the
    // rate_alert values for response.
    if (view === 'scenarios') {
      const scenarios = await sql`
        SELECT s.*,
          ra.alert_status    AS ra_alert_status,
          ra.alert_frequency AS ra_alert_frequency,
          ra.alert_days      AS ra_alert_days,
          ra.last_priced_at  AS ra_last_priced_at,
          ra.last_sent_at    AS ra_last_sent_at,
          ra.send_count      AS ra_send_count,
          ra.unsub_token     AS ra_unsub_token,
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
        LEFT JOIN rate_alerts ra ON ra.scenario_id = s.id
        LEFT JOIN leads l ON l.id = s.lead_id
        WHERE s.organization_id = ${orgId} AND s.owner_type = 'borrower'
          AND (${searchPattern}::text IS NULL OR l.name ILIKE ${searchPattern} OR l.email ILIKE ${searchPattern})
        ORDER BY s.created_at DESC
      `;

      return NextResponse.json({
        scenarios: scenarios.map((s) => ({
          ...s,
          alert_status: s.ra_alert_status ?? s.alert_status,
          alert_frequency: s.ra_alert_frequency ?? s.alert_frequency,
          alert_days: s.ra_alert_days ?? s.alert_days,
          last_priced_at: s.ra_last_priced_at ?? s.last_priced_at,
          last_sent_at: s.ra_last_sent_at ?? s.last_sent_at,
          send_count: s.ra_send_count ?? s.send_count,
          unsub_token: s.ra_unsub_token ?? s.unsub_token,
          _count: { alertQueue: s.alert_queue_count },
        })),
      });
    }

    // Default view: alert queue items
    const effectiveStatus = (statusFilter && statusFilter !== 'all') ? statusFilter : null;

    // Scope enforcement: queue items are org-scoped via their parent scenario.
    // INNER JOIN + organization_id filter prevents cross-org row leakage — an
    // MLO in Org A must never see Org B's queue items (which would include
    // joined borrower PII from the leads table).
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
          'unsub_token', COALESCE(ra.unsub_token, s.unsub_token),
          'lead', json_build_object('id', l.id, 'name', l.name, 'email', l.email, 'phone', l.phone)
        ) AS scenario
      FROM scenario_alert_queue saq
      INNER JOIN scenarios s
        ON s.id = saq.scenario_id
        AND s.owner_type = 'borrower'
        AND s.organization_id = ${orgId}
      LEFT JOIN rate_alerts ra ON ra.scenario_id = s.id
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

    // Handle pause/resume — write to the rate_alert subscription (post-3a).
    // The ids are scenario ids (borrower management view); update rate_alerts
    // by scenario_id within this org. Backfill from migration 053 guarantees
    // a rate_alert row per borrower scenario.
    if (action === 'pause' || action === 'resume') {
      const newStatus = action === 'pause' ? 'paused' : 'active';
      await sql`
        UPDATE rate_alerts
        SET alert_status = ${newStatus}, updated_at = NOW()
        WHERE scenario_id = ANY(${ids}) AND organization_id = ${orgId}
      `;
      return NextResponse.json({ success: true, action, count: ids.length });
    }

    const results = { sent: 0, declined: 0, errors: [] };

    for (const id of ids) {
      try {
        // Scope enforcement: INNER JOIN with org_id filter ensures a queue
        // item belonging to another org returns zero rows. The subsequent
        // `if (!item)` check then skips it, preventing cross-org approve/decline
        // from mutating another org's queue items or triggering their emails.
        const itemRows = await sql`
          SELECT saq.*,
            s.id AS scenario_ref_id,
            COALESCE(ra.unsub_token, s.unsub_token) AS unsub_token,
            ra.id AS rate_alert_ref_id,
            ra.send_count AS ra_send_count,
            s.loan_purpose, s.loan_amount, s.property_value, s.loan_type,
            s.fico, s.ltv, s.state, s.county, s.term,
            l.id AS lead_ref_id, l.name AS lead_name, l.email AS lead_email, l.view_token AS lead_view_token
          FROM scenario_alert_queue saq
          INNER JOIN scenarios s
            ON s.id = saq.scenario_id
            AND s.owner_type = 'borrower'
            AND s.organization_id = ${orgId}
          LEFT JOIN rate_alerts ra ON ra.scenario_id = s.id
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

        // Bump last_sent_at + send_count on the rate_alert subscription
        // (post-3a path). Defensive null-check in case a future scenario
        // somehow lacks a rate_alert row.
        if (item.rate_alert_ref_id) {
          await updateRateAlert(item.rate_alert_ref_id, orgId, {
            last_sent_at: new Date(),
            send_count: (item.ra_send_count || 0) + 1,
          });
        }

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
