// Site Access API — Verifies password and sets access cookie
// POST /api/site-access { password: "..." }
// Sets a 30-day cookie on success.

import { NextResponse } from 'next/server';

export async function POST(request) {
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    // No password wall active
    return NextResponse.json({ ok: true });
  }

  try {
    const { password } = await request.json();

    if (password !== sitePassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });

    // Set access cookie — 30 days, httpOnly, secure in production
    response.cookies.set('site_access', sitePassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
