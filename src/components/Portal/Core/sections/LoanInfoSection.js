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
import {
  PROPERTY_TYPES as PROPERTY_TYPE_OPTIONS,
  REFI_PURPOSES,
  CASHOUT_REASONS,
} from '@/lib/constants/picklists';

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
];

const OCCUPANCY_OPTIONS = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'secondary', label: 'Second Home' },
  { value: 'investment', label: 'Investment Property' },
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
            value={loan.loan_type}
            type="select"
            options={LOAN_TYPE_OPTIONS}
            onSave={save('loan_type')}
          />
          <EditableField
            label="Loan Amount"
            value={loan.loan_amount}
            type="currency"
            onSave={save('loan_amount')}
          />
          <EditableField
            label="Interest Rate"
            value={loan.interest_rate}
            type="text"
            placeholder="—"
            onSave={save('interest_rate')}
          />
          <EditableField
            label="Loan Term (years)"
            value={loan.loan_term}
            type="text"
            placeholder="—"
            onSave={save('loan_term')}
          />
          <EditableField
            label="Credit Score"
            value={loan.credit_score}
            type="text"
            onSave={save('credit_score')}
          />
          <EditableField
            label="Lien Status"
            value={loan.lien_status}
            type="select"
            options={lienStatusOptions}
            onSave={save('lien_status')}
          />
          <EditableField
            label="# Borrowers"
            value={loan.num_borrowers}
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
            value={loan.dates?.locked_date}
            type="date"
            onSave={async (v) => updateDates({ locked_date: v })}
          />
          <EditableField
            label="Lock Expiration"
            value={loan.dates?.lock_expiration}
            type="date"
            onSave={async (v) => updateDates({ lock_expiration: v })}
          />
          <EditableField
            label="Lock Term (days)"
            value={loan.dates?.lock_term}
            type="text"
            onSave={async (v) => updateDates({ lock_term: parseInt(v) || null })}
          />
        </div>
      </SectionCard>

      {/* ─── Property ─── */}
      <SectionCard title="Property" icon="🏠" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Property Address"
            value={formatAddress(loan.property_address)}
            type="text"
            placeholder="Street, City, State, Zip"
            onSave={save('property_address')}
            className="col-span-2"
          />
          <EditableField
            label="County"
            value={loan.property_address?.county}
            type="text"
            readOnly
          />
          <EditableField
            label="Property Type"
            value={loan.property_type}
            type="select"
            options={PROPERTY_TYPE_OPTIONS}
            onSave={save('property_type')}
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
            value={loan.num_units}
            type="text"
            onSave={save('num_units')}
          />
          <EditableField
            label="Purchase Price"
            value={loan.purchase_price}
            type="currency"
            onSave={save('purchase_price')}
          />
          <EditableField
            label="Down Payment"
            value={loan.down_payment}
            type="currency"
            onSave={save('down_payment')}
          />
          <EditableField
            label="Appraised Value"
            value={loan.estimated_value}
            type="currency"
            onSave={save('estimated_value')}
          />
          <EditableField
            label="Current Balance"
            value={loan.current_balance}
            type="currency"
            onSave={save('current_balance')}
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
          {loan.purpose === 'refinance' && (
            <EditableField
              label="Refi Purpose"
              value={loan.refi_purpose}
              type="select"
              options={REFI_PURPOSES}
              onSave={save('refi_purpose')}
            />
          )}
          {loan.refi_purpose === 'cashout' && (
            <EditableField
              label="Cash Out Reason"
              value={loan.cashout_reason}
              type="select"
              options={CASHOUT_REASONS}
              onSave={save('cashout_reason')}
            />
          )}
          <EditableField
            label="Cash Out Amount"
            value={loan.cash_out_amount}
            type="currency"
            onSave={save('cash_out_amount')}
          />
        </div>
      </SectionCard>

      {/* ─── Lender ─── */}
      <SectionCard title="Lender" icon="🏦" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <EditableField
            label="Lender Name"
            value={loan.lender_name}
            type="text"
            onSave={save('lender_name')}
          />
          <EditableField
            label="Loan Number"
            value={loan.loan_number}
            type="text"
            onSave={save('loan_number')}
          />
        </div>
      </SectionCard>

      {/* ─── MCR / HMDA ─── */}
      <SectionCard title="MCR / HMDA" icon="📊" defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableField
            label="Action Taken"
            value={loan.action_taken}
            type="select"
            options={actionTakenOptions}
            onSave={save('action_taken')}
          />
          <EditableField
            label="Action Taken Date"
            value={loan.action_taken_date}
            type="date"
            onSave={save('action_taken_date')}
          />
          <EditableField
            label="Application Method"
            value={loan.application_method}
            type="select"
            options={appMethodOptions}
            onSave={save('application_method')}
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
            value={loan.lead_source}
            type="select"
            options={leadSourceOptions}
            onSave={save('lead_source')}
          />
          <EditableField
            label="Application Channel"
            value={loan.application_channel}
            type="select"
            options={appChannelOptions}
            onSave={save('application_channel')}
          />
          <EditableField
            label="Referral Source"
            value={loan.referral_source}
            type="text"
            placeholder="Free text..."
            onSave={save('referral_source')}
          />
          <EditableField
            label="LDox Loan ID"
            value={loan.ldox_loan_id}
            type="text"
            readOnly
          />
          <EditableField
            label="Submitted At"
            value={loan.submitted_at}
            type="date"
            readOnly
          />
          <EditableField
            label="Created"
            value={loan.created_at}
            type="date"
            readOnly
          />
        </div>
      </SectionCard>
    </div>
  );
}
