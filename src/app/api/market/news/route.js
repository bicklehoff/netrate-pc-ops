// Market News API — Claw posts curated headlines, website renders them
//
// GET  /api/market/news          → latest headlines (public)
//   ?limit=10  (default: 10, max: 50)
//
// POST /api/market/news          → bulk upsert headlines (auth required)
//   Body: { headlines: [{ title, source, url, publishedAt }] }
//   Auth: x-api-key: CLAW_API_KEY
//
// Cache: 5-min CDN, 1-min browser

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import sql from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    const headlines = await sql`
      SELECT id, title, source, url, published_at
      FROM market_news_headlines
      ORDER BY published_at DESC
      LIMIT ${limit}
    `;

    const formatted = headlines.map(h => ({
      id: h.id,
      title: h.title,
      source: h.source,
      url: h.url,
      published_at: h.published_at instanceof Date ? h.published_at.toISOString() : h.published_at,
    }));

    const response = NextResponse.json({ headlines: formatted, count: formatted.length });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
    );
    return response;
  } catch (error) {
    console.error('Market news GET error:', error);
    // Graceful degradation: return empty instead of 500 so page renders
    return NextResponse.json({ headlines: [], count: 0, source: 'error' });
  }
}

export async function POST(request) {
  try {
    const apiKey = request.headers.get('x-api-key')
      || request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey || apiKey !== process.env.CLAW_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { headlines } = body;

    if (!Array.isArray(headlines) || headlines.length === 0) {
      return NextResponse.json({ error: 'headlines array required' }, { status: 400 });
    }

    if (headlines.length > 50) {
      return NextResponse.json({ error: 'Max 50 headlines per request' }, { status: 400 });
    }

    const results = [];
    for (const h of headlines) {
      if (!h.title || !h.source || !h.url || !h.publishedAt) {
        results.push({ title: h.title, error: 'title, source, url, publishedAt required' });
        continue;
      }

      const rows = await sql`
        INSERT INTO market_news_headlines (title, source, url, published_at, posted_by)
        VALUES (${h.title}, ${h.source}, ${h.url}, ${new Date(h.publishedAt)}, ${h.postedBy ?? 'claw'})
        ON CONFLICT (title, published_at) DO UPDATE SET
          source = EXCLUDED.source,
          url = EXCLUDED.url,
          posted_by = EXCLUDED.posted_by
        RETURNING id, title
      `;

      results.push({ id: rows[0].id, title: rows[0].title });
    }

    revalidatePath('/rate-watch');

    return NextResponse.json({ ok: true, upserted: results.length, results });
  } catch (error) {
    console.error('Market news POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
