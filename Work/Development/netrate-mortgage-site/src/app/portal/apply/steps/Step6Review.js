// Step 6: Review & Submit
// Read-only summary of all entered data with edit buttons per section.
// Consent checkbox + Submit button.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApplication } from '@/components/Portal/ApplicationContext';

const LABEL_MAP = {
  purpose: { purchase: 'Purchase', refinance: 'Refinance' },
  occupancy: { primary: 'Primary Residence', secondary: 'Second Home', investment: 'Investment' },
  propertyType: { sfr: 'Single Family', condo: 'Condo', townhome: 'Townhome', multi_unit: 'Multi-Unit', manufactured: 'Manufactured' },
  refiPurpose: { rate_term: 'Lower My Rate', cash_out: 'Cash Out Equity', streamline: 'Streamline / FHA / VA' },
  employmentStatus: { employed: 'Employed', self_employed: 'Self-Employed', retired: 'Retired', other: 'Other' },
  maritalStatus: { married: 'Married', unmarried: 'Unmarried', separated: 'Separated' },
  citizenshipStatus: { citizen: 'U.S. Citizen', permanent_resident: 'Permanent Resident', non_permanent_resident: 'Non-Permanent Resident' },
};

function mapLabel(field, value) {
  return LABEL_MAP[field]?.[value] || value || '—';
}

function formatCurrency(val) {
  if (!val && val !== 0) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatAddress(addr) {
  if (!addr || !addr.street) return '—';
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
}

function yn(val) {
  return val ? 'Yes' : 'No';
}

function ReviewSection({ title, step, children }) {
  return (
    <div className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <a
          href={step === 1 ? '/portal/apply' : `/portal/apply/${step}`}
          className="text-xs text-brand hover:underline"
        >
          Edit
        </a>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</dl>
    </div>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800">{value || '—'}</dd>
    </div>
  );
}

export default function Step6Review({ onBack }) {
  const router = useRouter();
  const { data, resetData, setCurrentStep } = useApplication();
  const [authorizeVerification, setAuthorizeVerification] = useState(false);
  const [authorizeCreditPull, setAuthorizeCreditPull] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check if PII fields are present (they are stripped from sessionStorage on refresh)
  const missingSSN = !data.ssn || data.ssn.replace(/\D/g, '').length !== 9;
  const missingDOB = !data.dob;
  const hasCoBorrowers = data.coBorrowers?.length > 0;
  const coBorrowerMissingPII = hasCoBorrowers && data.coBorrowers.some(
    (cb) => !cb.ssn || cb.ssn.replace(/\D/g, '').length !== 9 || !cb.dob
  );
  const hasMissingPII = missingSSN || missingDOB || coBorrowerMissingPII;

  // Auto-redirect to Step 1 when PII is missing (e.g., after page refresh)
  useEffect(() => {
    if (hasMissingPII) {
      const timeout = setTimeout(() => {
        setCurrentStep(1);
        router.push('/portal/apply');
      }, 3000); // 3 second delay so user sees the message
      return () => clearTimeout(timeout);
    }
  }, [hasMissingPII, router, setCurrentStep]);

  const handleSubmit = async () => {
    if (!authorizeVerification) return;

    // Guard: block submit if PII is missing
    if (hasMissingPII) {
      setError(
        'Your SSN and date of birth were cleared for security. Please go back to Step 1 to re-enter them before submitting.'
      );
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/portal/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          authorizeVerification,
          authorizeCreditPull,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Something went wrong. Please try again.');
        return;
      }

      // Clear form data and redirect to success
      resetData();
      router.push('/portal/apply/success');
    } catch {
      setError('Unable to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
      {/* Warning banner when PII is missing (cleared by security on refresh) */}
      {hasMissingPII && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {missingSSN && missingDOB
                ? 'SSN and date of birth need to be re-entered'
                : missingSSN
                  ? 'SSN needs to be re-entered'
                  : 'Date of birth needs to be re-entered'}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              For your security, this information is not saved in your browser.
              Redirecting you to Step 1 to re-enter it&hellip;
            </p>
            <a
              href="/portal/apply"
              className="inline-block mt-2 text-xs font-medium text-brand hover:underline"
            >
              &larr; Go to Step 1 now
            </a>
          </div>
        </div>
      )}
      {/* About You */}
      <ReviewSection title="About You" step={1}>
        <ReviewItem label="Name" value={`${data.firstName} ${data.lastName}`} />
        <ReviewItem label="Email" value={data.email} />
        <ReviewItem label="Phone" value={data.phone} />
        <ReviewItem
          label="Date of Birth"
          value={missingDOB ? '⚠ Re-enter on Step 1' : data.dob}
        />
        <ReviewItem
          label="SSN"
          value={missingSSN ? '⚠ Re-enter on Step 1' : `***-**-${data.ssn.replace(/\D/g, '').slice(-4)}`}
        />
        <ReviewItem label="Loan Purpose" value={mapLabel('purpose', data.purpose)} />
      </ReviewSection>

      {/* Co-Borrowers */}
      {hasCoBorrowers && data.coBorrowers.map((cb, i) => {
        const cbMissingSSN = !cb.ssn || cb.ssn.replace(/\D/g, '').length !== 9;
        const cbMissingDOB = !cb.dob;
        const cbDecl = cb.declarations || {};
        return (
          <ReviewSection key={cb.id} title={`Co-Borrower ${i + 1}: ${cb.firstName || ''} ${cb.lastName || ''}`} step={3}>
            <ReviewItem label="Relationship" value={cb.relationship || '—'} />
            <ReviewItem label="Name" value={`${cb.firstName || ''} ${cb.lastName || ''}`} />
            <ReviewItem label="Email" value={cb.email} />
            <ReviewItem label="Phone" value={cb.phone} />
            <ReviewItem
              label="Date of Birth"
              value={cbMissingDOB ? '⚠ Re-enter on Step 3' : cb.dob}
            />
            <ReviewItem
              label="SSN"
              value={cbMissingSSN ? '⚠ Re-enter on Step 3' : `***-**-${cb.ssn.replace(/\D/g, '').slice(-4)}`}
            />
            <ReviewItem label="Current Address" value={formatAddress(cb.currentAddress)} />
            <ReviewItem label="Employment" value={mapLabel('employmentStatus', cb.employmentStatus)} />
            <ReviewItem label="Monthly Income" value={formatCurrency(cb.monthlyBaseIncome)} />
            <ReviewItem label="Citizenship" value={mapLabel('citizenshipStatus', cbDecl.citizenshipStatus)} />
          </ReviewSection>
        );
      })}

      {/* Property */}
      <ReviewSection title="Property" step={2}>
        <ReviewItem label="Occupancy" value={mapLabel('occupancy', data.occupancy)} />
        <ReviewItem label="Property Type" value={mapLabel('propertyType', data.propertyType)} />
        {data.purpose === 'purchase' ? (
          <>
            <ReviewItem label="Purchase Price" value={formatCurrency(data.purchasePrice)} />
            <ReviewItem label="Down Payment" value={formatCurrency(data.downPayment)} />
          </>
        ) : (
          <>
            <ReviewItem label="Refi Purpose" value={mapLabel('refiPurpose', data.refiPurpose)} />
            <ReviewItem label="Estimated Value" value={formatCurrency(data.estimatedValue)} />
            <ReviewItem label="Current Balance" value={formatCurrency(data.currentBalance)} />
            {data.refiPurpose === 'cash_out' && (
              <ReviewItem label="Cash-Out Amount" value={formatCurrency(data.cashOutAmount)} />
            )}
          </>
        )}
        <ReviewItem label="Property Address" value={formatAddress(data.propertyAddress)} />
      </ReviewSection>

      {/* Address History */}
      <ReviewSection title="Address History" step={3}>
        <ReviewItem label="Current Address" value={formatAddress(data.currentAddress)} />
        <ReviewItem label="Time at Address" value={`${data.addressYears || 0} years ${data.addressMonths ? `${data.addressMonths} months` : ''}`} />
        <ReviewItem label="Marital Status" value={mapLabel('maritalStatus', data.maritalStatus)} />
      </ReviewSection>

      {/* Employment & Income */}
      <ReviewSection title="Employment & Income" step={4}>
        <ReviewItem label="Employment Status" value={mapLabel('employmentStatus', data.employmentStatus)} />
        {data.employerName && <ReviewItem label="Employer" value={data.employerName} />}
        {data.positionTitle && <ReviewItem label="Position" value={data.positionTitle} />}
        <ReviewItem label="Monthly Income" value={formatCurrency(data.monthlyBaseIncome)} />
        {parseFloat(data.otherMonthlyIncome) > 0 && (
          <ReviewItem label="Other Income" value={`${formatCurrency(data.otherMonthlyIncome)} (${data.otherIncomeSource || '—'})`} />
        )}
      </ReviewSection>

      {/* Declarations — Section 5a */}
      <ReviewSection title="Declarations — Property & Money" step={5}>
        <ReviewItem label="Primary Residence" value={yn(data.primaryResidence)} />
        {data.primaryResidence && (
          <ReviewItem label="Prior Ownership (3 yrs)" value={yn(data.priorOwnership3Years)} />
        )}
        {data.purpose === 'purchase' && (
          <ReviewItem label="Seller Relationship" value={yn(data.familyRelationshipSeller)} />
        )}
        <ReviewItem label="Undisclosed Borrowing" value={yn(data.undisclosedBorrowing)} />
        {data.undisclosedBorrowing && (
          <ReviewItem label="Undisclosed Amount" value={formatCurrency(data.undisclosedBorrowingAmount)} />
        )}
        <ReviewItem label="Other Mortgage Pending" value={yn(data.applyingForOtherMortgage)} />
        <ReviewItem label="New Credit Pending" value={yn(data.applyingForNewCredit)} />
        <ReviewItem label="Priority Lien (PACE)" value={yn(data.priorityLien)} />
      </ReviewSection>

      {/* Declarations — Section 5b */}
      <ReviewSection title="Declarations — Your Finances" step={5}>
        <ReviewItem label="Co-signer on Debt" value={yn(data.coSignerOnDebt)} />
        <ReviewItem label="Outstanding Judgments" value={yn(data.outstandingJudgments)} />
        <ReviewItem label="Delinquent Federal Debt" value={yn(data.delinquentFederalDebt)} />
        <ReviewItem label="Lawsuit Party" value={yn(data.lawsuitParty)} />
        <ReviewItem label="Deed in Lieu (7 yrs)" value={yn(data.deedInLieu)} />
        <ReviewItem label="Short Sale (7 yrs)" value={yn(data.preForeclosureSale)} />
        <ReviewItem label="Foreclosure (7 yrs)" value={yn(data.foreclosure)} />
        <ReviewItem label="Bankruptcy (7 yrs)" value={yn(data.bankruptcy)} />
        {data.bankruptcy && data.bankruptcyChapter && (
          <ReviewItem label="Bankruptcy Chapter" value={`Chapter ${data.bankruptcyChapter}`} />
        )}
        <ReviewItem label="Citizenship" value={mapLabel('citizenshipStatus', data.citizenshipStatus)} />
      </ReviewSection>

      {/* HMDA Demographics (if provided) */}
      {(data.hmdaEthnicity || data.hmdaRace?.length > 0 || data.hmdaSex) && (
        <ReviewSection title="Government Monitoring (HMDA)" step={5}>
          {data.hmdaEthnicity && (
            <ReviewItem
              label="Ethnicity"
              value={data.hmdaEthnicity === 'hispanic' ? 'Hispanic or Latino' : data.hmdaEthnicity === 'not_hispanic' ? 'Not Hispanic or Latino' : 'Declined'}
            />
          )}
          {data.hmdaRace?.length > 0 && (
            <ReviewItem
              label="Race"
              value={data.hmdaRace.includes('decline') ? 'Declined' : data.hmdaRace.map(r => ({
                american_indian: 'American Indian or Alaska Native',
                asian: 'Asian',
                black: 'Black or African American',
                pacific_islander: 'Native Hawaiian or Other Pacific Islander',
                white: 'White',
              }[r] || r)).join(', ')}
            />
          )}
          {data.hmdaSex && (
            <ReviewItem
              label="Sex"
              value={data.hmdaSex === 'female' ? 'Female' : data.hmdaSex === 'male' ? 'Male' : 'Declined'}
            />
          )}
        </ReviewSection>
      )}

      {/* Consent — two separate authorizations */}
      <div className="border-t border-gray-200 pt-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={authorizeVerification}
            onChange={(e) => setAuthorizeVerification(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Required:</span>{' '}
            I authorize NetRate Mortgage LLC (NMLS #1111861) to verify the information provided
            in this application{hasCoBorrowers ? ', including information for all co-borrowers listed above' : ''}.
            I understand that this is not a commitment to lend and that my information will be
            encrypted and handled securely.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={authorizeCreditPull}
            onChange={(e) => setAuthorizeCreditPull(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Optional:</span>{' '}
            I authorize NetRate Mortgage to obtain my credit report and credit score for the
            purpose of evaluating my mortgage application.
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Bottom PII warning — visible near submit so user doesn't miss it */}
      {hasMissingPII && (
        <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-800">
            Please{' '}
            <a href="/portal/apply" className="font-medium text-brand underline hover:no-underline">
              re-enter your SSN{missingDOB ? ' and date of birth' : ''} on Step 1
            </a>
            {' '}before submitting. Redirecting automatically&hellip;
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium transition-colors"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!authorizeVerification || submitting || hasMissingPII}
          className="bg-brand text-white px-8 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Securely submitting&hellip;
            </>
          ) : (
            'Submit Application'
          )}
        </button>
      </div>
    </div>
  );
}
