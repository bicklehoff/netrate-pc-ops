// API: MISMO 3.4 XML Export + Submission Snapshot
// GET  /api/portal/mlo/loans/:id/xml — Download XML file
// POST /api/portal/mlo/loans/:id/xml — Export + save snapshot to Vercel Blob as immutable audit document
//
// GET: Returns XML as file download (no snapshot saved)
// POST body: { lender?: string } — Exports, saves snapshot to Blob, creates LoanDocument record

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { put } from '@vercel/blob';
import { buildMismoXml } from '@/lib/mismo-builder';

// Fetch full loan with all 1003 relations
async function fetchFullLoan(id) {
  return prisma.loan.findUnique({
    where: { id },
    include: {
      borrower: true,
      mlo: { select: { id: true, firstName: true, lastName: true, email: true, nmls: true } },
      loanBorrowers: {
        orderBy: { ordinal: 'asc' },
        include: {
          borrower: true,
          employments: { orderBy: { isPrimary: 'desc' } },
          income: true,
          declaration: true,
        },
      },
      assets: { orderBy: { createdAt: 'asc' } },
      liabilities: { orderBy: { createdAt: 'asc' } },
      reos: { orderBy: { createdAt: 'asc' } },
      transaction: true,
    },
  });
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
      if (lb.dobEncrypted) dob = decrypt(lb.dobEncrypted) || dob;
    } catch {
      // Decryption fail — leave blank
    }
    result.push({ borrowerId: borr.id, ssn, dob });
  }
  return result;
}

// Serialize decimals for the loan object
function serializeDecimals(obj) {
  if (!obj) return null;
  const result = { ...obj };
  for (const [key, val] of Object.entries(result)) {
    if (val && typeof val === 'object' && typeof val.toNumber === 'function') {
      result[key] = Number(val);
    }
  }
  return result;
}

function serializeLoan(loan) {
  return {
    ...loan,
    loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
    interestRate: loan.interestRate ? Number(loan.interestRate) : null,
    purchasePrice: loan.purchasePrice ? Number(loan.purchasePrice) : null,
    estimatedValue: loan.estimatedValue ? Number(loan.estimatedValue) : null,
    armMargin: loan.armMargin ? Number(loan.armMargin) : null,
    armInitialCap: loan.armInitialCap ? Number(loan.armInitialCap) : null,
    armPeriodicCap: loan.armPeriodicCap ? Number(loan.armPeriodicCap) : null,
    armLifetimeCap: loan.armLifetimeCap ? Number(loan.armLifetimeCap) : null,
    loanBorrowers: (loan.loanBorrowers || []).map((lb) => ({
      ...lb,
      monthlyRent: lb.monthlyRent ? Number(lb.monthlyRent) : null,
      income: serializeDecimals(lb.income),
      employments: (lb.employments || []).map(serializeDecimals),
    })),
    assets: (loan.assets || []).map(serializeDecimals),
    liabilities: (loan.liabilities || []).map(serializeDecimals),
    reos: (loan.reos || []).map(serializeDecimals),
    transaction: serializeDecimals(loan.transaction),
  };
}

// ─── GET: Download XML (no snapshot) ──────────────────────

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const loan = await fetchFullLoan(id);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const serialized = serializeLoan(loan);
    const decryptedBorrowers = decryptBorrowers(loan);
    const xml = buildMismoXml(serialized, { decryptedBorrowers });

    const borrowerName = loan.borrower
      ? `${loan.borrower.lastName}_${loan.borrower.firstName}`.replace(/\s+/g, '_')
      : 'export';
    const filename = `${borrowerName}_${loan.loanNumber || id.substring(0, 8)}.xml`;

    // Audit event
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'xml_export',
        actorType: 'mlo',
        actorId: session.user.id,
        details: { action: 'download', format: 'MISMO_3.4' },
      },
    });

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
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const lender = body.lender || null;

    const loan = await fetchFullLoan(id);

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const serialized = serializeLoan(loan);
    const decryptedBorrowers = decryptBorrowers(loan);
    const xml = buildMismoXml(serialized, { decryptedBorrowers });

    const borrowerName = loan.borrower
      ? `${loan.borrower.lastName}_${loan.borrower.firstName}`.replace(/\s+/g, '_')
      : 'export';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${borrowerName}_${loan.loanNumber || id.substring(0, 8)}_${timestamp}.xml`;

    // ─── Save to Vercel Blob (immutable snapshot) ─────────
    const blob = await put(
      `loans/${id}/submissions/${filename}`,
      xml,
      { access: 'public', contentType: 'application/xml', addRandomSuffix: true }
    );

    // ─── Create LoanDocument record ───────────────────────
    const doc = await prisma.document.create({
      data: {
        loanId: id,
        docType: 'submission_package',
        label: `Submission Package${lender ? ` — ${lender}` : ''} (${new Date().toLocaleDateString('en-US')})`,
        status: 'uploaded',
        fileUrl: blob.url,
        fileName: filename,
        fileSize: Buffer.byteLength(xml, 'utf-8'),
        uploadedAt: new Date(),
        requestedById: session.user.id,
        notes: JSON.stringify({
          format: 'MISMO_3.4',
          lender,
          exportedBy: session.user.id,
          exportDate: new Date().toISOString(),
          borrowerCount: (loan.loanBorrowers || []).length,
          snapshotType: 'submission_package',
        }),
      },
    });

    // ─── Audit event ──────────────────────────────────────
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'xml_export',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: JSON.stringify({
          documentId: doc.id,
          blobUrl: blob.url,
          lender,
        }),
        details: {
          action: 'submission_snapshot',
          format: 'MISMO_3.4',
          lender,
          filename,
        },
      },
    });

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      blobUrl: blob.url,
      filename,
      lender,
    });
  } catch (error) {
    console.error('XML snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
