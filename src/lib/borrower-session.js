// Borrower Session Management
// Custom cookie-based sessions for borrowers (separate from NextAuth MLO sessions).
// Two-factor flow: magic link (email) → SMS verification (phone) → fully authenticated.
//
// Session states:
//   - No cookie: not authenticated
//   - cookie with smsVerified=false: magic link verified, needs SMS
//   - cookie with smsVerified=true: fully authenticated
//
// Uses signed, httpOnly cookies with JSON payload.
//
// Session shape post-UAD Layer-1b3: claim is `contactId`. Old `borrowerId`
// cookies from before the cutover are still accepted read-side (falls back to
// payload.borrowerId) so active sessions don't force a re-auth — but new
// sessions are written with `contactId`.

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'borrower_session';
const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET); // Reuse NextAuth secret

/**
 * Create a borrower session cookie.
 * Called after magic link verification (smsVerified=false) or after SMS verification (smsVerified=true).
 */
export async function createBorrowerSession(contactId, { smsVerified = false } = {}) {
  const token = await new SignJWT({
    contactId,
    smsVerified,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(smsVerified ? '30m' : '15m') // 30 min if fully auth'd, 15 min for SMS pending
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: smsVerified ? 30 * 60 : 15 * 60,
  });

  return token;
}

/**
 * Read and verify the borrower session from the cookie.
 * Returns { contactId, smsVerified } or null if invalid/expired.
 */
export async function getBorrowerSession() {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;

    const { payload } = await jwtVerify(cookie.value, SECRET);
    // Backward-compat: pre-1b3 cookies had `borrowerId` claim. For Case-3
    // orphan contacts the UUID was preserved (contact.id === old borrower.id)
    // so the claim is still a valid contact id.
    const contactId = payload.contactId || payload.borrowerId;
    return {
      contactId,
      smsVerified: payload.smsVerified || false,
    };
  } catch {
    return null; // Expired or tampered
  }
}

/**
 * Require a fully authenticated borrower session.
 * Returns the session or null. Use in API routes and server components.
 */
export async function requireBorrowerAuth() {
  const session = await getBorrowerSession();
  if (!session || !session.smsVerified) return null;
  return session;
}

/**
 * Clear the borrower session cookie.
 */
export async function clearBorrowerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
