// Loan status — canonical picklist, labels, colors for loans.status.
//
// Pre-submission loans use key 'draft' as of migration 013 (2026-04-20)
// which unified the legacy 'prospect' value (LDOX-derived) with 'draft'
// (portal-written). User-facing label for 'draft' stays "Prospect"
// because that's how MLOs talk about this stage in the pipeline.
//
// Two color palettes exported:
//   STATUS_COLORS       — bold (bg-*-500 text-white). Pipeline badges.
//   STATUS_COLORS_SOFT  — light (bg-*-100 text-*-800). Loan-detail top bar,
//                         contact-detail loan list, any compact inline pill.
//
// Consumers: PipelineTable, MLO dashboard, StatusHeader, NotesActivity-
// Section, contacts/[id]/page, any new surface rendering loan status.

export const ALL_STATUSES = [
  'draft',
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
  draft: 'Prospect',
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

// Bold palette for pipeline badges.
export const STATUS_COLORS = {
  draft: 'bg-slate-200 text-slate-800',
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

// Light palette for compact inline badges (loan-detail top bar,
// contact-detail loan list). Harmonized from StatusHeader.js +
// contacts/[id]/page.js local maps that diverged in PR #113.
export const STATUS_COLORS_SOFT = {
  draft: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  submitted_uw: 'bg-purple-100 text-purple-800',
  cond_approved: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-50 text-red-700',
  ctc: 'bg-green-100 text-green-800',
  docs_out: 'bg-teal-100 text-teal-800',
  funded: 'bg-green-200 text-green-900',
  settled: 'bg-green-100 text-green-800',
  withdrawn: 'bg-gray-200 text-gray-500',
  denied: 'bg-red-100 text-red-800',
  archived: 'bg-gray-200 text-gray-500',
};

// Grouped status sets for pipeline filtering.
export const ACTIVE_STATUSES = [
  'draft',
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
