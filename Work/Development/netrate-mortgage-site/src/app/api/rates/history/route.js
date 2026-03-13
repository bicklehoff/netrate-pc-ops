// Rate History API — Returns historical rate data from rate_history table
//
// GET /api/rates/history?loan_type=30yr_fixed&credit_score=760&days=90
//
// Query params:
//   loan_type    — '30yr_fixed' (default), '15yr_fixed', 'arm_5_1'
//   credit_score — '760' (maps to '760+'), '740' (maps to '740-759'), etc.
//   days         — Number of days back: 7, 30, 90 (default), 180, 365
//   period       — Alternative: 'ytd', 'all'
//
// Response: [{ date, rate, apr, change }, ...]
//
// Cache: 1-hour CDN cache, 5-min browser cache (data changes once daily)

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const CREDIT_SCORE_MAP = {
  '760': '760+',
  '740': '740-759',
  '720': '720-739',
  '700': '700-719',
  '680': '680-699',
};

const VALID_LOAN_TYPES = ['30yr_fixed', '15yr_fixed', 'arm_5_1'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const loanType = searchParams.get('loan_type') || '30yr_fixed';
    const creditScoreParam = searchParams.get('credit_score') || '760';
    const daysParam = searchParams.get('days');
    const periodParam = searchParams.get('period');

    // Validate loan type
    if (!VALID_LOAN_TYPES.includes(loanType)) {
      return NextResponse.json(
        { error: `Invalid loan_type. Must be one of: ${VALID_LOAN_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Map credit score to tier
    const creditScoreTier = CREDIT_SCORE_MAP[creditScoreParam];
    if (!creditScoreTier) {
      return NextResponse.json(
        { error: `Invalid credit_score. Must be one of: ${Object.keys(CREDIT_SCORE_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // Determine date range
    let days = 90; // default
    if (periodParam === 'ytd') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      days = Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24));
    } else if (periodParam === 'all') {
      days = 3650; // ~10 years, effectively all
    } else if (daysParam) {
      days = parseInt(daysParam, 10);
      if (isNaN(days) || days < 1 || days > 3650) {
        return NextResponse.json(
          { error: 'days must be between 1 and 3650' },
          { status: 400 }
        );
      }
    }

    // Query database
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT
        date,
        rate,
        apr,
        points,
        lender
      FROM rate_history
      WHERE loan_type = ${loanType}
        AND credit_score_tier = ${creditScoreTier}
        AND date >= CURRENT_DATE - ${days}::integer
      ORDER BY date ASC
    `;

    // Compute day-over-day change
    const result = rows.map((row, i) => {
      const prevRate = i > 0 ? parseFloat(rows[i - 1].rate) : null;
      const currentRate = parseFloat(row.rate);
      const change = prevRate !== null
        ? Math.round((currentRate - prevRate) * 1000) / 1000
        : 0;

      return {
        date: row.date instanceof Date
          ? row.date.toISOString().split('T')[0]
          : String(row.date).split('T')[0],
        rate: currentRate,
        apr: row.apr ? parseFloat(row.apr) : null,
        change,
      };
    });

    const response = NextResponse.json(result);

    // Cache headers: 1-hour CDN, 5-min browser
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, max-age=300, stale-while-revalidate=600'
    );

    return response;
  } catch (error) {
    console.error('Rate history API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate history' },
      { status: 500 }
    );
  }
}
