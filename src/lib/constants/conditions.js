// Condition constants — stages, statuses, types, owner roles
// Stages derived from real conditional approval documents (Finance of America, etc.)

export const CONDITION_STAGES = {
  SUSPENSE: 'suspense',
  PRIOR_TO_DOCS: 'prior_to_docs',
  PRIOR_TO_CLOSE: 'prior_to_close',
  AT_CLOSING: 'at_closing',
  PRIOR_TO_FUND: 'prior_to_fund',
  INTERNAL_NOTES: 'internal_notes',
};

// Ordered array for UI display
export const CONDITION_STAGE_ORDER = [
  'suspense',
  'prior_to_docs',
  'prior_to_close',
  'at_closing',
  'prior_to_fund',
  'internal_notes',
];

export const CONDITION_STAGE_LABELS = {
  suspense: 'Suspense',
  prior_to_docs: 'Prior to Docs',
  prior_to_close: 'Prior to Close',
  at_closing: 'At Closing',
  prior_to_fund: 'Prior to Fund',
  internal_notes: 'Internal Notes',
};

export const CONDITION_STAGE_COLORS = {
  suspense: 'bg-red-100 text-red-700',
  prior_to_docs: 'bg-purple-100 text-purple-700',
  prior_to_close: 'bg-amber-100 text-amber-700',
  at_closing: 'bg-blue-100 text-blue-700',
  prior_to_fund: 'bg-indigo-100 text-indigo-700',
  internal_notes: 'bg-gray-100 text-gray-600',
};

export const CONDITION_STATUSES = {
  NEEDED: 'needed',
  RECEIVED: 'received',
  CLEARED: 'cleared',
  WAIVED: 'waived',
};

export const CONDITION_STATUS_LABELS = {
  needed: 'Needed',
  received: 'Received',
  cleared: 'Cleared',
  waived: 'Waived',
};

export const CONDITION_STATUS_COLORS = {
  needed: 'bg-amber-100 text-amber-700',
  received: 'bg-blue-100 text-blue-700',
  cleared: 'bg-green-100 text-green-700',
  waived: 'bg-gray-100 text-gray-600',
};

export const CONDITION_STATUS_DOTS = {
  needed: 'bg-amber-400',
  received: 'bg-blue-400',
  cleared: 'bg-green-400',
  waived: 'bg-gray-400',
};

export const CONDITION_TYPES = {
  DOCUMENT: 'document',
  VERIFICATION: 'verification',
  COMPLIANCE: 'compliance',
  TITLE: 'title',
  APPRAISAL: 'appraisal',
  INSURANCE: 'insurance',
  INCOME: 'income',
  CREDIT: 'credit',
  OTHER: 'other',
};

export const CONDITION_TYPE_LABELS = {
  document: 'Document',
  verification: 'Verification',
  compliance: 'Compliance',
  title: 'Title',
  appraisal: 'Appraisal',
  insurance: 'Insurance',
  income: 'Income',
  credit: 'Credit',
  other: 'Other',
};

// Owner role prefixes from approval docs: (UW), (US), (Closer), (Funder)
export const CONDITION_OWNER_ROLES = {
  UNDERWRITER: 'underwriter',
  UW_SUPPORT: 'uw_support',
  CLOSER: 'closer',
  FUNDER: 'funder',
  MLO: 'mlo',
  BORROWER: 'borrower',
  PROCESSOR: 'processor',
};

export const CONDITION_OWNER_LABELS = {
  underwriter: 'UW',
  uw_support: 'US',
  closer: 'Closer',
  funder: 'Funder',
  mlo: 'MLO',
  borrower: 'Borrower',
  processor: 'Processor',
};
