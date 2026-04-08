// CD Extractor — Extract structured data from a Closing Disclosure PDF via Claude
// Used by: payroll route after CD upload
//
// Accepts either a file buffer (from upload) or a WorkDrive file ID (for re-extraction).
// Prefer passing the buffer directly to avoid a WorkDrive round-trip.

import { downloadFile } from '@/lib/zoho-workdrive';
import { askClaudeWithDocs } from '@/lib/anthropic';

const SYSTEM_PROMPT = `You are a mortgage document data extractor for NetRate Mortgage. Your job is to extract specific financial data points from a Closing Disclosure (CD) PDF. Return ONLY valid JSON with no markdown wrapping, no code fences, no explanation.`;

function buildExtractionPrompt(loanContext) {
  const ctx = [];
  if (loanContext.borrowerName) ctx.push(`- Expected borrower: ${loanContext.borrowerName}`);
  if (loanContext.loanNumber) ctx.push(`- Expected loan number: ${loanContext.loanNumber}`);
  if (loanContext.propertyAddress) {
    const addr = typeof loanContext.propertyAddress === 'object'
      ? `${loanContext.propertyAddress.street}, ${loanContext.propertyAddress.city}, ${loanContext.propertyAddress.state} ${loanContext.propertyAddress.zipCode}`
      : loanContext.propertyAddress;
    ctx.push(`- Expected property: ${addr}`);
  }

  return `Extract the following data from this Closing Disclosure PDF. Return a JSON object with exactly these fields. Use null for any field you cannot find. All dollar amounts should be numbers (no $ signs or commas). Rates should be numbers (no % sign).

{
  "loanAmount": "<number — Loan Amount>",
  "interestRate": "<number — e.g. 6.875>",
  "monthlyPI": "<number — monthly principal & interest payment>",
  "loanTerm": "<number — term in months, e.g. 360>",
  "totalClosingCosts": "<number — total closing costs>",
  "cashToClose": "<number — cash to close from borrower>",
  "lenderCredits": "<number — total lender credits>",
  "brokerCompensation": "<number — broker/loan originator compensation>",
  "sectionBItems": "<array of ALL line items from Section B (Services Borrower Did Not Shop For). Each item: {\"label\": \"APPRAISAL FEE\", \"payee\": \"to CLASS VALUATIONS FBO LOCUS COMPANIES\", \"amount\": 625.00, \"isFbo\": true, \"isPoc\": false}. isFbo = payee contains 'FBO' (For Benefit Of — indicates broker reimbursement). isPoc = marked as POC (Paid Outside Closing). Include EVERY line item in Section B, not just reimbursable ones.>",
  "totalDueToBroker": "<number — the total amount due to broker from the settlement statement, includes comp + all reimbursements>",
  "propertyAddress": "<string — full property address>",
  "borrowerNames": "<array of objects — each person listed on the CD, e.g. [{\"firstName\": \"TOMMY\", \"lastName\": \"PIPER\"}, {\"firstName\": \"SKYLAR\", \"lastName\": \"PIPER\"}]>",
  "closingDate": "<string — closing date in YYYY-MM-DD format>",
  "disbursementDate": "<string — disbursement date in YYYY-MM-DD format if shown>",
  "loanNumber": "<string — loan number as shown on CD>",
  "loanType": "<string — Conventional, FHA, VA, or USDA>",
  "lenderName": "<string — the lender/creditor name as shown on the CD>",
  "prepaidInterest": "<number — prepaid/per-diem interest>",
  "escrowsAtClosing": "<number — initial escrow deposit>",
  "totalLoanCosts": "<number — total loan costs>",
  "totalOtherCosts": "<number — total other costs>"
}

${ctx.length > 0 ? `\nLoan context for verification:\n${ctx.join('\n')}` : ''}`;
}

/**
 * Extract structured data from a Closing Disclosure PDF via Claude.
 *
 * @param {object} params
 * @param {ArrayBuffer|Buffer} [params.fileBuffer] — PDF bytes (preferred, avoids WorkDrive round-trip)
 * @param {string} [params.workDriveFileId] — WorkDrive file ID (fallback if no buffer)
 * @param {object} [params.loanContext] — { borrowerName, loanNumber, propertyAddress }
 * @returns {Promise<{ status: 'success'|'error', data?: object, error?: string, extractedAt: string }>}
 */
export async function extractCdData({ fileBuffer, workDriveFileId, loanContext = {} }) {
  const extractedAt = new Date().toISOString();

  try {
    let base64;

    if (fileBuffer) {
      // Use the buffer directly (from upload — no WorkDrive round-trip needed)
      base64 = Buffer.from(fileBuffer).toString('base64');
    } else if (workDriveFileId) {
      // Fallback: download from WorkDrive
      const { stream } = await downloadFile(workDriveFileId);

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

      base64 = Buffer.from(buffer).toString('base64');
    } else {
      throw new Error('Either fileBuffer or workDriveFileId is required');
    }

    // Build content blocks: PDF document + extraction prompt
    const content = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      },
      {
        type: 'text',
        text: buildExtractionPrompt(loanContext),
      },
    ];

    // Send to Claude
    const response = await askClaudeWithDocs({
      system: SYSTEM_PROMPT,
      content,
      maxTokens: 2048,
    });

    // Parse JSON response — strip any markdown fences if present
    const cleaned = response.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const data = JSON.parse(cleaned);

    return { status: 'success', data, extractedAt };
  } catch (err) {
    console.error('CD extraction failed:', err);
    return { status: 'error', error: err.message, extractedAt };
  }
}
