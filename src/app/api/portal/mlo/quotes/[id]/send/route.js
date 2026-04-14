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
import sql from '@/lib/db';
import { sendEmail } from '@/lib/resend';
import { quoteTemplate } from '@/lib/email-templates/borrower';
import { put } from '@vercel/blob';
import crypto from 'crypto';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export const maxDuration = 30;

export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // Load quote
    const quoteRows = await sql`SELECT * FROM borrower_quotes WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const quote = quoteRows[0];
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (quote.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Require borrower email
    const borrowerEmail = quote.borrower_email;
    if (!borrowerEmail) {
      return NextResponse.json({ error: 'Borrower email is required to send a quote' }, { status: 400 });
    }

    const borrowerName = quote.borrower_name || 'Valued Client';
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
            loanAmount: Number(quote.loan_amount),
            propertyValue: Number(quote.property_value),
            ltv: Number(quote.ltv),
            fico: quote.fico,
            loanType: quote.loan_type,
            state: quote.state,
            county: quote.county,
            term: quote.term,
          },
          scenarios: quote.scenarios,
          fees: quote.fee_breakdown,
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
    const borrowerRows = await sql`
      SELECT * FROM borrowers WHERE email = ${borrowerEmail.toLowerCase().trim()} AND organization_id = ${orgId} LIMIT 1
    `;
    let borrower = borrowerRows[0];

    if (!borrower) {
      const { encrypt } = await import('@/lib/encryption');
      const created = await sql`
        INSERT INTO borrowers (organization_id, email, first_name, last_name, phone, ssn_encrypted, dob_encrypted, ssn_last_four, created_at, updated_at)
        VALUES (
          ${orgId}, ${borrowerEmail.toLowerCase().trim()}, ${firstName},
          ${borrowerName.split(' ').slice(1).join(' ') || 'Unknown'},
          ${quote.borrower_phone || null},
          ${encrypt('000000000')}, ${encrypt('1900-01-01')}, '0000',
          NOW(), NOW()
        )
        RETURNING *
      `;
      borrower = created[0];
    }

    // Generate magic link (24 hours)
    const magicToken = crypto.randomBytes(32).toString('hex');
    const magicExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      UPDATE borrowers SET magic_token = ${magicToken}, magic_expires = ${magicExpires}, updated_at = NOW()
      WHERE id = ${borrower.id}
    `;

    const portalUrl = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
    const quoteLink = `${portalUrl}/portal/quote/${id}?token=${magicToken}`;

    // Build email
    const scenarios = quote.scenarios || [];
    const template = quoteTemplate({
      firstName,
      quoteLink,
      scenarios,
      loanAmount: `$${Number(quote.loan_amount).toLocaleString()}`,
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
    const updatedRows = await sql`
      UPDATE borrower_quotes
      SET status = 'sent', sent_at = ${now}, pdf_url = ${pdfUrl},
        pdf_generated_at = ${pdfUrl ? now : null},
        expires_at = ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)},
        updated_at = NOW()
      WHERE id = ${id} AND organization_id = ${orgId}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      quote: updatedRows[0],
      pdfUrl,
      quoteLink,
    });
  } catch (err) {
    console.error('Send quote error:', err);
    return NextResponse.json({ error: 'Failed to send quote', detail: err.message }, { status: 500 });
  }
}
