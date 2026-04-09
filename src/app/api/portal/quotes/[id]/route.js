/**
 * Borrower Quote View API
 *
 * GET /api/portal/quotes/:id?token=...
 *
 * Public-ish endpoint — authenticated via magic token (from email link).
 * Tracks viewedAt on first access. Returns quote data for the borrower view.
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate magic token
    const borrowerRows = await sql`
      SELECT id, email FROM borrowers
      WHERE magic_token = ${token} AND magic_expires >= NOW()
      LIMIT 1
    `;
    const borrower = borrowerRows[0];

    if (!borrower) {
      return NextResponse.json({ error: 'Link expired or invalid. Contact your loan officer for a new quote link.' }, { status: 401 });
    }

    // Load quote
    const quoteRows = await sql`SELECT * FROM borrower_quotes WHERE id = ${id} LIMIT 1`;
    const quote = quoteRows[0];

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Verify the borrower email matches the quote
    if (quote.borrower_email?.toLowerCase() !== borrower.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check expiration
    if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This quote has expired. Contact your loan officer for updated pricing.' }, { status: 410 });
    }

    // Track first view
    if (!quote.viewed_at) {
      await sql`
        UPDATE borrower_quotes SET viewed_at = NOW(), status = 'viewed', updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Return sanitized quote (no internal IDs)
    return NextResponse.json({
      quote: {
        id: quote.id,
        borrower_name: quote.borrower_name,
        purpose: quote.purpose,
        property_value: quote.property_value,
        loan_amount: quote.loan_amount,
        ltv: quote.ltv,
        fico: quote.fico,
        state: quote.state,
        county: quote.county,
        loan_type: quote.loan_type,
        term: quote.term,
        scenarios: quote.scenarios,
        fee_breakdown: quote.fee_breakdown,
        monthly_payment: quote.monthly_payment,
        pdf_url: quote.pdf_url,
        status: quote.status,
        expires_at: quote.expires_at,
        created_at: quote.created_at,
      },
    });
  } catch (err) {
    console.error('Borrower quote view error:', err);
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 });
  }
}
