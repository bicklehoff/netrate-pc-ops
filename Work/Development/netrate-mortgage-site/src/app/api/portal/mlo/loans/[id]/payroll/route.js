// API: Payroll — CD Upload + Send to Payroll
// PUT  /api/portal/mlo/loans/:id/payroll — Upload/replace the final Closing Disclosure PDF
// POST /api/portal/mlo/loans/:id/payroll — Send CD + loan data to payroll (marks loan)
// GET  /api/portal/mlo/loans/:id/payroll — Get payroll status for this loan
//
// The CD PDF is uploaded to WorkDrive's CLOSING subfolder. "Send to Payroll" marks
// the loan with payrollSentAt timestamp. Mac queries for funded loans with payrollSentAt
// set, fetches the CD from WorkDrive, and runs it through GCS OCR.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadFile, createLoanFolder } from '@/lib/zoho-workdrive';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      borrower: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      mlo: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mloId !== session.user.id) return null;
  return loan;
}

// ─── GET: Payroll status ─────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      loanId: loan.id,
      status: loan.status,
      cdWorkDriveFileId: loan.cdWorkDriveFileId,
      cdFileName: loan.cdFileName,
      payrollSentAt: loan.payrollSentAt,
      isFunded: loan.status === 'funded',
      hasCD: !!loan.cdWorkDriveFileId,
      isSent: !!loan.payrollSentAt,
    });
  } catch (error) {
    console.error('Payroll status error:', error);
    return NextResponse.json({ error: 'Failed to get payroll status' }, { status: 500 });
  }
}

// ─── PUT: Upload/replace the final CD ────────────────────────
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

    // Must be a PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Closing Disclosure must be a PDF file' }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit' }, { status: 400 });
    }

    // Upload to WorkDrive CLOSING subfolder — auto-create if missing
    let closingFolderId = loan.workDriveSubfolders?.CLOSING;

    if (!closingFolderId) {
      // Auto-create WorkDrive folder structure for this loan
      const loName = loan.mlo
        ? `${loan.mlo.firstName} ${loan.mlo.lastName}`
        : 'David Burson';

      const wdResult = await createLoanFolder({
        borrowerFirstName: loan.borrower?.firstName || 'Unknown',
        borrowerLastName: loan.borrower?.lastName || 'Unknown',
        purpose: loan.purpose || 'purchase',
        loName,
      });

      // Save the folder IDs on the loan for future use
      await prisma.loan.update({
        where: { id },
        data: {
          workDriveFolderId: wdResult.rootFolderId,
          workDriveSubfolders: wdResult.subfolders,
        },
      });

      closingFolderId = wdResult.subfolders.CLOSING;
    }

    const uploaded = await uploadFile(file, file.name, closingFolderId, true);

    // Store the CD reference on the loan
    await prisma.loan.update({
      where: { id },
      data: {
        cdWorkDriveFileId: uploaded.id,
        cdFileName: file.name,
        // Clear payrollSentAt if replacing CD after already sending
        payrollSentAt: null,
      },
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'cd_uploaded',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: file.name,
        details: {
          workDriveFileId: uploaded.id,
          fileName: file.name,
          fileSize: file.size,
          folder: 'CLOSING',
          replacedPrevious: !!loan.cdWorkDriveFileId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      cdWorkDriveFileId: uploaded.id,
      cdFileName: file.name,
    });
  } catch (error) {
    console.error('CD upload error:', error);
    return NextResponse.json({ error: 'CD upload failed' }, { status: 500 });
  }
}

// ─── POST: Send to Payroll ───────────────────────────────────
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

    if (!loan.cdWorkDriveFileId) {
      return NextResponse.json(
        { error: 'Upload the final Closing Disclosure before sending to payroll' },
        { status: 400 }
      );
    }

    if (loan.payrollSentAt) {
      return NextResponse.json(
        { error: 'Already sent to payroll. Upload a new CD to re-send.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Build the payroll data snapshot
    const payrollData = {
      loanId: loan.id,
      borrowerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      borrowerEmail: loan.borrower.email,
      mloName: loan.mlo ? `${loan.mlo.firstName} ${loan.mlo.lastName}` : null,
      mloEmail: loan.mlo?.email || null,
      loanNumber: loan.loanNumber,
      lenderName: loan.lenderName,
      loanType: loan.loanType,
      loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
      interestRate: loan.interestRate ? Number(loan.interestRate) : null,
      loanTerm: loan.loanTerm,
      purpose: loan.purpose,
      propertyAddress: loan.propertyAddress,
      // CD file reference — Mac uses this to fetch from WorkDrive
      cdWorkDriveFileId: loan.cdWorkDriveFileId,
      cdFileName: loan.cdFileName,
      workDriveFolderId: loan.workDriveFolderId,
      sentAt: now.toISOString(),
      sentBy: session.user.id,
    };

    // Mark loan as sent to payroll
    await prisma.loan.update({
      where: { id },
      data: { payrollSentAt: now },
    });

    // Audit event with full payroll snapshot
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'payroll_sent',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: 'Sent to payroll',
        details: payrollData,
      },
    });

    return NextResponse.json({
      success: true,
      payrollSentAt: now.toISOString(),
      payrollData,
    });
  } catch (error) {
    console.error('Send to payroll error:', error);
    return NextResponse.json({ error: 'Failed to send to payroll' }, { status: 500 });
  }
}
