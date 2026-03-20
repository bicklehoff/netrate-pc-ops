// Create WorkDrive folder for a loan that doesn't have one
// POST /api/portal/mlo/loans/:id/files/create-folder
// Auth: MLO session
//
// Creates the full folder structure (SUBMITTED, EXTRA, CLOSING)
// and links it to the loan record.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createLoanFolder } from '@/lib/zoho-workdrive';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: { select: { firstName: true, lastName: true } },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (loan.workDriveFolderId) {
      return NextResponse.json({ error: 'Loan already has a WorkDrive folder' }, { status: 400 });
    }

    if (!loan.borrower?.firstName || !loan.borrower?.lastName) {
      return NextResponse.json({ error: 'Borrower name is required to create folder' }, { status: 400 });
    }

    // Create folder structure in WorkDrive
    const folder = await createLoanFolder({
      borrowerFirstName: loan.borrower.firstName,
      borrowerLastName: loan.borrower.lastName,
      purpose: loan.purpose || 'purchase',
    });

    // Link folder to loan
    await prisma.loan.update({
      where: { id },
      data: {
        workDriveFolderId: folder.rootFolderId,
        workDriveSubfolders: folder.subfolders,
      },
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'workdrive_folder_created',
        actorType: 'mlo',
        actorId: session.user.id,
        details: {
          folderId: folder.rootFolderId,
          subfolders: folder.subfolders,
        },
      },
    });

    return NextResponse.json({
      success: true,
      folderId: folder.rootFolderId,
      subfolders: folder.subfolders,
    });
  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
