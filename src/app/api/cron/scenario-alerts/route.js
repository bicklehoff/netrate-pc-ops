/**
 * Vercel Cron Job — Scenario Rate Alerts
 * Runs weekdays at 8:00am MT (13:00 UTC) via vercel.json schedule.
 *
 * Re-prices all active saved scenarios where today matches their alert schedule.
 * Creates scenario_alert_queue entries with status "pending" for MLO review.
 * Does NOT send emails — MLO approves from the portal before anything goes out.
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { updateRateAlert } from '@/lib/rate-alerts';

function getTodayDay() {
  // Get today's day abbreviation in Mountain time
  const now = new Date();
  const mt = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'America/Denver',
  }).format(now);
  return mt.toLowerCase(); // "mon", "tue", etc.
}

export async function GET(request) {
  // Auth: Vercel cron (Bearer) or CLAW_API_KEY
  const authHeader = request.headers.get('authorization') || '';
  const apiKey = request.headers.get('x-api-key') || '';
  // REMOVED: URL query param key acceptance (leaks in server logs)

  const cronSecret = process.env.CRON_SECRET;
  const clawKey = process.env.CLAW_API_KEY;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (clawKey && apiKey === clawKey);

  if (!authorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = getTodayDay();
  const errors = [];
  let queued = 0;
  let skipped = 0;

  try {
    // Per UAD AD-10a (D9c Phase 3c, 2026-04-30): subscription lifecycle
    // (alert_status, alert_days) lives on rate_alerts now. Drive the cron
    // off rate_alerts as primary, JOIN scenarios for the pricing inputs.
    const scenarios = await sql`
      SELECT
        ra.id            AS rate_alert_id,
        ra.alert_days    AS ra_alert_days,
        s.*,
        l.name           AS lead_name,
        l.email          AS lead_email,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'rate', sr.rate, 'apr', sr.apr, 'monthlyPI', sr.monthly_pi,
          'price', sr.final_price, 'lenderName', sr.lender, 'program', sr.program,
          'rebateDollars', sr.rebate_dollars, 'discountDollars', sr.discount_dollars,
          'lenderFee', sr.lender_fee
        ) ORDER BY sr.display_order), '[]'::jsonb)
         FROM scenario_rates sr WHERE sr.scenario_id = s.id
        ) AS last_pricing_data
      FROM rate_alerts ra
      INNER JOIN scenarios s ON s.id = ra.scenario_id
      LEFT JOIN leads l ON s.lead_id = l.id
      WHERE ra.alert_status = 'active' AND s.owner_type = 'borrower'
    `;

    // Filter to those scheduled for today (alert_days lives on rate_alerts now)
    const dueScenarios = scenarios.filter(s =>
      Array.isArray(s.ra_alert_days) && s.ra_alert_days.includes(today)
    );

    for (const scenario of dueScenarios) {
      try {
        const loanAmt = Number(scenario.loan_amount);
        if (!loanAmt) {
          skipped++;
          continue;
        }

        // Re-price the scenario (read from normalized columns)
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

        // Par-anchored ladder — same rule as my-rates/reprice. Row 0 is the
        // par rate (borrower's actual today's rate). Rows 1-2 are the next
        // two at-or-above-par by rate. Change-detection anchors on par so
        // alerts fire on real rate movement, not on discount-heavy rows
        // shifting between lenders.
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
        const seen = new Set();
        const topRates = [];
        for (const r of sourceLadder) {
          const key = `${r.rate}:${r.finalPrice}:${r.lender}:${r.program}`;
          if (seen.has(key)) continue;
          seen.add(key);
          topRates.push({
            rate: r.rate,
            apr: r.apr,
            monthlyPI: r.monthlyPI,
            price: r.price,
            lenderName: r.lenderName,
            rebateDollars: r.rebateDollars,
            discountDollars: r.discountDollars,
            lenderFee: r.lenderFee,
            isPar: r === parRow,
          });
          if (topRates.length >= 3) break;
        }

        if (!topRates.length) {
          skipped++;
          continue;
        }

        // Compute rate change from last pricing — anchored on par rate
        // (topRates[0] is now par by construction above). Stable anchor
        // means alerts fire on actual rate moves, not on the cheapest-
        // discount-row jitter we had before.
        const prevRates = scenario.last_pricing_data;
        const bestRate = topRates[0]?.rate || null;
        const bestRatePrev = Array.isArray(prevRates) && prevRates[0]?.rate
          ? prevRates[0].rate
          : null;
        const rateChange = (bestRate != null && bestRatePrev != null)
          ? Math.round((bestRate - bestRatePrev) * 1000) / 1000
          : null;

        // Create queue entry for MLO review. Per migration 053,
        // scenario_alert_queue.rate_alert_id is NOT NULL — populate it.
        // scenario_id is kept during the transition window and dropped in
        // Phase 4 along with the scenarios.* lifecycle columns.
        await sql`
          INSERT INTO scenario_alert_queue (scenario_id, rate_alert_id, pricing_data, previous_data, best_rate, best_rate_prev, rate_change, status)
          VALUES (${scenario.id}, ${scenario.rate_alert_id}, ${JSON.stringify(topRates)}, ${prevRates ? JSON.stringify(prevRates) : null}, ${bestRate}, ${bestRatePrev}, ${rateChange}, 'pending')
        `;

        // Bump last_priced_at on the rate_alert subscription (post-3a path).
        await updateRateAlert(scenario.rate_alert_id, scenario.organization_id, {
          last_priced_at: new Date(),
        });

        queued++;
      } catch (err) {
        errors.push(`Scenario ${scenario.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      date: new Date().toISOString().split('T')[0],
      day: today,
      totalActive: scenarios.length,
      dueToday: dueScenarios.length,
      queued,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Scenario alerts cron error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
