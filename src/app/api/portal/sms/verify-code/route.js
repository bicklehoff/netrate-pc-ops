// API: Verify SMS Code
// POST /api/portal/sms/verify-code
// Body: { code }
//
// Checks the 6-digit code against Twilio Verify.
// On success, upgrades the borrower session to fully authenticated (smsVerified=true)
// and marks the phone as verified in the database.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getBorrowerSession, createBorrowerSession } from '@/lib/borrower-session';
import { checkVerification } from '@/lib/twilio-verify';

export async function POST(request) {
  try {
    const session = await getBorrowerSession();

    if (!session?.borrowerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 });
    }

    // Look up borrower's phone to pass to Twilio Verify
    const borrower = await prisma.borrower.findUnique({
      where: { id: session.borrowerId },
      select: { phone: true },
    });

    if (!borrower?.phone) {
      return NextResponse.json({ error: 'No phone number on file' }, { status: 400 });
    }

    // Twilio Verify checks the code (handles expiry and attempt limits internally)
    const { valid } = await checkVerification(borrower.phone, code);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please try again.' },
        { status: 401 }
      );
    }

    // Mark phone as verified in DB and upgrade session
    await prisma.borrower.update({
      where: { id: session.borrowerId },
      data: { phoneVerified: true },
    });

    await createBorrowerSession(session.borrowerId, { smsVerified: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify SMS code error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
