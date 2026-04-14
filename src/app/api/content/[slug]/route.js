/**
 * Content Publishing API — Single Page CRUD
 *
 * GET    /api/content/:slug — get full page (public for published, auth for drafts)
 * PUT    /api/content/:slug — update page fields (auth required)
 * DELETE /api/content/:slug — delete page (auth required)
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import sql from '@/lib/db';

function isAuthed(request) {
  const apiKey = request.headers.get('x-api-key')
    || request.headers.get('authorization')?.replace('Bearer ', '');
  return apiKey && apiKey === process.env.CLAW_API_KEY;
}

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const authed = isAuthed(request);

    let rows;
    if (authed) {
      // Authed users can see drafts too
      rows = await sql`SELECT * FROM content_pages WHERE slug = ${slug} LIMIT 1`;
    } else {
      rows = await sql`SELECT * FROM content_pages WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const response = NextResponse.json({ page: rows[0] });
    if (!authed) {
      response.headers.set('Cache-Control', 'public, s-maxage=300, max-age=60, stale-while-revalidate=120');
    }
    return response;
  } catch (error) {
    console.error('Content GET slug error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    if (!isAuthed(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();

    // Check page exists
    const existing = await sql`SELECT slug FROM content_pages WHERE slug = ${slug} LIMIT 1`;
    if (!existing.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Build SET clauses for provided fields only
    const updates = {};
    const allowed = ['title', 'metaTitle', 'metaDescription', 'body', 'category', 'status', 'author'];
    const dbMap = {
      title: 'title',
      metaTitle: 'meta_title',
      metaDescription: 'meta_description',
      body: 'body',
      category: 'category',
      status: 'status',
      author: 'author',
    };

    for (const field of allowed) {
      if (body[field] !== undefined) updates[dbMap[field]] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Build dynamic UPDATE with raw SQL
    // Since neon tagged templates don't support dynamic column names easily,
    // rebuild the full row with COALESCE for unchanged fields
    const rows = await sql`
      UPDATE content_pages SET
        title            = COALESCE(${updates.title ?? null}, title),
        meta_title       = COALESCE(${updates.meta_title ?? null}, meta_title),
        meta_description = COALESCE(${updates.meta_description ?? null}, meta_description),
        body             = COALESCE(${updates.body ?? null}, body),
        category         = COALESCE(${updates.category ?? null}, category),
        status           = COALESCE(${updates.status ?? null}, status),
        author           = COALESCE(${updates.author ?? null}, author),
        published_at     = CASE
          WHEN COALESCE(${updates.status ?? null}, status) = 'published' AND published_at IS NULL THEN NOW()
          WHEN COALESCE(${updates.status ?? null}, status) = 'draft' THEN NULL
          ELSE published_at
        END,
        updated_at       = NOW()
      WHERE slug = ${slug}
      RETURNING slug, status, updated_at
    `;

    revalidatePath(`/${slug}`);
    revalidatePath('/sitemap.xml');

    return NextResponse.json({ ok: true, slug: rows[0].slug, status: rows[0].status });
  } catch (error) {
    console.error('Content PUT error:', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!isAuthed(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;

    const rows = await sql`DELETE FROM content_pages WHERE slug = ${slug} RETURNING slug`;

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    revalidatePath(`/${slug}`);
    revalidatePath('/sitemap.xml');

    return NextResponse.json({ ok: true, deleted: slug });
  } catch (error) {
    console.error('Content DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
  }
}
