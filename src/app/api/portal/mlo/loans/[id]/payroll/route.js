// API: Payroll — CD Upload + Extraction + Approval + Send to Payroll
// PUT   /api/portal/mlo/loans/:id/payroll — Upload CD, trigger extraction via Claude
// PATCH /api/portal/mlo/loans/:id/payroll — Approve or dispute extracted CD data
// POST  /api/portal/mlo/loans/:id/payroll — Send approved CD + loan data to payroll
// GET   /api/portal/mlo/loans/:id/payroll — Get payroll/extraction status
//
// Flow: Upload CD → auto-extract via Claude → MLO reviews → MLO approves → Send to Payroll

// Claude extraction can take 15-20s — extend Vercel serverless timeout
export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { uploadFile, createLoanFolder } from '@/lib/zoho-workdrive';
import { extractCdData } from '@/lib/cd-extractor';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const rows = await sql`
    SELECT l.*, b.id AS b_id, b.first_name AS b_first_name, b.last_name AS b_last_name, b.email AS b_email,
           m.id AS m_id, m.first_name AS m_first_name, m.last_name AS m_last_name, m.email AS m_email, m.nmls AS m_nmls
    FROM loans l
    LEFT JOIN borrowers b ON b.id = l.borrower_id
    LEFT JOIN mlos m ON m.id = l.mlo_id
    WHERE l.id = ${loanId} LIMIT 1
  `;
  const loan = rows[0];
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mlo_id !== session.user.id) return null;
  return loan;
}

// ─── GET: Payroll + extraction status ───────────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dup-check: other loans for same borrower not settled/cancelled
    let relatedLoans = [];
    if (loan.borrower_id) {
      relatedLoans = await sql`
        SELECT id, status, loan_number, lender_name, loan_type, loan_amount, purpose, created_at
        FROM loans
        WHERE borrower_id = ${loan.borrower_id} AND id != ${id} AND status NOT IN ('settled', 'cancelled')
        ORDER BY created_at DESC
      `;
    }

    const response = {
      loan_id: loan.id,
      status: loan.status,
      cd_work_drive_file_id: loan.cd_work_drive_file_id,
      cd_file_name: loan.cd_file_name,
      cd_extracted_data: loan.cd_extracted_data,
      cd_processed_at: loan.cd_processed_at,
      cd_approved_at: loan.cd_approved_at,
      cd_approved_by: loan.cd_approved_by,
      payroll_sent_at: loan.payroll_sent_at,
      is_funded: loan.status === 'funded',
      has_cd: !!loan.cd_work_drive_file_id,
      is_extracted: loan.cd_extracted_data?.status === 'success',
      is_approved: !!loan.cd_approved_at,
      is_sent: !!loan.payroll_sent_at,
      related_loans: relatedLoans,
      payroll_details: null,
    };

    if (loan.payroll_sent_at) {
      const payrollEvents = await sql`
        SELECT details, created_at FROM loan_events
        WHERE loan_id = ${id} AND event_type = 'payroll_sent'
        ORDER BY created_at DESC LIMIT 5
      `;
      const successfulEvent = payrollEvents.find(e => e.details?.trackerResult?.success);
      response.payroll_details = successfulEvent?.details || payrollEvents[0]?.details || null;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Payroll status error:', error);
    return NextResponse.json({ error: 'Failed to get payroll status' }, { status: 500 });
  }
}

// ─── PUT: Upload CD + trigger extraction ────────────────────
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (loan.status !== 'funded') {
      return NextResponse.json(
        { error: 'Loan must be in Funded status to upload a Closing Disclosure' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Closing Disclosure must be a PDF file' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit' }, { status: 400 });
    }

    // Upload to WorkDrive CLOSING subfolder — auto-create if missing
    let closingFolderId = loan.work_drive_subfolders?.CLOSING;

    if (!closingFolderId) {
      const loName = loan.m_first_name
        ? `${loan.m_first_name} ${loan.m_last_name}`
        : 'David Burson';

      const wdResult = await createLoanFolder({
        borrowerFirstName: loan.b_first_name || 'Unknown',
        borrowerLastName: loan.b_last_name || 'Unknown',
        purpose: loan.purpose || 'purchase',
        loName,
      });

      await sql`
        UPDATE loans SET work_drive_folder_id = ${wdResult.rootFolderId}, work_drive_subfolders = ${JSON.stringify(wdResult.subfolders)}, updated_at = NOW()
        WHERE id = ${id}
      `;

      closingFolderId = wdResult.subfolders.CLOSING;
    }

    const uploaded = await uploadFile(file, file.name, closingFolderId, true);

    // Store CD reference + clear any previous extraction/approval/payroll state
    await sql`
      UPDATE loans SET cd_work_drive_file_id = ${uploaded.id}, cd_file_name = ${file.name},
        cd_extracted_data = NULL, cd_processed_at = NULL, cd_approved_at = NULL, cd_approved_by = NULL, payroll_sent_at = NULL,
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Audit: CD uploaded
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'cd_uploaded', 'mlo', ${session.user.id}, ${file.name},
              ${JSON.stringify({ workDriveFileId: uploaded.id, fileName: file.name, fileSize: file.size, folder: 'CLOSING', replacedPrevious: !!loan.cd_work_drive_file_id })},
              NOW())
    `;

    // Trigger CD extraction via Claude
    const loanContext = {
      borrowerName: loan.b_first_name ? `${loan.b_first_name} ${loan.b_last_name}` : null,
      loanNumber: loan.loan_number,
      propertyAddress: loan.property_address,
    };

    const fileBuffer = await file.arrayBuffer();
    const extraction = await extractCdData({ fileBuffer, loanContext });

    await sql`
      UPDATE loans SET cd_extracted_data = ${JSON.stringify(extraction)}, cd_processed_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;

    // Audit: extraction result
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, ${extraction.status === 'success' ? 'cd_extracted' : 'cd_extraction_failed'}, 'system', 'cd-extractor', ${extraction.status},
              ${JSON.stringify(extraction.status === 'success' ? { fields: Object.keys(extraction.data) } : { error: extraction.error })},
              NOW())
    `;

    // Dup-check
    let relatedLoans = [];
    if (loan.borrower_id) {
      relatedLoans = await sql`
        SELECT id, status, loan_number, lender_name, loan_type, loan_amount, purpose, created_at
        FROM loans
        WHERE borrower_id = ${loan.borrower_id} AND id != ${id} AND status NOT IN ('settled', 'cancelled')
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({
      success: true,
      cd_work_drive_file_id: uploaded.id,
      cd_file_name: file.name,
      cd_extracted_data: extraction,
      cd_processed_at: new Date().toISOString(),
      related_loans: relatedLoans,
    });
  } catch (error) {
    console.error('CD upload error:', error);
    return NextResponse.json({ error: 'CD upload failed' }, { status: 500 });
  }
}

// ─── PATCH: Approve or dispute extracted CD data ────────────
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notes, nicknameConfirmed, unmatchedPersons, reimbursementSelections } = body;

    if (action === 'approve') {
      if (!loan.cd_extracted_data || loan.cd_extracted_data.status !== 'success') {
        return NextResponse.json({ error: 'No successful CD extraction to approve' }, { status: 400 });
      }
      if (loan.cd_approved_at) {
        return NextResponse.json({ error: 'CD data already approved' }, { status: 400 });
      }

      const now = new Date();
      const cd = loan.cd_extracted_data.data;

      // Build loan update fields from CD extraction
      const loanUpdate = { cd_approved_at: now, cd_approved_by: session.user.id };
      if (cd.loanAmount != null) loanUpdate.loan_amount = cd.loanAmount;
      if (cd.interestRate != null) loanUpdate.interest_rate = cd.interestRate;
      if (cd.loanTerm != null) loanUpdate.loan_term = cd.loanTerm;
      if (cd.loanType && cd.loanType !== 'other') loanUpdate.loan_type = cd.loanType;
      if (cd.lenderName) loanUpdate.lender_name = cd.lenderName;
      if (cd.loanNumber) loanUpdate.lender_loan_number = cd.loanNumber;
      if (cd.monthlyPI != null) loanUpdate.monthly_payment = cd.monthlyPI;
      if (cd.brokerCompensation != null) loanUpdate.broker_compensation = cd.brokerCompensation;
      if (cd.totalClosingCosts != null) loanUpdate.total_closing_costs = cd.totalClosingCosts;
      if (cd.cashToClose != null) loanUpdate.cash_to_close = cd.cashToClose;
      if (cd.lenderCredits != null) loanUpdate.lender_credits = cd.lenderCredits;
      if (cd.closingDate) loanUpdate.closing_date = new Date(cd.closingDate);
      if (cd.disbursementDate) loanUpdate.funding_date = new Date(cd.disbursementDate);

      // Persist reimbursement selections into cd_extracted_data
      if (reimbursementSelections) {
        const updatedExtraction = {
          ...loan.cd_extracted_data,
          data: { ...cd, _reimbursementSelections: reimbursementSelections },
        };
        loanUpdate.cd_extracted_data = JSON.stringify(updatedExtraction);
      }

      // Dynamic update
      const cols = Object.keys(loanUpdate);
      const vals = Object.values(loanUpdate);
      const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
      await sql(`UPDATE loans SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...vals, id]);

      // Handle nickname
      let nicknameUpdate = null;
      if (nicknameConfirmed && loan.borrower_id && Array.isArray(cd.borrowerNames) && cd.borrowerNames.length > 0) {
        const primaryCd = cd.borrowerNames[0];
        nicknameUpdate = {
          legalFirstName: primaryCd.firstName,
          legalLastName: primaryCd.lastName,
          nickname: loan.b_first_name,
        };
        await sql`
          UPDATE borrowers SET legal_first_name = ${primaryCd.firstName}, legal_last_name = ${primaryCd.lastName}, nickname = ${loan.b_first_name}, updated_at = NOW()
          WHERE id = ${loan.borrower_id}
        `;
      }

      // Process unmatched persons from CD
      const personsCreated = [];
      if (unmatchedPersons && unmatchedPersons.length > 0) {
        for (const person of unmatchedPersons) {
          if (!person.role || !person.firstName || !person.lastName) continue;

          let contactId = null;

          if (person.saveAsContact) {
            const contactRows = await sql`
              INSERT INTO contacts (id, first_name, last_name, email, phone, source, contact_type, tags, created_at, updated_at)
              VALUES (gen_random_uuid(), ${person.firstName}, ${person.lastName}, ${person.email || null}, ${person.phone || null}, 'cd_extraction', ${person.role === 'nbs' ? 'nbs' : 'borrower'}, ${[person.role === 'nbs' ? 'non-borrowing-spouse' : 'co-borrower']}, NOW(), NOW())
              RETURNING *
            `;
            contactId = contactRows[0].id;
          }

          if (person.role === 'co_borrower') {
            const borrowerRows = await sql`
              INSERT INTO borrowers (id, first_name, last_name, legal_first_name, legal_last_name, email, dob_encrypted, ssn_encrypted, ssn_last_four, created_at, updated_at)
              VALUES (gen_random_uuid(), ${person.firstName}, ${person.lastName}, ${person.firstName}, ${person.lastName}, ${person.email || `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@placeholder.local`}, '', '', '0000', NOW(), NOW())
              RETURNING *
            `;
            const borrower = borrowerRows[0];

            await sql`
              INSERT INTO loan_borrowers (id, loan_id, borrower_id, borrower_type, ordinal, created_at, updated_at)
              VALUES (gen_random_uuid(), ${id}, ${borrower.id}, 'co_borrower', 1, NOW(), NOW())
            `;

            personsCreated.push({ ...person, borrowerId: borrower.id, contactId });
          } else {
            personsCreated.push({ ...person, contactId });
          }
        }
      }

      const fieldsUpdated = cols.filter(k => k !== 'cd_approved_at' && k !== 'cd_approved_by');
      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'cd_approved', 'mlo', ${session.user.id}, 'approved',
                ${JSON.stringify({ extractedData: cd, fieldsUpdated, ...(nicknameUpdate ? { nicknameUpdate } : {}), ...(personsCreated.length > 0 ? { personsCreated } : {}), ...(notes ? { notes } : {}) })},
                NOW())
      `;

      return NextResponse.json({
        success: true,
        cd_approved_at: now.toISOString(),
        fields_updated: fieldsUpdated,
        persons_created: personsCreated,
      });
    }

    if (action === 'dispute') {
      await sql`
        UPDATE loans SET cd_work_drive_file_id = NULL, cd_file_name = NULL, cd_extracted_data = NULL, cd_processed_at = NULL, cd_approved_at = NULL, cd_approved_by = NULL, updated_at = NOW()
        WHERE id = ${id}
      `;

      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'cd_disputed', 'mlo', ${session.user.id}, 'disputed',
                ${JSON.stringify({ reason: notes || 'MLO disputed extracted CD data' })}, NOW())
      `;

      return NextResponse.json({ success: true, cleared: true });
    }

    return NextResponse.json({ error: 'Invalid action. Use "approve" or "dispute".' }, { status: 400 });
  } catch (error) {
    console.error('CD approve/dispute error:', error);
    return NextResponse.json({ error: 'Failed to process CD action' }, { status: 500 });
  }
}

// ─── POST: Send to Payroll ──────────────────────────────────
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (loan.status !== 'funded') {
      return NextResponse.json({ error: 'Loan must be in Funded status' }, { status: 400 });
    }
    if (!loan.cd_work_drive_file_id) {
      return NextResponse.json({ error: 'Upload the final Closing Disclosure before sending to payroll' }, { status: 400 });
    }
    if (!loan.cd_approved_at) {
      return NextResponse.json({ error: 'CD data must be reviewed and approved before sending to payroll' }, { status: 400 });
    }
    if (loan.payroll_sent_at) {
      return NextResponse.json({ error: 'Already sent to payroll. Upload a new CD to re-send.' }, { status: 400 });
    }

    const now = new Date();

    // Re-read loan with fresh data (approval may have updated fields)
    const freshRows = await sql`
      SELECT l.*, b.first_name AS b_first_name, b.last_name AS b_last_name, b.email AS b_email,
             m.first_name AS m_first_name, m.last_name AS m_last_name, m.email AS m_email, m.nmls AS m_nmls
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      LEFT JOIN mlos m ON m.id = l.mlo_id
      WHERE l.id = ${id} LIMIT 1
    `;
    const freshLoan = freshRows[0];

    const propState = freshLoan.property_address?.state || null;

    const cdData = freshLoan.cd_extracted_data?.data || {};
    const grossComp = freshLoan.broker_compensation ? Number(freshLoan.broker_compensation) : null;
    const reimbSelections = cdData._reimbursementSelections || [];
    const totalReimb = reimbSelections.reduce((sum, r) => sum + (r.editedAmount || 0), 0);
    const wireTotal = cdData.totalDueToBroker
      ? Number(cdData.totalDueToBroker)
      : (grossComp || 0) + totalReimb;

    const trackerPayload = {
      borrowerName: `${freshLoan.b_first_name} ${freshLoan.b_last_name}`,
      loanNumber: freshLoan.lender_loan_number || freshLoan.loan_number,
      propertyAddress: freshLoan.property_address
        ? `${freshLoan.property_address.street}, ${freshLoan.property_address.city}, ${freshLoan.property_address.state} ${freshLoan.property_address.zipCode}`
        : null,
      propertyState: propState,
      lender: freshLoan.lender_name,
      loanAmount: freshLoan.loan_amount ? Number(freshLoan.loan_amount) : null,
      loanType: freshLoan.loan_type,
      loanPurpose: freshLoan.purpose ? freshLoan.purpose.charAt(0).toUpperCase() + freshLoan.purpose.slice(1) : null,
      interestRate: freshLoan.interest_rate ? Number(freshLoan.interest_rate) : null,
      loanTerm: freshLoan.loan_term ? Math.round(freshLoan.loan_term / 12) : null,
      grossComp,
      reimbursements: reimbSelections.length > 0 ? reimbSelections : null,
      totalReimb: totalReimb || null,
      wireTotal,
      closingDate: freshLoan.closing_date?.toISOString?.()?.split('T')[0] || (freshLoan.closing_date ? String(freshLoan.closing_date).split('T')[0] : null),
      fundingDate: freshLoan.funding_date?.toISOString?.()?.split('T')[0] || (freshLoan.funding_date ? String(freshLoan.funding_date).split('T')[0] : null),
      loName: freshLoan.m_first_name ? `${freshLoan.m_first_name} ${freshLoan.m_last_name}` : null,
      loNmls: freshLoan.m_nmls || null,
      confirmedBy: freshLoan.m_first_name ? freshLoan.m_first_name.toLowerCase() : session.user.id,
      confirmedAt: freshLoan.cd_approved_at?.toISOString?.() || now.toISOString(),
      cdWorkDriveFileId: freshLoan.cd_work_drive_file_id || null,
    };

    // POST to TrackerPortal
    let trackerResult = null;
    try {
      const trackerRes = await fetch('https://tracker.netratemortgage.com/api/payroll/commission-confirmed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tracker-api-key': process.env.TRACKER_API_KEY || 'agent',
        },
        body: JSON.stringify(trackerPayload),
      });
      trackerResult = await trackerRes.json();
      if (!trackerRes.ok) {
        console.error('TrackerPortal error:', trackerResult);
      }
    } catch (trackerErr) {
      console.error('TrackerPortal POST failed:', trackerErr);
      trackerResult = { error: trackerErr.message };
    }

    // Mark loan as sent
    await sql`UPDATE loans SET payroll_sent_at = ${now}, updated_at = NOW() WHERE id = ${id}`;

    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'payroll_sent', 'mlo', ${session.user.id}, 'Sent to payroll',
              ${JSON.stringify({ trackerPayload, trackerResult, sentAt: now.toISOString(), sentBy: session.user.id })},
              NOW())
    `;

    return NextResponse.json({
      success: true,
      payroll_sent_at: now.toISOString(),
      tracker_result: trackerResult,
    });
  } catch (error) {
    console.error('Send to payroll error:', error);
    return NextResponse.json({ error: 'Failed to send to payroll' }, { status: 500 });
  }
}
