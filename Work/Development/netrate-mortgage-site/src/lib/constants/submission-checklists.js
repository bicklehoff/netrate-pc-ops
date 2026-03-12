// Submission Checklists — what docs are needed BEFORE submitting to UW
// Keyed by loan type + purpose. CoreBot checks these against WorkDrive contents.
//
// Each item has:
//   category: doc prefix (INC, AST, etc.)
//   label: human-readable description
//   required: must be present to submit
//   subtypes: specific doc subtypes that satisfy this requirement (optional)

export const SUBMISSION_CHECKLISTS = {
  conventional: {
    purchase: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'PUR', label: 'Purchase contract (fully executed)', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
      { category: 'HOI', label: 'Homeowners insurance quote or binder', required: false },
      { category: 'TTL', label: 'Title commitment', required: false },
    ],
    refinance: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
      { category: 'HOI', label: 'Current homeowners insurance dec page', required: false },
      { category: 'TTL', label: 'Current mortgage statement / payoff', required: false },
    ],
  },
  fha: {
    purchase: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'INC', label: 'Income — Tax returns (2 years, if self-employed)', required: false, subtypes: ['TAX-RETURN'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'PUR', label: 'Purchase contract', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
      { category: 'HOI', label: 'Insurance quote or binder', required: false },
    ],
    refinance: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
      { category: 'HOI', label: 'Current insurance dec page', required: false },
    ],
  },
  va: {
    purchase: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'PUR', label: 'Purchase contract', required: true },
      { category: 'DOC', label: 'DD-214 or Statement of Service', required: true },
      { category: 'DOC', label: 'Certificate of Eligibility (COE)', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
    ],
    refinance: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'DOC', label: 'Certificate of Eligibility (COE)', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
    ],
  },
  usda: {
    purchase: [
      { category: 'INC', label: 'Income — W-2s (2 years)', required: true, subtypes: ['W2'] },
      { category: 'INC', label: 'Income — Pay stubs (most recent 30 days)', required: true, subtypes: ['PAYSTUB'] },
      { category: 'INC', label: 'Income — Tax returns (2 years)', required: true, subtypes: ['TAX-RETURN'] },
      { category: 'AST', label: 'Asset statements (2 months, all pages)', required: true },
      { category: 'PUR', label: 'Purchase contract', required: true },
      { category: 'CRD', label: 'Credit report', required: false },
      { category: 'HOI', label: 'Insurance quote or binder', required: false },
    ],
  },
};

// Default checklist for loan types not explicitly listed
export const DEFAULT_CHECKLIST = [
  { category: 'INC', label: 'Income documentation (W-2s, pay stubs)', required: true },
  { category: 'AST', label: 'Asset statements (2 months)', required: true },
  { category: 'CRD', label: 'Credit report', required: false },
];

// Closing checklist — used when loan reaches CTC status
export const CLOSING_CHECKLIST = [
  { category: 'DOC', label: 'Closing Disclosure (CD) — reviewed and signed', required: true, subtypes: ['CD'] },
  { category: 'HOI', label: 'Homeowners insurance — bound', required: true, subtypes: ['BINDER'] },
  { category: 'TTL', label: 'Title — clear to close', required: true },
  { category: 'DOC', label: 'Wire instructions received', required: true },
  { category: 'DOC', label: 'Final loan documents', required: true },
];

/**
 * Get the submission checklist for a loan.
 * @param {string} loanType — conventional, fha, va, usda, etc.
 * @param {string} purpose — purchase, refinance
 * @returns {Array} — checklist items
 */
export function getSubmissionChecklist(loanType, purpose) {
  const normalized = (loanType || '').toLowerCase();
  const normalizedPurpose = (purpose || '').toLowerCase();

  const typeChecklists = SUBMISSION_CHECKLISTS[normalized];
  if (!typeChecklists) return DEFAULT_CHECKLIST;

  return typeChecklists[normalizedPurpose] || typeChecklists.purchase || DEFAULT_CHECKLIST;
}

/**
 * Get the closing checklist.
 * @returns {Array} — closing checklist items
 */
export function getClosingChecklist() {
  return CLOSING_CHECKLIST;
}

/**
 * Determine which checklist phase a loan is in based on status.
 * @param {string} status — loan status
 * @returns {'pre_submission' | 'post_approval' | 'closing'}
 */
export function getProcessingPhase(status) {
  switch (status) {
    case 'draft':
    case 'applied':
    case 'processing':
      return 'pre_submission';
    case 'submitted_uw':
    case 'cond_approved':
    case 'suspended':
      return 'post_approval';
    case 'ctc':
    case 'docs_out':
    case 'funded':
      return 'closing';
    default:
      return 'pre_submission';
  }
}
