// OverviewSection — Dense, editable, full-width loan overview
// Layout: Summary strip → Borrower+Property → Loan Terms+Rate Lock →
//         Processing Timeline → Conditions+Key Dates → Source+Alerts

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import EditableField from '../EditableField';
import PayrollSection from '../../PayrollSection';
import CompensationSection from '../../CompensationSection';
import PrequalLetterModal from '../../PrequalLetter/PrequalLetterModal';

// ─── Constants ──────────────────────────────────────────────

const MILESTONES = [
  { key: 'applied', label: 'Applied', dateField: 'applicationDate' },
  { key: 'processing', label: 'Processing', dateField: null },
  { key: 'submitted_uw', label: 'UW', dateField: 'submittedToUwDate' },
  { key: 'cond_approved', label: 'Approved', dateField: 'condApprovedDate' },
  { key: 'ctc', label: 'CTC', dateField: 'ctcDate' },
  { key: 'docs_out', label: 'Docs Out', dateField: 'docsOutDate' },
  { key: 'funded', label: 'Funded', dateField: 'fundingDate' },
];

const LOAN_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'other', label: 'Other' },
];

const PURPOSE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Refinance' },
  { value: 'cash_out', label: 'Cash-Out Refi' },
  { value: 'heloc', label: 'HELOC' },
  { value: 'hecm', label: 'HECM' },
  { value: 'construction', label: 'Construction' },
];

const OCCUPANCY_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Second Home' },
  { value: 'investment', label: 'Investment' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'SFH-Detached', label: 'SFH-Detached' },
  { value: 'SFH-Attached', label: 'SFH-Attached' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Townhome', label: 'Townhome' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Manufactured', label: 'Manufactured' },
  { value: 'PUD', label: 'PUD' },
];

// ─── Helpers ────────────────────────────────────────────────

function fmt$(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtAddr(addr) {
  if (!addr) return '—';
  const street = addr.street || '';
  const cityStateZip = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
  return { street: street || '—', cityStateZip: cityStateZip || '' };
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

function computeAlerts(loan, dates) {
  const alerts = [];
  if (!loan.creditScore) alerts.push('FICO missing');
  if (!loan.estimatedValue || Number(loan.estimatedValue) === 0) alerts.push('Appraised Value missing');
  if (!dates.lockedDate && !dates.lockExpiration) alerts.push('Rate not locked');
  if (dates.lockExpiration && isExpired(dates.lockExpiration)) alerts.push('Lock EXPIRED');
  if (dates.lockExpiration && isExpiringSoon(dates.lockExpiration)) alerts.push('Lock expires within 7 days');
  if (dates.creditExpiration && isExpired(dates.creditExpiration)) alerts.push('Credit report EXPIRED');
  if (!loan.lenderName) alerts.push('No lender assigned');
  if (!loan.interestRate) alerts.push('Rate not set');
  if (!loan.monthlyBaseIncome) alerts.push('Income missing');
  return alerts;
}

// ─── Section Header ─────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{children}</h3>
  );
}

// ─── Read-only Field (for non-editable data like borrower identity) ─

function ReadField({ label, value, warn = false, error = false }) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${error ? 'text-red-600' : warn ? 'text-amber-600' : value && value !== '—' ? 'text-slate-900' : 'text-slate-300'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── Processing Task (compact) ──────────────────────────────

function ProcessingTask({ label, dates: d, fields, updateDates }) {
  // Determine status from dates
  let status = 'pending'; // default
  let statusIcon = '○';
  let statusColor = 'text-slate-400';

  const hasReceived = fields.some(f => f.key.includes('Received') || f.key.includes('Bound') || f.key.includes('Pulled'));
  const receivedField = fields.find(f => f.key.includes('Received') || f.key.includes('Bound') || f.key.includes('Pulled'));
  const expiryField = fields.find(f => f.key.includes('Expir') || f.key.includes('Expiry'));

  if (receivedField && d[receivedField.key]) {
    if (expiryField && d[expiryField.key] && isExpired(d[expiryField.key])) {
      status = 'expired'; statusIcon = '✕'; statusColor = 'text-red-600';
    } else if (expiryField && d[expiryField.key] && isExpiringSoon(d[expiryField.key])) {
      status = 'expiring'; statusIcon = '!'; statusColor = 'text-amber-500';
    } else {
      status = 'complete'; statusIcon = '✓'; statusColor = 'text-emerald-600';
    }
  } else {
    const orderedField = fields.find(f => f.key.includes('Ordered') || f.key.includes('Pulled'));
    if (orderedField && d[orderedField.key]) {
      status = 'ordered'; statusIcon = '⏳'; statusColor = 'text-blue-500';
    }
  }

  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-sm font-bold ${statusColor}`}>{statusIcon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{label}</span>
      </div>
      <div className="space-y-1">
        {fields.map(f => (
          <div key={f.key} className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] text-slate-400 shrink-0">{f.label}</span>
            {updateDates ? (
              <EditableField
                value={d[f.key] || null}
                type="date"
                onSave={val => updateDates({ [f.key]: val })}
                placeholder="—"
                className="text-right"
              />
            ) : (
              <span className={`text-xs font-semibold ${d[f.key] ? 'text-slate-800' : 'text-slate-300'}`}>
                {d[f.key] ? fmtDate(d[f.key]) : '—'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function OverviewSection({ loan, onRefresh, updateLoanField, updateDates }) {
  const { data: session } = useSession();
  const [showPrequalModal, setShowPrequalModal] = useState(false);
  const dates = loan.dates || {};
  const conditions = loan.conditions || [];
  const milestoneIndex = getMilestoneIndex(loan.status);
  const addr = loan.propertyAddress;
  const borrower = loan.borrower || {};
  const coBorrowers = loan.loanBorrowers?.filter(lb => lb.borrowerType !== 'primary') || [];
  const alerts = computeAlerts(loan, dates);

  const condNeeded = conditions.filter((c) => c.status === 'needed').length;
  const condCleared = conditions.filter((c) => c.status === 'cleared' || c.status === 'waived').length;
  const condWaived = conditions.filter((c) => c.status === 'waived').length;
  const condTotal = conditions.length;

  const address = fmtAddr(addr);

  // Compute LTV
  const loanAmt = Number(loan.loanAmount || 0);
  const propVal = Number(loan.purchasePrice || loan.estimatedValue || 0);
  const ltv = propVal > 0 ? ((loanAmt / propVal) * 100).toFixed(1) + '%' : '—';

  // Lock expiry coloring
  const lockClass = dates.lockExpiration
    ? isExpired(dates.lockExpiration) ? 'text-red-600 font-bold'
      : isExpiringSoon(dates.lockExpiration) ? 'text-amber-600 font-bold'
      : 'text-slate-900'
    : '';

  const save = updateLoanField || (() => Promise.resolve());
  const saveDates = updateDates || (() => Promise.resolve());

  return (
    <div className="space-y-4">
      {/* ─── Actions Bar ─── */}
      <div className="flex items-center gap-3">
        <button onClick={() => setShowPrequalModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-cyan-700 transition-colors shadow-sm">
          Pre-Qual Letter
        </button>
      </div>

      {showPrequalModal && (
        <PrequalLetterModal loan={loan} session={session} onClose={() => setShowPrequalModal(false)} />
      )}

      {loan.status === 'funded' && (
        <>
          <PayrollSection loan={loan} onRefresh={onRefresh} />
          <CompensationSection loan={loan} />
        </>
      )}

      {/* ─── Alerts ─── */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap gap-3">
          {alerts.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
              <span className="text-amber-500">⚠</span> {a}
            </span>
          ))}
        </div>
      )}

      {/* ─── Pipeline Progress Bar ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
        <div className="flex items-center justify-between">
          {MILESTONES.map((milestone, i) => {
            const isComplete = milestoneIndex >= i;
            const isCurrent = milestoneIndex === i;
            const dateVal = milestone.dateField ? dates[milestone.dateField] : null;
            return (
              <div key={milestone.key} className="flex-1 flex flex-col items-center relative">
                {i > 0 && (
                  <div className={`absolute top-3 right-1/2 w-full h-1 -translate-y-1/2 ${isComplete ? 'bg-primary' : 'bg-slate-200'}`}
                    style={{ left: '-50%' }} />
                )}
                <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent ? 'bg-primary text-white ring-4 ring-primary/20'
                    : isComplete ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {isComplete ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] mt-1 font-bold ${isCurrent ? 'text-primary' : isComplete ? 'text-slate-700' : 'text-slate-400'}`}>
                  {milestone.label}
                </span>
                <span className="text-[10px] text-slate-400">{dateVal ? fmtDate(dateVal) : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Row 1: Loan Summary Strip ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          <div>
            <EditableField label="Loan Amount" value={loan.loanAmount} type="currency"
              onSave={val => save({ loanAmount: val })} placeholder="—" />
          </div>
          <div>
            <EditableField label="Rate" value={loan.interestRate} type="text"
              onSave={val => save({ interestRate: val })} placeholder="—" />
          </div>
          <div>
            <ReadField label="LTV" value={ltv} />
          </div>
          <div>
            <EditableField label="FICO" value={loan.creditScore} type="text"
              onSave={val => save({ creditScore: val })} placeholder="—" />
          </div>
          <div>
            <ReadField label="Monthly Pmt" value={fmt$(loan.monthlyPayment)} />
          </div>
          <div>
            <EditableField label="Closing Date" value={dates.estimatedClosing || dates.closingDate} type="date"
              onSave={val => saveDates({ estimatedClosing: val })} placeholder="—" />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Lock Expires</span>
            <span className={`text-sm font-semibold ${lockClass || 'text-slate-300'}`}>
              {dates.lockExpiration ? fmtDate(dates.lockExpiration) : '—'}
            </span>
          </div>
          <div>
            <ReadField label="Ball In Court" value={loan.ballInCourt || '—'} />
          </div>
        </div>
      </div>

      {/* ─── Row 2: Borrower + Property ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Borrower */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionHeader>Borrower</SectionHeader>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-slate-900">{borrower.firstName} {borrower.lastName}</span>
              {borrower.ssnLastFour && <span className="text-xs font-medium text-slate-400">SSN ···{borrower.ssnLastFour}</span>}
            </div>
            {borrower.email && (
              <a href={`mailto:${borrower.email}`} className="block text-sm text-primary font-semibold hover:underline">{borrower.email}</a>
            )}
            {borrower.phone && (
              <a href={`tel:${borrower.phone}`} className="block text-sm text-primary font-semibold hover:underline">{borrower.phone}</a>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <EditableField label="FICO" value={loan.creditScore} type="text" onSave={val => save({ creditScore: val })} placeholder="—" />
              <EditableField label="Monthly Income" value={loan.monthlyBaseIncome} type="currency" onSave={val => save({ monthlyBaseIncome: val })} placeholder="—" />
              <EditableField label="Employment" value={loan.employmentStatus} type="text" onSave={val => save({ employmentStatus: val })} placeholder="—" />
              <EditableField label="Employer" value={loan.employerName} type="text" onSave={val => save({ employerName: val })} placeholder="—" />
              <EditableField label="Housing Exp" value={loan.presentHousingExpense} type="currency" onSave={val => save({ presentHousingExpense: val })} placeholder="—" />
            </div>
            {coBorrowers.length > 0 && (
              <div className="border-t border-slate-100 pt-2 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Co-Borrower</span>
                {coBorrowers.map((lb, i) => (
                  <div key={i} className="text-sm font-semibold text-slate-800 mt-0.5">
                    {lb.borrower?.firstName} {lb.borrower?.lastName}
                    {lb.borrower?.email && <span className="text-slate-400 font-normal ml-2">{lb.borrower.email}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Property */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionHeader>Property</SectionHeader>
          <div className="space-y-2">
            <div className="text-base font-bold text-slate-900">{address.street}</div>
            {address.cityStateZip && <div className="text-sm text-slate-600">{address.cityStateZip}</div>}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <EditableField label="Type" value={loan.propertyType} type="select" options={PROPERTY_TYPE_OPTIONS} onSave={val => save({ propertyType: val })} placeholder="—" />
              <EditableField label="Occupancy" value={loan.occupancy} type="select" options={OCCUPANCY_OPTIONS} onSave={val => save({ occupancy: val })} placeholder="—" />
              <EditableField label="Units" value={loan.numUnits} type="text" onSave={val => save({ numUnits: val })} placeholder="—" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditableField label="Purchase Price" value={loan.purchasePrice} type="currency" onSave={val => save({ purchasePrice: val })} placeholder="—" />
              <EditableField label="Appraised Value" value={loan.estimatedValue} type="currency" onSave={val => save({ estimatedValue: val })} placeholder="—" />
              <EditableField label="Down Payment" value={loan.downPayment} type="currency" onSave={val => save({ downPayment: val })} placeholder="—" />
              <EditableField label="Current Balance" value={loan.currentBalance} type="currency" onSave={val => save({ currentBalance: val })} placeholder="—" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Row 3: Loan Terms + Rate Lock ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Loan Terms */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionHeader>Loan Terms</SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            <EditableField label="Amount" value={loan.loanAmount} type="currency" onSave={val => save({ loanAmount: val })} placeholder="—" />
            <EditableField label="Rate" value={loan.interestRate} type="text" onSave={val => save({ interestRate: val })} placeholder="—" />
            <EditableField label="Term" value={loan.loanTerm} type="text" onSave={val => save({ loanTerm: val })} placeholder="—" />
            <EditableField label="Type" value={loan.loanType} type="select" options={LOAN_TYPE_OPTIONS} onSave={val => save({ loanType: val })} placeholder="—" />
            <EditableField label="Purpose" value={loan.purpose} type="select" options={PURPOSE_OPTIONS} onSave={val => save({ purpose: val })} placeholder="—" />
            <EditableField label="Lender" value={loan.lenderName} type="text" onSave={val => save({ lenderName: val })} placeholder="—" />
            <EditableField label="Loan #" value={loan.loanNumber} type="text" onSave={val => save({ loanNumber: val })} placeholder="—" />
            <EditableField label="Lien Status" value={loan.lienStatus} type="text" onSave={val => save({ lienStatus: val })} placeholder="—" />
            <ReadField label="Ball in Court" value={loan.ballInCourt} />
          </div>
          {(loan.purpose === 'refinance' || loan.purpose === 'cash_out') && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
              <EditableField label="Refi Purpose" value={loan.refiPurpose} type="text" onSave={val => save({ refiPurpose: val })} placeholder="—" />
              <EditableField label="Cash Out" value={loan.cashOutAmount} type="currency" onSave={val => save({ cashOutAmount: val })} placeholder="—" />
            </div>
          )}
        </div>

        {/* Rate Lock */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionHeader>Rate Lock</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="Lock Date" value={dates.lockedDate} type="date" onSave={val => saveDates({ lockedDate: val })} placeholder="—" />
            <EditableField label="Lock Expires" value={dates.lockExpiration} type="date" onSave={val => saveDates({ lockExpiration: val })} placeholder="—" />
            <EditableField label="Lock Term (days)" value={dates.lockTerm} type="text" onSave={val => saveDates({ lockTerm: val })} placeholder="—" />
            <ReadField label="# Borrowers" value={loan.numBorrowers} />
          </div>
        </div>
      </div>

      {/* ─── Row 4: Processing Timeline (compact horizontal) ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SectionHeader>Processing</SectionHeader>
        <div className="flex flex-wrap gap-6">
          <ProcessingTask label="Credit" dates={dates} updateDates={updateDates} fields={[
            { key: 'creditPulledDate', label: 'Pulled' },
            { key: 'creditExpiration', label: 'Expires' },
          ]} />
          <ProcessingTask label="Appraisal" dates={dates} updateDates={updateDates} fields={[
            { key: 'appraisalOrdered', label: 'Ordered' },
            { key: 'appraisalReceived', label: 'Received' },
            { key: 'appraisalExpiry', label: 'Expires' },
          ]} />
          <ProcessingTask label="Title" dates={dates} updateDates={updateDates} fields={[
            { key: 'titleOrdered', label: 'Ordered' },
            { key: 'titleReceived', label: 'Received' },
          ]} />
          <ProcessingTask label="Flood" dates={dates} updateDates={updateDates} fields={[
            { key: 'floodCertOrdered', label: 'Ordered' },
            { key: 'floodCertReceived', label: 'Received' },
          ]} />
          <ProcessingTask label="HOI" dates={dates} updateDates={updateDates} fields={[
            { key: 'hoiOrdered', label: 'Ordered' },
            { key: 'hoiReceived', label: 'Received' },
            { key: 'hoiBound', label: 'Bound' },
          ]} />
        </div>
      </div>

      {/* ─── Row 5: Conditions + Key Dates ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conditions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader>Conditions</SectionHeader>
            {condTotal > 0 && <span className="text-xs font-bold text-slate-400">{condCleared}/{condTotal} cleared</span>}
          </div>
          {condTotal > 0 ? (
            <>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-700">{condNeeded} needed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-700">{condCleared - condWaived} cleared</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-bold text-slate-700">{condWaived} waived</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {conditions.slice(0, 5).map((cond) => (
                  <div key={cond.id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        cond.status === 'needed' ? 'bg-amber-500' :
                        cond.status === 'cleared' ? 'bg-emerald-500' :
                        cond.status === 'waived' ? 'bg-slate-400' : 'bg-slate-200'
                      }`} />
                      <span className="text-sm font-semibold text-slate-800">{cond.title}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">{cond.stage?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
                {condTotal > 5 && <p className="text-xs font-medium text-primary pt-1">→ View all {condTotal} conditions</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">No conditions yet</p>
          )}
        </div>

        {/* Key Dates */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionHeader>Key Dates</SectionHeader>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Application', key: 'applicationDate' },
              { label: 'Submitted UW', key: 'submittedToUwDate' },
              { label: 'Cond. Approved', key: 'condApprovedDate' },
              { label: 'CTC', key: 'ctcDate' },
              { label: 'Docs Out', key: 'docsOutDate' },
              { label: 'Est. Closing', key: 'estimatedClosing' },
              { label: 'Closing', key: 'closingDate' },
              { label: 'Funding', key: 'fundingDate' },
              { label: 'First Payment', key: 'firstPaymentDate' },
            ].map(d => (
              <EditableField key={d.key} label={d.label} value={dates[d.key]} type="date"
                onSave={val => saveDates({ [d.key]: val })} placeholder="—" />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Row 6: Source/CRM ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SectionHeader>Source / CRM</SectionHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <EditableField label="Lead Source" value={loan.leadSource} type="text" onSave={val => save({ leadSource: val })} placeholder="—" />
          <EditableField label="Channel" value={loan.applicationChannel} type="text" onSave={val => save({ applicationChannel: val })} placeholder="—" />
          <EditableField label="Referral" value={loan.referralSource} type="text" onSave={val => save({ referralSource: val })} placeholder="—" />
          <ReadField label="LDox ID" value={loan.ldoxLoanId} />
          <ReadField label="Created" value={loan.createdAt ? new Date(loan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
        </div>
      </div>
    </div>
  );
}
