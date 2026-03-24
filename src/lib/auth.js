// NextAuth.js Configuration
// Two providers: EmailProvider (borrower magic link) + CredentialsProvider (MLO password)
// Session stored in database via Prisma adapter
//
// NOTE: Full NextAuth setup requires DATABASE_URL and NEXTAUTH_SECRET.
// This file defines the configuration — the route handler is at /api/auth/[...nextauth]/route.js

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
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
        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials');
          return null;
        }

        const email = credentials.email.toLowerCase();
        console.log('[AUTH] Login attempt for:', email);

        const mlo = await prisma.mlo.findUnique({
          where: { email },
        });

        if (!mlo) {
          console.log('[AUTH] MLO not found for email:', email);
          return null;
        }

        console.log('[AUTH] MLO found:', mlo.email, 'hash prefix:', mlo.passwordHash?.substring(0, 10));

        const passwordValid = await bcrypt.compare(
          credentials.password,
          mlo.passwordHash
        );

        console.log('[AUTH] Password valid:', passwordValid);

        if (!passwordValid) return null;

        return {
          id: mlo.id,
          email: mlo.email,
          name: `${mlo.firstName} ${mlo.lastName}`,
          role: mlo.role,
          userType: 'mlo',
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
      }
      return token;
    },

    async session({ session, token }) {
      // Expose custom fields in the session object
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.userType = token.userType;
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

  await prisma.borrower.update({
    where: { id: borrowerId },
    data: {
      magicToken: token,
      magicExpires: expires,
    },
  });

  return token;
}

/**
 * Verify a magic link token. Returns the borrower if valid, null if not.
 */
export async function verifyMagicToken(token) {
  const borrower = await prisma.borrower.findFirst({
    where: {
      magicToken: token,
      magicExpires: { gt: new Date() },
    },
  });

  if (!borrower) return null;

  // Clear the token (single-use)
  await prisma.borrower.update({
    where: { id: borrower.id },
    data: {
      magicToken: null,
      magicExpires: null,
    },
  });

  return borrower;
}

/**
 * Generate a 6-digit SMS verification code for a borrower.
 * Stores hashed code in DB.
 */
export async function generateSmsCode(borrowerId) {
  const borrower = await prisma.borrower.findUnique({
    where: { id: borrowerId },
  });

  if (!borrower) throw new Error('Borrower not found');

  // Check lockout
  if (borrower.smsLockedUntil && borrower.smsLockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (borrower.smsLockedUntil.getTime() - Date.now()) / 60000
    );
    throw new Error(`Too many attempts. Try again in ${minutesLeft} minutes.`);
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = await bcrypt.hash(code, 10);

  await prisma.borrower.update({
    where: { id: borrowerId },
    data: {
      smsCode: hashedCode,
      smsCodeExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      smsAttempts: 0,
      smsLockedUntil: null,
    },
  });

  return code; // Return plaintext code to send via SMS
}

/**
 * Verify an SMS code for a borrower.
 * Returns true if valid, false if not. Handles lockout after 3 failed attempts.
 */
export async function verifySmsCode(borrowerId, code) {
  const borrower = await prisma.borrower.findUnique({
    where: { id: borrowerId },
  });

  if (!borrower || !borrower.smsCode) return false;

  // Check lockout
  if (borrower.smsLockedUntil && borrower.smsLockedUntil > new Date()) {
    return false;
  }

  // Check expiry
  if (!borrower.smsCodeExpires || borrower.smsCodeExpires < new Date()) {
    return false;
  }

  const isValid = await bcrypt.compare(code, borrower.smsCode);

  if (!isValid) {
    const newAttempts = borrower.smsAttempts + 1;
    const updateData = { smsAttempts: newAttempts };

    // Lock after 3 failed attempts
    if (newAttempts >= 3) {
      updateData.smsLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
    }

    await prisma.borrower.update({
      where: { id: borrowerId },
      data: updateData,
    });

    return false;
  }

  // Success — clear the code and mark phone as verified
  await prisma.borrower.update({
    where: { id: borrowerId },
    data: {
      smsCode: null,
      smsCodeExpires: null,
      smsAttempts: 0,
      smsLockedUntil: null,
      phoneVerified: true,
    },
  });

  return true;
}

export default NextAuth(authOptions);
