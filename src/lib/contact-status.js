// Contact Status Auto-Update
// Updates contact lifecycle status based on loan/lead events.
// Status progression: subscriber → lead → applicant → in_process → funded → past_client

import prisma from '@/lib/prisma';

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
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { borrowerId: true },
    });
    if (!loan?.borrowerId) return;

    const contact = await prisma.contact.findFirst({
      where: { borrowerId: loan.borrowerId },
    });
    if (!contact) return;

    const targetStatus = LOAN_STATUS_MAP[newLoanStatus];
    if (!targetStatus) return;

    const currentIdx = STATUS_ORDER.indexOf(contact.status);
    const targetIdx = STATUS_ORDER.indexOf(targetStatus);

    // Only upgrade
    if (targetIdx > currentIdx) {
      const data = { status: targetStatus };

      if (newLoanStatus === 'funded') {
        data.fundedDate = new Date();
        if (!contact.tags.includes('mailing-list')) {
          data.tags = [...contact.tags, 'mailing-list'];
        }
      }

      await prisma.contact.update({
        where: { id: contact.id },
        data,
      });
    }
  } catch (error) {
    console.error('Contact status update error:', error?.message);
  }
}
