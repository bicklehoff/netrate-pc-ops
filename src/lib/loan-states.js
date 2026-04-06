// Loan State Machine
// Defines valid statuses, transitions, ball-in-court rules, and email triggers.
// Based on PORTAL-ARCHITECTURE-PLAN.md

// ─── Status Labels (for UI display) ─────────────────────────

export const STATUS_LABELS = {
  draft: 'Prospect',
  rate_alert: 'Rate Alert',
  applied: 'Applied',
  processing: 'Processing',
  submitted_uw: 'Submitted to UW',
  cond_approved: 'Conditionally Approved',
  suspended: 'Suspended',
  ctc: 'Clear to Close',
  docs_out: 'Docs Out',
  funded: 'Funded',
  denied: 'Denied',
  archived: 'Archived',
};

// ─── Valid Transitions ──────────────────────────────────────

export const TRANSITIONS = {
  draft: ['applied'],
  applied: ['processing', 'denied'],
  processing: ['submitted_uw', 'suspended', 'denied'],
  submitted_uw: ['cond_approved', 'suspended', 'denied'],
  cond_approved: ['ctc', 'suspended', 'denied'],
  suspended: ['processing', 'submitted_uw', 'denied'],
  ctc: ['docs_out'],
  docs_out: ['funded'],
  funded: [],     // Terminal
  denied: [],     // Terminal
  archived: [],   // Terminal — soft-delete
};

// ─── Ball-in-Court Rules ────────────────────────────────────

export const BALL_IN_COURT = {
  draft: 'borrower',
  applied: 'mlo',
  processing: 'mlo',
  submitted_uw: 'lender',
  cond_approved: 'mlo',
  suspended: 'mlo',
  ctc: 'mlo',
  docs_out: 'lender',
  funded: null,     // Complete
  denied: null,     // Complete
  archived: null,   // Soft-deleted
};

// ─── Email Triggers ─────────────────────────────────────────

export const EMAIL_TRIGGERS = {
  applied: {
    subject: 'Your application has been received',
    sendToBorrower: true,
  },
  processing: {
    subject: 'Your loan is being processed',
    sendToBorrower: true,
  },
  submitted_uw: {
    subject: 'Your loan has been submitted to underwriting',
    sendToBorrower: true,
  },
  cond_approved: {
    subject: 'Conditional approval — we\'re almost there',
    sendToBorrower: true,
  },
  ctc: {
    subject: 'Clear to close — your loan is approved!',
    sendToBorrower: true,
  },
  docs_out: {
    subject: 'Closing documents have been sent',
    sendToBorrower: true,
  },
  funded: {
    subject: 'Congratulations — your loan has funded!',
    sendToBorrower: true,
  },
  denied: {
    subject: 'Update on your application',
    sendToBorrower: true,
  },
  suspended: {
    subject: 'We need to discuss your application',
    sendToBorrower: true,
  },
};

// ─── Helpers ────────────────────────────────────────────────

/**
 * Check if a status transition is valid.
 */
export function canTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

/**
 * Get the ball-in-court value for a given status.
 * Returns 'borrower' if there are pending document requests.
 */
export function getBallInCourt(status, hasPendingDocs = false) {
  if (hasPendingDocs && BALL_IN_COURT[status] === 'mlo') {
    return 'borrower'; // Ball shifts to borrower when docs are requested
  }
  return BALL_IN_COURT[status];
}

/**
 * Check if a status is terminal (no further transitions).
 */
export function isTerminal(status) {
  return TRANSITIONS[status]?.length === 0;
}

/**
 * Get all valid next statuses from the current status.
 */
export function getNextStatuses(currentStatus) {
  return TRANSITIONS[currentStatus] || [];
}
