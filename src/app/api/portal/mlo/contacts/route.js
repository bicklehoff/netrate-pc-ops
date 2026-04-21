// API: MLO Contacts
// GET  /api/portal/mlo/contacts — List/search contacts
// POST /api/portal/mlo/contacts — Create a new contact
// Auth: MLO session required

import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(req) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const tag = searchParams.get('tag');
    const status = searchParams.get('status');
    const filterMloId = searchParams.get('mloId');
    const sort = searchParams.get('sort') || 'updatedAt';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Map sort fields to DB columns
    const sortMap = {
      name: 'last_name',
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      lastContactedAt: 'last_contacted_at',
      fundedDate: 'funded_date',
      status: 'status',
    };
    const sortCol = sortMap[sort] || 'updated_at';
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';

    const pattern = q ? `%${q}%` : null;

    // Main query with includes. sortCol + orderDir come from validated
    // allowlists above; safe to interpolate as string literals. Remaining
    // inputs are parameterized via $N. Uses sql.query() for parameterized
    // form — raw sql(query, [params]) call-style is not supported by the
    // current @neondatabase/serverless client (tagged-template only).
    const contactQuery = `
      SELECT c.*,
        json_build_object('id', m.id, 'first_name', m.first_name, 'last_name', m.last_name) AS assigned_mlo,
        (SELECT COUNT(*)::int FROM contact_notes WHERE contact_id = c.id) AS contact_notes_count,
        (SELECT COUNT(*)::int FROM leads WHERE contact_id = c.id) AS leads_count
      FROM contacts c
      LEFT JOIN staff m ON m.id = c.assigned_mlo_id
      WHERE c.organization_id = $1
        AND ($2::text IS NULL OR c.first_name ILIKE $2 OR c.last_name ILIKE $2 OR c.email ILIKE $2 OR c.phone LIKE $2)
        AND ($3::text IS NULL OR $3 = ANY(c.tags))
        AND ($4::text IS NULL OR c.status = $4)
        AND ($5::uuid IS NULL OR c.assigned_mlo_id = $5)
      ORDER BY ${sortCol} ${orderDir}
      LIMIT $6 OFFSET $7
    `;
    const contactResult = await sql.query(contactQuery, [orgId, pattern, tag, status, filterMloId, limit, offset]);
    const contacts = contactResult.rows;

    // Post-migration: contact IS borrower. Pull loans for borrower-role contacts directly.
    const borrowerContactIds = contacts.filter(c => c.role === 'borrower').map(c => c.id);
    let contactLoans = [];
    if (borrowerContactIds.length > 0) {
      contactLoans = await sql`
        SELECT l.contact_id AS contact_id, l.id AS loan_id, l.status, l.purpose, l.loan_amount, l.lender_name
        FROM loans l
        WHERE l.contact_id = ANY(${borrowerContactIds}) AND l.organization_id = ${orgId}
        ORDER BY l.created_at DESC
      `;
    }

    // Group loans by contact_id
    const contactLoanMap = new Map();
    for (const row of contactLoans) {
      if (!contactLoanMap.has(row.contact_id)) {
        contactLoanMap.set(row.contact_id, []);
      }
      if (row.loan_id) {
        const arr = contactLoanMap.get(row.contact_id);
        if (arr.length < 3) {
          arr.push({ id: row.loan_id, status: row.status, purpose: row.purpose, loan_amount: row.loan_amount, lender_name: row.lender_name });
        }
      }
    }

    // Enrich contacts with borrower-role loan data
    const enriched = contacts.map(c => ({
      ...c,
      assigned_mlo: c.assigned_mlo?.id ? c.assigned_mlo : null,
      borrower: c.role === 'borrower' ? {
        id: c.id,
        loans: contactLoanMap.get(c.id) || [],
      } : null,
      _count: { contactNotes: c.contact_notes_count, leads: c.leads_count },
    }));

    // Total count
    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM contacts c
      WHERE c.organization_id = ${orgId}
        AND (${pattern}::text IS NULL OR c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern})
        AND (${tag}::text IS NULL OR ${tag} = ANY(c.tags))
        AND (${status}::text IS NULL OR c.status = ${status})
        AND (${filterMloId}::uuid IS NULL OR c.assigned_mlo_id = ${filterMloId})
    `;
    const total = countRows[0]?.total || 0;

    // Status counts for filter badges (unfiltered by status)
    const statusCountRows = await sql`
      SELECT status, COUNT(*)::int AS count FROM contacts
      WHERE organization_id = ${orgId}
        AND (${pattern}::text IS NULL OR first_name ILIKE ${pattern} OR last_name ILIKE ${pattern} OR email ILIKE ${pattern} OR phone LIKE ${pattern})
        AND (${tag}::text IS NULL OR ${tag} = ANY(tags))
        AND (${filterMloId}::uuid IS NULL OR assigned_mlo_id = ${filterMloId})
      GROUP BY status
    `;

    return Response.json({
      contacts: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      statusCounts: statusCountRows.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
    });
  } catch (error) {
    console.error('Contacts list error:', error?.message);
    return Response.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const { firstName, lastName, email, phone, company, source, tags, notes } = body;

    if (!firstName || !lastName) {
      return Response.json({ error: 'First and last name are required' }, { status: 400 });
    }

    // Check for duplicate by email
    if (email) {
      const existing = await sql`SELECT id FROM contacts WHERE email = ${email.toLowerCase().trim()} AND organization_id = ${orgId} LIMIT 1`;
      if (existing[0]) {
        return Response.json({
          error: 'A contact with this email already exists',
          existingId: existing[0].id,
        }, { status: 409 });
      }
    }

    const contactRows = await sql`
      INSERT INTO contacts (organization_id, first_name, last_name, email, phone, company, source, tags, notes, created_at, updated_at)
      VALUES (
        ${orgId}, ${firstName}, ${lastName},
        ${email ? email.toLowerCase().trim() : null},
        ${normalizePhone(phone) || phone || null},
        ${company || null}, ${source || 'manual'},
        ${tags || []}, ${notes || null},
        NOW(), NOW()
      )
      RETURNING *
    `;

    return Response.json({ success: true, contact: contactRows[0] }, { status: 201 });
  } catch (error) {
    console.error('Contact create error:', error?.message);
    return Response.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
