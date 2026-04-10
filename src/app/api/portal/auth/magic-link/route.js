// API: Request Magic Link
// POST /api/portal/auth/magic-link
// Body: { email }
//
// Finds borrower by email, generates magic token, sends login email via Resend.
// Always returns success even if no borrower found (prevent email enumeration).

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { generateMagicToken } from '@/lib/auth';
import { sendEmail } from '@/lib/resend';
import { magicLinkTemplate } from '@/lib/email-templates/borrower';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const rows = await sql`SELECT * FROM borrowers WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    const borrower = rows[0];

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
      firstName: borrower.first_name,
      magicLink,
    });

    try {
      await sendEmail({ to: borrower.email, subject, html, text });
    } catch (emailErr) {
      console.error('Magic link email failed:', emailErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
