// API: Request Magic Link
// POST /api/portal/auth/magic-link
// Body: { email }
//
// Finds borrower by email, generates magic token, sends login email via Resend.
// Always returns success even if no borrower found (prevent email enumeration).

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateMagicToken } from '@/lib/auth';
import { sendEmail } from '@/lib/resend';
import { magicLinkTemplate } from '@/lib/email-templates/borrower';

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

    // Send magic link email via Resend
    const { subject, html, text } = magicLinkTemplate({
      firstName: borrower.firstName,
      magicLink,
    });

    try {
      await sendEmail({ to: borrower.email, subject, html, text });
    } catch (emailErr) {
      // Log but don't fail — borrower shouldn't know email failed
      console.error('Magic link email failed:', emailErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
