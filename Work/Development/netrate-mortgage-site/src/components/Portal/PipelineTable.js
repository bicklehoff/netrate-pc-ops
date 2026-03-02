// Pipeline Table — Loan list for MLO dashboard
// Shows borrower name, status, ball-in-court, loan amount, pending docs

'use client';

import Link from 'next/link';

const STATUS_LABELS = {
  draft: 'Draft',
  applied: 'Applied',
  processing: 'Processing',
  submitted_uw: 'In UW',
  cond_approved: 'Cond. Approved',
  suspended: 'Suspended',
  ctc: 'Clear to Close',
  docs_out: 'Docs Out',
  funded: 'Funded',
  denied: 'Denied',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  submitted_uw: 'bg-purple-100 text-purple-800',
  cond_approved: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-50 text-red-700',
  ctc: 'bg-green-100 text-green-800',
  docs_out: 'bg-green-100 text-green-800',
  funded: 'bg-green-200 text-green-900',
  denied: 'bg-red-100 text-red-800',
};

const BALL_ICONS = {
  borrower: '👤',
  mlo: '🏢',
  lender: '🏦',
};

function formatCurrency(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PipelineTable({ loans }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Borrower
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Ball
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Purpose
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Amount
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Docs
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loans.map((loan) => (
              <tr
                key={loan.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <Link href={`/portal/mlo/loans/${loan.id}`} className="block">
                    <span className="font-medium text-gray-900">{loan.borrowerName}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      SSN ···{loan.ssnLastFour}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/portal/mlo/loans/${loan.id}`}>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABELS[loan.status] || loan.status}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-center">
                  <span title={loan.ballInCourt}>
                    {BALL_ICONS[loan.ballInCourt] || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-700 capitalize">{loan.purpose || '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-gray-700">
                    {formatCurrency(loan.purchasePrice || loan.estimatedValue)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {loan.pendingDocs > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {loan.pendingDocs} pending
                    </span>
                  ) : loan.totalDocs > 0 ? (
                    <span className="text-xs text-gray-400">{loan.totalDocs} docs</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-gray-400">{timeAgo(loan.updatedAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
