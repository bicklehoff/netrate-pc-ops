// LoanInfoSection — All editable loan fields in grouped sub-sections
// Sub-sections: Loan Terms, Property, Purpose, Lender, MCR, CRM/Source

'use client';

import SectionCard from '../SectionCard';
import EditableField from '../EditableField';
import {
  ACTION_TAKEN_LABELS,
  APPLICATION_METHOD_LABELS,
  LIEN_STATUS_LABELS,
  LEAD_SOURCES,
  APPLICATION_CHANNELS,
} from '@/lib/constants/mcr-fields';

// Convert label maps to option arrays
const actionTakenOptions = Object.entries(ACTION_TAKEN_LABELS).map(([v, l]) => ({ value: v, label: l }));
const appMethodOptions = Object.entries(APPLICATION_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }));
const lienStatusOptions = Object.entries(LIEN_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
const leadSourceOptions = LEAD_SOURCES;
const appChannelOptions = APPLICATION_CHANNELS;

const LOAN_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'hecm', label: 'HECM' },
  { value: 'other', label: 'Other' },
];

const PURPOSE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Refinance' },
  { value: 'cash_out', label: 'Cash-Out Refi' },
  { value: 'hecm', label: 'HECM / Reverse' },
];

const OCCUPANCY_OPTIONS = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'secondary', label: 'Second Home' },
  { value: 'investment', label: 'Investment Property' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'multi_unit', label: 'Multi-Unit (2-4)' },
  { value: 'manufactured', label: 'Manufactured' },
];

function formatAddress(addr) {
  if (!addr) return '—';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ') || '—';
}

export default function LoanInfoSection({ loan, updateLoanField, updateDates }) {
  const save = (field) => async (value) => {
    await updateLoanField({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* ─── Loan Terms ─── */}
      <SectionCard title="Loan Terms" icon="💰" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Loan Type"
            value={loan.loanType}
            type="select"
            options={LOAN_TYPE_OPTIONS}
            onSave={save('loanType')}
          />
          <EditableField
            label="Loan Amount"
            value={loan.loanAmount}
            type="currency"
            onSave={save('loanAmount')}
          />
          <EditableField
            label="Interest Rate"
            value={loan.interestRate}
            type="text"
            placeholder="—"
            onSave={save('interestRate')}
          />
          <EditableField
            label="Loan Term (years)"
            value={loan.loanTerm}
            type="text"
            placeholder="—"
            onSave={save('loanTerm')}
          />
          <EditableField
            label="Credit Score"
            value={loan.creditScore}
            type="text"
            onSave={save('creditScore')}
          />
          <EditableField
            label="Lien Status"
            value={loan.lienStatus}
            type="select"
            options={lienStatusOptions}
            onSave={save('lienStatus')}
          />
          <EditableField
            label="# Borrowers"
            value={loan.numBorrowers}
            type="text"
            readOnly
          />
        </div>
      </SectionCard>

      {/* ─── Rate Lock ─── */}
      <SectionCard title="Rate Lock" icon="🔒" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Lock Date"
            value={loan.dates?.lockedDate}
            type="date"
            onSave={async (v) => updateDates({ lockedDate: v })}
          />
          <EditableField
            label="Lock Expiration"
            value={loan.dates?.lockExpiration}
            type="date"
            onSave={async (v) => updateDates({ lockExpiration: v })}
          />
          <EditableField
            label="Lock Term (days)"
            value={loan.dates?.lockTerm}
            type="text"
            onSave={async (v) => updateDates({ lockTerm: parseInt(v) || null })}
          />
        </div>
      </SectionCard>

      {/* ─── Property ─── */}
      <SectionCard title="Property" icon="🏠" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Property Address"
            value={formatAddress(loan.propertyAddress)}
            type="text"
            placeholder="Street, City, State, Zip"
            onSave={save('propertyAddress')}
            className="col-span-2"
          />
          <EditableField
            label="County"
            value={loan.propertyAddress?.county}
            type="text"
            readOnly
          />
          <EditableField
            label="Property Type"
            value={loan.propertyType}
            type="select"
            options={PROPERTY_TYPE_OPTIONS}
            onSave={save('propertyType')}
          />
          <EditableField
            label="Occupancy"
            value={loan.occupancy}
            type="select"
            options={OCCUPANCY_OPTIONS}
            onSave={save('occupancy')}
          />
          <EditableField
            label="# Units"
            value={loan.numUnits}
            type="text"
            onSave={save('numUnits')}
          />
          <EditableField
            label="Purchase Price"
            value={loan.purchasePrice}
            type="currency"
            onSave={save('purchasePrice')}
          />
          <EditableField
            label="Down Payment"
            value={loan.downPayment}
            type="currency"
            onSave={save('downPayment')}
          />
          <EditableField
            label="Appraised Value"
            value={loan.estimatedValue}
            type="currency"
            onSave={save('estimatedValue')}
          />
          <EditableField
            label="Current Balance"
            value={loan.currentBalance}
            type="currency"
            onSave={save('currentBalance')}
          />
        </div>
      </SectionCard>

      {/* ─── Purpose ─── */}
      <SectionCard title="Purpose" icon="🎯" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Loan Purpose"
            value={loan.purpose}
            type="select"
            options={PURPOSE_OPTIONS}
            onSave={save('purpose')}
          />
          <EditableField
            label="Refi Purpose"
            value={loan.refiPurpose}
            type="text"
            onSave={save('refiPurpose')}
          />
          <EditableField
            label="Cash Out Amount"
            value={loan.cashOutAmount}
            type="currency"
            onSave={save('cashOutAmount')}
          />
        </div>
      </SectionCard>

      {/* ─── Lender ─── */}
      <SectionCard title="Lender" icon="🏦" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <EditableField
            label="Lender Name"
            value={loan.lenderName}
            type="text"
            onSave={save('lenderName')}
          />
          <EditableField
            label="Loan Number"
            value={loan.loanNumber}
            type="text"
            onSave={save('loanNumber')}
          />
        </div>
      </SectionCard>

      {/* ─── MCR / HMDA ─── */}
      <SectionCard title="MCR / HMDA" icon="📊" defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Action Taken"
            value={loan.actionTaken}
            type="select"
            options={actionTakenOptions}
            onSave={save('actionTaken')}
          />
          <EditableField
            label="Action Taken Date"
            value={loan.actionTakenDate}
            type="date"
            onSave={save('actionTakenDate')}
          />
          <EditableField
            label="Application Method"
            value={loan.applicationMethod}
            type="select"
            options={appMethodOptions}
            onSave={save('applicationMethod')}
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          These fields are used for quarterly MCR reporting via Tracker.
        </p>
      </SectionCard>

      {/* ─── Source / CRM ─── */}
      <SectionCard title="Source / CRM" icon="📣" defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Lead Source"
            value={loan.leadSource}
            type="select"
            options={leadSourceOptions}
            onSave={save('leadSource')}
          />
          <EditableField
            label="Application Channel"
            value={loan.applicationChannel}
            type="select"
            options={appChannelOptions}
            onSave={save('applicationChannel')}
          />
          <EditableField
            label="Referral Source"
            value={loan.referralSource}
            type="text"
            placeholder="Free text..."
            onSave={save('referralSource')}
          />
          <EditableField
            label="LDox Loan ID"
            value={loan.ldoxLoanId}
            type="text"
            readOnly
          />
          <EditableField
            label="Submitted At"
            value={loan.submittedAt}
            type="date"
            readOnly
          />
          <EditableField
            label="Created"
            value={loan.createdAt}
            type="date"
            readOnly
          />
        </div>
      </SectionCard>
    </div>
  );
}
