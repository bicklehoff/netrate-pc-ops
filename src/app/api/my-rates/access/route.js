// API: Send BRP access link to borrower's email
// POST /api/my-rates/access { email }
// Looks up lead by email, gets viewToken, sends magic link email.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/resend';
import { brpAccessTemplate } from '@/lib/email-templates/borrower';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find a lead with this email that has a saved scenario
    const lead = await prisma.lead.findFirst({
      where: {
        email: normalizedEmail,
        savedScenarios: { some: {} },
      },
      select: { id: true, name: true },
    });

    // Always return success — don't reveal whether the email exists
    if (!lead) {
      console.log('BRP access requested for unknown email:', normalizedEmail);
      return NextResponse.json({ success: true });
    }

    // Get viewToken via raw SQL (Prisma client doesn't expose this field)
    const tokenRows = await prisma.$queryRaw`
      SELECT view_token::text FROM leads WHERE id::text = ${lead.id} LIMIT 1
    `;
    const viewToken = tokenRows?.[0]?.view_token;

    if (!viewToken) {
      console.error('BRP access: lead found but no viewToken for', lead.id);
      return NextResponse.json({ success: true });
    }

    // Send access email
    const SITE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
    const accessLink = `${SITE_URL}/portal/my-rates?token=${viewToken}`;
    const firstName = lead.name?.split(' ')[0] || null;

    const emailContent = brpAccessTemplate({ firstName, accessLink });

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      console.log('BRP access email sent to:', normalizedEmail);
    } catch (err) {
      console.error('BRP access email failed:', err.message);
      // Still return success — don't reveal email delivery issues
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('BRP access error:', err.message, err.stack);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
