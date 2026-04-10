// API: MLO Contacts
// GET  /api/portal/mlo/contacts — List/search contacts
// POST /api/portal/mlo/contacts — Create a new contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const tag = searchParams.get('tag');
    const status = searchParams.get('status');
    const mloId = searchParams.get('mloId');
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

    // Main query with includes
    // Using sql() call syntax for dynamic ORDER BY
    const contactQuery = `
      SELECT c.*,
        json_build_object('id', m.id, 'first_name', m.first_name, 'last_name', m.last_name) AS assigned_mlo,
        (SELECT COUNT(*)::int FROM contact_notes WHERE contact_id = c.id) AS contact_notes_count,
        (SELECT COUNT(*)::int FROM leads WHERE contact_id = c.id) AS leads_count
      FROM contacts c
      LEFT JOIN mlos m ON m.id = c.assigned_mlo_id
      WHERE ($1::text IS NULL OR c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR c.email ILIKE $1 OR c.phone LIKE $1)
        AND ($2::text IS NULL OR $2 = ANY(c.tags))
        AND ($3::text IS NULL OR c.status = $3)
        AND ($4::uuid IS NULL OR c.assigned_mlo_id = $4)
      ORDER BY ${sortCol} ${orderDir}
      LIMIT $5 OFFSET $6
    `;
    const contacts = await sql(contactQuery, [pattern, tag, status, mloId, limit, offset]);

    // Get borrower + loans for each contact that has a borrower_id
    const borrowerIds = contacts.filter(c => c.borrower_id).map(c => c.borrower_id);
    let borrowerLoans = [];
    if (borrowerIds.length > 0) {
      borrowerLoans = await sql`
        SELECT b.id AS borrower_id, l.id AS loan_id, l.status, l.purpose, l.loan_amount, l.lender_name
        FROM borrowers b
        LEFT JOIN loans l ON l.borrower_id = b.id
        WHERE b.id = ANY(${borrowerIds})
        ORDER BY l.created_at DESC
      `;
    }

    // Group loans by borrower_id
    const borrowerLoanMap = new Map();
    for (const row of borrowerLoans) {
      if (!borrowerLoanMap.has(row.borrower_id)) {
        borrowerLoanMap.set(row.borrower_id, []);
      }
      if (row.loan_id) {
        const arr = borrowerLoanMap.get(row.borrower_id);
        if (arr.length < 3) {
          arr.push({ id: row.loan_id, status: row.status, purpose: row.purpose, loan_amount: row.loan_amount, lender_name: row.lender_name });
        }
      }
    }

    // Enrich contacts with borrower data
    const enriched = contacts.map(c => ({
      ...c,
      assigned_mlo: c.assigned_mlo?.id ? c.assigned_mlo : null,
      borrower: c.borrower_id ? {
        id: c.borrower_id,
        loans: borrowerLoanMap.get(c.borrower_id) || [],
      } : null,
      _count: { contactNotes: c.contact_notes_count, leads: c.leads_count },
    }));

    // Total count
    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM contacts c
      WHERE (${pattern}::text IS NULL OR c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern})
        AND (${tag}::text IS NULL OR ${tag} = ANY(c.tags))
        AND (${status}::text IS NULL OR c.status = ${status})
        AND (${mloId}::uuid IS NULL OR c.assigned_mlo_id = ${mloId})
    `;
    const total = countRows[0]?.total || 0;

    // Status counts for filter badges (unfiltered by status)
    const statusCountRows = await sql`
      SELECT status, COUNT(*)::int AS count FROM contacts
      WHERE (${pattern}::text IS NULL OR first_name ILIKE ${pattern} OR last_name ILIKE ${pattern} OR email ILIKE ${pattern} OR phone LIKE ${pattern})
        AND (${tag}::text IS NULL OR ${tag} = ANY(tags))
        AND (${mloId}::uuid IS NULL OR assigned_mlo_id = ${mloId})
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, email, phone, company, source, tags, notes } = body;

    if (!firstName || !lastName) {
      return Response.json({ error: 'First and last name are required' }, { status: 400 });
    }

    // Check for duplicate by email
    if (email) {
      const existing = await sql`SELECT id FROM contacts WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
      if (existing[0]) {
        return Response.json({
          error: 'A contact with this email already exists',
          existingId: existing[0].id,
        }, { status: 409 });
      }
    }

    const contactRows = await sql`
      INSERT INTO contacts (first_name, last_name, email, phone, company, source, tags, notes, created_at, updated_at)
      VALUES (
        ${firstName}, ${lastName},
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
