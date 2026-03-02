// API: Verify Magic Link Token
// POST /api/portal/auth/verify
// Body: { token }
//
// Verifies the magic link token, creates a borrower session cookie,
// and determines if SMS verification is needed.

import { NextResponse } from 'next/server';
import { verifyMagicToken } from '@/lib/auth';
import { createBorrowerSession } from '@/lib/borrower-session';
import { sendVerification } from '@/lib/twilio-verify';

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const borrower = await verifyMagicToken(token);

    if (!borrower) {
      return NextResponse.json(
        { error: 'Invalid or expired link. Please request a new one.' },
        { status: 401 }
      );
    }

    // Check if phone is already verified
    const needsSmsVerification = borrower.phone && !borrower.phoneVerified;

    // Create session (partial if SMS needed, full if phone already verified or no phone)
    await createBorrowerSession(borrower.id, {
      smsVerified: !needsSmsVerification,
    });

    // Auto-send SMS verification code so it arrives before the user lands on the verify-phone page
    if (needsSmsVerification) {
      try {
        await sendVerification(borrower.phone);
      } catch (smsError) {
        // Log but don't block — user can still resend from the verify-phone page
        console.error('Auto-send SMS failed:', smsError);
      }
    }

    return NextResponse.json({
      success: true,
      needsSmsVerification,
      borrowerId: borrower.id,
    });
  } catch (error) {
    console.error('Verify magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
