/**
 * National Average Rates API
 *
 * GET  /api/market/national-rates — Get latest national avg rates (from MND scrape)
 * POST /api/market/national-rates — Store scraped MND rates (called by scheduled task)
 *
 * Stores in rate_history table with source='mnd', credit_score_tier='national'.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function getSql() {
  return neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
}

// MND product keys → DB loan_type mapping
const PRODUCT_MAP = {
  conv30: { loanType: '30yr_fixed', term: 360 },
  conv15: { loanType: '15yr_fixed', term: 180 },
  fha30: { loanType: 'fha_30yr', term: 360 },
  va30: { loanType: 'va_30yr', term: 360 },
  jumbo30: { loanType: 'jumbo_30yr', term: 360 },
  arm: { loanType: '7_6_arm', term: 360 },
};

export async function GET() {
  try {
    // Get the most recent MND rates
    const sql = getSql();
    const rows = await sql`
      SELECT date, loan_type, rate, points, lender AS change_str
      FROM rate_history
      WHERE source = 'mnd' AND credit_score_tier = 'national'
      ORDER BY date DESC, id DESC
      LIMIT 10
    `;

    if (!rows.length) {
      return NextResponse.json({ rates: null, source: 'none' });
    }

    const latestDate = rows[0].date;
    const latest = rows.filter(r =>
      (r.date instanceof Date ? r.date.toISOString() : String(r.date)).startsWith(
        latestDate instanceof Date ? latestDate.toISOString().split('T')[0] : String(latestDate).split('T')[0]
      )
    );

    const rates = {};
    for (const row of latest) {
      // Reverse lookup: loanType → product key
      const entry = Object.entries(PRODUCT_MAP).find(([, v]) => v.loanType === row.loan_type);
      if (entry) {
        rates[entry[0]] = {
          rate: parseFloat(row.rate),
          change: row.change_str ? parseFloat(row.change_str) : 0,
        };
      }
    }

    const dateStr = latestDate instanceof Date
      ? latestDate.toISOString().split('T')[0]
      : String(latestDate).split('T')[0];

    return NextResponse.json({
      rates,
      date: dateStr,
      source: 'mnd',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, max-age=60' },
    });
  } catch (err) {
    console.error('National rates GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { rates, date } = body;

    if (!rates || !date) {
      return NextResponse.json({ error: 'rates and date required' }, { status: 400 });
    }

    const sql = getSql();
    let inserted = 0;
    let updated = 0;

    for (const [key, data] of Object.entries(rates)) {
      const mapping = PRODUCT_MAP[key];
      if (!mapping || !data.rate) continue;

      const existing = await sql`
        SELECT id FROM rate_history
        WHERE date = ${date}
          AND loan_type = ${mapping.loanType}
          AND credit_score_tier = 'national'
          AND source = 'mnd'
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE rate_history
          SET rate = ${data.rate},
              lender = ${String(data.change || 0)}
          WHERE id = ${existing[0].id}
        `;
        updated++;
      } else {
        await sql`
          INSERT INTO rate_history (date, loan_type, term, credit_score_tier, rate, source, lender, loan_purpose)
          VALUES (${date}, ${mapping.loanType}, ${mapping.term}, 'national', ${data.rate}, 'mnd', ${String(data.change || 0)}, 'purchase')
        `;
        inserted++;
      }
    }

    return NextResponse.json({
      ok: true,
      date,
      inserted,
      updated,
      total: inserted + updated,
    });
  } catch (err) {
    console.error('National rates POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
