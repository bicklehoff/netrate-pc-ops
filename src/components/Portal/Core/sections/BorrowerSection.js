// BorrowerSection — Borrower info display, SSN reveal (audited), co-borrower tabs
// Primary borrower data is from the Borrower model (read-only identity fields)
// Employment/income fields are on the Loan model (editable)

'use client';

import { useState } from 'react';
import SectionCard from '../SectionCard';
import EditableField from '../EditableField';

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'retired', label: 'Retired' },
  { value: 'not_employed', label: 'Not Employed' },
];

const MARITAL_OPTIONS = [
  { value: 'married', label: 'Married' },
  { value: 'unmarried', label: 'Unmarried' },
  { value: 'separated', label: 'Separated' },
];

function formatAddress(addr) {
  if (!addr) return '—';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ') || '—';
}

export default function BorrowerSection({ loan, updateLoanField }) {
  const [ssnRevealed, setSsnRevealed] = useState(null);
  const [ssnLoading, setSsnLoading] = useState(false);
  const [activeBorrowerTab, setActiveBorrowerTab] = useState(0);

  const borrower = loan.borrower;
  const loanBorrowers = (loan.loanBorrowers || []).filter(
    (lb) => lb.borrowerType !== 'primary'
  );

  if (!borrower) return null;

  // SSN reveal with audit
  const handleSsnReveal = async () => {
    setSsnLoading(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/ssn`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setSsnRevealed(data.ssn);
      setTimeout(() => setSsnRevealed(null), 30000);
    } catch {
      // fail silently
    } finally {
      setSsnLoading(false);
    }
  };

  const save = (field) => async (value) => {
    await updateLoanField({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* ─── Primary Borrower Identity ─── */}
      <SectionCard title="Borrower" icon="👤" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <span className="block text-xs text-ink-subtle">Name</span>
            <span className="text-sm font-medium text-ink">
              {borrower.first_name} {borrower.last_name}
            </span>
          </div>
          <div>
            <span className="block text-xs text-ink-subtle">Email</span>
            <span className="text-sm text-ink">{borrower.email}</span>
          </div>
          <div>
            <span className="block text-xs text-ink-subtle">Phone</span>
            <span className="text-sm text-ink">
              {borrower.phone || '—'}
              {borrower.phone_verified && (
                <span className="ml-1 text-green-500 text-xs">✓ verified</span>
              )}
            </span>
          </div>

          {/* SSN with reveal */}
          <div className="col-span-2">
            <span className="block text-xs text-ink-subtle mb-0.5">SSN</span>
            <div className="flex items-center gap-2">
              {ssnRevealed ? (
                <span className="font-mono text-sm text-ink bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                  {ssnRevealed}
                </span>
              ) : (
                <>
                  <span className="text-sm text-ink-mid font-mono">
                    ···-··-{borrower.ssn_last_four}
                  </span>
                  <button
                    onClick={handleSsnReveal}
                    disabled={ssnLoading}
                    className="text-xs text-brand hover:underline disabled:opacity-50"
                  >
                    {ssnLoading ? 'Loading...' : '🔓 Reveal (audited)'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs text-ink-subtle">Member Since</span>
            <span className="text-sm text-ink">
              {new Date(borrower.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ─── Co-Borrowers (if any) ─── */}
      {loanBorrowers.length > 0 && (
        <SectionCard title="Co-Borrowers" icon="👥" badge={`${loanBorrowers.length}`} defaultOpen={true}>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            {loanBorrowers.map((lb, i) => (
              <button
                key={lb.id}
                onClick={() => setActiveBorrowerTab(i)}
                className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                  activeBorrowerTab === i
                    ? 'border-brand text-brand font-medium'
                    : 'border-transparent text-ink-subtle hover:text-ink-mid'
                }`}
              >
                {lb.borrowerType === 'co_borrower' ? 'Co-Borrower' : lb.borrowerType}
                {lb.ordinal > 0 && ` ${lb.ordinal + 1}`}
              </button>
            ))}
          </div>

          {/* Active co-borrower detail */}
          {loanBorrowers[activeBorrowerTab] && (() => {
            const lb = loanBorrowers[activeBorrowerTab];
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="block text-xs text-ink-subtle">Relationship</span>
                  <span className="text-ink capitalize">{lb.relationship || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-ink-subtle">Marital Status</span>
                  <span className="text-ink capitalize">{lb.maritalStatus || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-ink-subtle">Employment</span>
                  <span className="text-ink capitalize">{lb.employment_status || '—'}</span>
                </div>
                {lb.employer_name && (
                  <div>
                    <span className="block text-xs text-ink-subtle">Employer</span>
                    <span className="text-ink">{lb.employer_name}</span>
                  </div>
                )}
                {lb.monthly_base_income && (
                  <div>
                    <span className="block text-xs text-ink-subtle">Monthly Income</span>
                    <span className="text-ink">
                      ${Number(lb.monthly_base_income).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="block text-xs text-ink-subtle">Current Address</span>
                  <span className="text-ink">{formatAddress(lb.currentAddress)}</span>
                </div>
              </div>
            );
          })()}
        </SectionCard>
      )}

      {/* ─── Employment & Income (on Loan model — editable) ─── */}
      <SectionCard title="Employment & Income" icon="💼" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Employment Status"
            value={loan.employment_status}
            type="select"
            options={EMPLOYMENT_OPTIONS}
            onSave={save('employment_status')}
          />
          <EditableField
            label="Employer"
            value={loan.employer_name}
            type="text"
            onSave={save('employer_name')}
          />
          <EditableField
            label="Position / Title"
            value={loan.position_title}
            type="text"
            onSave={save('position_title')}
          />
          <EditableField
            label="Years in Position"
            value={loan.years_in_position}
            type="text"
            onSave={save('years_in_position')}
          />
          <EditableField
            label="Monthly Base Income"
            value={loan.monthly_base_income}
            type="currency"
            onSave={save('monthly_base_income')}
          />
          <EditableField
            label="Other Monthly Income"
            value={loan.other_monthly_income}
            type="currency"
            onSave={save('other_monthly_income')}
          />
          <EditableField
            label="Other Income Source"
            value={loan.other_income_source}
            type="text"
            onSave={save('other_income_source')}
          />
          <EditableField
            label="Marital Status"
            value={loan.maritalStatus}
            type="select"
            options={MARITAL_OPTIONS}
            onSave={save('maritalStatus')}
          />
          <EditableField
            label="Housing Expense"
            value={loan.present_housing_expense}
            type="currency"
            onSave={save('present_housing_expense')}
          />
          <EditableField
            label="# Dependents"
            value={loan.numDependents}
            type="text"
            onSave={save('numDependents')}
          />
          <EditableField
            label="Dependent Ages"
            value={loan.dependentAges}
            type="text"
            placeholder="e.g. 5, 8, 12"
            onSave={save('dependentAges')}
          />
        </div>
      </SectionCard>

      {/* ─── Address ─── */}
      <SectionCard title="Address" icon="📍" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="block text-xs text-ink-subtle mb-0.5">Current Address</span>
            <span className="text-ink">{formatAddress(loan.currentAddress)}</span>
            {(loan.addressYears || loan.addressMonths) && (
              <span className="block text-xs text-ink-subtle mt-0.5">
                {loan.addressYears ? `${loan.addressYears}y` : ''}{' '}
                {loan.addressMonths ? `${loan.addressMonths}m` : ''}
              </span>
            )}
          </div>
          <div>
            <span className="block text-xs text-ink-subtle mb-0.5">Mailing Address</span>
            <span className="text-ink">{formatAddress(loan.mailingAddress)}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
