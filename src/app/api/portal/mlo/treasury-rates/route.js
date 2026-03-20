// API: Treasury CMT Rates
// GET /api/portal/mlo/treasury-rates
// Fetches latest 1-year and 10-year CMT rates from Treasury.gov XML feed.
// Caches for 1 hour.

import { NextResponse } from 'next/server';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // Treasury daily yield curve XML feed
    const year = new Date().getFullYear();
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/${year}?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch Treasury data' }, { status: 502 });
    }

    const csv = await res.text();
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json({ error: 'No data' }, { status: 502 });
    }

    // Parse headers to find column indices
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const idx1y = headers.findIndex(h => h === '1 Yr');
    const idx10y = headers.findIndex(h => h === '10 Yr');
    const idxDate = headers.findIndex(h => h === 'Date');

    if (idx1y === -1 || idx10y === -1) {
      return NextResponse.json({ error: 'Column headers not found' }, { status: 502 });
    }

    // Get last (most recent) row
    const lastRow = lines[lines.length - 1].split(',').map(v => v.trim().replace(/"/g, ''));

    const data = {
      date: idxDate >= 0 ? lastRow[idxDate] : null,
      oneYear: parseFloat(lastRow[idx1y]) || null,
      tenYear: parseFloat(lastRow[idx10y]) || null,
    };

    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error('Treasury rates error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
