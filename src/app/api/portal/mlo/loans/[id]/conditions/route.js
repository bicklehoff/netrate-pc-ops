// Conditions CRUD API
// GET    /api/portal/mlo/loans/:id/conditions — List all conditions
// POST   /api/portal/mlo/loans/:id/conditions — Create condition OR confirm approval extraction
// PATCH  /api/portal/mlo/loans/:id/conditions — Update condition status/fields
// PUT    /api/portal/mlo/loans/:id/conditions — Upload approval PDF + auto-extract
// Auth: MLO session

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { put } from '@vercel/blob';
import { uploadFile, getSubfolderForDocType } from '@/lib/zoho-workdrive';
import { extractApprovalData } from '@/lib/approval-extractor';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mloId !== session.user.id) return null;
  return loan;
}

// ─── List conditions ────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conditions = await prisma.condition.findMany({
      where: { loanId: id },
      orderBy: [{ stage: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ conditions });
  } catch (error) {
    console.error('Conditions list error:', error);
    return NextResponse.json({ error: 'Failed to list conditions' }, { status: 500 });
  }
}

// ─── Create condition OR confirm approval extraction ────────
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
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
      const deleted = await prisma.condition.deleteMany({
        where: { loanId: id, source: 'approval' },
      });

      // Bulk-create new conditions from extraction
      const created = await prisma.condition.createMany({
        data: extractedConditions.map((c) => ({
          loanId: id,
          conditionNumber: c.conditionNumber ? parseInt(c.conditionNumber, 10) : null,
          title: c.title,
          conditionType: c.conditionType || 'document',
          stage: c.stage || 'prior_to_close',
          ownerRole: c.ownerRole || 'mlo',
          status: 'needed',
          source: 'approval',
          documentId,
          requestedDate: new Date(),
        })),
      });

      // Update loan universal fields from extracted loan data
      if (extractedLoanData) {
        const loanUpdate = {};
        if (extractedLoanData.appraisedValue != null) loanUpdate.appraisedValue = extractedLoanData.appraisedValue;
        if (extractedLoanData.loanProgram) loanUpdate.loanProgram = extractedLoanData.loanProgram;
        if (extractedLoanData.underwriterName) loanUpdate.underwriterName = extractedLoanData.underwriterName;
        if (extractedLoanData.accountExec) loanUpdate.accountExec = extractedLoanData.accountExec;
        if (extractedLoanData.brokerProcessor) loanUpdate.brokerProcessor = extractedLoanData.brokerProcessor;
        if (extractedLoanData.loanNumber) loanUpdate.loanNumber = extractedLoanData.loanNumber;

        if (Object.keys(loanUpdate).length > 0) {
          await prisma.loan.update({ where: { id }, data: loanUpdate });
        }

        // Upsert FHA satellite if FHA data present
        if (extractedLoanData.fhaCaseNumber || extractedLoanData.financialAssessmentResult) {
          const fhaData = {};
          if (extractedLoanData.fhaCaseNumber) fhaData.caseNumber = extractedLoanData.fhaCaseNumber;
          if (extractedLoanData.fhaCaseAssignedDate) fhaData.caseAssignedDate = new Date(extractedLoanData.fhaCaseAssignedDate);
          if (extractedLoanData.financialAssessmentResult) fhaData.financialAssessmentResult = extractedLoanData.financialAssessmentResult;
          if (extractedLoanData.lesaResult) fhaData.lesaResult = extractedLoanData.lesaResult;

          await prisma.loanFha.upsert({
            where: { loanId: id },
            create: { loanId: id, ...fhaData },
            update: fhaData,
          });
        }

        // Upsert HECM satellite if HECM data present
        if (extractedLoanData.margin != null || extractedLoanData.maxClaimAmount != null) {
          const hecmData = {};
          if (extractedLoanData.margin != null) hecmData.margin = extractedLoanData.margin;
          if (extractedLoanData.maxClaimAmount != null) hecmData.maxClaimAmount = extractedLoanData.maxClaimAmount;
          if (extractedLoanData.counselingExpiration) hecmData.counselingExpiration = new Date(extractedLoanData.counselingExpiration);
          if (extractedLoanData.pllExpiration) hecmData.pllExpiration = new Date(extractedLoanData.pllExpiration);

          await prisma.loanHecm.upsert({
            where: { loanId: id },
            create: { loanId: id, ...hecmData },
            update: hecmData,
          });
        }

        // Update expiration dates on LoanDates
        const dateUpdates = {};
        if (extractedLoanData.appraisalExpires) dateUpdates.appraisalExpiry = new Date(extractedLoanData.appraisalExpires);
        if (extractedLoanData.creditExpires) dateUpdates.creditExpiration = new Date(extractedLoanData.creditExpires);
        if (extractedLoanData.titleExpires) dateUpdates.titleExpiry = new Date(extractedLoanData.titleExpires);
        if (extractedLoanData.applicationDate) dateUpdates.applicationDate = new Date(extractedLoanData.applicationDate);

        if (Object.keys(dateUpdates).length > 0) {
          await prisma.loanDates.upsert({
            where: { loanId: id },
            create: { loanId: id, ...dateUpdates },
            update: dateUpdates,
          });
        }
      }

      // Audit
      await prisma.loanEvent.create({
        data: {
          loanId: id,
          eventType: 'approval_conditions_created',
          actorType: 'mlo',
          actorId: session.user.id,
          details: {
            documentId,
            conditionsCreated: created.count,
            conditionsDeleted: deleted.count,
            loanDataUpdated: !!extractedLoanData,
          },
        },
      });

      return NextResponse.json({
        success: true,
        conditionsCreated: created.count,
        conditionsDeleted: deleted.count,
      });
    }

    // ─── Regular condition creation ───
    const { title, description, conditionType, stage, borrowerFacing, blockingProgress, dueDate, conditionNumber, ownerRole } = body;

    if (!title || !conditionType) {
      return NextResponse.json({ error: 'title and conditionType are required' }, { status: 400 });
    }

    const condition = await prisma.condition.create({
      data: {
        loanId: id,
        title,
        description: description || null,
        conditionType,
        stage: stage || 'prior_to_close',
        status: 'needed',
        borrowerFacing: borrowerFacing || false,
        blockingProgress: blockingProgress || false,
        dueDate: dueDate ? new Date(dueDate) : null,
        ownerRole: ownerRole || 'mlo',
        conditionNumber: conditionNumber ? parseInt(conditionNumber, 10) : null,
        source: 'manual',
        requestedDate: new Date(),
      },
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'condition_created',
        actorType: 'mlo',
        actorId: session.user.id,
        details: { conditionId: condition.id, title, conditionType, stage: stage || 'prior_to_close' },
      },
    });

    return NextResponse.json({ condition });
  } catch (error) {
    console.error('Condition create error:', error);
    return NextResponse.json({ error: 'Failed to create condition' }, { status: 500 });
  }
}

// ─── Update condition ───────────────────────────────────────
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      conditionId, status, notes, blockingProgress,
      title, description, stage, conditionType, ownerRole,
      dueDate, borrowerFacing, conditionNumber,
    } = body;

    if (!conditionId) {
      return NextResponse.json({ error: 'conditionId is required' }, { status: 400 });
    }

    // Verify condition belongs to this loan
    const existing = await prisma.condition.findFirst({
      where: { id: conditionId, loanId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Condition not found' }, { status: 404 });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (typeof blockingProgress === 'boolean') updateData.blockingProgress = blockingProgress;
    if (typeof borrowerFacing === 'boolean') updateData.borrowerFacing = borrowerFacing;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (stage !== undefined) updateData.stage = stage;
    if (conditionType !== undefined) updateData.conditionType = conditionType;
    if (ownerRole !== undefined) updateData.ownerRole = ownerRole;
    if (conditionNumber !== undefined) updateData.conditionNumber = conditionNumber ? parseInt(conditionNumber, 10) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    // Append note to internal notes array
    if (notes) {
      const existingNotes = Array.isArray(existing.internalNotes) ? existing.internalNotes : [];
      updateData.internalNotes = [
        ...existingNotes,
        {
          note: notes,
          author: session.user.id,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    // Auto-set timestamps on status transitions
    if (status === 'received' && !existing.receivedAt) {
      updateData.receivedAt = new Date();
    }
    if (status === 'cleared' && !existing.clearedAt) {
      updateData.clearedAt = new Date();
    }

    const condition = await prisma.condition.update({
      where: { id: conditionId },
      data: updateData,
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'condition_updated',
        actorType: 'mlo',
        actorId: session.user.id,
        details: {
          conditionId,
          changes: Object.keys(updateData),
          newStatus: status || undefined,
        },
      },
    });

    return NextResponse.json({ condition });
  } catch (error) {
    console.error('Condition update error:', error);
    return NextResponse.json({ error: 'Failed to update condition' }, { status: 500 });
  }
}

// ─── Upload approval PDF + auto-extract ────────────────────
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate PDF
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (file.type !== 'application/pdf' && fileExt !== '.pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit' }, { status: 400 });
    }

    // ─── Upload to WorkDrive APPROVALS subfolder (or Blob fallback) ───
    let fileUrl;
    const subfolders = loan.workDriveSubfolders;

    if (loan.workDriveFolderId && subfolders) {
      const targetFolderId = subfolders['APPROVALS'] || subfolders['CLOSING'] || loan.workDriveFolderId;
      try {
        const uploaded = await uploadFile(file, file.name, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
      } catch (wdError) {
        console.error('WorkDrive upload failed, falling back to Blob:', wdError?.message);
        const blob = await put(`loans/${id}/approvals/${file.name}`, file, {
          access: 'public',
          addRandomSuffix: true,
        });
        fileUrl = blob.url;
      }
    } else {
      const blob = await put(`loans/${id}/approvals/${file.name}`, file, {
        access: 'public',
        addRandomSuffix: true,
      });
      fileUrl = blob.url;
    }

    // ─── Create Document record ───
    const doc = await prisma.document.create({
      data: {
        loanId: id,
        docType: 'approval',
        label: file.name.replace(/\.[^.]+$/, ''),
        status: 'uploaded',
        requestedById: session.user.id,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date(),
      },
    });

    // ─── Extract via Claude ───
    const borrower = await prisma.borrower.findUnique({ where: { id: loan.borrowerId } });
    const loanContext = {
      borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : undefined,
      loanNumber: loan.loanNumber || undefined,
      propertyAddress: loan.propertyAddress || undefined,
    };

    const fileBuffer = await file.arrayBuffer();
    const extraction = await extractApprovalData({ fileBuffer, loanContext });

    // Store extraction result on document notes
    await prisma.document.update({
      where: { id: doc.id },
      data: { notes: JSON.stringify(extraction) },
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'approval_uploaded',
        actorType: 'mlo',
        actorId: session.user.id,
        details: {
          documentId: doc.id,
          fileName: file.name,
          extractionStatus: extraction.status,
          conditionsFound: extraction.data?.conditions?.length || 0,
        },
      },
    });

    return NextResponse.json({ document: doc, extraction });
  } catch (error) {
    console.error('Approval upload error:', error);
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
