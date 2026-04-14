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
    // Find active scenarios — filter for today's schedule in JS (alert_days is a text array)
    const scenarios = await sql`
      SELECT s.*, l.name AS lead_name, l.email AS lead_email
      FROM saved_scenarios s
      LEFT JOIN leads l ON s.lead_id = l.id
      WHERE s.alert_status = 'active'
    `;

    // Filter to those scheduled for today
    const dueScenarios = scenarios.filter(s =>
      Array.isArray(s.alert_days) && s.alert_days.includes(today)
    );

    for (const scenario of dueScenarios) {
      try {
        const sd = scenario.scenario_data;
        if (!sd || !sd.loanAmount) {
          skipped++;
          continue;
        }

        // Re-price the scenario
        const pricingInput = {
          loanAmount: sd.loanAmount,
          propertyValue: sd.propertyValue,
          loanPurpose: sd.purpose,
          loanType: sd.loanType,
          creditScore: sd.fico,
          state: sd.state,
          county: sd.county,
          term: sd.term,
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
          UPDATE saved_scenarios SET last_priced_at = NOW() WHERE id = ${scenario.id}
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
