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
  const loanBorrowers = (loan.loan_borrowers || []).filter(
    (lb) => lb.borrower_type !== 'primary'
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
            <span className="block text-xs text-gray-400">Name</span>
            <span className="text-sm font-medium text-gray-800">
              {borrower.first_name} {borrower.last_name}
            </span>
          </div>
          <div>
            <span className="block text-xs text-gray-400">Email</span>
            <span className="text-sm text-gray-800">{borrower.email}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-400">Phone</span>
            <span className="text-sm text-gray-800">
              {borrower.phone || '—'}
              {borrower.phone_verified && (
                <span className="ml-1 text-green-500 text-xs">✓ verified</span>
              )}
            </span>
          </div>

          {/* SSN with reveal */}
          <div className="col-span-2">
            <span className="block text-xs text-gray-400 mb-0.5">SSN</span>
            <div className="flex items-center gap-2">
              {ssnRevealed ? (
                <span className="font-mono text-sm text-gray-900 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                  {ssnRevealed}
                </span>
              ) : (
                <>
                  <span className="text-sm text-gray-700 font-mono">
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
            <span className="block text-xs text-gray-400">Member Since</span>
            <span className="text-sm text-gray-800">
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
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {lb.borrower_type === 'co_borrower' ? 'Co-Borrower' : lb.borrower_type}
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
                  <span className="block text-xs text-gray-400">Relationship</span>
                  <span className="text-gray-800 capitalize">{lb.relationship || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400">Marital Status</span>
                  <span className="text-gray-800 capitalize">{lb.marital_status || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400">Employment</span>
                  <span className="text-gray-800 capitalize">{lb.employment_status || '—'}</span>
                </div>
                {lb.employer_name && (
                  <div>
                    <span className="block text-xs text-gray-400">Employer</span>
                    <span className="text-gray-800">{lb.employer_name}</span>
                  </div>
                )}
                {lb.monthly_base_income && (
                  <div>
                    <span className="block text-xs text-gray-400">Monthly Income</span>
                    <span className="text-gray-800">
                      ${Number(lb.monthly_base_income).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="block text-xs text-gray-400">Current Address</span>
                  <span className="text-gray-800">{formatAddress(lb.current_address)}</span>
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
            onSave={save('employmentStatus')}
          />
          <EditableField
            label="Employer"
            value={loan.employer_name}
            type="text"
            onSave={save('employerName')}
          />
          <EditableField
            label="Position / Title"
            value={loan.position_title}
            type="text"
            onSave={save('positionTitle')}
          />
          <EditableField
            label="Years in Position"
            value={loan.years_in_position}
            type="text"
            onSave={save('yearsInPosition')}
          />
          <EditableField
            label="Monthly Base Income"
            value={loan.monthly_base_income}
            type="currency"
            onSave={save('monthlyBaseIncome')}
          />
          <EditableField
            label="Other Monthly Income"
            value={loan.other_monthly_income}
            type="currency"
            onSave={save('otherMonthlyIncome')}
          />
          <EditableField
            label="Other Income Source"
            value={loan.other_income_source}
            type="text"
            onSave={save('otherIncomeSource')}
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
            onSave={save('presentHousingExpense')}
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
            <span className="block text-xs text-gray-400 mb-0.5">Current Address</span>
            <span className="text-gray-800">{formatAddress(loan.current_address)}</span>
            {(loan.address_years || loan.address_months) && (
              <span className="block text-xs text-gray-400 mt-0.5">
                {loan.address_years ? `${loan.address_years}y` : ''}{' '}
                {loan.address_months ? `${loan.address_months}m` : ''}
              </span>
            )}
          </div>
          <div>
            <span className="block text-xs text-gray-400 mb-0.5">Mailing Address</span>
            <span className="text-gray-800">{formatAddress(loan.mailing_address)}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
