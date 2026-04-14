// Conditions CRUD API
// GET    /api/portal/mlo/loans/:id/conditions — List all conditions
// POST   /api/portal/mlo/loans/:id/conditions — Create condition OR confirm approval extraction
// PATCH  /api/portal/mlo/loans/:id/conditions — Update condition status/fields
// PUT    /api/portal/mlo/loans/:id/conditions — Upload approval PDF + auto-extract
// Auth: MLO session

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { uploadFile } from '@/lib/zoho-workdrive';
import { extractApprovalData } from '@/lib/approval-extractor';
import { requireMloSession } from '@/lib/require-mlo-session';

export const maxDuration = 120; // Claude extraction on multi-page approval PDFs

async function verifyMloAccess(loanId, session, orgId, mloId) {
  if (!session) return null;
  const rows = await sql`SELECT * FROM loans WHERE id = ${loanId} AND organization_id = ${orgId} LIMIT 1`;
  const loan = rows[0];
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mlo_id !== mloId) return null;
  return loan;
}

// ─── List conditions ────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    const { id } = await params;
    const loan = await verifyMloAccess(id, session, orgId, mloId);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conditions = await sql`
      SELECT * FROM conditions WHERE loan_id = ${id} ORDER BY stage ASC, created_at ASC
    `;

    return NextResponse.json({ conditions });
  } catch (error) {
    console.error('Conditions list error:', error);
    return NextResponse.json({ error: 'Failed to list conditions' }, { status: 500 });
  }
}

// ─── Create condition OR confirm approval extraction ────────
export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    const { id } = await params;
    const loan = await verifyMloAccess(id, session, orgId, mloId);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // ─── Confirm approval extraction ───
    if (body.action === 'confirm_approval') {
      const { documentId, extractedConditions, extractedLoanData } = body;

      if (!documentId || !extractedConditions) {
        return NextResponse.json({ error: 'documentId and extractedConditions required' }, { status: 400 });
      }

      // Delete all existing approval-sourced conditions for this loan
      const deleteResult = await sql`DELETE FROM conditions WHERE loan_id = ${id} AND source = 'approval'`;
      const deletedCount = deleteResult.count || 0;

      // Bulk-create new conditions from extraction
      let createdCount = 0;
      for (const c of extractedConditions) {
        await sql`
          INSERT INTO conditions (id, loan_id, condition_number, title, condition_type, stage, owner_role, status, source, document_id, requested_date, created_at, updated_at)
          VALUES (gen_random_uuid(), ${id}, ${c.conditionNumber ? parseInt(c.conditionNumber, 10) : null}, ${c.title}, ${c.conditionType || 'document'}, ${c.stage || 'prior_to_close'}, ${c.ownerRole || 'mlo'}, 'needed', 'approval', ${documentId}, NOW(), NOW(), NOW())
        `;
        createdCount++;
      }

      // Update loan universal fields from extracted loan data
      if (extractedLoanData) {
        const loanUpdate = {};
        if (extractedLoanData.appraisedValue != null) loanUpdate.appraised_value = extractedLoanData.appraisedValue;
        if (extractedLoanData.loanProgram) loanUpdate.loan_program = extractedLoanData.loanProgram;
        if (extractedLoanData.underwriterName) loanUpdate.underwriter_name = extractedLoanData.underwriterName;
        if (extractedLoanData.accountExec) loanUpdate.account_exec = extractedLoanData.accountExec;
        if (extractedLoanData.brokerProcessor) loanUpdate.broker_processor = extractedLoanData.brokerProcessor;
        if (extractedLoanData.loanNumber) loanUpdate.loan_number = extractedLoanData.loanNumber;

        if (Object.keys(loanUpdate).length > 0) {
          const cols = Object.keys(loanUpdate);
          const vals = Object.values(loanUpdate);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          await sql(`UPDATE loans SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...vals, id]);
        }

        // Upsert FHA satellite if FHA data present
        if (extractedLoanData.fhaCaseNumber || extractedLoanData.financialAssessmentResult) {
          const fhaData = {};
          if (extractedLoanData.fhaCaseNumber) fhaData.case_number = extractedLoanData.fhaCaseNumber;
          if (extractedLoanData.fhaCaseAssignedDate) fhaData.case_assigned_date = new Date(extractedLoanData.fhaCaseAssignedDate);
          if (extractedLoanData.financialAssessmentResult) fhaData.financial_assessment_result = extractedLoanData.financialAssessmentResult;
          if (extractedLoanData.lesaResult) fhaData.lesa_result = extractedLoanData.lesaResult;

          const cols = Object.keys(fhaData);
          const vals = Object.values(fhaData);
          const updateFragments = cols.map((c, i) => `"${c}" = $${i + 2}`);
          const insertCols = ['loan_id', ...cols];
          const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
          const q = `INSERT INTO loan_fha (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at)
                     VALUES (gen_random_uuid(), ${insertPlaceholders.join(', ')}, NOW(), NOW())
                     ON CONFLICT (loan_id) DO UPDATE SET ${updateFragments.join(', ')}, updated_at = NOW()`;
          await sql(q, [id, ...vals]);
        }

        // Upsert HECM satellite if HECM data present
        if (extractedLoanData.margin != null || extractedLoanData.maxClaimAmount != null) {
          const hecmData = {};
          if (extractedLoanData.margin != null) hecmData.margin = extractedLoanData.margin;
          if (extractedLoanData.maxClaimAmount != null) hecmData.max_claim_amount = extractedLoanData.maxClaimAmount;
          if (extractedLoanData.counselingExpiration) hecmData.counseling_expiration = new Date(extractedLoanData.counselingExpiration);
          if (extractedLoanData.pllExpiration) hecmData.pll_expiration = new Date(extractedLoanData.pllExpiration);

          const cols = Object.keys(hecmData);
          const vals = Object.values(hecmData);
          const updateFragments = cols.map((c, i) => `"${c}" = $${i + 2}`);
          const insertCols = ['loan_id', ...cols];
          const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
          const q = `INSERT INTO loan_hecm (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at)
                     VALUES (gen_random_uuid(), ${insertPlaceholders.join(', ')}, NOW(), NOW())
                     ON CONFLICT (loan_id) DO UPDATE SET ${updateFragments.join(', ')}, updated_at = NOW()`;
          await sql(q, [id, ...vals]);
        }

        // Update expiration dates on LoanDates
        const dateUpdates = {};
        if (extractedLoanData.appraisalExpires) dateUpdates.appraisal_expiry = new Date(extractedLoanData.appraisalExpires);
        if (extractedLoanData.creditExpires) dateUpdates.credit_expiration = new Date(extractedLoanData.creditExpires);
        if (extractedLoanData.titleExpires) dateUpdates.title_expiry = new Date(extractedLoanData.titleExpires);
        if (extractedLoanData.applicationDate) dateUpdates.application_date = new Date(extractedLoanData.applicationDate);

        if (Object.keys(dateUpdates).length > 0) {
          const cols = Object.keys(dateUpdates);
          const vals = Object.values(dateUpdates);
          const updateFragments = cols.map((c, i) => `"${c}" = $${i + 2}`);
          const insertCols = ['loan_id', ...cols];
          const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
          const q = `INSERT INTO loan_dates (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at)
                     VALUES (gen_random_uuid(), ${insertPlaceholders.join(', ')}, NOW(), NOW())
                     ON CONFLICT (loan_id) DO UPDATE SET ${updateFragments.join(', ')}, updated_at = NOW()`;
          await sql(q, [id, ...vals]);
        }
      }

      // Audit
      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'approval_conditions_created', 'mlo', ${mloId},
                ${JSON.stringify({ documentId, conditionsCreated: createdCount, conditionsDeleted: deletedCount, loanDataUpdated: !!extractedLoanData })},
                NOW())
      `;

      return NextResponse.json({
        success: true,
        conditionsCreated: createdCount,
        conditionsDeleted: deletedCount,
      });
    }

    // ─── Regular condition creation ───
    const { title, description, conditionType, stage, borrowerFacing, blockingProgress, dueDate, conditionNumber, ownerRole } = body;

    if (!title || !conditionType) {
      return NextResponse.json({ error: 'title and conditionType are required' }, { status: 400 });
    }

    const condRows = await sql`
      INSERT INTO conditions (id, loan_id, title, description, condition_type, stage, status, borrower_facing, blocking_progress, due_date, owner_role, condition_number, source, requested_date, created_at, updated_at)
      VALUES (gen_random_uuid(), ${id}, ${title}, ${description || null}, ${conditionType}, ${stage || 'prior_to_close'}, 'needed', ${borrowerFacing || false}, ${blockingProgress || false}, ${dueDate ? new Date(dueDate) : null}, ${ownerRole || 'mlo'}, ${conditionNumber ? parseInt(conditionNumber, 10) : null}, 'manual', NOW(), NOW(), NOW())
      RETURNING *
    `;
    const condition = condRows[0];

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'condition_created', 'mlo', ${mloId},
              ${JSON.stringify({ conditionId: condition.id, title, conditionType, stage: stage || 'prior_to_close' })},
              NOW())
    `;

    return NextResponse.json({ condition });
  } catch (error) {
    console.error('Condition create error:', error);
    return NextResponse.json({ error: 'Failed to create condition' }, { status: 500 });
  }
}

// ─── Update condition(s) — single or batch ─────────────────
export async function PATCH(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    const { id } = await params;
    const loan = await verifyMloAccess(id, session, orgId, mloId);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // ─── Batch update ───
    if (Array.isArray(body.batch)) {
      let updated = 0;
      for (const item of body.batch) {
        const existingRows = await sql`SELECT * FROM conditions WHERE id = ${item.conditionId} AND loan_id = ${id} LIMIT 1`;
        const existing = existingRows[0];
        if (!existing) continue;

        const updateData = {};
        if (item.status !== undefined) updateData.status = item.status;
        if (typeof item.blockingProgress === 'boolean') updateData.blocking_progress = item.blockingProgress;
        if (typeof item.borrowerFacing === 'boolean') updateData.borrower_facing = item.borrowerFacing;
        if (item.title !== undefined) updateData.title = item.title;
        if (item.description !== undefined) updateData.description = item.description || null;
        if (item.stage !== undefined) updateData.stage = item.stage;
        if (item.conditionType !== undefined) updateData.condition_type = item.conditionType;
        if (item.ownerRole !== undefined) updateData.owner_role = item.ownerRole;
        if (item.conditionNumber !== undefined) updateData.condition_number = item.conditionNumber ? parseInt(item.conditionNumber, 10) : null;
        if (item.dueDate !== undefined) updateData.due_date = item.dueDate ? new Date(item.dueDate) : null;

        if (item.status === 'received' && !existing.received_at) updateData.received_at = new Date();
        if (item.status === 'cleared' && !existing.cleared_at) updateData.cleared_at = new Date();

        if (Object.keys(updateData).length > 0) {
          const cols = Object.keys(updateData);
          const vals = Object.values(updateData);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          await sql(`UPDATE conditions SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...vals, item.conditionId]);
          updated++;
        }
      }

      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'conditions_batch_updated', 'mlo', ${mloId},
                ${JSON.stringify({ count: updated })}, NOW())
      `;

      return NextResponse.json({ success: true, updated });
    }

    // ─── Single update ───
    const {
      conditionId, status, notes, blockingProgress,
      title, description, stage, conditionType, ownerRole,
      dueDate, borrowerFacing, conditionNumber,
    } = body;

    if (!conditionId) {
      return NextResponse.json({ error: 'conditionId is required' }, { status: 400 });
    }

    const existingRows = await sql`SELECT * FROM conditions WHERE id = ${conditionId} AND loan_id = ${id} LIMIT 1`;
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Condition not found' }, { status: 404 });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (typeof blockingProgress === 'boolean') updateData.blocking_progress = blockingProgress;
    if (typeof borrowerFacing === 'boolean') updateData.borrower_facing = borrowerFacing;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (stage !== undefined) updateData.stage = stage;
    if (conditionType !== undefined) updateData.condition_type = conditionType;
    if (ownerRole !== undefined) updateData.owner_role = ownerRole;
    if (conditionNumber !== undefined) updateData.condition_number = conditionNumber ? parseInt(conditionNumber, 10) : null;
    if (dueDate !== undefined) updateData.due_date = dueDate ? new Date(dueDate) : null;

    // Append note to internal notes array
    if (notes) {
      const existingNotes = Array.isArray(existing.internal_notes) ? existing.internal_notes : [];
      updateData.internal_notes = JSON.stringify([
        ...existingNotes,
        { note: notes, author: mloId, timestamp: new Date().toISOString() },
      ]);
    }

    if (status === 'received' && !existing.received_at) updateData.received_at = new Date();
    if (status === 'cleared' && !existing.cleared_at) updateData.cleared_at = new Date();

    if (Object.keys(updateData).length > 0) {
      const cols = Object.keys(updateData);
      const vals = Object.values(updateData);
      const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
      const q = `UPDATE conditions SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
      const condRows = await sql(q, [...vals, conditionId]);
      const condition = condRows[0];

      // Audit
      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'condition_updated', 'mlo', ${mloId},
                ${JSON.stringify({ conditionId, changes: Object.keys(updateData), newStatus: status || undefined })},
                NOW())
      `;

      return NextResponse.json({ condition });
    }

    return NextResponse.json({ condition: existing });
  } catch (error) {
    console.error('Condition update error:', error);
    return NextResponse.json({ error: 'Failed to update condition' }, { status: 500 });
  }
}

// ─── Upload approval PDF + auto-extract ────────────────────
export async function PUT(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    const { id } = await params;
    const loan = await verifyMloAccess(id, session, orgId, mloId);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (file.type !== 'application/pdf' && fileExt !== '.pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit' }, { status: 400 });
    }

    let fileBuffer;
    try {
      fileBuffer = await file.arrayBuffer();
    } catch (bufErr) {
      return NextResponse.json({ error: `Buffer read failed: ${bufErr.message}` }, { status: 500 });
    }

    // Upload to WorkDrive (if available)
    let fileUrl = null;
    const subfolders = loan.work_drive_subfolders;
    if (loan.work_drive_folder_id && subfolders) {
      const targetFolderId = subfolders['APPROVALS'] || subfolders['CLOSING'] || loan.work_drive_folder_id;
      try {
        const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
        const uploaded = await uploadFile(fileBlob, file.name, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
      } catch (wdErr) {
        console.error('WorkDrive upload failed (continuing without file storage):', wdErr?.message);
      }
    }

    // Create Document record
    let doc;
    try {
      const docRows = await sql`
        INSERT INTO documents (id, loan_id, doc_type, label, status, requested_by, file_url, file_name, file_size, uploaded_at, created_at)
        VALUES (gen_random_uuid(), ${id}, 'approval', ${file.name.replace(/\.[^.]+$/, '')}, 'uploaded', ${mloId}, ${fileUrl}, ${file.name}, ${file.size}, NOW(), NOW())
        RETURNING *
      `;
      doc = docRows[0];
    } catch (dbErr) {
      return NextResponse.json({ error: `Document record failed: ${dbErr.message}` }, { status: 500 });
    }

    // Extract via Claude
    let extraction;
    try {
      const borrowerRows = loan.borrower_id
        ? await sql`SELECT first_name, last_name FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`
        : [];
      const borrower = borrowerRows[0];
      const loanContext = {
        borrowerName: borrower ? `${borrower.first_name} ${borrower.last_name}` : undefined,
        loanNumber: loan.loan_number || undefined,
        propertyAddress: loan.property_address || undefined,
      };
      extraction = await extractApprovalData({ fileBuffer, loanContext });
    } catch (extractErr) {
      return NextResponse.json({ error: `Extraction failed: ${extractErr.message}` }, { status: 500 });
    }

    // Store extraction result on document notes
    try {
      await sql`UPDATE documents SET notes = ${JSON.stringify(extraction)} WHERE id = ${doc.id}`;
    } catch (noteErr) {
      console.error('Failed to save extraction notes:', noteErr.message);
    }

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'approval_uploaded', 'mlo', ${mloId},
              ${JSON.stringify({ documentId: doc.id, fileName: file.name, extractionStatus: extraction.status, conditionsFound: extraction.data?.conditions?.length || 0 })},
              NOW())
    `.catch(() => {});

    return NextResponse.json({ document: doc, extraction });
  } catch (error) {
    console.error('Approval upload error:', error);
    return NextResponse.json({ error: `Failed to process approval: ${error.message}` }, { status: 500 });
  }
}
