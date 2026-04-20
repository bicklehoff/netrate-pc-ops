// Document lifecycle picklists — loan document requests + uploads.
//
// Consumers: DocumentsSection (MLO loan detail). When borrower-facing document
// UI is built, it should import from here as well.

export const DOC_TYPES = [
  { value: 'pay_stub',       label: 'Pay Stub' },
  { value: 'w2',             label: 'W-2' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'tax_return',     label: 'Tax Return' },
  { value: 'id',             label: 'Photo ID' },
  { value: 'other',          label: 'Other' },
];

// Light state-tint palette for doc lifecycle. Uses Tailwind stock shades —
// the design system doesn't ship explicit state tokens, and these semantic
// colors (amber = pending, blue = new, purple = in review, green = ok,
// red = rejected) are widely-understood UI conventions.
export const DOC_STATUS_LABELS = {
  requested: 'Requested',
  uploaded:  'Uploaded',
  reviewed:  'Under Review',
  accepted:  'Accepted',
  rejected:  'Rejected',
};

export const DOC_STATUS_COLORS = {
  requested: 'bg-amber-100 text-amber-800',
  uploaded:  'bg-blue-100 text-blue-800',
  reviewed:  'bg-purple-100 text-purple-800',
  accepted:  'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
};
