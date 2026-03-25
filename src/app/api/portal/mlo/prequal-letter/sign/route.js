// API: Pre-Qualification Letter — Zoho Sign
// POST /api/portal/mlo/prequal-letter/sign
// Receives PDF blob + signer info, creates Zoho Sign request for MLO e-signature.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSigningRequest } from '@/lib/zoho-sign';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const mloName = formData.get('mloName');
    const mloEmail = formData.get('mloEmail');
    const borrowerNames = formData.get('borrowerNames');
    // loanId available for future use (storing signed docs against loans)
    // const loanId = formData.get('loanId');

    if (!file || !mloName || !mloEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: file, mloName, mloEmail' },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    const fileName = file.name || `NetRate-PreQual-${Date.now()}.pdf`;

    const result = await createSigningRequest({
      pdfBuffer,
      fileName,
      signerName: mloName,
      signerEmail: mloEmail,
      description: borrowerNames
        ? `Pre-Qualification Letter for ${borrowerNames}`
        : 'Pre-Qualification Letter',
    });

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      status: result.requestStatus,
      signUrl: result.signUrl || null,
      message: result.signUrl
        ? 'Ready to sign'
        : `Signing request sent to ${mloEmail}`,
    });
  } catch (err) {
    console.error('Prequal letter sign error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create signing request' },
      { status: 500 }
    );
  }
}
