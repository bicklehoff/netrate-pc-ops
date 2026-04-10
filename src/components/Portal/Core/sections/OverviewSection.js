// OverviewSection — Dense, editable, full-width loan overview
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import EditableField from '../EditableField';
import PrequalLetterModal from '../../PrequalLetter/PrequalLetterModal';

// ─── Constants ──────────────────────────────────────────────

const MILESTONES = [
  { key: 'applied', label: 'Applied', dateField: 'application_date' },
  { key: 'processing', label: 'Processing', dateField: null },
  { key: 'submitted_uw', label: 'UW', dateField: 'submitted_to_uw_date' },
  { key: 'cond_approved', label: 'Approved', dateField: 'cond_approved_date' },
  { key: 'ctc', label: 'CTC', dateField: 'ctc_date' },
  { key: 'docs_out', label: 'Docs', dateField: 'docs_out_date' },
  { key: 'funded', label: 'Funded', dateField: 'funding_date' },
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
// Avatar URL — colored initials circle via ui-avatars.com (free, no API key)
// Shows borrower initials in brand teal. Could add Gravatar/Clearbit later.
function avatarUrl(name, size = 80) {
  const initials = (name || '?').split(' ').map(n => (n || '')[0]).filter(Boolean).join('').slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=0891b2&color=fff&bold=true&format=svg`;
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
  if (!loan.credit_score) a.push('FICO missing');
  if (!loan.estimated_value || Number(loan.estimated_value) === 0) a.push('Appraised Value missing');
  if (!dates.locked_date && !dates.lock_expiration) a.push('Rate not locked');
  if (dates.lock_expiration && isExpired(dates.lock_expiration)) a.push('Lock EXPIRED');
  else if (dates.lock_expiration && isExpiringSoon(dates.lock_expiration)) a.push('Lock expires soon');
  if (dates.credit_expiration && isExpired(dates.credit_expiration)) a.push('Credit EXPIRED');
  if (!loan.lender_name) a.push('No lender');
  if (!loan.interest_rate) a.push('Rate not set');
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
  const addr = fmtAddr(loan.property_address);

  const loanAmt = Number(loan.loan_amount || 0);
  const propVal = Number(loan.purchase_price || loan.estimated_value || 0);
  const ltv = propVal > 0 ? ((loanAmt / propVal) * 100).toFixed(1) + '%' : '—';

  const lockClass = dates.lock_expiration
    ? isExpired(dates.lock_expiration) ? 'text-red-600 font-bold'
      : isExpiringSoon(dates.lock_expiration) ? 'text-amber-600 font-bold'
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
          <EF label="Loan Amt" value={loan.loan_amount} type="currency" onSave={v => save({ loan_amount: v })} />
          <EF label="Rate" value={loan.interest_rate} type="text" onSave={v => save({ interest_rate: v })} />
          <RF label="LTV" value={ltv} />
          <EF label="FICO" value={loan.credit_score} type="text" onSave={v => save({ credit_score: v })} />
          <RF label="Mo. Pmt" value={fmt$(loan.monthlyPayment)} />
          <EF label="Closing" value={dates.estimated_closing || dates.closing_date} type="date" onSave={v => saveDates({ estimated_closing: v })} />
          <div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">Lock Exp</div>
            <div className={`text-xs font-semibold leading-tight ${lockClass || 'text-slate-300'}`}>{dates.lock_expiration ? fmtDate(dates.lock_expiration) : '—'}</div></div>
          <RF label="BIC" value={loan.ball_in_court || '—'} />
        </div>
      </div>

      {/* Borrower — inline strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <img src={avatarUrl(`${borrower.first_name} ${borrower.last_name}`)} alt="" className="w-6 h-6 rounded-full shrink-0" />
          <span className="text-[9px] font-bold uppercase text-slate-400">Borrower</span>
          <span className="font-bold text-slate-900">{borrower.first_name} {borrower.last_name}</span>
          {borrower.ssn_last_four && <><span className="text-slate-300">|</span><span className="text-slate-500">···{borrower.ssn_last_four}</span></>}
          {borrower.email && <><span className="text-slate-300">|</span><a href={`mailto:${borrower.email}`} className="text-primary font-semibold">{borrower.email}</a></>}
          {borrower.phone && <><span className="text-slate-300">|</span><a href={`tel:${borrower.phone}`} className="text-primary font-semibold">{borrower.phone}</a></>}
          {coBorrowers.length > 0 && <><span className="text-slate-300">|</span><span className="text-slate-500">Co: {coBorrowers.map(lb => `${lb.borrower?.first_name} ${lb.borrower?.last_name}`).join(', ')}</span></>}
        </div>
        <div className="flex gap-x-6 mt-1 pt-1 border-t border-slate-100">
          <div className="flex-1"><EF label="FICO" value={loan.credit_score} type="text" onSave={v => save({ credit_score: v })} /></div>
          <div className="flex-1"><EF label="Income" value={loan.monthly_base_income} type="currency" onSave={v => save({ monthly_base_income: v })} /></div>
          <div className="flex-1"><EF label="Employment" value={loan.employment_status} type="text" onSave={v => save({ employment_status: v })} /></div>
          <div className="flex-1"><EF label="Employer" value={loan.employer_name} type="text" onSave={v => save({ employer_name: v })} /></div>
          <div className="flex-1"><EF label="Housing" value={loan.present_housing_expense} type="currency" onSave={v => save({ present_housing_expense: v })} /></div>
        </div>
      </div>

      {/* Property — inline strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
          <span className="text-[9px] font-bold uppercase text-slate-400 mr-1">Property</span>
          <span className="font-bold text-slate-900">{addr.street}</span>
          {addr.csz && <><span className="text-slate-300">|</span><span className="text-slate-600">{addr.csz}</span></>}
          {(loan.property_county || addr.county) && <><span className="text-slate-300">|</span><span className="text-slate-500">{loan.property_county || addr.county} County</span></>}
          {loan.property_address?.googleValidated && <span className="text-[9px] font-bold text-emerald-600 ml-1">✓ Verified</span>}
          {!loan.property_address?.googleValidated && addr.street !== '—' && (
            <button
              onClick={async () => {
                setGeocoding(true);
                setGeocodeResult(null);
                try {
                  const res = await fetch(`/api/portal/mlo/loans/${loan.id}/geocode`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
                  });
                  const data = await res.json();
                  console.log('Geocode result:', data);
                  setGeocodeResult(data);
                } catch (err) {
                  console.error('Geocode error:', err);
                  setGeocodeResult({ validated: false, error: err.message });
                } finally { setGeocoding(false); }
              }}
              disabled={geocoding}
              className="text-[10px] font-bold text-white bg-primary px-2 py-0.5 rounded hover:bg-cyan-700 ml-2"
            >
              {geocoding ? 'Validating...' : '⟳ Validate Address'}
            </button>
          )}
        </div>
        {/* Geocode comparison */}
        {geocodeResult?.validated && (
          <div className="mt-1.5 p-3 bg-emerald-50 rounded-md border-2 border-emerald-300 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-emerald-800 text-sm">✓ Google Validated Address</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch(`/api/portal/mlo/loans/${loan.id}/geocode`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ accept: true, address: geocodeResult.google }),
                    });
                    setGeocodeResult(null);
                    window.location.reload();
                  }}
                  className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-md text-xs hover:bg-emerald-700"
                >Accept Google Address</button>
                <button
                  onClick={() => setGeocodeResult(null)}
                  className="px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded-md text-xs hover:bg-slate-300"
                >Keep Current</button>
              </div>
            </div>
            <div className="font-bold text-slate-900 text-sm">{geocodeResult.google.formatted}</div>
            <div className="text-slate-600 mt-1 flex gap-4">
              <span>County: <span className="font-bold text-slate-900">{geocodeResult.google.county || '—'}</span></span>
              <span>Zip: <span className="font-bold text-slate-900">{geocodeResult.google.zip || '—'}</span></span>
              <span>State: <span className="font-bold text-slate-900">{geocodeResult.google.state || '—'}</span></span>
            </div>
          </div>
        )}
        {geocodeResult && !geocodeResult.validated && (
          <div className="mt-1.5 p-3 bg-red-50 rounded-md border-2 border-red-300 text-xs text-red-800 font-bold">
            ✕ Could not validate address: {geocodeResult.error || 'Address not found'}
            <button onClick={() => setGeocodeResult(null)} className="ml-3 text-red-500 underline font-medium">Dismiss</button>
          </div>
        )}
        <div className="flex gap-x-6 mt-1 pt-1 border-t border-slate-100">
          <div className="flex-1"><EF label="Type" value={loan.property_type} type="select" options={PROPERTY_TYPE_OPTIONS} onSave={v => save({ property_type: v })} /></div>
          <div className="flex-1"><EF label="Occup" value={loan.occupancy} type="select" options={OCCUPANCY_OPTIONS} onSave={v => save({ occupancy: v })} /></div>
          <div className="flex-1"><EF label="Units" value={loan.num_units} type="text" onSave={v => save({ num_units: v })} /></div>
          <div className="flex-1"><EF label="Purchase" value={loan.purchase_price} type="currency" onSave={v => save({ purchase_price: v })} /></div>
          <div className="flex-1"><EF label="Appraised" value={loan.estimated_value} type="currency" onSave={v => save({ estimated_value: v })} /></div>
          <div className="flex-1"><EF label="Down Pmt" value={loan.down_payment} type="currency" onSave={v => save({ down_payment: v })} /></div>
          <div className="flex-1"><EF label="Cur Bal" value={loan.current_balance} type="currency" onSave={v => save({ current_balance: v })} /></div>
        </div>
      </div>

      {/* Key Dates — right after summary strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Key Dates</div>
        <div className="flex gap-x-6">
          {[
            ['application_date','Applied'], ['submitted_to_uw_date','UW'],
            ['cond_approved_date','Approved'], ['ctc_date','CTC'],
            ['docs_out_date','Docs Out'], ['estimated_closing','Est. Close'],
            ['closing_date','Closing'], ['funding_date','Funding'],
            ['first_payment_date','1st Pmt'],
          ].map(([key, lbl]) => (
            <div key={key} className="flex-1"><EF label={lbl} value={dates[key]} type="date" onSave={v => saveDates({ [key]: v })} /></div>
          ))}
        </div>
      </div>

      {/* Loan Terms + Rate Lock — inline strip */}
      <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Loan Terms</div>
        <div className="flex gap-x-6">
          <div className="flex-1"><EF label="Amount" value={loan.loan_amount} type="currency" onSave={v => save({ loan_amount: v })} /></div>
          <div className="flex-1"><EF label="Rate" value={loan.interest_rate} type="text" onSave={v => save({ interest_rate: v })} /></div>
          <div className="flex-1"><EF label="Term" value={loan.loan_term} type="text" onSave={v => save({ loan_term: v })} /></div>
          <div className="flex-1"><EF label="Type" value={loan.loan_type} type="select" options={LOAN_TYPE_OPTIONS} onSave={v => save({ loan_type: v })} /></div>
          <div className="flex-1"><EF label="Purpose" value={loan.purpose} type="select" options={PURPOSE_OPTIONS} onSave={v => save({ purpose: v })} /></div>
          <div className="flex-1"><EF label="Lender" value={loan.lender_name} type="text" onSave={v => save({ lender_name: v })} /></div>
          <div className="flex-1"><EF label="Loan #" value={loan.loan_number} type="text" onSave={v => save({ loan_number: v })} /></div>
          <div className="flex-1"><EF label="Lien" value={loan.lien_status} type="text" onSave={v => save({ lien_status: v })} /></div>
          <div className="flex-1"><RF label="BIC" value={loan.ball_in_court} /></div>
        </div>
        {(loan.purpose === 'refinance' || loan.purpose === 'cash_out') && (
          <div className="flex gap-x-6 mt-0.5 pt-0.5 border-t border-slate-100">
            <div className="flex-1"><EF label="Refi Purpose" value={loan.refi_purpose} type="text" onSave={v => save({ refi_purpose: v })} /></div>
            <div className="flex-1"><EF label="Cash Out" value={loan.cash_out_amount} type="currency" onSave={v => save({ cash_out_amount: v })} /></div>
            <div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" />
          </div>
        )}
        <div className="flex gap-x-6 mt-0.5 pt-0.5 border-t border-slate-100">
          <div className="flex-1"><EF label="Lock Date" value={dates.locked_date} type="date" onSave={v => saveDates({ locked_date: v })} /></div>
          <div className="flex-1"><EF label="Lock Exp" value={dates.lock_expiration} type="date" onSave={v => saveDates({ lock_expiration: v })} /></div>
          <div className="flex-1"><EF label="Lock Term" value={dates.lock_term} type="text" onSave={v => saveDates({ lock_term: v })} /></div>
          <div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" /><div className="flex-1" />
        </div>
      </div>

      {/* Source */}
      <div className="space-y-1.5">
        <div className="bg-white rounded-md border border-slate-200 px-2 py-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Source / CRM</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-0.5">
            <EF label="Lead Src" value={loan.lead_source} type="text" onSave={v => save({ lead_source: v })} />
            <EF label="Channel" value={loan.application_channel} type="text" onSave={v => save({ application_channel: v })} />
            <EF label="Referral" value={loan.referral_source} type="text" onSave={v => save({ referral_source: v })} />
            <RF label="LDox ID" value={loan.ldox_loan_id} />
            <RF label="Created" value={loan.created_at ? fmtDate(loan.created_at) : '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}
