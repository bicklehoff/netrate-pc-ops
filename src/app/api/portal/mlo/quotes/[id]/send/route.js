/**
 * Send Quote to Borrower
 *
 * POST /api/portal/mlo/quotes/:id/send
 *
 * 1. Load quote from DB
 * 2. Generate PDF server-side via renderToBuffer
 * 3. Upload PDF to Vercel Blob
 * 4. Generate magic link for borrower portal access
 * 5. Send email with PDF attachment + portal link
 * 6. Update quote status to "sent"
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/resend';
import { quoteTemplate } from '@/lib/email-templates/borrower';
import { put } from '@vercel/blob';
import crypto from 'crypto';

export const maxDuration = 30;

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Load quote
    const quote = await prisma.borrowerQuote.findUnique({ where: { id } });
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (quote.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Require borrower email
    const borrowerEmail = quote.borrowerEmail;
    if (!borrowerEmail) {
      return NextResponse.json({ error: 'Borrower email is required to send a quote' }, { status: 400 });
    }

    const borrowerName = quote.borrowerName || 'Valued Client';
    const firstName = borrowerName.split(' ')[0];

    // Generate PDF server-side
    let pdfBuffer;
    let pdfUrl = null;
    try {
      const { renderToBuffer } = await import('@react-pdf/renderer');
      const { default: QuotePDF } = await import('@/components/Portal/QuoteGenerator/QuotePDF');

      const React = await import('react');
      pdfBuffer = await renderToBuffer(
        React.createElement(QuotePDF, {
          quote: {
            borrowerName,
            purpose: quote.purpose,
            loanAmount: Number(quote.loanAmount),
            propertyValue: Number(quote.propertyValue),
            ltv: Number(quote.ltv),
            fico: quote.fico,
            loanType: quote.loanType,
            state: quote.state,
            county: quote.county,
            term: quote.term,
          },
          scenarios: quote.scenarios,
          fees: quote.feeBreakdown,
        })
      );

      // Upload to Vercel Blob
      const blob = await put(
        `quotes/${id}/NetRate-Quote-${Date.now()}.pdf`,
        pdfBuffer,
        { access: 'public', addRandomSuffix: false }
      );
      pdfUrl = blob.url;
    } catch (pdfErr) {
      console.error('PDF generation failed:', pdfErr);
      // Continue without PDF — still send email with link
    }

    // Ensure borrower exists for portal access
    let borrower = await prisma.borrower.findUnique({
      where: { email: borrowerEmail.toLowerCase().trim() },
    });

    if (!borrower) {
      const { encrypt } = await import('@/lib/encryption');
      borrower = await prisma.borrower.create({
        data: {
          email: borrowerEmail.toLowerCase().trim(),
          firstName: firstName,
          lastName: borrowerName.split(' ').slice(1).join(' ') || 'Unknown',
          phone: quote.borrowerPhone || null,
          ssnEncrypted: encrypt('000000000'),
          dobEncrypted: encrypt('1900-01-01'),
          ssnLastFour: '0000',
        },
      });
    }

    // Generate magic link (24 hours)
    const magicToken = crypto.randomBytes(32).toString('hex');
    const magicExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.borrower.update({
      where: { id: borrower.id },
      data: { magicToken, magicExpires },
    });

    const portalUrl = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
    const quoteLink = `${portalUrl}/portal/quote/${id}?token=${magicToken}`;

    // Build email
    const scenarios = quote.scenarios || [];
    const template = quoteTemplate({
      firstName,
      quoteLink,
      scenarios,
      loanAmount: `$${Number(quote.loanAmount).toLocaleString()}`,
      purpose: quote.purpose,
    });

    // Send with PDF attachment if available
    const emailPayload = {
      to: borrowerEmail,
      ...template,
    };

    if (pdfBuffer) {
      emailPayload.attachments = [{
        filename: `NetRate-Quote-${firstName}.pdf`,
        content: pdfBuffer,
      }];
    }

    await sendEmail(emailPayload);

    // Update quote status
    const now = new Date();
    const updatedQuote = await prisma.borrowerQuote.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: now,
        pdfUrl,
        pdfGeneratedAt: pdfUrl ? now : undefined,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return NextResponse.json({
      success: true,
      quote: updatedQuote,
      pdfUrl,
      quoteLink,
    });
  } catch (err) {
    console.error('Send quote error:', err);
    return NextResponse.json({ error: 'Failed to send quote', detail: err.message }, { status: 500 });
  }
}
