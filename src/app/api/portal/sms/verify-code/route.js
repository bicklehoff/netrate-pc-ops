// API: Verify SMS Code
// POST /api/portal/sms/verify-code
// Body: { code }
//
// Checks the 6-digit code against Twilio Verify.
// On success, upgrades the borrower session to fully authenticated (smsVerified=true)
// and marks the phone as verified in the database.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getBorrowerSession, createBorrowerSession } from '@/lib/borrower-session';
import { checkVerification } from '@/lib/twilio-verify';

export async function POST(request) {
  try {
    const session = await getBorrowerSession();

    if (!session?.contactId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 });
    }

    // Look up contact's phone to pass to Twilio Verify
    const rows = await sql`SELECT phone FROM contacts WHERE id = ${session.contactId} LIMIT 1`;
    const contact = rows[0];

    if (!contact?.phone) {
      return NextResponse.json({ error: 'No phone number on file' }, { status: 400 });
    }

    // Twilio Verify checks the code (handles expiry and attempt limits internally)
    const { valid } = await checkVerification(contact.phone, code);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please try again.' },
        { status: 401 }
      );
    }

    // Mark phone as verified in DB and upgrade session
    await sql`UPDATE contacts SET phone_verified = true, updated_at = NOW() WHERE id = ${session.contactId}`;

    await createBorrowerSession(session.contactId, { smsVerified: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify SMS code error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
