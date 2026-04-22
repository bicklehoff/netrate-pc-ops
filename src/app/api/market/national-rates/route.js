/**
 * National Average Rates API
 *
 * GET  /api/market/national-rates — Get latest national avg rates (from MND scrape)
 *
 * Writes are handled by the auth-gated `/scrape` sub-route, which fetches MND,
 * parses the HTML, and UPSERTs rate_history in one pass. A prior unauthenticated
 * POST handler on this route was orphaned (zero callers) and has been removed —
 * any third party could have poisoned the national rate display.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { apiError } from '@/lib/api/safe-error';

function getSql() {
  return neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
}

// DB loan_type → MND product key mapping
const LOAN_TYPE_TO_KEY = {
  '30yr_fixed': 'conv30',
  '15yr_fixed': 'conv15',
  fha_30yr: 'fha30',
  va_30yr: 'va30',
  jumbo_30yr: 'jumbo30',
  '7_6_arm': 'arm',
};

export async function GET() {
  try {
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
    const latestDateStr = latestDate instanceof Date
      ? latestDate.toISOString().split('T')[0]
      : String(latestDate).split('T')[0];

    const latest = rows.filter(r => {
      const rowDateStr = r.date instanceof Date
        ? r.date.toISOString().split('T')[0]
        : String(r.date).split('T')[0];
      return rowDateStr === latestDateStr;
    });

    const rates = {};
    for (const row of latest) {
      const key = LOAN_TYPE_TO_KEY[row.loan_type];
      if (key) {
        rates[key] = {
          rate: parseFloat(row.rate),
          change: row.change_str ? parseFloat(row.change_str) : 0,
        };
      }
    }

    return NextResponse.json({
      rates,
      date: latestDateStr,
      source: 'mnd',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, max-age=60' },
    });
  } catch (err) {
    return apiError(err, 'National rates unavailable', 500, { scope: 'national-rates' });
  }
}
