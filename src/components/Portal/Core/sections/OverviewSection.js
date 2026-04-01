// OverviewSection — Dense, editable, full-width loan overview
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import EditableField from '../EditableField';
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
  if (!addr) return { street: '—', csz: '', county: '' };
  return {
    street: addr.street || '—',
    csz: [addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
    county: addr.county || '',
  };
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

export default function OverviewSection({ loan, updateLoanField, updateDates }) {
  const { data: session } = useSession();
  const [showPrequalModal, setShowPrequalModal] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const dates = loan.dates || {};
  const mi = getMilestoneIndex(loan.status);
  const borrower = loan.borrower || {};
  const coBorrowers = loan.loanBorrowers?.filter(lb => lb.borrowerType !== 'primary') || [];
  const alerts = computeAlerts(loan, dates);
  const addr = fmtAddr(loan.propertyAddress);

  const loanAmt = Number(loan.loanAmount || 0);
  const propVal = Number(loan.purchasePrice || loan.estimatedValue || 0);
  const ltv = propVal > 0 ? ((loanAmt / propVal) * 100).toFixed(1) + '%' : '—';

  const lockClass = dates.lockExpiration
    ? isExpired(dates.lockExpiration) ? 'text-red-600 font-bold'
      : isExpiringSoon(dates.lockExpiration) ? 'text-amber-600 font-bold'
      : '' : '';

  const save = updateLoanField || (() => Promise.resolve());
  const saveDates = updateDates || (() => Promise.resolve());

  return (
    <div className="space-y-1.5">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowPrequalModal(true)}
          className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-md hover:bg-cyan-700 transition-colors">Pre-Qual Letter</button>
        {(loan.status === 'funded' || loan.status === 'settled') && (
          <a href={`?section=payroll`}
            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors">
            Payroll / CD →
          </a>
        )}
      </div>
      {showPrequalModal && <PrequalLetterModal loan={loan} session={session} onClose={() => setShowPrequalModal(false)} />}

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

      {/* Borrower — inline strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
          <span className="text-[9px] font-bold uppercase text-slate-400 mr-1">Borrower</span>
          <span className="font-bold text-slate-900">{borrower.firstName} {borrower.lastName}</span>
          {borrower.ssnLastFour && <><span className="text-slate-300">|</span><span className="text-slate-500">···{borrower.ssnLastFour}</span></>}
          {borrower.email && <><span className="text-slate-300">|</span><a href={`mailto:${borrower.email}`} className="text-primary font-semibold">{borrower.email}</a></>}
          {borrower.phone && <><span className="text-slate-300">|</span><a href={`tel:${borrower.phone}`} className="text-primary font-semibold">{borrower.phone}</a></>}
          {coBorrowers.length > 0 && <><span className="text-slate-300">|</span><span className="text-slate-500">Co: {coBorrowers.map(lb => `${lb.borrower?.firstName} ${lb.borrower?.lastName}`).join(', ')}</span></>}
        </div>
        <div className="flex gap-x-6 mt-1 pt-1 border-t border-slate-100">
          <div className="flex-1"><EF label="FICO" value={loan.creditScore} type="text" onSave={v => save({ creditScore: v })} /></div>
          <div className="flex-1"><EF label="Income" value={loan.monthlyBaseIncome} type="currency" onSave={v => save({ monthlyBaseIncome: v })} /></div>
          <div className="flex-1"><EF label="Employment" value={loan.employmentStatus} type="text" onSave={v => save({ employmentStatus: v })} /></div>
          <div className="flex-1"><EF label="Employer" value={loan.employerName} type="text" onSave={v => save({ employerName: v })} /></div>
          <div className="flex-1"><EF label="Housing" value={loan.presentHousingExpense} type="currency" onSave={v => save({ presentHousingExpense: v })} /></div>
        </div>
      </div>

      {/* Property — inline strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
          <span className="text-[9px] font-bold uppercase text-slate-400 mr-1">Property</span>
          <span className="font-bold text-slate-900">{addr.street}</span>
          {addr.csz && <><span className="text-slate-300">|</span><span className="text-slate-600">{addr.csz}</span></>}
          {(loan.propertyCounty || addr.county) && <><span className="text-slate-300">|</span><span className="text-slate-500">{loan.propertyCounty || addr.county} County</span></>}
          {loan.propertyAddress?.googleValidated && <span className="text-[9px] font-bold text-emerald-600 ml-1">✓ Verified</span>}
          {!loan.propertyAddress?.googleValidated && addr.street !== '—' && (
            <button
              onClick={async () => {
                setGeocoding(true);
                try {
                  const res = await fetch(`/api/portal/mlo/loans/${loan.id}/geocode`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
                  });
                  const data = await res.json();
                  setGeocodeResult(data);
                } catch {} finally { setGeocoding(false); }
              }}
              disabled={geocoding}
              className="text-[9px] font-bold text-primary hover:text-cyan-700 ml-1"
            >
              {geocoding ? '...' : '⟳ Validate'}
            </button>
          )}
        </div>
        {/* Geocode comparison */}
        {geocodeResult?.validated && (
          <div className="mt-1 p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-700">Google suggests:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={async () => {
                    await fetch(`/api/portal/mlo/loans/${loan.id}/geocode`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ accept: true, address: geocodeResult.google }),
                    });
                    setGeocodeResult(null);
                    window.location.reload();
                  }}
                  className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[9px]"
                >Accept Google</button>
                <button
                  onClick={() => setGeocodeResult(null)}
                  className="px-2 py-0.5 bg-slate-300 text-slate-700 font-bold rounded text-[9px]"
                >Keep Current</button>
              </div>
            </div>
            <div className="font-semibold text-slate-800">{geocodeResult.google.formatted}</div>
            <div className="text-slate-500 mt-0.5">
              County: <span className="font-bold text-slate-700">{geocodeResult.google.county || '—'}</span>
              {' | '}Zip: <span className="font-bold text-slate-700">{geocodeResult.google.zip || '—'}</span>
            </div>
          </div>
        )}
        {geocodeResult && !geocodeResult.validated && (
          <div className="mt-1 p-1.5 bg-red-50 rounded border border-red-200 text-[10px] text-red-700 font-medium">
            Could not validate: {geocodeResult.error || 'Address not found'}
            <button onClick={() => setGeocodeResult(null)} className="ml-2 text-red-500 font-bold">✕</button>
          </div>
        )}
        <div className="flex gap-x-6 mt-1 pt-1 border-t border-slate-100">
          <div className="flex-1"><EF label="Type" value={loan.propertyType} type="select" options={PROPERTY_TYPE_OPTIONS} onSave={v => save({ propertyType: v })} /></div>
          <div className="flex-1"><EF label="Occup" value={loan.occupancy} type="select" options={OCCUPANCY_OPTIONS} onSave={v => save({ occupancy: v })} /></div>
          <div className="flex-1"><EF label="Units" value={loan.numUnits} type="text" onSave={v => save({ numUnits: v })} /></div>
          <div className="flex-1"><EF label="Purchase" value={loan.purchasePrice} type="currency" onSave={v => save({ purchasePrice: v })} /></div>
          <div className="flex-1"><EF label="Appraised" value={loan.estimatedValue} type="currency" onSave={v => save({ estimatedValue: v })} /></div>
          <div className="flex-1"><EF label="Down Pmt" value={loan.downPayment} type="currency" onSave={v => save({ downPayment: v })} /></div>
          <div className="flex-1"><EF label="Cur Bal" value={loan.currentBalance} type="currency" onSave={v => save({ currentBalance: v })} /></div>
        </div>
      </div>

      {/* Key Dates — right after summary strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Key Dates</div>
        <div className="flex gap-x-6">
          {[
            ['applicationDate','Applied'], ['submittedToUwDate','UW'],
            ['condApprovedDate','Approved'], ['ctcDate','CTC'],
            ['docsOutDate','Docs Out'], ['estimatedClosing','Est. Close'],
            ['closingDate','Closing'], ['fundingDate','Funding'],
            ['firstPaymentDate','1st Pmt'],
          ].map(([key, lbl]) => (
            <div key={key} className="flex-1"><EF label={lbl} value={dates[key]} type="date" onSave={v => saveDates({ [key]: v })} /></div>
          ))}
        </div>
      </div>

      {/* Loan Terms + Rate Lock — inline strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Loan Terms</div>
        <div className="flex gap-x-6">
          <div className="flex-1"><EF label="Amount" value={loan.loanAmount} type="currency" onSave={v => save({ loanAmount: v })} /></div>
          <div className="flex-1"><EF label="Rate" value={loan.interestRate} type="text" onSave={v => save({ interestRate: v })} /></div>
          <div className="flex-1"><EF label="Term" value={loan.loanTerm} type="text" onSave={v => save({ loanTerm: v })} /></div>
          <div className="flex-1"><EF label="Type" value={loan.loanType} type="select" options={LOAN_TYPE_OPTIONS} onSave={v => save({ loanType: v })} /></div>
          <div className="flex-1"><EF label="Purpose" value={loan.purpose} type="select" options={PURPOSE_OPTIONS} onSave={v => save({ purpose: v })} /></div>
          <div className="flex-1"><EF label="Lender" value={loan.lenderName} type="text" onSave={v => save({ lenderName: v })} /></div>
          <div className="flex-1"><EF label="Loan #" value={loan.loanNumber} type="text" onSave={v => save({ loanNumber: v })} /></div>
          <div className="flex-1"><EF label="Lien" value={loan.lienStatus} type="text" onSave={v => save({ lienStatus: v })} /></div>
          <div className="flex-1"><RF label="BIC" value={loan.ballInCourt} /></div>
        </div>
        {(loan.purpose === 'refinance' || loan.purpose === 'cash_out') && (
          <div className="flex gap-x-6 mt-0.5 pt-0.5 border-t border-slate-100">
            <div className="flex-1"><EF label="Refi Purpose" value={loan.refiPurpose} type="text" onSave={v => save({ refiPurpose: v })} /></div>
            <div className="flex-1"><EF label="Cash Out" value={loan.cashOutAmount} type="currency" onSave={v => save({ cashOutAmount: v })} /></div>
            <div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" />
          </div>
        )}
        <div className="flex gap-x-6 mt-0.5 pt-0.5 border-t border-slate-100">
          <div className="flex-1"><EF label="Lock Date" value={dates.lockedDate} type="date" onSave={v => saveDates({ lockedDate: v })} /></div>
          <div className="flex-1"><EF label="Lock Exp" value={dates.lockExpiration} type="date" onSave={v => saveDates({ lockExpiration: v })} /></div>
          <div className="flex-1"><EF label="Lock Term" value={dates.lockTerm} type="text" onSave={v => saveDates({ lockTerm: v })} /></div>
          <div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" />
        </div>
      </div>

      {/* Source */}
      <div className="space-y-1.5">
        <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Source / CRM</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-0.5">
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
