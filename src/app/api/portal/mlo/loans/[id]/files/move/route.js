// Move file between WorkDrive folders (e.g., FLOOR → SUBMITTED)
// POST /api/portal/mlo/loans/:id/files/move
// Body: { fileId, targetFolder }
// Auth: MLO session
//
// Downloads file from source, uploads to target folder, deletes original.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { downloadFile, uploadFile, deleteResource } from '@/lib/zoho-workdrive';

const VALID_FOLDERS = ['FLOOR', 'SUBMITTED', 'EXTRA', 'CLOSING'];

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const loanRows = await sql`SELECT * FROM loans WHERE id = ${id} LIMIT 1`;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { fileId, fileName, targetFolder } = await request.json();
    if (!fileId || !targetFolder) {
      return NextResponse.json({ error: 'fileId and targetFolder are required' }, { status: 400 });
    }

    if (!VALID_FOLDERS.includes(targetFolder)) {
      return NextResponse.json(
        { error: `targetFolder must be one of: ${VALID_FOLDERS.join(', ')}` },
        { status: 400 }
      );
    }

    const subfolders = loan.work_drive_subfolders || {};

    let targetFolderId;
    if (targetFolder === 'FLOOR') {
      targetFolderId = loan.work_drive_folder_id;
    } else {
      targetFolderId = subfolders[targetFolder];
    }

    if (!targetFolderId) {
      return NextResponse.json(
        { error: `No WorkDrive folder found for ${targetFolder}` },
        { status: 400 }
      );
    }

    // Download file
    const { stream, contentType } = await downloadFile(fileId);

    // Read into buffer
    const chunks = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    const name = fileName || 'moved-file';
    const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' });

    // Upload to target folder
    const uploaded = await uploadFile(blob, name, targetFolderId, false);

    // Delete original
    await deleteResource(fileId);

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'doc_moved', 'mlo', ${session.user.id},
              ${JSON.stringify({ fileName: name, targetFolder, originalFileId: fileId, newFileId: uploaded?.id || null })},
              NOW())
    `;

    return NextResponse.json({
      success: true,
      newFileId: uploaded?.id || null,
      targetFolder,
    });
  } catch (error) {
    console.error('File move error:', error);
    return NextResponse.json(
      { error: error.message || 'Move failed' },
      { status: 500 }
    );
  }
}
