// API: MISMO 3.4 XML Export + Submission Snapshot
// GET  /api/portal/mlo/loans/:id/xml — Download XML file
// POST /api/portal/mlo/loans/:id/xml — Export + save snapshot to Vercel Blob as immutable audit document
//
// GET: Returns XML as file download (no snapshot saved)
// POST body: { lender?: string } — Exports, saves snapshot to Blob, creates LoanDocument record

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { put } from '@vercel/blob';
import { buildMismoXml } from '@/lib/mismo-builder';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

// Fetch full loan with all 1003 relations
async function fetchFullLoan(id, orgId) {
  const loanRows = await sql`SELECT * FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
  const loan = loanRows[0];
  if (!loan) return null;

  // Borrower (contact)
  const borrowerRows = loan.contact_id
    ? await sql`SELECT * FROM contacts WHERE id = ${loan.contact_id} LIMIT 1`
    : [];

  // MLO
  const mloRows = loan.mlo_id
    ? await sql`SELECT id, first_name, last_name, email, nmls FROM staff WHERE id = ${loan.mlo_id} LIMIT 1`
    : [];

  // Participants (borrowers) with sub-models
  const participants = await sql`
    SELECT lp.id, lp.loan_id, lp.contact_id, lp.ordinal, lp.marital_status,
      CASE lp.role WHEN 'primary_borrower' THEN 'primary' ELSE lp.role END AS borrower_type,
      c.first_name AS b_first_name, c.last_name AS b_last_name,
      c.email AS b_email, c.phone AS b_phone,
      c.ssn_encrypted AS b_ssn_encrypted, c.dob_encrypted AS b_dob_encrypted,
      hh_cur.address AS current_address, hh_cur.years AS address_years,
      hh_cur.months AS address_months, hh_cur.monthly_rent,
      hh_cur.residency_type AS housing_type,
      hh_prev.address AS previous_address, hh_prev.years AS previous_address_years,
      hh_prev.months AS previous_address_months
    FROM loan_participants lp
    LEFT JOIN contacts c ON c.id = lp.contact_id
    LEFT JOIN loan_housing_history hh_cur
      ON hh_cur.loan_id = lp.loan_id AND hh_cur.contact_id = lp.contact_id AND hh_cur.housing_type = 'current'
    LEFT JOIN loan_housing_history hh_prev
      ON hh_prev.loan_id = lp.loan_id AND hh_prev.contact_id = lp.contact_id AND hh_prev.housing_type = 'previous'
    WHERE lp.loan_id = ${id}
      AND lp.role IN ('primary_borrower', 'co_borrower')
      AND lp.deleted_at IS NULL
    ORDER BY lp.ordinal ASC
  `;

  const contactIds = participants.map(p => p.contact_id);
  let employments = [];
  let incomes = [];
  let declarations = [];
  if (contactIds.length > 0) {
    employments = await sql`SELECT * FROM loan_employments WHERE loan_id = ${id} AND contact_id = ANY(${contactIds}) ORDER BY is_primary DESC`;
    incomes = await sql`SELECT * FROM loan_incomes WHERE loan_id = ${id} AND contact_id = ANY(${contactIds})`;
    declarations = await sql`SELECT * FROM loan_declarations WHERE loan_id = ${id} AND contact_id = ANY(${contactIds})`;
  }

  const assets = await sql`SELECT * FROM loan_assets WHERE loan_id = ${id} ORDER BY created_at ASC`;
  const liabilities = await sql`SELECT * FROM loan_liabilities WHERE loan_id = ${id} ORDER BY created_at ASC`;
  const reos = await sql`SELECT * FROM loan_reos WHERE loan_id = ${id} ORDER BY created_at ASC`;
  const transactionRows = await sql`SELECT * FROM loan_transactions WHERE loan_id = ${id} LIMIT 1`;

  // Assemble into a loan-like object
  loan.borrower = borrowerRows[0] || null;
  loan.mlo = mloRows[0] || null;
  loan.loanBorrowers = participants.map(lp => ({
    ...lp,
    borrower: {
      id: lp.contact_id, first_name: lp.b_first_name, last_name: lp.b_last_name,
      email: lp.b_email, phone: lp.b_phone,
      ssnEncrypted: lp.b_ssn_encrypted, dobEncrypted: lp.b_dob_encrypted,
    },
    employments: employments.filter(e => e.contact_id === lp.contact_id),
    income: incomes.find(i => i.contact_id === lp.contact_id) || null,
    declaration: declarations.find(d => d.contact_id === lp.contact_id) || null,
  }));
  loan.assets = assets;
  loan.liabilities = liabilities;
  loan.reos = reos;
  loan.transaction = transactionRows[0] || null;

  return loan;
}

// Decrypt PII for all borrowers
function decryptBorrowers(loan) {
  const result = [];
  for (const lb of (loan.loanBorrowers || [])) {
    const borr = lb.borrower;
    if (!borr) continue;
    let ssn = '';
    let dob = '';
    try {
      if (borr.ssnEncrypted) ssn = decrypt(borr.ssnEncrypted);
      if (borr.dobEncrypted) dob = decrypt(borr.dobEncrypted);
      if (lb.dob_encrypted) dob = decrypt(lb.dob_encrypted) || dob;
    } catch {
      // Decryption fail — leave blank
    }
    result.push({ borrowerId: borr.id, ssn, dob });
  }
  return result;
}

// Serialize decimal strings to numbers
function serializeLoan(loan) {
  const DECIMAL_FIELDS = [
    'loan_amount', 'interest_rate', 'purchase_price', 'estimated_value',
    'arm_margin', 'arm_initial_cap', 'arm_periodic_cap', 'arm_lifetime_cap',
  ];
  const serialized = { ...loan };
  for (const f of DECIMAL_FIELDS) {
    if (serialized[f] != null) serialized[f] = Number(serialized[f]);
  }
  serialized.loanBorrowers = (loan.loanBorrowers || []).map((lb) => ({
    ...lb,
    monthly_rent: lb.monthly_rent ? Number(lb.monthly_rent) : null,
  }));
  return serialized;
}

// ─── GET: Download XML (no snapshot) ──────────────────────
export async function GET(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const loan = await fetchFullLoan(id, orgId);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const serialized = serializeLoan(loan);
    const decryptedBorrowers = decryptBorrowers(loan);
    const xml = buildMismoXml(serialized, { decryptedBorrowers });

    const borrowerName = loan.borrower
      ? `${loan.borrower.last_name}_${loan.borrower.first_name}`.replace(/\s+/g, '_')
      : 'export';
    const filename = `${borrowerName}_${loan.loan_number || id.substring(0, 8)}.xml`;

    // Audit event
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'xml_export', 'mlo', ${mloId},
              ${JSON.stringify({ action: 'download', format: 'MISMO_3.4' })}, NOW())
    `;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('XML export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Export + Snapshot (save to Blob + create Document) ──
export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const lender = body.lender || null;

    const loan = await fetchFullLoan(id, orgId);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const serialized = serializeLoan(loan);
    const decryptedBorrowers = decryptBorrowers(loan);
    const xml = buildMismoXml(serialized, { decryptedBorrowers });

    const borrowerName = loan.borrower
      ? `${loan.borrower.last_name}_${loan.borrower.first_name}`.replace(/\s+/g, '_')
      : 'export';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${borrowerName}_${loan.loan_number || id.substring(0, 8)}_${timestamp}.xml`;

    // Save to Vercel Blob (immutable snapshot)
    const blob = await put(
      `loans/${id}/submissions/${filename}`,
      xml,
      { access: 'public', contentType: 'application/xml', addRandomSuffix: true }
    );

    // Create Document record
    const docRows = await sql`
      INSERT INTO documents (id, loan_id, doc_type, label, status, file_url, file_name, file_size, uploaded_at, requested_by, notes, created_at)
      VALUES (gen_random_uuid(), ${id}, 'submission_package',
              ${`Submission Package${lender ? ` — ${lender}` : ''} (${new Date().toLocaleDateString('en-US')})`},
              'uploaded', ${blob.url}, ${filename}, ${Buffer.byteLength(xml, 'utf-8')}, NOW(), ${mloId},
              ${JSON.stringify({ format: 'MISMO_3.4', lender, exportedBy: mloId, exportDate: new Date().toISOString(), borrowerCount: (loan.loanBorrowers || []).length, snapshotType: 'submission_package' })},
              NOW())
      RETURNING *
    `;
    const doc = docRows[0];

    // Audit event
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'xml_export', 'mlo', ${mloId},
              ${JSON.stringify({ documentId: doc.id, blobUrl: blob.url, lender })},
              ${JSON.stringify({ action: 'submission_snapshot', format: 'MISMO_3.4', lender, filename })},
              NOW())
    `;

    return NextResponse.json({
      success: true,
      document_id: doc.id,
      blob_url: blob.url,
      filename,
      lender,
    });
  } catch (error) {
    console.error('XML snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
