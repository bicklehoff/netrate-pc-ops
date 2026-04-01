// OverviewSection — Dense, editable, full-width loan overview
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
  { key: 'docs_out', label: 'Docs', dateField: 'docsOutDate' },
  { key: 'funded', label: 'Funded', dateField: 'fundingDate' },
];

const LOAN_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conv' }, { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' }, { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' }, { value: 'other', label: 'Other' },
];
const PURPOSE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' }, { value: 'refinance', label: 'Refi' },
  { value: 'cash_out', label: 'C/O Refi' }, { value: 'heloc', label: 'HELOC' },
  { value: 'hecm', label: 'HECM' }, { value: 'construction', label: 'Construction' },
];
const OCCUPANCY_OPTIONS = [
  { value: 'primary', label: 'Primary' }, { value: 'secondary', label: '2nd Home' },
  { value: 'investment', label: 'Investment' },
];
const PROPERTY_TYPE_OPTIONS = [
  { value: 'SFH-Detached', label: 'SFH-Det' }, { value: 'SFH-Attached', label: 'SFH-Att' },
  { value: 'Condo', label: 'Condo' }, { value: 'Townhome', label: 'Town' },
  { value: 'Multi-Family', label: 'Multi' }, { value: 'Manufactured', label: 'Mfg' },
  { value: 'PUD', label: 'PUD' },
];

// ─── Helpers ────────────────────────────────────────────────

function fmt$(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtAddr(addr) {
  if (!addr) return { street: '—', csz: '' };
  return { street: addr.street || '—', csz: [addr.city, addr.state, addr.zip].filter(Boolean).join(', ') };
}
function getMilestoneIndex(status) {
  const idx = MILESTONES.findIndex(m => m.key === status);
  return idx >= 0 ? idx : -1;
}
function isExpiringSoon(d, days = 7) {
  if (!d) return false;
  const diff = (new Date(d) - new Date()) / 86400000;
  return diff >= 0 && diff <= days;
}
function isExpired(d) { return d ? new Date(d) < new Date() : false; }

function computeAlerts(loan, dates) {
  const a = [];
  if (!loan.creditScore) a.push('FICO missing');
  if (!loan.estimatedValue || Number(loan.estimatedValue) === 0) a.push('Appraised Value missing');
  if (!dates.lockedDate && !dates.lockExpiration) a.push('Rate not locked');
  if (dates.lockExpiration && isExpired(dates.lockExpiration)) a.push('Lock EXPIRED');
  else if (dates.lockExpiration && isExpiringSoon(dates.lockExpiration)) a.push('Lock expires soon');
  if (dates.creditExpiration && isExpired(dates.creditExpiration)) a.push('Credit EXPIRED');
  if (!loan.lenderName) a.push('No lender');
  if (!loan.interestRate) a.push('Rate not set');
  return a;
}

// ─── Tiny display components ────────────────────────────────

function RF({ label, value, warn, error }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">{label}</div>
      <div className={`text-xs font-semibold leading-tight truncate ${error ? 'text-red-600' : warn ? 'text-amber-600' : value && value !== '—' ? 'text-slate-900' : 'text-slate-300'}`}>{value || '—'}</div>
    </div>
  );
}

function EF({ label, value, type = 'text', options, onSave, placeholder = '—' }) {
  return (
    <div className="min-w-0">
      <EditableField label={label} value={value} type={type} options={options} onSave={onSave} placeholder={placeholder} />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function OverviewSection({ loan, onRefresh, updateLoanField, updateDates }) {
  const { data: session } = useSession();
  const [showPrequalModal, setShowPrequalModal] = useState(false);
  const dates = loan.dates || {};
  const conditions = loan.conditions || [];
  const mi = getMilestoneIndex(loan.status);
  const borrower = loan.borrower || {};
  const coBorrowers = loan.loanBorrowers?.filter(lb => lb.borrowerType !== 'primary') || [];
  const alerts = computeAlerts(loan, dates);
  const addr = fmtAddr(loan.propertyAddress);

  const condNeeded = conditions.filter(c => c.status === 'needed').length;
  const condCleared = conditions.filter(c => c.status === 'cleared' || c.status === 'waived').length;
  const condTotal = conditions.length;

  const loanAmt = Number(loan.loanAmount || 0);
  const propVal = Number(loan.purchasePrice || loan.estimatedValue || 0);
  const ltv = propVal > 0 ? ((loanAmt / propVal) * 100).toFixed(1) + '%' : '—';

  const lockClass = dates.lockExpiration
    ? isExpired(dates.lockExpiration) ? 'text-red-600 font-bold'
      : isExpiringSoon(dates.lockExpiration) ? 'text-amber-600 font-bold'
      : '' : '';

  const save = updateLoanField || (() => Promise.resolve());
  const saveDates = updateDates || (() => Promise.resolve());

  // Processing task status helper
  const procStatus = (rcvKey, expKey, ordKey) => {
    if (dates[rcvKey]) {
      if (expKey && dates[expKey] && isExpired(dates[expKey])) return ['✕', 'text-red-600'];
      if (expKey && dates[expKey] && isExpiringSoon(dates[expKey])) return ['!', 'text-amber-500'];
      return ['✓', 'text-emerald-600'];
    }
    if (ordKey && dates[ordKey]) return ['⏳', 'text-blue-500'];
    return ['○', 'text-slate-300'];
  };

  return (
    <div className="space-y-2">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowPrequalModal(true)}
          className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-md hover:bg-cyan-700 transition-colors">Pre-Qual Letter</button>
      </div>
      {showPrequalModal && <PrequalLetterModal loan={loan} session={session} onClose={() => setShowPrequalModal(false)} />}
      {loan.status === 'funded' && <><PayrollSection loan={loan} onRefresh={onRefresh} /><CompensationSection loan={loan} /></>}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 flex flex-wrap gap-2">
          {alerts.map((a, i) => <span key={i} className="text-[10px] font-bold text-amber-800">⚠ {a}</span>)}
        </div>
      )}

      {/* Pipeline + Summary strip — combined */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        {/* Pipeline bar */}
        <div className="flex items-center px-3 py-1.5 border-b border-slate-100">
          {MILESTONES.map((m, i) => {
            const done = mi >= i;
            const cur = mi === i;
            const dv = m.dateField ? dates[m.dateField] : null;
            return (
              <div key={m.key} className="flex-1 flex items-center gap-1">
                {i > 0 && <div className={`flex-1 h-0.5 ${done ? 'bg-primary' : 'bg-slate-200'}`} />}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  cur ? 'bg-primary text-white ring-2 ring-primary/30' : done ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'
                }`}>{done ? '✓' : i + 1}</div>
                <div className="hidden sm:block">
                  <div className={`text-[9px] font-bold leading-none ${cur ? 'text-primary' : done ? 'text-slate-700' : 'text-slate-400'}`}>{m.label}</div>
                  {dv && <div className="text-[8px] text-slate-400 leading-none">{fmtDate(dv)}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Summary strip */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-1 px-3 py-2">
          <EF label="Loan Amt" value={loan.loanAmount} type="currency" onSave={v => save({ loanAmount: v })} />
          <EF label="Rate" value={loan.interestRate} type="text" onSave={v => save({ interestRate: v })} />
          <RF label="LTV" value={ltv} />
          <EF label="FICO" value={loan.creditScore} type="text" onSave={v => save({ creditScore: v })} />
          <RF label="Mo. Pmt" value={fmt$(loan.monthlyPayment)} />
          <EF label="Closing" value={dates.estimatedClosing || dates.closingDate} type="date" onSave={v => saveDates({ estimatedClosing: v })} />
          <div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">Lock Exp</div>
            <div className={`text-xs font-semibold leading-tight ${lockClass || 'text-slate-300'}`}>{dates.lockExpiration ? fmtDate(dates.lockExpiration) : '—'}</div></div>
          <RF label="BIC" value={loan.ballInCourt || '—'} />
        </div>
      </div>

      {/* Borrower + Property + Loan Terms + Rate Lock — 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {/* Borrower */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Borrower</div>
          <div className="text-sm font-bold text-slate-900 leading-tight">{borrower.firstName} {borrower.lastName}
            {borrower.ssnLastFour && <span className="text-[10px] font-medium text-slate-400 ml-1">···{borrower.ssnLastFour}</span>}
          </div>
          {borrower.email && <a href={`mailto:${borrower.email}`} className="block text-xs text-primary font-semibold truncate">{borrower.email}</a>}
          {borrower.phone && <a href={`tel:${borrower.phone}`} className="block text-xs text-primary font-semibold">{borrower.phone}</a>}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-slate-100">
            <EF label="FICO" value={loan.creditScore} type="text" onSave={v => save({ creditScore: v })} />
            <EF label="Income" value={loan.monthlyBaseIncome} type="currency" onSave={v => save({ monthlyBaseIncome: v })} />
            <EF label="Employment" value={loan.employmentStatus} type="text" onSave={v => save({ employmentStatus: v })} />
            <EF label="Employer" value={loan.employerName} type="text" onSave={v => save({ employerName: v })} />
            <EF label="Housing" value={loan.presentHousingExpense} type="currency" onSave={v => save({ presentHousingExpense: v })} />
          </div>
          {coBorrowers.length > 0 && (
            <div className="mt-1 pt-1 border-t border-slate-100 text-[10px]">
              <span className="font-bold text-slate-400 uppercase">Co-Borr: </span>
              {coBorrowers.map((lb, i) => <span key={i} className="font-semibold text-slate-700">{lb.borrower?.firstName} {lb.borrower?.lastName}{i < coBorrowers.length - 1 ? ', ' : ''}</span>)}
            </div>
          )}
        </div>

        {/* Property */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Property</div>
          <div className="text-sm font-bold text-slate-900 leading-tight">{addr.street}</div>
          {addr.csz && <div className="text-xs text-slate-500">{addr.csz}</div>}
          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 mt-1.5 pt-1.5 border-t border-slate-100">
            <EF label="Type" value={loan.propertyType} type="select" options={PROPERTY_TYPE_OPTIONS} onSave={v => save({ propertyType: v })} />
            <EF label="Occup" value={loan.occupancy} type="select" options={OCCUPANCY_OPTIONS} onSave={v => save({ occupancy: v })} />
            <EF label="Units" value={loan.numUnits} type="text" onSave={v => save({ numUnits: v })} />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
            <EF label="Purchase" value={loan.purchasePrice} type="currency" onSave={v => save({ purchasePrice: v })} />
            <EF label="Appraised" value={loan.estimatedValue} type="currency" onSave={v => save({ estimatedValue: v })} />
            <EF label="Down Pmt" value={loan.downPayment} type="currency" onSave={v => save({ downPayment: v })} />
            <EF label="Cur Bal" value={loan.currentBalance} type="currency" onSave={v => save({ currentBalance: v })} />
          </div>
        </div>

        {/* Loan Terms */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Loan Terms</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
            <EF label="Amount" value={loan.loanAmount} type="currency" onSave={v => save({ loanAmount: v })} />
            <EF label="Rate" value={loan.interestRate} type="text" onSave={v => save({ interestRate: v })} />
            <EF label="Term" value={loan.loanTerm} type="text" onSave={v => save({ loanTerm: v })} />
            <EF label="Type" value={loan.loanType} type="select" options={LOAN_TYPE_OPTIONS} onSave={v => save({ loanType: v })} />
            <EF label="Purpose" value={loan.purpose} type="select" options={PURPOSE_OPTIONS} onSave={v => save({ purpose: v })} />
            <EF label="Lender" value={loan.lenderName} type="text" onSave={v => save({ lenderName: v })} />
            <EF label="Loan #" value={loan.loanNumber} type="text" onSave={v => save({ loanNumber: v })} />
            <EF label="Lien" value={loan.lienStatus} type="text" onSave={v => save({ lienStatus: v })} />
            <RF label="BIC" value={loan.ballInCourt} />
          </div>
          {(loan.purpose === 'refinance' || loan.purpose === 'cash_out') && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 pt-1 border-t border-slate-100">
              <EF label="Refi Purpose" value={loan.refiPurpose} type="text" onSave={v => save({ refiPurpose: v })} />
              <EF label="Cash Out" value={loan.cashOutAmount} type="currency" onSave={v => save({ cashOutAmount: v })} />
            </div>
          )}
        </div>

        {/* Rate Lock */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rate Lock</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <EF label="Lock Date" value={dates.lockedDate} type="date" onSave={v => saveDates({ lockedDate: v })} />
            <EF label="Lock Exp" value={dates.lockExpiration} type="date" onSave={v => saveDates({ lockExpiration: v })} />
            <EF label="Lock Term" value={dates.lockTerm} type="text" onSave={v => saveDates({ lockTerm: v })} />
            <RF label="# Borrowers" value={loan.numBorrowers} />
          </div>
        </div>
      </div>

      {/* Processing — inline horizontal */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Processing</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Credit', fields: [['creditPulledDate','Pulled'],['creditExpiration','Expires']], rcv: 'creditPulledDate', exp: 'creditExpiration' },
            { label: 'Appraisal', fields: [['appraisalOrdered','Ordered'],['appraisalReceived','Rcvd'],['appraisalExpiry','Expires']], rcv: 'appraisalReceived', exp: 'appraisalExpiry', ord: 'appraisalOrdered' },
            { label: 'Title', fields: [['titleOrdered','Ordered'],['titleReceived','Rcvd']], rcv: 'titleReceived', ord: 'titleOrdered' },
            { label: 'Flood', fields: [['floodCertOrdered','Ordered'],['floodCertReceived','Rcvd']], rcv: 'floodCertReceived', ord: 'floodCertOrdered' },
            { label: 'HOI', fields: [['hoiOrdered','Ordered'],['hoiReceived','Rcvd'],['hoiBound','Bound']], rcv: 'hoiBound', ord: 'hoiOrdered' },
          ].map(task => {
            const [icon, iconColor] = procStatus(task.rcv, task.exp, task.ord);
            return (
              <div key={task.label}>
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-xs font-bold ${iconColor}`}>{icon}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-700">{task.label}</span>
                </div>
                {task.fields.map(([key, lbl]) => (
                  <div key={key} className="flex items-baseline justify-between gap-1">
                    <span className="text-[9px] text-slate-400">{lbl}</span>
                    <span className={`text-[10px] font-semibold ${dates[key] ? 'text-slate-800' : 'text-slate-300'}`}>{dates[key] ? fmtDate(dates[key]) : '—'}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conditions + Key Dates + Source — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Conditions */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Conditions</div>
            {condTotal > 0 && <span className="text-[10px] font-bold text-slate-500">{condCleared}/{condTotal}</span>}
          </div>
          {condTotal > 0 ? (
            <>
              <div className="flex gap-3 mb-1.5 text-[10px] font-bold">
                <span className="text-amber-600">● {condNeeded} needed</span>
                <span className="text-emerald-600">● {condCleared} cleared</span>
              </div>
              {conditions.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-0.5 text-[11px]">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === 'needed' ? 'bg-amber-500' : c.status === 'cleared' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="font-semibold text-slate-800 truncate">{c.title}</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0 ml-1">{c.stage?.replace(/_/g, ' ')}</span>
                </div>
              ))}
              {condTotal > 5 && <p className="text-[10px] font-bold text-primary mt-0.5">→ {condTotal - 5} more</p>}
            </>
          ) : <p className="text-[10px] text-slate-400">No conditions</p>}
        </div>

        {/* Key Dates */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Key Dates</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {[
              ['applicationDate','Application'], ['submittedToUwDate','Submitted UW'],
              ['condApprovedDate','Approved'], ['ctcDate','CTC'],
              ['docsOutDate','Docs Out'], ['estimatedClosing','Est. Closing'],
              ['closingDate','Closing'], ['fundingDate','Funding'],
              ['firstPaymentDate','1st Payment'],
            ].map(([key, lbl]) => (
              <EF key={key} label={lbl} value={dates[key]} type="date" onSave={v => saveDates({ [key]: v })} />
            ))}
          </div>
        </div>

        {/* Source */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Source / CRM</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <EF label="Lead Src" value={loan.leadSource} type="text" onSave={v => save({ leadSource: v })} />
            <EF label="Channel" value={loan.applicationChannel} type="text" onSave={v => save({ applicationChannel: v })} />
            <EF label="Referral" value={loan.referralSource} type="text" onSave={v => save({ referralSource: v })} />
            <RF label="LDox ID" value={loan.ldoxLoanId} />
            <RF label="Created" value={loan.createdAt ? fmtDate(loan.createdAt) : '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}
