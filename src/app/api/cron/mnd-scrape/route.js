/**
 * Vercel Cron Job — Daily MND Rate Scrape
 * Runs weekdays at 4:15pm EST (21:15 UTC) via vercel.json schedule.
 *
 * Vercel sends: Authorization: Bearer {CRON_SECRET}
 * Protected so only Vercel's scheduler (or manual trigger with key) can call it.
 *
 * Internally calls the MND scrape logic and stores results in rate_history
 * (source='mnd', credit_score_tier='national') for use by Rate Watch page.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const MND_URL = 'https://www.mortgagenewsdaily.com/mortgage-rates';

const PRODUCT_MAP = [
  { pattern: /30\s*Yr\.?\s*Fixed/i, key: 'conv30', loanType: '30yr_fixed', term: 360 },
  { pattern: /15\s*Yr\.?\s*Fixed/i, key: 'conv15', loanType: '15yr_fixed', term: 180 },
  { pattern: /30\s*Yr\.?\s*FHA/i, key: 'fha30', loanType: 'fha_30yr', term: 360 },
  { pattern: /30\s*Yr\.?\s*VA/i, key: 'va30', loanType: 'va_30yr', term: 360 },
  { pattern: /30\s*Yr\.?\s*Jumbo/i, key: 'jumbo30', loanType: 'jumbo_30yr', term: 360 },
];

function parseRatesFromHtml(html) {
  const rates = {};
  for (const prod of PRODUCT_MAP) {
    const labelMatch = html.match(prod.pattern);
    if (!labelMatch) continue;
    const afterLabel = html.substring(labelMatch.index, labelMatch.index + 300);
    const rateMatch = afterLabel.match(/(\d{1,2}\.\d{2})%/);
    if (!rateMatch) continue;
    const rate = parseFloat(rateMatch[1]);
    const changeMatch = afterLabel.match(/([+-]\d\.\d{2})/);
    const change = changeMatch ? parseFloat(changeMatch[1]) : 0;
    rates[prod.key] = { rate, change, loanType: prod.loanType, term: prod.term };
  }
  return rates;
}

export async function GET(request) {
  // Auth: Vercel cron sends Authorization: Bearer {CRON_SECRET}
  // Also accept CLAW_API_KEY for manual triggers
  const authHeader = request.headers.get('authorization') || '';
  const apiKey = request.headers.get('x-api-key') || '';
  const urlKey = new URL(request.url).searchParams.get('key') || '';

  const cronSecret = process.env.CRON_SECRET;
  const clawKey = process.env.CLAW_API_KEY;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (clawKey && (apiKey === clawKey || urlKey === clawKey));

  if (!authorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(MND_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetRate Mortgage Rate Watch)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `MND returned ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    const rates = parseRatesFromHtml(html);

    if (Object.keys(rates).length === 0) {
      return NextResponse.json({ error: 'No rates parsed from MND page' }, { status: 502 });
    }

    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;
    let updated = 0;

    for (const [, data] of Object.entries(rates)) {
      const existing = await sql`
        SELECT id FROM rate_history
        WHERE date = ${today}
          AND loan_type = ${data.loanType}
          AND credit_score_tier = 'national'
          AND source = 'mnd'
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE rate_history
          SET rate = ${data.rate},
              lender = ${String(data.change)}
          WHERE id = ${existing[0].id}
        `;
        updated++;
      } else {
        await sql`
          INSERT INTO rate_history (date, loan_type, term, credit_score_tier, rate, source, lender, loan_purpose)
          VALUES (${today}, ${data.loanType}, ${data.term}, 'national', ${data.rate}, 'mnd', ${String(data.change)}, 'purchase')
        `;
        inserted++;
      }
    }

    const result = {};
    for (const [key, data] of Object.entries(rates)) {
      result[key] = { rate: data.rate, change: data.change };
    }

    console.log(`[cron/mnd-scrape] ${today}: inserted=${inserted} updated=${updated}`, result);

    return NextResponse.json({ ok: true, date: today, rates: result, inserted, updated });
  } catch (error) {
    console.error('[cron/mnd-scrape] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
