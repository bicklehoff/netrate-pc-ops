// Loan status picklist — canonical set for the MLO portal pipeline.
//
// Extracted from src/app/portal/mlo/page.js + PipelineTable.js (which
// agreed on values). LoanDetailView.js uses a different initial status
// name ('draft' vs 'prospect') and is NOT yet consolidated here pending
// a DB audit — see D8 Pass 6 MLO-5 finding.
//
// Consumers: MLO dashboard status filters, PipelineTable column rendering,
// status dropdowns in bulk actions.

export const ALL_STATUSES = [
  'prospect',
  'applied',
  'processing',
  'submitted_uw',
  'cond_approved',
  'ctc',
  'docs_out',
  'funded',
  'settled',
  'withdrawn',
  'suspended',
  'denied',
  'archived',
];

export const STATUS_LABELS = {
  prospect: 'Prospect',
  applied: 'Applied',
  processing: 'Processing',
  submitted_uw: 'In UW',
  cond_approved: 'Cond. Approved',
  suspended: 'Suspended',
  ctc: 'Clear to Close',
  docs_out: 'Docs Out',
  funded: 'Funded',
  settled: 'Settled',
  withdrawn: 'Withdrawn',
  denied: 'Denied',
  archived: 'Archived',
};

// Unified color palette — matches PipelineTable.js which had the richer set.
// LoanDetailView used a lighter palette (bg-*-100 text-*-700) which diverged
// from this; consolidating into one canonical palette when LoanDetailView is
// migrated (pending DB audit on 'draft' vs 'prospect' status name).
export const STATUS_COLORS = {
  prospect: 'bg-slate-200 text-slate-800',
  applied: 'bg-blue-500 text-white',
  processing: 'bg-amber-500 text-white',
  submitted_uw: 'bg-purple-500 text-white',
  cond_approved: 'bg-orange-500 text-white',
  suspended: 'bg-red-500 text-white',
  ctc: 'bg-emerald-500 text-white',
  docs_out: 'bg-teal-500 text-white',
  funded: 'bg-emerald-600 text-white',
  settled: 'bg-green-700 text-white',
  withdrawn: 'bg-gray-400 text-white',
  denied: 'bg-red-600 text-white',
  archived: 'bg-gray-400 text-white',
};

// Grouped status sets for pipeline filtering.
export const ACTIVE_STATUSES = [
  'prospect',
  'applied',
  'processing',
  'submitted_uw',
  'cond_approved',
  'ctc',
  'docs_out',
  'funded',
];

export const SETTLED_STATUSES = ['settled'];

export const CANCELLED_STATUSES = ['withdrawn', 'denied', 'suspended'];

// Top-level filter tabs shown above the pipeline table.
export const TIER1_FILTERS = [
  { value: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { value: 'settled', label: 'Settled', statuses: SETTLED_STATUSES },
  { value: 'cancelled', label: 'Cancelled', statuses: CANCELLED_STATUSES },
  { value: 'all', label: 'All', statuses: null },
];
