/**
 * Content Publishing API — List & Create/Upsert
 *
 * GET  /api/content          — list published pages (optional ?category= filter)
 * POST /api/content          — create or upsert a content page by slug (auth required)
 *
 * Auth: CLAW_API_KEY header (same as /api/market/summary).
 * DB:   Raw SQL via @neondatabase/serverless.
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import sql from '@/lib/db';

function cached200(data) {
  const response = NextResponse.json(data);
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
  );
  return response;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

    let rows;
    if (category) {
      rows = await sql`
        SELECT slug, title, meta_title, meta_description, category, status, author, published_at, updated_at
        FROM content_pages
        WHERE status = 'published' AND category = ${category}
        ORDER BY published_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT slug, title, meta_title, meta_description, category, status, author, published_at, updated_at
        FROM content_pages
        WHERE status = 'published'
        ORDER BY published_at DESC
        LIMIT ${limit}
      `;
    }

    return cached200({ pages: rows, count: rows.length });
  } catch (error) {
    console.error('Content GET error:', error);
    return NextResponse.json({ error: 'Internal error', detail: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Auth: CLAW_API_KEY header
    const apiKey = request.headers.get('x-api-key')
      || request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey || apiKey !== process.env.CLAW_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, title, metaTitle, metaDescription, body: content, category, status, author } = body;

    // Validate required fields
    if (!slug || !title || !metaDescription || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, title, metaDescription, body' },
        { status: 400 }
      );
    }

    // Sanitize slug — lowercase, alphanumeric + hyphens only
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }

    const pageStatus = status || 'published';
    const pageAuthor = author || 'NetRate Mortgage';
    const publishedAt = pageStatus === 'published' ? new Date() : null;

    const rows = await sql`
      INSERT INTO content_pages (slug, title, meta_title, meta_description, body, category, status, author, published_at, updated_at)
      VALUES (${cleanSlug}, ${title}, ${metaTitle || title}, ${metaDescription}, ${content}, ${category || null}, ${pageStatus}, ${pageAuthor}, ${publishedAt}, ${new Date()})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description,
        body = EXCLUDED.body,
        category = COALESCE(EXCLUDED.category, content_pages.category),
        status = EXCLUDED.status,
        author = EXCLUDED.author,
        published_at = CASE
          WHEN EXCLUDED.status = 'published' AND content_pages.published_at IS NULL THEN NOW()
          WHEN EXCLUDED.status = 'published' THEN content_pages.published_at
          ELSE NULL
        END,
        updated_at = NOW()
      RETURNING slug, status, updated_at
    `;

    // Bust caches
    revalidatePath(`/${cleanSlug}`);
    revalidatePath('/sitemap.xml');

    return NextResponse.json({ ok: true, slug: rows[0].slug, status: rows[0].status });
  } catch (error) {
    console.error('Content POST error:', error);
    return NextResponse.json({ error: 'Failed to save content', detail: error.message }, { status: 500 });
  }
}
