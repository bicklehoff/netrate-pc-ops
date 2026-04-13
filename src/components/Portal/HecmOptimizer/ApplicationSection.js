'use client';

import { useState } from 'react';
import { useScenario } from './ScenarioContext';

function Input({ label, value, onChange, type = 'text', className = '', inputClass = '', ...rest }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ink-subtle mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none ${inputClass}`}
        {...rest}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ink-subtle mb-0.5">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
      >
        <option value="">Select...</option>
        {options.map(o => (
          <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink-mid py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
      />
      {label}
    </label>
  );
}

function SectionBlock({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-ink-mid mb-2 border-b border-gray-100 pb-1">{title}</h4>
      {children}
    </div>
  );
}

export default function ApplicationSection() {
  const { state, setField } = useScenario();
  const [collapsed, setCollapsed] = useState(true);

  const handleText = (field) => (e) => setField(field, e.target.value);
  const handleNum = (field) => (e) => setField(field, parseFloat(e.target.value) || 0);
  const handleCheck = (field) => (e) => setField(field, e.target.checked);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden print:hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-sm font-semibold text-ink-mid">Application Details</h3>
        <span className="text-ink-subtle text-sm">{collapsed ? '+' : '−'}</span>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-5">
          {/* NBS Info */}
          <SectionBlock title="Non-Borrowing Spouse (NBS)">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="NBS Name" value={state.nbsName} onChange={handleText('nbsName')} inputClass="bg-yellow-50" />
              <Input label="NBS DOB" type="date" value={state.nbsDOB} onChange={handleText('nbsDOB')} inputClass="bg-yellow-50" />
              <Select label="Remain in Home?" value={state.nbsRemainInHome} onChange={handleText('nbsRemainInHome')} options={['Yes', 'No', 'N/A']} />
              <Select label="On Title?" value={state.nbsOnTitle} onChange={handleText('nbsOnTitle')} options={['Yes', 'No']} />
            </div>
          </SectionBlock>

          {/* Counseling */}
          <SectionBlock title="Counseling">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="Agency" value={state.counselingAgency} onChange={handleText('counselingAgency')} inputClass="bg-yellow-50" />
              <Input label="Counselor Name" value={state.counselorName} onChange={handleText('counselorName')} inputClass="bg-yellow-50" />
              <Input label="Date" type="date" value={state.counselingDate} onChange={handleText('counselingDate')} inputClass="bg-yellow-50" />
              <Input label="Cert Number" value={state.counselingCertNumber} onChange={handleText('counselingCertNumber')} inputClass="bg-yellow-50" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Select label="Method" value={state.counselingMethod} onChange={handleText('counselingMethod')} options={['Phone', 'In Person', 'Video']} />
            </div>
          </SectionBlock>

          {/* Title & Trust */}
          <SectionBlock title="Title & Trust">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select label="Property Held In" value={state.propertyHeldIn} onChange={handleText('propertyHeldIn')} options={['Individual', 'Joint', 'Trust', 'LLC', 'Life Estate']} />
              <Input label="Trust Name" value={state.trustName} onChange={handleText('trustName')} inputClass="bg-yellow-50" />
              <Input label="Trust Date" type="date" value={state.trustDate} onChange={handleText('trustDate')} inputClass="bg-yellow-50" />
              <Input label="Trustee Name" value={state.trusteeName} onChange={handleText('trusteeName')} inputClass="bg-yellow-50" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Select label="POA on File?" value={state.poaOnFile} onChange={handleText('poaOnFile')} options={['Yes', 'No']} />
              <Input label="POA Name" value={state.poaName} onChange={handleText('poaName')} inputClass="bg-yellow-50" />
            </div>
          </SectionBlock>

          {/* Disbursement */}
          <SectionBlock title="Disbursement">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select label="Type" value={state.disbursementType} onChange={handleText('disbursementType')} options={['Lump Sum', 'Line of Credit', 'Tenure', 'Term', 'Combination']} />
              <Input label="Term Length (months)" type="number" value={state.termLength || ''} onChange={handleNum('termLength')} />
              <Input label="Initial Draw Amount" type="number" value={state.initialDrawAmount || ''} onChange={handleNum('initialDrawAmount')} />
              <Input label="Combination Details" value={state.combinationDetails} onChange={handleText('combinationDetails')} />
            </div>
          </SectionBlock>

          {/* Financial Assessment */}
          <SectionBlock title="Financial Assessment">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Input label="Monthly Prop Tax" type="number" value={state.monthlyPropTax || ''} onChange={handleNum('monthlyPropTax')} inputClass="bg-yellow-50" />
              <Input label="Monthly Insurance" type="number" value={state.monthlyInsurance || ''} onChange={handleNum('monthlyInsurance')} inputClass="bg-yellow-50" />
              <Input label="Monthly HOA" type="number" value={state.monthlyHOA || ''} onChange={handleNum('monthlyHOA')} inputClass="bg-yellow-50" />
              <Input label="Monthly Flood" type="number" value={state.monthlyFlood || ''} onChange={handleNum('monthlyFlood')} inputClass="bg-yellow-50" />
              <Select label="Prop Tax Current?" value={state.propTaxCurrent} onChange={handleText('propTaxCurrent')} options={['Yes', 'No']} />
              <Select label="Insurance Current?" value={state.insuranceCurrent} onChange={handleText('insuranceCurrent')} options={['Yes', 'No']} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Select label="LESA Required?" value={state.lesaRequired} onChange={handleText('lesaRequired')} options={['Yes', 'No', 'TBD']} />
              <Input label="LESA Amount" type="number" value={state.lesaAmount || ''} onChange={handleNum('lesaAmount')} />
            </div>
          </SectionBlock>

          {/* Borrower Details */}
          <SectionBlock title="Borrower Details">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select label="Marital (Borrower)" value={state.maritalBorrower} onChange={handleText('maritalBorrower')} options={['Married', 'Unmarried', 'Separated']} />
              <Select label="Marital (Co-Borrower)" value={state.maritalCoBorrower} onChange={handleText('maritalCoBorrower')} options={['Married', 'Unmarried', 'Separated', 'N/A']} />
              <Select label="Citizenship" value={state.citizenship} onChange={handleText('citizenship')} options={['US Citizen', 'Permanent Resident', 'Non-Permanent Resident']} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Select label="Prior Bankruptcy?" value={state.priorBankruptcy} onChange={handleText('priorBankruptcy')} options={['Yes', 'No']} />
              <Input label="Bankruptcy Details" value={state.bankruptcyDetails} onChange={handleText('bankruptcyDetails')} />
              <Select label="Prior Foreclosure?" value={state.priorForeclosure} onChange={handleText('priorForeclosure')} options={['Yes', 'No']} />
              <Input label="Foreclosure Date" type="date" value={state.foreclosureDate} onChange={handleText('foreclosureDate')} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Select label="Outstanding Judgments?" value={state.outstandingJudgments} onChange={handleText('outstandingJudgments')} options={['Yes', 'No']} />
              <Input label="Judgment Details" value={state.judgmentDetails} onChange={handleText('judgmentDetails')} />
            </div>
          </SectionBlock>

          {/* Notes */}
          <SectionBlock title="Notes">
            <textarea
              value={state.applicationNotes}
              onChange={handleText('applicationNotes')}
              rows={3}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-yellow-50"
              placeholder="Application notes..."
            />
          </SectionBlock>

          {/* Document Checklist */}
          <SectionBlock title="Document Checklist">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
              <Checkbox label="Counseling Certificate" checked={state.checkCounseling} onChange={handleCheck('checkCounseling')} />
              <Checkbox label="Photo ID" checked={state.checkID} onChange={handleCheck('checkID')} />
              <Checkbox label="Trust Documents" checked={state.checkTrust} onChange={handleCheck('checkTrust')} />
              <Checkbox label="SSA Award Letter" checked={state.checkSSA} onChange={handleCheck('checkSSA')} />
              <Checkbox label="Tax Bill" checked={state.checkTaxBill} onChange={handleCheck('checkTaxBill')} />
              <Checkbox label="Insurance Dec Page" checked={state.checkInsurance} onChange={handleCheck('checkInsurance')} />
              <Checkbox label="Mortgage Statement" checked={state.checkMortgageStmt} onChange={handleCheck('checkMortgageStmt')} />
              <Checkbox label="POA Documents" checked={state.checkPOA} onChange={handleCheck('checkPOA')} />
            </div>
          </SectionBlock>
        </div>
      )}
    </div>
  );
}
