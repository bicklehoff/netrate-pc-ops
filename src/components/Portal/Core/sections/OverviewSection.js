// OverviewSection — At-a-glance loan summary with all key info
// Shows: borrower contact, property, loan terms, rate lock, dates, progress, conditions

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import SectionCard from '../SectionCard';
import PayrollSection from '../../PayrollSection';
import PrequalLetterModal from '../../PrequalLetter/PrequalLetterModal';

const MILESTONES = [
  { key: 'applied', label: 'Applied', dateField: 'applicationDate' },
  { key: 'processing', label: 'Processing', dateField: null },
  { key: 'submitted_uw', label: 'UW', dateField: 'submittedToUwDate' },
  { key: 'cond_approved', label: 'Approved', dateField: 'condApprovedDate' },
  { key: 'ctc', label: 'CTC', dateField: 'ctcDate' },
  { key: 'docs_out', label: 'Docs Out', dateField: 'docsOutDate' },
  { key: 'funded', label: 'Funded', dateField: 'fundingDate' },
];

function fmt$(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateLong(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtAddr(addr) {
  if (!addr) return '—';
  return [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') || '—';
}

function getMilestoneIndex(status) {
  const idx = MILESTONES.findIndex((m) => m.key === status);
  return idx >= 0 ? idx : -1;
}

function isExpiringSoon(dateStr, days = 7) {
  if (!dateStr) return false;
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  return diff >= 0 && diff <= days;
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Small display components ────────────────────────────────

function Field({ label, value, className = '', warn = false, error = false }) {
  return (
    <div className={className}>
      <span className="block text-[10px] uppercase tracking-wider text-gray-400">{label}</span>
      <span className={`text-sm ${error ? 'text-red-600 font-medium' : warn ? 'text-amber-600 font-medium' : value && value !== '—' ? 'text-gray-800' : 'text-gray-300'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function DateField({ label, value, warnDays = 0 }) {
  const warn = warnDays > 0 && isExpiringSoon(value, warnDays);
  const expired = warnDays > 0 && isExpired(value);
  return <Field label={label} value={fmtDateLong(value)} warn={warn} error={expired} />;
}

export default function OverviewSection({ loan, onRefresh }) {
  const { data: session } = useSession();
  const [showPrequalModal, setShowPrequalModal] = useState(false);
  const dates = loan.dates || {};
  const conditions = loan.conditions || [];
  const milestoneIndex = getMilestoneIndex(loan.status);
  const addr = loan.propertyAddress;
  const borrower = loan.borrower || {};
  const coBorrowers = loan.loanBorrowers?.filter(lb => lb.borrowerType !== 'primary') || [];

  const condNeeded = conditions.filter((c) => c.status === 'needed').length;
  const condCleared = conditions.filter((c) => c.status === 'cleared' || c.status === 'waived').length;
  const condTotal = conditions.length;

  return (
    <div className="space-y-4">
      {/* ─── Actions Bar ─── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowPrequalModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors"
        >
          Pre-Qual Letter
        </button>
      </div>

      {showPrequalModal && (
        <PrequalLetterModal loan={loan} session={session} onClose={() => setShowPrequalModal(false)} />
      )}

      {loan.status === 'funded' && (
        <PayrollSection loan={loan} onRefresh={onRefresh} />
      )}

      {/* ─── Borrower & Property (side by side) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Borrower Contact */}
        <SectionCard title="Borrower" icon="👤" defaultOpen={true}>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-900">{borrower.firstName} {borrower.lastName}</span>
              {borrower.ssnLastFour && <span className="text-xs text-gray-400">SSN ···{borrower.ssnLastFour}</span>}
            </div>
            {borrower.email && (
              <div className="text-sm">
                <a href={`mailto:${borrower.email}`} className="text-brand hover:underline">{borrower.email}</a>
              </div>
            )}
            {borrower.phone && (
              <div className="text-sm">
                <a href={`tel:${borrower.phone}`} className="text-brand hover:underline">{borrower.phone}</a>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="FICO" value={loan.creditScore || null} />
              <Field label="Income" value={fmt$(loan.monthlyBaseIncome)} />
            </div>
            {coBorrowers.length > 0 && (
              <div className="border-t border-gray-100 pt-2 mt-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">Co-Borrower</span>
                {coBorrowers.map((lb, i) => (
                  <div key={i} className="text-sm text-gray-700">
                    {lb.borrower?.firstName} {lb.borrower?.lastName}
                    {lb.borrower?.email && <span className="text-gray-400 ml-2">{lb.borrower.email}</span>}
                    {lb.borrower?.phone && <span className="text-gray-400 ml-2">{lb.borrower.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Property */}
        <SectionCard title="Property" icon="🏠" defaultOpen={true}>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">{fmtAddr(addr)}</div>
            {addr?.county && <div className="text-xs text-gray-500">{addr.county} County</div>}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Field label="Type" value={loan.propertyType?.replace(/_/g, ' ')} />
              <Field label="Occupancy" value={loan.occupancy} />
              <Field label="Units" value={loan.numUnits} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Purchase Price" value={fmt$(loan.purchasePrice)} />
              <Field label="Appraised Value" value={fmt$(loan.estimatedValue)} />
              <Field label="Down Payment" value={fmt$(loan.downPayment)} />
              <Field label="Current Balance" value={fmt$(loan.currentBalance)} />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ─── Loan Terms & Rate Lock (side by side) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Loan Terms" icon="💰" defaultOpen={true}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount" value={fmt$(loan.loanAmount)} />
            <Field label="Rate" value={loan.interestRate ? `${loan.interestRate}%` : null} />
            <Field label="Term" value={loan.loanTerm ? `${loan.loanTerm} yrs` : null} />
            <Field label="Type" value={loan.loanType} />
            <Field label="Purpose" value={loan.purpose} />
            <Field label="Lender" value={loan.lenderName} />
            <Field label="Loan #" value={loan.loanNumber} />
            <Field label="Lien Status" value={loan.lienStatus} />
            <Field label="Ball in Court" value={loan.ballInCourt} />
          </div>
          {(loan.purpose === 'refinance' || loan.purpose === 'cash_out') && (
            <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-gray-100">
              <Field label="Refi Purpose" value={loan.refiPurpose} />
              <Field label="Cash Out" value={fmt$(loan.cashOutAmount)} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Rate Lock" icon="🔒" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Lock Date" value={dates.lockedDate} />
            <DateField label="Lock Expires" value={dates.lockExpiration} warnDays={7} />
            <Field label="Lock Term" value={dates.lockTerm ? `${dates.lockTerm} days` : null} />
            <Field label="# Borrowers" value={loan.numBorrowers} />
          </div>
        </SectionCard>
      </div>

      {/* ─── Milestone Pipeline ─── */}
      <SectionCard title="Loan Progress" icon="📈" defaultOpen={true}>
        <div className="flex items-center justify-between mb-2">
          {MILESTONES.map((milestone, i) => {
            const isComplete = milestoneIndex >= i;
            const isCurrent = milestoneIndex === i;
            const dateVal = milestone.dateField ? dates[milestone.dateField] : null;
            return (
              <div key={milestone.key} className="flex-1 flex flex-col items-center relative">
                {i > 0 && (
                  <div
                    className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${isComplete ? 'bg-brand' : 'bg-gray-200'}`}
                    style={{ left: '-50%' }}
                  />
                )}
                <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCurrent ? 'bg-brand text-white ring-4 ring-brand/20'
                    : isComplete ? 'bg-brand text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {isComplete ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isCurrent ? 'text-brand' : isComplete ? 'text-gray-700' : 'text-gray-400'}`}>
                  {milestone.label}
                </span>
                <span className="text-[10px] text-gray-400">{dateVal ? fmtDate(dateVal) : ''}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ─── Key Dates ─── */}
      <SectionCard title="Key Dates" icon="📅" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DateField label="Application" value={dates.applicationDate} />
          <DateField label="Credit Pulled" value={dates.creditPulledDate} />
          <DateField label="Credit Expires" value={dates.creditExpiration} warnDays={30} />
          <DateField label="Rate Locked" value={dates.lockedDate} />
          <DateField label="Lock Expires" value={dates.lockExpiration} warnDays={7} />
          <DateField label="Appraisal Ordered" value={dates.appraisalOrdered} />
          <DateField label="Appraisal Received" value={dates.appraisalReceived} />
          <DateField label="Title Ordered" value={dates.titleOrdered} />
          <DateField label="Title Received" value={dates.titleReceived} />
          <DateField label="HOI Received" value={dates.hoiReceived} />
          <DateField label="Flood Cert" value={dates.floodCertReceived} />
          <DateField label="Submitted to UW" value={dates.submittedToUwDate} />
          <DateField label="Cond. Approved" value={dates.condApprovedDate} />
          <DateField label="CTC" value={dates.ctcDate} />
          <DateField label="Docs Out" value={dates.docsOutDate} />
          <DateField label="Est. Closing" value={dates.estimatedClosing} />
          <DateField label="Closing" value={dates.closingDate} />
          <DateField label="Funding" value={dates.fundingDate} />
          <DateField label="First Payment" value={dates.firstPaymentDate} />
        </div>
      </SectionCard>

      {/* ─── Conditions Summary ─── */}
      {condTotal > 0 && (
        <SectionCard title="Conditions" icon="📋" badge={`${condTotal} total`} defaultOpen={true}>
          <div className="flex items-center gap-4 mb-3">
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
              <div key={cond.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    cond.status === 'needed' ? 'bg-amber-400' :
                    cond.status === 'cleared' || cond.status === 'waived' ? 'bg-green-400' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">{cond.title}</span>
                </div>
                <span className="text-xs text-gray-400 capitalize">{cond.stage?.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {condTotal > 5 && <p className="text-xs text-gray-400 pt-1">+ {condTotal - 5} more conditions</p>}
          </div>
        </SectionCard>
      )}

      {/* ─── Source / CRM ─── */}
      <SectionCard title="Source" icon="📣" defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Lead Source" value={loan.leadSource} />
          <Field label="Referral" value={loan.referralSource} />
          <Field label="Channel" value={loan.applicationChannel} />
          <Field label="Method" value={loan.applicationMethod} />
          <Field label="LDox ID" value={loan.ldoxLoanId} />
          <DateField label="Created" value={loan.createdAt} />
        </div>
      </SectionCard>
    </div>
  );
}
