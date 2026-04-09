// Contact Status Auto-Update
// Updates contact lifecycle status based on loan/lead events.
// Status progression: subscriber → lead → applicant → in_process → funded → past_client

import sql from '@/lib/db';

const STATUS_ORDER = ['subscriber', 'lead', 'applicant', 'in_process', 'funded', 'past_client'];

const LOAN_STATUS_MAP = {
  draft: 'applicant',
  applied: 'applicant',
  processing: 'in_process',
  submitted_uw: 'in_process',
  cond_approved: 'in_process',
  ctc: 'in_process',
  docs_out: 'in_process',
  funded: 'funded',
  suspended: 'in_process',
  denied: null, // don't downgrade
  archived: null,
};

/**
 * Update contact status based on a loan status change.
 * Only upgrades — never downgrades a contact's lifecycle status.
 */
export async function updateContactFromLoanStatus(loanId, newLoanStatus) {
  try {
    const loanRows = await sql`SELECT borrower_id FROM loans WHERE id = ${loanId} LIMIT 1`;
    if (!loanRows.length || !loanRows[0].borrower_id) return;

    const contactRows = await sql`SELECT * FROM contacts WHERE borrower_id = ${loanRows[0].borrower_id} LIMIT 1`;
    if (!contactRows.length) return;

    const contact = contactRows[0];
    const targetStatus = LOAN_STATUS_MAP[newLoanStatus];
    if (!targetStatus) return;

    const currentIdx = STATUS_ORDER.indexOf(contact.status);
    const targetIdx = STATUS_ORDER.indexOf(targetStatus);

    // Only upgrade
    if (targetIdx > currentIdx) {
      if (newLoanStatus === 'funded') {
        const newTags = contact.tags?.includes('mailing-list')
          ? contact.tags
          : [...(contact.tags || []), 'mailing-list'];
        await sql`
          UPDATE contacts SET status = ${targetStatus}, funded_date = NOW(), tags = ${newTags}, updated_at = NOW()
          WHERE id = ${contact.id}
        `;
      } else {
        await sql`
          UPDATE contacts SET status = ${targetStatus}, updated_at = NOW()
          WHERE id = ${contact.id}
        `;
      }
    }
  } catch (error) {
    console.error('Contact status update error:', error?.message);
  }
}
