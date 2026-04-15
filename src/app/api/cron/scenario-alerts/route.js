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
    // Find active borrower scenarios — filter for today's schedule in JS (alert_days is a text array)
    const scenarios = await sql`
      SELECT s.*, l.name AS lead_name, l.email AS lead_email,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'rate', sr.rate, 'apr', sr.apr, 'monthlyPI', sr.monthly_pi,
          'price', sr.final_price, 'lenderName', sr.lender, 'program', sr.program,
          'rebateDollars', sr.rebate_dollars, 'discountDollars', sr.discount_dollars,
          'lenderFee', sr.lender_fee
        ) ORDER BY sr.display_order), '[]'::jsonb)
         FROM scenario_rates sr WHERE sr.scenario_id = s.id
        ) AS last_pricing_data
      FROM scenarios s
      LEFT JOIN leads l ON s.lead_id = l.id
      WHERE s.alert_status = 'active' AND s.owner_type = 'borrower'
    `;

    // Filter to those scheduled for today
    const dueScenarios = scenarios.filter(s =>
      Array.isArray(s.alert_days) && s.alert_days.includes(today)
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
        const topRates = (result.results || [])
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 3)
          .map(r => ({
            rate: r.rate,
            apr: r.apr,
            monthlyPI: r.monthlyPI,
            price: r.price,
            lenderName: r.lenderName,
            rebateDollars: r.rebateDollars,
            discountDollars: r.discountDollars,
            lenderFee: r.lenderFee,
          }));

        if (!topRates.length) {
          skipped++;
          continue;
        }

        // Compute rate change from last pricing
        const prevRates = scenario.last_pricing_data;
        const bestRate = topRates[0]?.rate || null;
        const bestRatePrev = Array.isArray(prevRates) && prevRates[0]?.rate
          ? prevRates[0].rate
          : null;
        const rateChange = (bestRate != null && bestRatePrev != null)
          ? Math.round((bestRate - bestRatePrev) * 1000) / 1000
          : null;

        // Create queue entry for MLO review
        await sql`
          INSERT INTO scenario_alert_queue (scenario_id, pricing_data, previous_data, best_rate, best_rate_prev, rate_change, status)
          VALUES (${scenario.id}, ${JSON.stringify(topRates)}, ${prevRates ? JSON.stringify(prevRates) : null}, ${bestRate}, ${bestRatePrev}, ${rateChange}, 'pending')
        `;

        // Update last_priced_at on the scenario
        await sql`
          UPDATE scenarios SET last_priced_at = NOW(), updated_at = NOW() WHERE id = ${scenario.id}
        `;

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
