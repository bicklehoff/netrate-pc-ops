// NextAuth.js Configuration
// Two providers: EmailProvider (borrower magic link) + CredentialsProvider (MLO password)
// Session stored in JWT (no DB adapter)
//
// NOTE: Full NextAuth setup requires DATABASE_URL and NEXTAUTH_SECRET.
// This file defines the configuration — the route handler is at /api/auth/[...nextauth]/route.js

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { randomBytes } from 'crypto';

export const authOptions = {
  providers: [
    // ─── MLO Login (email + password) ─────────────────────────
    CredentialsProvider({
      id: 'mlo-credentials',
      name: 'MLO Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase();

        const rows = await sql`SELECT * FROM staff WHERE email = ${email} LIMIT 1`;
        const mlo = rows[0];

        if (!mlo) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password,
          mlo.password_hash
        );

        if (!passwordValid) return null;

        return {
          id: mlo.id,
          email: mlo.email,
          name: `${mlo.first_name} ${mlo.last_name}`,
          role: mlo.role,
          userType: 'mlo',
          organizationId: mlo.organization_id,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days — MLO sessions persist across browser restarts
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, add custom fields to the JWT
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.userType = user.userType;
        token.organizationId = user.organizationId;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose custom fields in the session object
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.userType = token.userType;
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },

  pages: {
    signIn: '/portal/mlo/login', // Custom MLO login page
    error: '/portal/mlo/login',  // Redirect errors to login
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ─── Borrower Magic Link Helpers ────────────────────────────
// Borrower auth is custom (not NextAuth EmailProvider) because we need
// two-factor (magic link + SMS). These helpers manage the magic link flow.

/**
 * Generate a magic link token for a borrower.
 * Returns the token (to be included in the email link).
 */
export async function generateMagicToken(borrowerId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await sql`
    UPDATE borrowers SET magic_token = ${token}, magic_expires = ${expires}
    WHERE id = ${borrowerId}
  `;

  return token;
}

/**
 * Verify a magic link token. Returns the borrower if valid, null if not.
 */
export async function verifyMagicToken(token) {
  const rows = await sql`
    SELECT * FROM borrowers
    WHERE magic_token = ${token} AND magic_expires > NOW()
    LIMIT 1
  `;

  if (!rows.length) return null;

  const borrower = rows[0];

  // Clear the token (single-use)
  await sql`
    UPDATE borrowers SET magic_token = NULL, magic_expires = NULL
    WHERE id = ${borrower.id}
  `;

  return borrower;
}

/**
 * Generate a 6-digit SMS verification code for a borrower.
 * Stores hashed code in DB.
 */
export async function generateSmsCode(borrowerId) {
  const rows = await sql`SELECT * FROM borrowers WHERE id = ${borrowerId} LIMIT 1`;
  const borrower = rows[0];

  if (!borrower) throw new Error('Borrower not found');

  // Check lockout
  if (borrower.sms_locked_until && new Date(borrower.sms_locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(borrower.sms_locked_until).getTime() - Date.now()) / 60000
    );
    throw new Error(`Too many attempts. Try again in ${minutesLeft} minutes.`);
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = await bcrypt.hash(code, 10);

  await sql`
    UPDATE borrowers SET
      sms_code = ${hashedCode},
      sms_code_expires = ${new Date(Date.now() + 10 * 60 * 1000)},
      sms_attempts = 0,
      sms_locked_until = NULL
    WHERE id = ${borrowerId}
  `;

  return code; // Return plaintext code to send via SMS
}

/**
 * Verify an SMS code for a borrower.
 * Returns true if valid, false if not. Handles lockout after 3 failed attempts.
 */
export async function verifySmsCode(borrowerId, code) {
  const rows = await sql`SELECT * FROM borrowers WHERE id = ${borrowerId} LIMIT 1`;
  const borrower = rows[0];

  if (!borrower || !borrower.sms_code) return false;

  // Check lockout
  if (borrower.sms_locked_until && new Date(borrower.sms_locked_until) > new Date()) {
    return false;
  }

  // Check expiry
  if (!borrower.sms_code_expires || new Date(borrower.sms_code_expires) < new Date()) {
    return false;
  }

  const isValid = await bcrypt.compare(code, borrower.sms_code);

  if (!isValid) {
    const newAttempts = borrower.sms_attempts + 1;

    if (newAttempts >= 3) {
      // Lock after 3 failed attempts
      await sql`
        UPDATE borrowers SET sms_attempts = ${newAttempts}, sms_locked_until = ${new Date(Date.now() + 15 * 60 * 1000)}
        WHERE id = ${borrowerId}
      `;
    } else {
      await sql`
        UPDATE borrowers SET sms_attempts = ${newAttempts}
        WHERE id = ${borrowerId}
      `;
    }

    return false;
  }

  // Success — clear the code and mark phone as verified
  await sql`
    UPDATE borrowers SET
      sms_code = NULL,
      sms_code_expires = NULL,
      sms_attempts = 0,
      sms_locked_until = NULL,
      phone_verified = true
    WHERE id = ${borrowerId}
  `;

  return true;
}

export default NextAuth(authOptions);
