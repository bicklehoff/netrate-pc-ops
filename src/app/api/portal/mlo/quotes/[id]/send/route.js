/**
 * Send Quote to Borrower
 *
 * POST /api/portal/mlo/quotes/:id/send
 *
 * 1. Load scenario from DB (unified scenarios table)
 * 2. Generate PDF server-side via renderToBuffer
 * 3. Upload PDF to Vercel Blob
 * 4. Generate magic link for borrower portal access
 * 5. Send email with PDF attachment + portal link
 * 6. Update scenario status to "sent"
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendEmail } from '@/lib/resend';
import { quoteTemplate } from '@/lib/email-templates/borrower';
import { put } from '@vercel/blob';
import crypto from 'crypto';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { getScenarioById, updateScenario } from '@/lib/scenarios/db';
import {
  createQuote,
  getQuoteByScenarioId,
  scenarioToQuoteShape,
  sendQuote,
  updateQuote,
} from '@/lib/quotes';

export const maxDuration = 30;

export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // Load scenario (with rates + fee items)
    const scenario = await getScenarioById(id, orgId);
    if (!scenario) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (scenario.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Per UAD AD-10a + AD-12a (D9c Phase 3b, 2026-04-30): the send flow now
    // routes through the quotes table. Existing scenarios from before
    // Phase 1 backfill may not yet have a quote row (drafts weren't
    // backfilled). Create one on first send.
    let quoteRow = await getQuoteByScenarioId(id, orgId);
    if (!quoteRow) {
      quoteRow = await createQuote({
        scenarioId: id,
        organizationId: orgId,
        mloId,
        contactId: scenario.contact_id || null,
      });
    }

    // Shape into legacy quote format for PDF/email
    const quote = scenarioToQuoteShape(scenario, quoteRow);

    // Require contact email (post-UAD identity)
    const contactEmail = quote.contact_email;
    if (!contactEmail) {
      return NextResponse.json({ error: 'Contact email is required to send a quote' }, { status: 400 });
    }

    const contactName = quote.contact_name || 'Valued Client';
    const firstName = contactName.split(' ')[0];

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
            contact_name: contactName,
            purpose: quote.purpose,
            loan_amount: Number(quote.loan_amount),
            property_value: Number(quote.property_value),
            ltv: Number(quote.ltv),
            fico: quote.fico,
            loan_type: quote.loan_type,
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

    // Ensure contact (borrower role) exists for portal access. `borrower`
    // variable name refers to the borrower ROLE on this loan, not to the
    // identity field shape — contacts table is the unified identity store.
    const borrowerRows = await sql`
      SELECT * FROM contacts WHERE email = ${contactEmail.toLowerCase().trim()} AND organization_id = ${orgId} LIMIT 1
    `;
    let borrower = borrowerRows[0];

    if (!borrower) {
      const { encrypt } = await import('@/lib/encryption');
      const created = await sql`
        INSERT INTO contacts (organization_id, email, first_name, last_name, phone, ssn_encrypted, dob_encrypted, ssn_last_four, role, marketing_stage, created_at, updated_at)
        VALUES (
          ${orgId}, ${contactEmail.toLowerCase().trim()}, ${firstName},
          ${contactName.split(' ').slice(1).join(' ') || 'Unknown'},
          ${quote.contact_phone || null},
          ${encrypt('000000000')}, ${encrypt('1900-01-01')}, '0000',
          'borrower', 'in_process', NOW(), NOW()
        )
        RETURNING *
      `;
      borrower = created[0];
    } else if (borrower.role !== 'borrower') {
      await sql`UPDATE contacts SET role = 'borrower', marketing_stage = COALESCE(marketing_stage, 'in_process'), updated_at = NOW() WHERE id = ${borrower.id}`;
    }

    // Generate magic link (24 hours)
    const magicToken = crypto.randomBytes(32).toString('hex');
    const magicExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      UPDATE contacts SET magic_token = ${magicToken}, magic_expires = ${magicExpires}, updated_at = NOW()
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
      to: contactEmail,
      ...template,
    };

    if (pdfBuffer) {
      emailPayload.attachments = [{
        filename: `NetRate-Quote-${firstName}.pdf`,
        content: pdfBuffer,
      }];
    }

    await sendEmail(emailPayload);

    // Transition the quote to 'sent' on first send (sets sent_at + share_token
    // + 7-day expires_at). Re-sends are idempotent: status stays 'sent' (or
    // 'viewed'/etc.), expires_at stays anchored at first send (per AD-12a),
    // and we just refresh pdf_url + pdf_generated_at via updateQuote below.
    let quoteAfterSend = quoteRow;
    if (quoteRow.status === 'draft') {
      quoteAfterSend = await sendQuote(quoteRow.id, orgId, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    // Refresh PDF fields (post-send fields per updateQuote allowlist).
    const now = new Date();
    if (pdfUrl) {
      quoteAfterSend = await updateQuote(quoteAfterSend.id, orgId, {
        pdf_url: pdfUrl,
        pdf_generated_at: now,
      });
    }

    // Keep scenarios.status in sync for the list view (which still reads
    // from scenarios.status until that view is converted). status is not in
    // the deprecation set; this write doesn't fire [d9c-deprecation].
    await updateScenario(id, orgId, { status: quoteAfterSend.status });

    // Reload and return
    const updated = await getScenarioById(id, orgId);
    return NextResponse.json({
      success: true,
      quote: scenarioToQuoteShape(updated, quoteAfterSend),
      pdfUrl,
      quoteLink,
    });
  } catch (err) {
    console.error('Send quote error:', err);
    return NextResponse.json({ error: 'Failed to send quote', detail: err.message }, { status: 500 });
  }
}
