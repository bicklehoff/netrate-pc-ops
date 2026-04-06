// Borrower Dashboard — Loan Status Overview
// Auth required (magic link + SMS verified)
// Fetches loans server-side, renders status, documents, and timeline.

import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireBorrowerAuth } from '@/lib/borrower-session';
import LoanStatusCard from '@/components/Portal/LoanStatusCard';
import BorrowerChecklist from '@/components/Portal/BorrowerChecklist';
import LoanTimeline from '@/components/Portal/LoanTimeline';

export default async function BorrowerDashboardPage() {
  const session = await requireBorrowerAuth();

  if (!session) {
    redirect('/portal/auth/login');
  }

  const borrower = await prisma.borrower.findUnique({
    where: { id: session.borrowerId },
    select: { firstName: true, lastName: true, email: true },
  });

  // Find loans where this borrower is either primary or co-borrower
  const loanBorrowers = await prisma.loanBorrower.findMany({
    where: { borrowerId: session.borrowerId },
    select: { loanId: true, borrowerType: true },
    orderBy: { loan: { createdAt: 'desc' } },
  });
  const loanIds = loanBorrowers.map((lb) => lb.loanId);

  const loans = await prisma.loan.findMany({
    where: { id: { in: loanIds } },
    include: {
      documents: {
        orderBy: { createdAt: 'desc' },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 15,
      },
      mlo: {
        select: { firstName: true, lastName: true, email: true },
      },
      loanBorrowers: {
        where: { borrowerType: 'primary' },
        include: { borrower: { select: { firstName: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Most recent loan (borrowers typically have one active)
  const loan = loans[0] || null;

  // Use the primary borrower's name for the greeting, not the session borrower
  // (handles shared-email cases where co-borrower's name overwrites the record)
  const primaryName = loan?.loanBorrowers?.[0]?.borrower?.firstName || borrower?.firstName;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {primaryName || 'there'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Track your application status, upload documents, and see what&apos;s next.
        </p>
      </div>

      {!loan ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
          <p className="text-gray-500 mb-4">You don&apos;t have any loan applications yet.</p>
          <a
            href="/portal/apply"
            className="inline-block bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Start an Application
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Card */}
          <LoanStatusCard loan={loan} />

          {/* Checklist */}
          <BorrowerChecklist loan={loan} />

          {/* Timeline */}
          <LoanTimeline events={loan.events} />
        </div>
      )}
    </div>
  );
}
