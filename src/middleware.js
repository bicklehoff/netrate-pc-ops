// Next.js Middleware — Route protection for portal + site-wide password wall
// Protects /portal/dashboard/* (borrower) and /portal/mlo/* (MLO) routes.
// Also blocks all public access behind a password wall (SITE_PASSWORD env var).
//
// NOTE: Borrower auth uses custom magic link + SMS flow (not NextAuth).
// MLO auth uses NextAuth JWT sessions.
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

// ─── Site-Wide Password Wall ────────────────────────────────
// Set SITE_PASSWORD in Vercel env vars to enable.
// Remove it (or set to empty) to disable the wall and go public.
function checkSitePassword(request) {
  const sitePassword = process.env.SITE_PASSWORD;

  // No password set = site is public
  if (!sitePassword) return null;

  const { pathname } = request.nextUrl;

  // Always allow these through without password:
  // - API routes (rate pipeline, webhooks, NextAuth callbacks)
  // - The password entry page itself
  // - The password verify endpoint
  // - Static assets (_next, favicon, etc.)
  // - Public compliance pages (needed for Twilio A2P campaign verification)
  if (
    pathname.startsWith('/api/') ||
    pathname === '/site-access' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname === '/contact' ||
    pathname === '/privacy' ||
    pathname === '/terms'
  ) {
    return null;
  }

  // Check for valid access cookie
  const accessCookie = request.cookies.get('site_access')?.value;
  if (accessCookie === sitePassword) {
    return null; // Authenticated
  }

  // Redirect to password page
  return NextResponse.redirect(new URL('/site-access', request.url));
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ─── Site Password Wall (check first) ──────────────────────
  const passwordRedirect = checkSitePassword(request);
  if (passwordRedirect) return passwordRedirect;

  // ─── MLO Routes: Require NextAuth session with MLO/admin role ──
  // /portal/dock is the floating mini-PWA panel — same auth model as /portal/mlo.
  if (
    (pathname.startsWith('/portal/mlo') && !pathname.startsWith('/portal/mlo/login')) ||
    pathname.startsWith('/portal/dock')
  ) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || token.userType !== 'mlo') {
      const loginUrl = new URL('/portal/mlo/login', request.url);
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ─── Borrower Dashboard: Require borrower session cookie (jose JWT) ──
  if (pathname.startsWith('/portal/dashboard')) {
    const sessionCookie = request.cookies.get('borrower_session')?.value;

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/portal/auth/login', request.url));
    }

    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
      await jwtVerify(sessionCookie, secret);
    } catch {
      // Invalid or expired token — redirect to login
      return NextResponse.redirect(new URL('/portal/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
