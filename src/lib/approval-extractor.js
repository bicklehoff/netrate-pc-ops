// Approval Extractor — Extract conditions and loan data from a Conditional Loan Approval PDF via Claude
// Used by: conditions route after approval PDF upload
//
// Follows the same pattern as cd-extractor.js:
// - Accepts file buffer (preferred) or WorkDrive file ID
// - Sends PDF to Claude as base64 document
// - Returns structured JSON with conditions + loan-level data

import { downloadFile } from '@/lib/zoho-workdrive';
import { askClaudeWithDocs } from '@/lib/anthropic';

const SYSTEM_PROMPT = `You are a mortgage document data extractor for NetRate Mortgage. Your job is to extract all conditions and loan-level data from a Conditional Loan Approval document. Return ONLY valid JSON with no markdown wrapping, no code fences, no explanation.`;

function buildExtractionPrompt(loanContext) {
  const ctx = [];
  if (loanContext.borrowerName) ctx.push(`- Expected borrower: ${loanContext.borrowerName}`);
  if (loanContext.loanNumber) ctx.push(`- Expected loan number: ${loanContext.loanNumber}`);
  if (loanContext.propertyAddress) {
    const addr = typeof loanContext.propertyAddress === 'object'
      ? `${loanContext.propertyAddress.street}, ${loanContext.propertyAddress.city}, ${loanContext.propertyAddress.state} ${loanContext.propertyAddress.zip || loanContext.propertyAddress.zipCode}`
      : loanContext.propertyAddress;
    ctx.push(`- Expected property: ${addr}`);
  }

  return `Extract ALL data from this Conditional Loan Approval PDF. Return a JSON object with exactly two top-level keys: "loanData" and "conditions".

{
  "loanData": {
    "lenderName": "<string — lender name>",
    "loanNumber": "<string — loan number>",
    "loanProgram": "<string — loan program name, e.g. 'Monthly CMT Cap5'>",
    "transactionType": "<string — e.g. 'FHA HECM', 'Conventional', 'FHA'>",
    "fhaCaseNumber": "<string — FHA case number if present, else null>",
    "fhaCaseAssignedDate": "<string — YYYY-MM-DD or null>",
    "margin": "<number — margin percentage, e.g. 1.625, or null>",
    "appraisedValue": "<number — appraised value>",
    "maxClaimAmount": "<number — max claim amount or null>",
    "applicationDate": "<string — YYYY-MM-DD or null>",
    "counselingExpiration": "<string — YYYY-MM-DD or null>",
    "appraisalExpires": "<string — YYYY-MM-DD or null>",
    "creditExpires": "<string — YYYY-MM-DD or null>",
    "titleExpires": "<string — YYYY-MM-DD or null>",
    "pllExpiration": "<string — YYYY-MM-DD or null>",
    "underwriterName": "<string — underwriter name or null>",
    "accountExec": "<string — AE name or null>",
    "uwSupport": "<string — UW Support name or null>",
    "brokerProcessor": "<string — broker processor name or null>",
    "financialAssessmentResult": "<string — PASS/FAIL/TBD or null>",
    "lesaResult": "<string — None/Required or null>",
    "creditResult": "<string — PASS/FAIL or null>",
    "propertyChargesResult": "<string — PASS/FAIL or null>",
    "borrowerNames": "<array of {firstName, lastName} for each borrower listed>",
    "propertyAddress": "<string — full property address>"
  },
  "conditions": [
    {
      "conditionNumber": "<integer — the lender's condition number (e.g. 1, 100, 101, 200)>",
      "title": "<string — the FULL condition description text, preserving all details>",
      "stage": "<string — one of: suspense, prior_to_close, at_closing, prior_to_fund, internal_notes>",
      "ownerRole": "<string — one of: underwriter, uw_support, closer, funder, mlo>",
      "conditionType": "<string — best guess, one of: document, verification, compliance, title, appraisal, insurance, income, credit, other>"
    }
  ]
}

STAGE MAPPING — map the section header from the document to these values:
- "SUSPENSE" → "suspense"
- "PRIOR TO CLOSE" or "PRIOR TO CLOSING" → "prior_to_close"
- "AT CLOSING" → "at_closing"
- "PRIOR TO FUND" or "PRIOR TO FUNDING" → "prior_to_fund"
- "INTERNAL NOTES" → "internal_notes"

OWNER ROLE MAPPING — parse the prefix in parentheses at the start of each condition:
- "(UW)" → "underwriter"
- "(US)" → "uw_support"
- "(Closer)" or "(CLOSER)" → "closer"
- "(Funder)" or "(FUNDER)" → "funder"
- No prefix or other → "mlo"

CONDITION TYPE — infer from the content:
- Mentions appraisal, valuation → "appraisal"
- Mentions title, deed, vesting, lien → "title"
- Mentions insurance, HOI, hazard, flood → "insurance"
- Mentions income, W2, paystub, VOE, tax → "income"
- Mentions credit, credit report → "credit"
- Mentions disclosure, application, 1009 → "compliance"
- Mentions payoff, bank, account → "verification"
- Default → "document"

Extract EVERY condition listed in the document. Do not skip any. Include the full description text for each.
All dollar amounts should be numbers (no $ signs or commas). Dates should be YYYY-MM-DD format. Use null for any field you cannot find.

${ctx.length > 0 ? `\nLoan context for verification:\n${ctx.join('\n')}` : ''}`;
}

/**
 * Extract conditions and loan data from an approval PDF via Claude.
 *
 * @param {object} params
 * @param {ArrayBuffer|Buffer} [params.fileBuffer] — PDF bytes (preferred)
 * @param {string} [params.workDriveFileId] — WorkDrive file ID (fallback)
 * @param {object} [params.loanContext] — { borrowerName, loanNumber, propertyAddress }
 * @returns {Promise<{ status: 'success'|'error', data?: { loanData, conditions }, error?: string, extractedAt: string }>}
 */
export async function extractApprovalData({ fileBuffer, workDriveFileId, loanContext = {} }) {
  const extractedAt = new Date().toISOString();

  try {
    let base64;

    if (fileBuffer) {
      base64 = Buffer.from(fileBuffer).toString('base64');
    } else if (workDriveFileId) {
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

    const response = await askClaudeWithDocs({
      system: SYSTEM_PROMPT,
      content,
      maxTokens: 8192,
    });

    // Parse JSON — strip markdown fences if present
    const cleaned = response.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const data = JSON.parse(cleaned);

    // Validate structure
    if (!data.conditions || !Array.isArray(data.conditions)) {
      throw new Error('Extraction did not return a conditions array');
    }

    return { status: 'success', data, extractedAt };
  } catch (err) {
    console.error('Approval extraction failed:', err);
    return { status: 'error', error: err.message, extractedAt };
  }
}
