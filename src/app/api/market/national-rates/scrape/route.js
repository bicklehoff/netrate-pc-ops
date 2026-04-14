/**
 * MND Rate Scraper
 * GET /api/market/national-rates/scrape
 *
 * Scrapes current mortgage rates from Mortgage News Daily,
 * stores in rate_history table, returns the rates.
 *
 * Protected by CLAW_API_KEY or internal scheduled task auth.
 * MND updates weekdays ~4 PM EST.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const MND_URL = 'https://www.mortgagenewsdaily.com/mortgage-rates';

// Product label → our key mapping
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
    // Find the product label, then grab the next percentage
    const labelMatch = html.match(prod.pattern);
    if (!labelMatch) continue;

    // Get text after the label (next ~200 chars) to find the rate
    const afterLabel = html.substring(labelMatch.index, labelMatch.index + 300);

    // Match rate: first percentage pattern after label
    const rateMatch = afterLabel.match(/(\d{1,2}\.\d{2})%/);
    if (!rateMatch) continue;

    const rate = parseFloat(rateMatch[1]);

    // Match change: signed decimal like +0.02 or -0.05
    const changeMatch = afterLabel.match(/([+-]\d\.\d{2})/);
    const change = changeMatch ? parseFloat(changeMatch[1]) : 0;

    rates[prod.key] = { rate, change, loanType: prod.loanType, term: prod.term };
  }

  return rates;
}

export async function GET(request) {
  // Auth check — scheduled task or API key
  const authKey = request.headers.get('x-api-key') || request.headers.get('x-tracker-api-key');
  const url = new URL(request.url);
  const taskAuth = url.searchParams.get('key');

  if (authKey !== process.env.CLAW_API_KEY && taskAuth !== process.env.CLAW_API_KEY) {
    // Allow unauthenticated in dev, require auth in prod
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MND_SCRAPE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Fetch MND page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(MND_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetRate Mortgage Rate Watch)',
        'Accept': 'text/html',
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

    // Store in database
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

    // Format response
    const result = {};
    for (const [key, data] of Object.entries(rates)) {
      result[key] = { rate: data.rate, change: data.change };
    }

    return NextResponse.json({
      ok: true,
      date: today,
      rates: result,
      inserted,
      updated,
      total: inserted + updated,
    });
  } catch (error) {
    console.error('MND scrape error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
