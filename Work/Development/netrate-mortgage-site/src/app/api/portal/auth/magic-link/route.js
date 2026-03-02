// API: Request Magic Link
// POST /api/portal/auth/magic-link
// Body: { email }
//
// Finds borrower by email, generates magic token, returns success.
// In production, this would send an email with the link.
// For now, logs the link to console (email integration in Phase 2c later).

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateMagicToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const borrower = await prisma.borrower.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success even if no borrower found (prevent email enumeration)
    if (!borrower) {
      return NextResponse.json({ success: true });
    }

    const token = await generateMagicToken(borrower.id);

    // Build the magic link URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/portal/auth/verify?token=${token}`;

    // TODO: Send via Zoho Mail API (Phase 2c email integration)
    // For now, log to console for testing
    console.log(`\n🔗 Magic link for ${email}:\n${magicLink}\n`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
