// Loan Status Card — Shows current status, ball-in-court, and loan summary

import { STATUS_LABELS, BALL_IN_COURT } from '@/lib/loan-states';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  submitted_uw: 'bg-purple-100 text-purple-800',
  cond_approved: 'bg-orange-100 text-orange-800',
  ctc: 'bg-green-100 text-green-800',
  docs_out: 'bg-green-100 text-green-800',
  funded: 'bg-green-200 text-green-900',
  denied: 'bg-red-100 text-red-800',
  suspended: 'bg-red-100 text-red-700',
};

const BALL_MESSAGES = {
  borrower: 'Action needed from you',
  mlo: 'Your loan officer is working on this',
  lender: 'Waiting on the lender',
};

const PROPERTY_TYPE_LABELS = {
  sfr: 'Single Family',
  condo: 'Condo',
  townhome: 'Townhome',
  multi_unit: 'Multi-Unit',
  manufactured: 'Manufactured',
};

function formatCurrency(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatAddress(addr) {
  if (!addr) return 'TBD';
  const street = addr.street?.trim();
  if (!street) return 'TBD';
  const parts = [street, addr.city, addr.state].filter(Boolean);
  return parts.join(', ') || 'TBD';
}

export default function LoanStatusCard({ loan }) {
  const statusLabel = STATUS_LABELS[loan.status] || loan.status;
  const statusColor = STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700';
  const ball = BALL_IN_COURT[loan.status];
  const ballMessage = BALL_MESSAGES[ball] || '';
  const pendingDocs = loan.documents?.filter((d) => d.status === 'requested').length || 0;

  // Determine loan amount display
  const loanAmount = loan.purpose === 'purchase'
    ? loan.purchasePrice
    : loan.estimatedValue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Loan Status</h2>
          {loan.mlo && (
            <p className="text-sm text-gray-500 mt-0.5">
              Loan Officer: {loan.mlo.firstName} {loan.mlo.lastName}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Ball-in-court indicator */}
      {ball && (
        <div className={`
          rounded-lg px-4 py-3 mb-4 text-sm
          ${ball === 'borrower' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-gray-50 text-gray-600'}
        `}>
          {ball === 'borrower' && pendingDocs > 0 ? (
            <span className="font-medium">
              📋 {pendingDocs} document{pendingDocs > 1 ? 's' : ''} requested — please upload below
            </span>
          ) : (
            <span>{ballMessage}</span>
          )}
        </div>
      )}

      {/* Property Address */}
      <div className="text-sm mb-4">
        <span className="text-gray-400 block">Property</span>
        <span className="text-gray-800 font-medium">
          {formatAddress(loan.propertyAddress)}
        </span>
      </div>

      {/* Loan Summary */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-400 block">Purpose</span>
          <span className="text-gray-800 font-medium capitalize">{loan.purpose || '—'}</span>
        </div>
        <div>
          <span className="text-gray-400 block">
            {loan.purpose === 'purchase' ? 'Price' : 'Value'}
          </span>
          <span className="text-gray-800 font-medium">{formatCurrency(loanAmount)}</span>
        </div>
        <div>
          <span className="text-gray-400 block">Type</span>
          <span className="text-gray-800 font-medium">
            {PROPERTY_TYPE_LABELS[loan.propertyType] || loan.propertyType || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
