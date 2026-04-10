// API: Send SMS Verification Code
// POST /api/portal/sms/send-code
//
// Requires a borrower session cookie (from magic link verification).
// Sends a verification code via Twilio Verify (Twilio manages code generation, delivery, and expiry).

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrower-session';
import { sendVerification } from '@/lib/twilio-verify';

export async function POST() {
  try {
    const session = await getBorrowerSession();

    if (!session?.borrowerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const rows = await sql`SELECT id, phone FROM borrowers WHERE id = ${session.borrowerId} LIMIT 1`;
    const borrower = rows[0];

    if (!borrower) {
      return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });
    }

    if (!borrower.phone) {
      return NextResponse.json(
        { error: 'No phone number on file. Please contact us for assistance.' },
        { status: 400 }
      );
    }

    // Twilio Verify handles code generation, delivery, rate limiting, and fraud prevention
    await sendVerification(borrower.phone);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send SMS code error:', error);

    if (error.message?.includes('Max send attempts reached')) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
