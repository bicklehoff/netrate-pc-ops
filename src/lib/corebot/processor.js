// CoreBot Document Processor — the brain
// Orchestrates: download from WorkDrive → identify via Claude → rename → update conditions
//
// Called by: POST /api/corebot/process (batch) and /api/corebot/identify (single)

import { askClaudeWithDocs } from '@/lib/anthropic';
import { listFolder, downloadFile, renameFile } from '@/lib/zoho-workdrive';
import { isNamedDoc, buildDocName } from '@/lib/constants/doc-types';
import { getSubmissionChecklist, getProcessingPhase } from '@/lib/constants/submission-checklists';
import { SYSTEM_PROMPT, buildIdentifyPrompt } from './prompts';
import sql from '@/lib/db';

// Max time per file (leave headroom for Vercel's 60s limit)
const PER_FILE_TIMEOUT_MS = 15000;
const MAX_TOTAL_MS = 50000;

// ─── Loan Context Builder ────────────────────────────────────

/**
 * Build loan context for Claude identification prompts.
 */
async function buildLoanContext(loan) {
  const context = {
    borrowerFirstName: loan.borrower_first_name || null,
    borrowerLastName: loan.borrower_last_name || null,
    propertyAddress: loan.property_street || null,
    loanType: loan.loan_type || null,
    purpose: loan.purpose || null,
    lenderName: loan.lender_name || null,
  };

  // Get co-borrower if exists
  if (loan._loanBorrowers?.length > 1) {
    const coBorrower = loan._loanBorrowers.find((lb) => lb.borrower_type === 'co_borrower');
    if (coBorrower) {
      context.coBorrowerFirstName = coBorrower.b_first_name;
      context.coBorrowerLastName = coBorrower.b_last_name;
    }
  }

  return context;
}

// ─── Single File Identification ──────────────────────────────

/**
 * Identify a single file using Claude API.
 * Downloads from WorkDrive, sends to Claude with loan context.
 *
 * @param {string} fileId — WorkDrive file ID
 * @param {string} fileName — original filename
 * @param {object} loanContext — borrower name, property, etc.
 * @returns {Promise<object>} — identification result
 */
export async function identifyFile(fileId, fileName, loanContext) {
  // Download file from WorkDrive
  const { stream, contentType } = await downloadFile(fileId);

  // Read stream into buffer
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

  const base64 = Buffer.from(buffer).toString('base64');

  // Determine content type for Claude
  const isPdf = contentType?.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType?.includes('image') || /\.(png|jpg|jpeg)$/i.test(fileName);

  // Build content blocks for Claude
  const content = [];

  if (isPdf) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    });
  } else if (isImage) {
    const mediaType = contentType || (fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    });
  } else {
    return {
      originalName: fileName,
      prefix: 'UNK',
      confidence: 0,
      error: `Unsupported file type: ${contentType}`,
      action: 'skipped',
    };
  }

  // Add the identification prompt
  content.push({
    type: 'text',
    text: buildIdentifyPrompt({ fileName, loanContext }),
  });

  // Call Claude — catch encrypted PDF errors
  let response;
  try {
    response = await askClaudeWithDocs({
      system: SYSTEM_PROMPT,
      content,
      maxTokens: 1024,
    });
  } catch (apiErr) {
    const msg = apiErr?.message || apiErr?.error?.message || String(apiErr);
    const isEncrypted = /encrypt|password.protect|could not process|cannot read/i.test(msg);
    if (isEncrypted) {
      return {
        originalName: fileName,
        fileId,
        prefix: 'LOCKED',
        newFileName: `LOCKED-${fileName}`,
        confidence: 1.0,
        error: 'Password-protected document',
        action: 'rename',
      };
    }
    throw apiErr;
  }

  // Check if Claude says the document is encrypted/unreadable
  if (/password.protect|encrypted|cannot (be )?read|unable to (read|open|access)/i.test(response)) {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    if (!parsed.prefix || parsed.prefix === 'UNK' || parsed.confidence < 0.3) {
      return {
        originalName: fileName,
        fileId,
        prefix: 'LOCKED',
        newFileName: `LOCKED-${fileName}`,
        confidence: 1.0,
        error: 'Password-protected document',
        action: 'rename',
      };
    }
  }

  // Parse JSON response
  try {
    // Extract JSON from response (Claude sometimes wraps in markdown)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const result = JSON.parse(jsonMatch[0]);
    const prefix = result.prefix || 'UNK';
    const subtype = result.subtype || null;
    const identifier = result.identifier || null;
    const date = result.date || null;
    const confidence = result.confidence || 0;

    // Get file extension from original filename
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';

    // Build newFileName from parts if Claude didn't return one
    let newFileName = result.newFileName || null;
    if (!newFileName && prefix !== 'UNK' && subtype) {
      newFileName = buildDocName(prefix, subtype, identifier, date, ext);
    }

    return {
      originalName: fileName,
      fileId,
      prefix,
      subtype,
      identifier,
      date,
      newFileName,
      confidence,
      extractedData: result.extractedData || {},
      action: confidence >= 0.7 ? 'rename' : confidence >= 0.5 ? 'suggest' : 'flagged',
    };
  } catch (parseErr) {
    console.error('[CoreBot] Failed to parse Claude response:', parseErr.message, response);
    return {
      originalName: fileName,
      fileId,
      prefix: 'UNK',
      confidence: 0,
      error: 'Failed to parse identification response',
      action: 'flagged',
    };
  }
}

// ─── Batch Process ───────────────────────────────────────────

/**
 * Process all documents on the FLOOR of a loan's WorkDrive folder.
 * Identifies, renames, and updates conditions/checklist.
 *
 * @param {string} loanId — Loan database ID
 * @param {string} mloId — MLO who triggered processing
 * @returns {Promise<object>} — processing report
 */
export async function processLoanDocuments(loanId, mloId) {
  const startTime = Date.now();

  // Load loan with borrower info and loan_borrowers
  const loanRows = await sql`
    SELECT l.*,
           b.first_name AS borrower_first_name,
           b.last_name AS borrower_last_name
    FROM loans l
    LEFT JOIN contacts b ON l.contact_id = b.id
    WHERE l.id = ${loanId}
    LIMIT 1
  `;
  const loan = loanRows[0];

  if (!loan) throw new Error('Loan not found');
  if (!loan.work_drive_folder_id) throw new Error('No WorkDrive folder for this loan');

  // Load loan_borrowers with borrower names
  const loanBorrowers = await sql`
    SELECT lb.borrower_type,
           b.first_name AS b_first_name,
           b.last_name AS b_last_name
    FROM loan_borrowers lb
    JOIN contacts b ON lb.contact_id = b.id
    WHERE lb.loan_id = ${loanId}
  `;
  loan._loanBorrowers = loanBorrowers;

  // Load conditions
  const conditions = await sql`
    SELECT * FROM conditions WHERE loan_id = ${loanId}
  `;
  loan._conditions = conditions;

  const subfolders = loan.work_drive_subfolders || {};
  const floorFolderId = subfolders.FLOOR || loan.work_drive_folder_id;

  // List FLOOR files
  const floorFiles = await listFolder(floorFolderId);

  // Filter out already-named files and folders
  const filesToProcess = floorFiles.filter((f) => !f.isFolder && !isNamedDoc(f.name));

  if (filesToProcess.length === 0) {
    return {
      processed: 0,
      renamed: 0,
      conditionsUpdated: 0,
      errors: [],
      documents: [],
      message: 'No unprocessed files on the floor',
      checklistStatus: await getChecklistStatus(loan),
    };
  }

  // Build loan context for Claude
  const loanContext = await buildLoanContext(loan);

  const report = {
    processed: 0,
    renamed: 0,
    conditionsUpdated: 0,
    errors: [],
    documents: [],
  };

  // Process files sequentially (Claude API rate limits + timeout management)
  for (const file of filesToProcess) {
    // Check time budget
    if (Date.now() - startTime > MAX_TOTAL_MS) {
      report.errors.push(`Time limit reached — ${filesToProcess.length - report.processed} files skipped`);
      break;
    }

    try {
      // Identify
      const result = await Promise.race([
        identifyFile(file.id, file.name, loanContext),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Identification timeout')), PER_FILE_TIMEOUT_MS)
        ),
      ]);

      report.processed++;

      // Auto-rename if confident enough
      if (result.action === 'rename' && result.newFileName) {
        try {
          await renameFile(file.id, result.newFileName);
          result.action = 'renamed';
          report.renamed++;
        } catch (renameErr) {
          result.action = 'rename_failed';
          result.error = renameErr.message;
          report.errors.push(`${file.name} — rename failed: ${renameErr.message}`);
        }
      }

      // Check against conditions
      if (result.prefix && result.prefix !== 'UNK') {
        const condUpdated = await matchCondition(loan, result);
        if (condUpdated) report.conditionsUpdated++;
      }

      report.documents.push(result);
    } catch (err) {
      report.processed++;
      report.errors.push(`${file.name} — ${err.message}`);
      report.documents.push({
        originalName: file.name,
        fileId: file.id,
        prefix: 'UNK',
        confidence: 0,
        error: err.message,
        action: 'error',
      });
    }
  }

  // Add checklist status
  report.checklistStatus = await getChecklistStatus(loan);

  // Create audit event with per-file rename mappings
  const renames = report.documents
    .filter((d) => d.action === 'renamed' && d.newFileName)
    .map((d) => ({ from: d.originalName, to: d.newFileName, prefix: d.prefix }));

  await sql`
    INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, details, created_at)
    VALUES (
      ${loanId},
      'corebot_process',
      'system',
      ${mloId},
      ${JSON.stringify({
        processed: report.processed,
        renamed: report.renamed,
        conditionsUpdated: report.conditionsUpdated,
        errors: report.errors.length,
        durationMs: Date.now() - startTime,
        renames,
      })},
      NOW()
    )
  `;

  return report;
}

// ─── Condition Matching ──────────────────────────────────────

/**
 * Check if an identified document matches any active condition.
 * If so, update the condition status to 'received'.
 */
async function matchCondition(loan, docResult) {
  const { prefix } = docResult;
  if (!prefix || prefix === 'UNK') return false;

  // Map prefix to condition category
  const prefixToCondition = {
    APP: 'appraisal', AST: 'investment', CRD: 'credit', DOC: 'doc',
    HOI: 'hoi', INC: 'income', LND: 'land', LOE: 'loe', PUR: 'purchase', TTL: 'title',
  };

  const condType = prefixToCondition[prefix];
  if (!condType) return false;

  // Find matching open condition
  const condRows = await sql`
    SELECT * FROM conditions
    WHERE loan_id = ${loan.id}
      AND category = ${condType}
      AND status IN ('open', 'requested')
    ORDER BY created_at ASC
    LIMIT 1
  `;
  const condition = condRows[0];

  if (!condition) return false;

  const updatedNotes = condition.notes
    ? `${condition.notes}\nCoreBot: matched ${docResult.newFileName || docResult.originalName}`
    : `CoreBot: matched ${docResult.newFileName || docResult.originalName}`;

  await sql`
    UPDATE conditions
    SET status = 'received',
        received_at = NOW(),
        notes = ${updatedNotes},
        updated_at = NOW()
    WHERE id = ${condition.id}
  `;

  return true;
}

// ─── Checklist Status ────────────────────────────────────────

/**
 * Get current checklist status for a loan.
 * Compares submission checklist against what's in the folder.
 */
async function getChecklistStatus(loan) {
  const phase = getProcessingPhase(loan.status);
  const checklist = getSubmissionChecklist(loan.loan_type, loan.purpose);

  // Count received conditions
  const conditions = loan._conditions || [];
  const receivedCategories = new Set(
    conditions
      .filter((c) => ['received', 'cleared', 'waived'].includes(c.status))
      .map((c) => c.category)
  );

  const total = checklist.filter((item) => item.required).length;
  const received = checklist.filter(
    (item) => item.required && receivedCategories.has(item.category?.toLowerCase())
  ).length;

  const missing = checklist
    .filter((item) => item.required && !receivedCategories.has(item.category?.toLowerCase()))
    .map((item) => item.label);

  return {
    phase,
    total,
    received,
    missing,
  };
}
