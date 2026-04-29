/**
 * Borrower Quote View API
 *
 * GET /api/portal/quotes/:id?token=...
 *
 * Public-ish endpoint — authenticated via magic token (from email link).
 * Tracks viewedAt on first access. Returns quote data for the borrower view.
 *
 * Reads from unified scenarios table; responds in the legacy quote shape
 * (pre-unification) for backward compatibility with existing clients.
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getScenarioById, updateScenario } from '@/lib/scenarios/db';
import { getQuoteByScenarioId, scenarioToQuoteShape, updateQuote } from '@/lib/quotes';
import { deriveIdentity } from '@/lib/scenarios';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate magic token — also gives us the borrower's organization scope
    const borrowerRows = await sql`
      SELECT id, email, organization_id FROM contacts
      WHERE magic_token = ${token} AND magic_expires >= NOW()
      LIMIT 1
    `;
    const borrower = borrowerRows[0];

    if (!borrower) {
      return NextResponse.json({ error: 'Link expired or invalid. Contact your loan officer for a new quote link.' }, { status: 401 });
    }

    // Load scenario scoped to borrower's org
    const scenario = await getScenarioById(id, borrower.organization_id);
    if (!scenario) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Verify the contact email matches the scenario. Use deriveIdentity so
    // the check cascades through contact JOIN → lead JOIN (legacy denorm
    // columns were dropped by migration 036 2026-04-23).
    const identity = deriveIdentity(scenario);
    if (identity.contact_email?.toLowerCase() !== borrower.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Per UAD AD-10a (D9c Phase 3b): expires_at + viewed_at live on quotes.
    // Fall back to the scenario columns for the transition window — they
    // were populated by the Phase 1 backfill for sent rows but stay null
    // on new flows post-Phase-3b.
    const quoteRow = await getQuoteByScenarioId(id, borrower.organization_id);
    const expiresAt = quoteRow?.expires_at ?? scenario.expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This quote has expired. Contact your loan officer for updated pricing.' }, { status: 410 });
    }

    // Track first view on the quote row (the source of truth post-Phase-3b).
    // Mirror status='viewed' to scenarios.status for the list view, which
    // still reads from scenarios.status during the transition.
    let viewedQuote = quoteRow;
    if (quoteRow && !quoteRow.viewed_at) {
      try {
        viewedQuote = await updateQuote(quoteRow.id, borrower.organization_id, {
          viewed_at: new Date(),
          status: 'viewed',
        });
      } catch {
        // updateQuote rejects status transitions from terminal states
        // (accepted/declined/expired) — silently ignore; tracking is
        // best-effort, not a hard requirement.
      }
      await updateScenario(id, borrower.organization_id, { status: 'viewed' });
    } else if (!quoteRow && !scenario.viewed_at) {
      // Defensive fallback for any scenario without a quote row yet —
      // shouldn't happen after Phase 1 backfill, but keeps the borrower
      // view from silently dropping the view event.
      await updateScenario(id, borrower.organization_id, {
        viewed_at: new Date(),
        status: 'viewed',
      });
    }

    const quote = scenarioToQuoteShape(scenario, viewedQuote);

    // Return sanitized quote (no internal IDs)
    return NextResponse.json({
      quote: {
        id: quote.id,
        contact_name: quote.contact_name,
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
