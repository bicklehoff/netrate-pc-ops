// OverviewSection — Status card, key dates timeline, quick stats, conditions summary
// First section in the Core loan detail sidebar navigation

'use client';

import SectionCard from '../SectionCard';
import PayrollSection from '../../PayrollSection';

// Status labels used by milestone pipeline
// (kept local to avoid cross-import dependency)

// Milestone pipeline stages (in order)
const MILESTONES = [
  { key: 'applied', label: 'Applied', dateField: 'applicationDate' },
  { key: 'processing', label: 'Processing', dateField: null },
  { key: 'submitted_uw', label: 'UW', dateField: 'submittedToUwDate' },
  { key: 'cond_approved', label: 'Approved', dateField: 'condApprovedDate' },
  { key: 'ctc', label: 'CTC', dateField: 'ctcDate' },
  { key: 'docs_out', label: 'Docs Out', dateField: 'docsOutDate' },
  { key: 'funded', label: 'Funded', dateField: 'fundingDate' },
];

function formatCurrency(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Get the index of the current milestone
function getMilestoneIndex(status) {
  const idx = MILESTONES.findIndex((m) => m.key === status);
  return idx >= 0 ? idx : -1;
}

export default function OverviewSection({ loan, onRefresh }) {
  const dates = loan.dates || {};
  const conditions = loan.conditions || [];
  const milestoneIndex = getMilestoneIndex(loan.status);

  // Conditions summary
  const condNeeded = conditions.filter((c) => c.status === 'needed').length;
  const condCleared = conditions.filter((c) => c.status === 'cleared' || c.status === 'waived').length;
  const condTotal = conditions.length;

  return (
    <div className="space-y-6">
      {/* ─── CD Upload + Payroll (funded loans) ─── */}
      {loan.status === 'funded' && (
        <PayrollSection loan={loan} onRefresh={onRefresh} />
      )}

      {/* ─── Milestone Pipeline ─── */}
      <SectionCard title="Loan Progress" icon="📈" defaultOpen={true}>
        <div className="flex items-center justify-between mb-4">
          {MILESTONES.map((milestone, i) => {
            const isComplete = milestoneIndex >= i;
            const isCurrent = milestoneIndex === i;
            const dateVal = milestone.dateField ? dates[milestone.dateField] : null;

            return (
              <div key={milestone.key} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {i > 0 && (
                  <div
                    className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                      isComplete ? 'bg-brand' : 'bg-gray-200'
                    }`}
                    style={{ left: '-50%' }}
                  />
                )}

                {/* Dot */}
                <div
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isCurrent
                      ? 'bg-brand text-white ring-4 ring-brand/20'
                      : isComplete
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isComplete ? '✓' : i + 1}
                </div>

                {/* Label */}
                <span className={`text-[10px] mt-1 font-medium ${
                  isCurrent ? 'text-brand' : isComplete ? 'text-gray-700' : 'text-gray-400'
                }`}>
                  {milestone.label}
                </span>

                {/* Date */}
                <span className="text-[10px] text-gray-400">
                  {dateVal ? formatDate(dateVal) : ''}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ─── Quick Stats Grid ─── */}
      <SectionCard title="Quick Stats" icon="📊" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatItem label="Loan Amount" value={formatCurrency(loan.loanAmount)} />
          <StatItem label="Interest Rate" value={loan.interestRate ? `${loan.interestRate}%` : '—'} />
          <StatItem label="Loan Term" value={loan.loanTerm ? `${loan.loanTerm} yrs` : '—'} />
          <StatItem label="Lender" value={loan.lenderName || '—'} />
          <StatItem label="Loan #" value={loan.loanNumber || '—'} />
          <StatItem
            label="Ball in Court"
            value={loan.ballInCourt || '—'}
            capitalize
          />
          <StatItem label="Purpose" value={loan.purpose || '—'} capitalize />
          <StatItem label="Loan Type" value={loan.loanType || '—'} capitalize />
          <StatItem label="Property Type" value={loan.propertyType?.replace('_', ' ') || '—'} capitalize />
        </div>
      </SectionCard>

      {/* ─── Key Dates ─── */}
      <SectionCard title="Key Dates" icon="📅" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <DateItem label="Application" value={dates.applicationDate} />
          <DateItem label="Credit Pulled" value={dates.creditPulledDate} />
          <DateItem label="Credit Expires" value={dates.creditExpiration} warn />
          <DateItem label="Appraisal Received" value={dates.appraisalReceived} />
          <DateItem label="Title Received" value={dates.titleReceived} />
          <DateItem label="Submitted to UW" value={dates.submittedToUwDate} />
          <DateItem label="Cond. Approved" value={dates.condApprovedDate} />
          <DateItem label="CTC" value={dates.ctcDate} />
          <DateItem label="Est. Closing" value={dates.estimatedClosing} />
          <DateItem label="Closing" value={dates.closingDate} />
          <DateItem label="Funding" value={dates.fundingDate} />
          <DateItem label="First Payment" value={dates.firstPaymentDate} />
        </div>
      </SectionCard>

      {/* ─── Conditions Summary ─── */}
      {condTotal > 0 && (
        <SectionCard
          title="Conditions"
          icon="📋"
          badge={`${condTotal} total`}
          defaultOpen={true}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-sm text-gray-600">{condNeeded} needed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
              <span className="text-sm text-gray-600">{condCleared} cleared</span>
            </div>
          </div>

          <div className="space-y-2">
            {conditions.slice(0, 5).map((cond) => (
              <div
                key={cond.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    cond.status === 'needed' ? 'bg-amber-400' :
                    cond.status === 'cleared' || cond.status === 'waived' ? 'bg-green-400' :
                    'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">{cond.title}</span>
                </div>
                <span className="text-xs text-gray-400 capitalize">{cond.stage?.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {condTotal > 5 && (
              <p className="text-xs text-gray-400 pt-1">
                + {condTotal - 5} more conditions
              </p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function StatItem({ label, value, capitalize = false }) {
  return (
    <div>
      <span className="block text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-medium text-gray-800 ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function DateItem({ label, value, warn = false }) {
  const dateStr = formatDateLong(value);
  const isExpiringSoon = warn && value && (() => {
    const d = new Date(value);
    const now = new Date();
    const diffDays = (d - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 30;
  })();

  return (
    <div>
      <span className="block text-xs text-gray-400">{label}</span>
      <span className={`text-sm ${
        isExpiringSoon ? 'text-amber-600 font-medium' : value ? 'text-gray-800' : 'text-gray-300'
      }`}>
        {dateStr}
        {isExpiringSoon && ' ⚠️'}
      </span>
    </div>
  );
}
