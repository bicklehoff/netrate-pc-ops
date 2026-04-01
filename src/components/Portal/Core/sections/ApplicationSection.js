// ApplicationSection — Full 1003 Uniform Residential Loan Application
// All fields on one dense page, grouped by URLA section.
// Per-borrower data shown with tabs (primary + co-borrowers).
// Repeating items (assets, liabilities, REO) with add/remove rows.

'use client';

import { useState, useEffect, useCallback } from 'react';
import SectionCard from '../SectionCard';
import EditableField from '../EditableField';

// ─── Constants ───

const HOUSING_OPTIONS = [
  { value: 'own', label: 'Own' },
  { value: 'rent', label: 'Rent' },
  { value: 'free', label: 'Living Rent Free' },
];

const CITIZENSHIP_OPTIONS = [
  { value: 'us_citizen', label: 'U.S. Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident' },
  { value: 'non_permanent_resident', label: 'Non-Permanent Resident' },
];

const MARITAL_OPTIONS = [
  { value: 'married', label: 'Married' },
  { value: 'unmarried', label: 'Unmarried' },
  { value: 'separated', label: 'Separated' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cd', label: 'CD' },
  { value: 'stocks', label: 'Stocks/Bonds' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'other', label: 'Other' },
];

const LIABILITY_TYPE_OPTIONS = [
  { value: 'revolving', label: 'Revolving' },
  { value: 'installment', label: 'Installment' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'collection', label: 'Collection' },
  { value: 'other', label: 'Other' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'multi_unit', label: 'Multi-Unit' },
  { value: 'manufactured', label: 'Manufactured' },
];

const REO_STATUS_OPTIONS = [
  { value: 'retained', label: 'Retained' },
  { value: 'sold', label: 'Sold' },
  { value: 'pending_sale', label: 'Pending Sale' },
];

const AMORT_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'arm', label: 'ARM' },
  { value: 'balloon', label: 'Balloon' },
];

const TITLE_OPTIONS = [
  { value: 'sole', label: 'Solely by Borrower' },
  { value: 'with_spouse', label: 'With Spouse' },
  { value: 'with_other', label: 'With Other' },
];

// ─── Helpers ───

function formatAddress(addr) {
  if (!addr) return '—';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ') || '—';
}

// ─── Main Component ───

export default function ApplicationSection({ loan }) {
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeBorrowerTab, setActiveBorrowerTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  // Fetch all 1003 data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/application`);
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setAppData(json.application);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loan.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Save handlers ───

  const saveField = useCallback(async (section, loanBorrowerId, field, value) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/application`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, loanBorrowerId, data: { [field]: value } }),
      });
      if (!res.ok) throw new Error('Save failed');
      await fetchData();
    } catch (err) {
      console.error('Save error:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loan.id, fetchData]);

  const saveEmployment = useCallback(async (loanBorrowerId, data, itemId) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/application`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'employment', loanBorrowerId, data, itemId }),
      });
      if (!res.ok) throw new Error('Save failed');
      await fetchData();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [loan.id, fetchData]);

  const addItem = useCallback(async (itemType, data = {}) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, data }),
      });
      if (!res.ok) throw new Error('Add failed');
      await fetchData();
    } catch (err) {
      console.error('Add error:', err);
    } finally {
      setSaving(false);
    }
  }, [loan.id, fetchData]);

  const deleteItem = useCallback(async (itemType, itemId) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/portal/mlo/loans/${loan.id}/application?itemType=${itemType}&itemId=${itemId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Delete failed');
      await fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setSaving(false);
    }
  }, [loan.id, fetchData]);

  // ─── Loading/Error states ───

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 text-sm">{error}</p>
        <button onClick={fetchData} className="mt-2 text-xs text-red-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (!appData) return null;

  const borrowers = appData.loanBorrowers || [];
  const activeBorrower = borrowers[activeBorrowerTab] || borrowers[0];

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">1003 Application</h2>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-gray-400 animate-pulse">Saving...</span>}
          <ExportXmlButton loanId={loan.id} exporting={exporting} setExporting={setExporting} setExportResult={setExportResult} />
        </div>
      </div>

      {/* Export result banner */}
      {exportResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <div className="text-xs text-green-800">
            <span className="font-medium">Snapshot saved</span> — {exportResult.filename}
          </div>
          <button onClick={() => setExportResult(null)} className="text-xs text-green-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* ─── Borrower Tabs ─── */}
      {borrowers.length > 1 && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {borrowers.map((lb, idx) => (
            <button
              key={lb.id}
              onClick={() => setActiveBorrowerTab(idx)}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                idx === activeBorrowerTab
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {lb.borrower?.firstName} {lb.borrower?.lastName}
              <span className="ml-1 text-gray-400">
                ({lb.borrowerType === 'primary' ? 'Primary' : 'Co-Borrower'})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Section I: Borrower Information ─── */}
      {activeBorrower && (
        <BorrowerInfoCard
          borrower={activeBorrower}
          onSave={(field, value) => saveField('borrower', activeBorrower.id, field, value)}
        />
      )}

      {/* ─── Section II: Employment ─── */}
      {activeBorrower && (
        <EmploymentCard
          borrower={activeBorrower}
          onSave={(data, itemId) => saveEmployment(activeBorrower.id, data, itemId)}
          onAdd={() => saveEmployment(activeBorrower.id, { isPrimary: false })}
          onDelete={(itemId) => deleteItem('employment', itemId)}
        />
      )}

      {/* ─── Section III: Income ─── */}
      {activeBorrower && (
        <IncomeCard
          borrower={activeBorrower}
          onSave={(field, value) => saveField('income', activeBorrower.id, field, value)}
        />
      )}

      {/* ─── Section IV: Assets ─── */}
      <AssetsCard
        assets={appData.assets || []}
        onAdd={() => addItem('asset')}
        onDelete={(id) => deleteItem('asset', id)}
        loanId={loan.id}
        fetchData={fetchData}
      />

      {/* ─── Section V: Liabilities ─── */}
      <LiabilitiesCard
        liabilities={appData.liabilities || []}
        onAdd={() => addItem('liability')}
        onDelete={(id) => deleteItem('liability', id)}
        loanId={loan.id}
        fetchData={fetchData}
      />

      {/* ─── Section VI: Real Estate Owned ─── */}
      <REOCard
        reos={appData.reos || []}
        onAdd={() => addItem('reo')}
        onDelete={(id) => deleteItem('reo', id)}
        loanId={loan.id}
        fetchData={fetchData}
      />

      {/* ─── Section VII: Transaction Details ─── */}
      <TransactionCard
        transaction={appData.transaction}
        onSave={(field, value) => saveField('transaction', null, field, value)}
        loanPurpose={loan.purpose}
      />

      {/* ─── Section VIII: Declarations ─── */}
      {activeBorrower && (
        <DeclarationsCard
          borrower={activeBorrower}
          onSave={(field, value) => saveField('declaration', activeBorrower.id, field, value)}
        />
      )}

      {/* ─── Section IX: Loan Details (ARM, Title) ─── */}
      <LoanDetailsCard
        appData={appData}
        onSave={(field, value) => saveField('loanDetails', null, field, value)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-section Cards
// ═══════════════════════════════════════════════════════════════════════

function BorrowerInfoCard({ borrower, onSave }) {
  return (
    <SectionCard title="Borrower Information" icon="👤" defaultOpen={true}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EditableField
          label="Citizenship"
          value={borrower.citizenship}
          type="select"
          options={CITIZENSHIP_OPTIONS}
          onSave={(v) => onSave('citizenship', v)}
        />
        <EditableField
          label="Marital Status"
          value={borrower.maritalStatus}
          type="select"
          options={MARITAL_OPTIONS}
          onSave={(v) => onSave('maritalStatus', v)}
        />
        <EditableField
          label="Housing"
          value={borrower.housingType}
          type="select"
          options={HOUSING_OPTIONS}
          onSave={(v) => onSave('housingType', v)}
        />
        <EditableField
          label="Monthly Rent"
          value={borrower.monthlyRent}
          type="currency"
          onSave={(v) => onSave('monthlyRent', v)}
        />
        <EditableField
          label="Cell Phone"
          value={borrower.cellPhone}
          type="text"
          onSave={(v) => onSave('cellPhone', v)}
        />
        <EditableField
          label="Suffix"
          value={borrower.suffix}
          type="text"
          onSave={(v) => onSave('suffix', v)}
        />
        <div className="col-span-2">
          <span className="block text-xs text-gray-400 mb-0.5">Current Address</span>
          <span className="text-sm text-gray-800">{formatAddress(borrower.currentAddress)}</span>
        </div>
        <EditableField
          label="Years at Address"
          value={borrower.addressYears}
          type="text"
          onSave={(v) => onSave('addressYears', v)}
        />
        <EditableField
          label="Months at Address"
          value={borrower.addressMonths}
          type="text"
          onSave={(v) => onSave('addressMonths', v)}
        />
      </div>

      {/* Previous Address (shown if < 2 years at current) */}
      {(borrower.addressYears == null || borrower.addressYears < 2) && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous Address</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <div className="col-span-2">
              <span className="block text-xs text-gray-400 mb-0.5">Previous Address</span>
              <span className="text-sm text-gray-800">{formatAddress(borrower.previousAddress)}</span>
            </div>
            <EditableField
              label="Years"
              value={borrower.previousAddressYears}
              type="text"
              onSave={(v) => onSave('previousAddressYears', v)}
            />
            <EditableField
              label="Months"
              value={borrower.previousAddressMonths}
              type="text"
              onSave={(v) => onSave('previousAddressMonths', v)}
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function EmploymentCard({ borrower, onSave, onAdd, onDelete }) {
  const employments = borrower.employments || [];
  const current = employments.filter((e) => e.isPrimary);
  const previous = employments.filter((e) => !e.isPrimary);

  return (
    <SectionCard
      title="Employment"
      icon="💼"
      defaultOpen={true}
      actions={
        <button
          onClick={onAdd}
          className="text-xs text-brand hover:text-brand-dark font-medium"
        >
          + Previous
        </button>
      }
    >
      {employments.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">No employment records</p>
          <button
            onClick={() => onSave({ isPrimary: true })}
            className="mt-2 text-xs text-brand hover:underline"
          >
            + Add Current Employment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {current.map((emp) => (
            <EmploymentRow key={emp.id} emp={emp} label="Current" onSave={onSave} onDelete={onDelete} />
          ))}
          {previous.map((emp) => (
            <EmploymentRow key={emp.id} emp={emp} label="Previous" onSave={onSave} onDelete={onDelete} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function EmploymentRow({ emp, label, onSave, onDelete }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase">{label}</span>
        <div className="flex items-center gap-2">
          {emp.selfEmployed && (
            <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">Self-Employed</span>
          )}
          {label === 'Previous' && (
            <button onClick={() => onDelete(emp.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EditableField
          label="Employer"
          value={emp.employerName}
          type="text"
          onSave={(v) => onSave({ ...emp, employerName: v }, emp.id)}
        />
        <EditableField
          label="Position"
          value={emp.position}
          type="text"
          onSave={(v) => onSave({ ...emp, position: v }, emp.id)}
        />
        <EditableField
          label="Phone"
          value={emp.employerPhone}
          type="text"
          onSave={(v) => onSave({ ...emp, employerPhone: v }, emp.id)}
        />
        <EditableField
          label="Self-Employed"
          value={emp.selfEmployed ? 'Yes' : 'No'}
          type="select"
          options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
          onSave={(v) => onSave({ ...emp, selfEmployed: v === 'true' }, emp.id)}
        />
        <EditableField
          label="Start Date"
          value={emp.startDate}
          type="date"
          onSave={(v) => onSave({ ...emp, startDate: v }, emp.id)}
        />
        <EditableField
          label="End Date"
          value={emp.endDate}
          type="date"
          onSave={(v) => onSave({ ...emp, endDate: v }, emp.id)}
        />
        <EditableField
          label="Years"
          value={emp.yearsOnJob}
          type="text"
          onSave={(v) => onSave({ ...emp, yearsOnJob: v }, emp.id)}
        />
        <EditableField
          label="Months"
          value={emp.monthsOnJob}
          type="text"
          onSave={(v) => onSave({ ...emp, monthsOnJob: v }, emp.id)}
        />
      </div>
    </div>
  );
}

function IncomeCard({ borrower, onSave }) {
  const income = borrower.income || {};

  return (
    <SectionCard title="Monthly Income" icon="💵" defaultOpen={true}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EditableField label="Base" value={income.baseMonthly} type="currency" onSave={(v) => onSave('baseMonthly', v)} />
        <EditableField label="Overtime" value={income.overtimeMonthly} type="currency" onSave={(v) => onSave('overtimeMonthly', v)} />
        <EditableField label="Bonus" value={income.bonusMonthly} type="currency" onSave={(v) => onSave('bonusMonthly', v)} />
        <EditableField label="Commission" value={income.commissionMonthly} type="currency" onSave={(v) => onSave('commissionMonthly', v)} />
        <EditableField label="Dividends/Interest" value={income.dividendsMonthly} type="currency" onSave={(v) => onSave('dividendsMonthly', v)} />
        <EditableField label="Net Rental" value={income.rentalIncomeMonthly} type="currency" onSave={(v) => onSave('rentalIncomeMonthly', v)} />
        <EditableField label="Other" value={income.otherMonthly} type="currency" onSave={(v) => onSave('otherMonthly', v)} />
        <EditableField label="Other Source" value={income.otherIncomeSource} type="text" onSave={(v) => onSave('otherIncomeSource', v)} />
      </div>
      {/* Total */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
        <div className="text-right">
          <span className="text-xs text-gray-400">Total Monthly</span>
          <p className="text-sm font-bold text-gray-900">
            ${(
              (income.baseMonthly || 0) +
              (income.overtimeMonthly || 0) +
              (income.bonusMonthly || 0) +
              (income.commissionMonthly || 0) +
              (income.dividendsMonthly || 0) +
              (income.interestMonthly || 0) +
              (income.rentalIncomeMonthly || 0) +
              (income.otherMonthly || 0)
            ).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function AssetsCard({ assets, onAdd, onDelete, loanId, fetchData }) {
  const totalBalance = assets.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <SectionCard
      title="Assets"
      icon="🏦"
      defaultOpen={true}
      badge={assets.length > 0 ? `${assets.length}` : null}
      actions={
        <button onClick={onAdd} className="text-xs text-brand hover:text-brand-dark font-medium">+ Add</button>
      }
    >
      {assets.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No assets recorded</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">Institution</th>
                <th className="text-left py-1.5 font-medium">Type</th>
                <th className="text-left py-1.5 font-medium">Acct #</th>
                <th className="text-right py-1.5 font-medium">Balance</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <AssetRow key={a.id} asset={a} loanId={loanId} fetchData={fetchData} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
            <span className="text-xs text-gray-400 mr-2">Total</span>
            <span className="text-xs font-bold text-gray-900">${totalBalance.toLocaleString()}</span>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function AssetRow({ asset, loanId, fetchData, onDelete }) {
  const saveAssetField = async (field, value) => {
    await fetch(`/api/portal/mlo/loans/${loanId}/application`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'asset',
        data: { ...asset, [field]: value },
        itemId: asset.id,
      }),
    });
    await fetchData();
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-1.5">
        <InlineEdit value={asset.institution} onSave={(v) => saveAssetField('institution', v)} />
      </td>
      <td className="py-1.5">
        <InlineSelect value={asset.accountType} options={ACCOUNT_TYPE_OPTIONS} onSave={(v) => saveAssetField('accountType', v)} />
      </td>
      <td className="py-1.5">
        <InlineEdit value={asset.accountNumber} onSave={(v) => saveAssetField('accountNumber', v)} />
      </td>
      <td className="py-1.5 text-right">
        <InlineEdit value={asset.balance} onSave={(v) => saveAssetField('balance', v)} format="currency" />
      </td>
      <td className="py-1.5 text-right">
        <button onClick={() => onDelete(asset.id)} className="text-gray-300 hover:text-red-500">×</button>
      </td>
    </tr>
  );
}

function LiabilitiesCard({ liabilities, onAdd, onDelete, loanId, fetchData }) {
  const totalPayment = liabilities.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);
  const totalBalance = liabilities.reduce((sum, l) => sum + (l.unpaidBalance || 0), 0);

  return (
    <SectionCard
      title="Liabilities"
      icon="💳"
      defaultOpen={true}
      badge={liabilities.length > 0 ? `${liabilities.length}` : null}
      actions={
        <button onClick={onAdd} className="text-xs text-brand hover:text-brand-dark font-medium">+ Add</button>
      }
    >
      {liabilities.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No liabilities recorded</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">Creditor</th>
                <th className="text-left py-1.5 font-medium">Type</th>
                <th className="text-right py-1.5 font-medium">Payment</th>
                <th className="text-right py-1.5 font-medium">Balance</th>
                <th className="text-center py-1.5 font-medium">Payoff</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((l) => (
                <LiabilityRow key={l.id} liability={l} loanId={loanId} fetchData={fetchData} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end gap-6">
            <div>
              <span className="text-xs text-gray-400">Total Payment</span>
              <span className="ml-1 text-xs font-bold text-gray-900">${totalPayment.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">Total Balance</span>
              <span className="ml-1 text-xs font-bold text-gray-900">${totalBalance.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function LiabilityRow({ liability, loanId, fetchData, onDelete }) {
  const saveLiabField = async (field, value) => {
    await fetch(`/api/portal/mlo/loans/${loanId}/application`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'liability',
        data: { ...liability, [field]: value },
        itemId: liability.id,
      }),
    });
    await fetchData();
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-1.5">
        <InlineEdit value={liability.creditor} onSave={(v) => saveLiabField('creditor', v)} />
      </td>
      <td className="py-1.5">
        <InlineSelect value={liability.liabilityType} options={LIABILITY_TYPE_OPTIONS} onSave={(v) => saveLiabField('liabilityType', v)} />
      </td>
      <td className="py-1.5 text-right">
        <InlineEdit value={liability.monthlyPayment} onSave={(v) => saveLiabField('monthlyPayment', v)} format="currency" />
      </td>
      <td className="py-1.5 text-right">
        <InlineEdit value={liability.unpaidBalance} onSave={(v) => saveLiabField('unpaidBalance', v)} format="currency" />
      </td>
      <td className="py-1.5 text-center">
        <input
          type="checkbox"
          checked={liability.paidOffAtClosing}
          onChange={(e) => saveLiabField('paidOffAtClosing', e.target.checked)}
          className="rounded border-gray-300 text-brand focus:ring-brand"
        />
      </td>
      <td className="py-1.5 text-right">
        <button onClick={() => onDelete(liability.id)} className="text-gray-300 hover:text-red-500">×</button>
      </td>
    </tr>
  );
}

function REOCard({ reos, onAdd, onDelete, loanId, fetchData }) {
  return (
    <SectionCard
      title="Real Estate Owned"
      icon="🏠"
      defaultOpen={true}
      badge={reos.length > 0 ? `${reos.length}` : null}
      actions={
        <button onClick={onAdd} className="text-xs text-brand hover:text-brand-dark font-medium">+ Add</button>
      }
    >
      {reos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No properties owned</p>
      ) : (
        <div className="space-y-3">
          {reos.map((reo) => (
            <REORow key={reo.id} reo={reo} loanId={loanId} fetchData={fetchData} onDelete={onDelete} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function REORow({ reo, loanId, fetchData, onDelete }) {
  const saveReoField = async (field, value) => {
    await fetch(`/api/portal/mlo/loans/${loanId}/application`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'reo',
        data: { ...reo, [field]: value },
        itemId: reo.id,
      }),
    });
    await fetchData();
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{formatAddress(reo.address)}</span>
        <button onClick={() => onDelete(reo.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EditableField label="Property Type" value={reo.propertyType} type="select" options={PROPERTY_TYPE_OPTIONS} onSave={(v) => saveReoField('propertyType', v)} />
        <EditableField label="Market Value" value={reo.presentMarketValue} type="currency" onSave={(v) => saveReoField('presentMarketValue', v)} />
        <EditableField label="Mortgage Balance" value={reo.mortgageBalance} type="currency" onSave={(v) => saveReoField('mortgageBalance', v)} />
        <EditableField label="Mortgage Payment" value={reo.mortgagePayment} type="currency" onSave={(v) => saveReoField('mortgagePayment', v)} />
        <EditableField label="Gross Rental" value={reo.grossRentalIncome} type="currency" onSave={(v) => saveReoField('grossRentalIncome', v)} />
        <EditableField label="Net Rental" value={reo.netRentalIncome} type="currency" onSave={(v) => saveReoField('netRentalIncome', v)} />
        <EditableField label="Ins/Tax/Maint" value={reo.insuranceTaxesMaintenance} type="currency" onSave={(v) => saveReoField('insuranceTaxesMaintenance', v)} />
        <EditableField label="Status" value={reo.status} type="select" options={REO_STATUS_OPTIONS} onSave={(v) => saveReoField('status', v)} />
      </div>
    </div>
  );
}

function TransactionCard({ transaction, onSave, loanPurpose }) {
  const tx = transaction || {};
  const isPurchase = loanPurpose === 'purchase';

  return (
    <SectionCard title="Transaction Details" icon="📄" defaultOpen={true}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isPurchase ? (
          <>
            <EditableField label="Purchase Price" value={tx.purchasePrice} type="currency" onSave={(v) => onSave('purchasePrice', v)} />
            <EditableField label="Alterations" value={tx.alterationsAmount} type="currency" onSave={(v) => onSave('alterationsAmount', v)} />
            <EditableField label="Land Value" value={tx.landValue} type="currency" onSave={(v) => onSave('landValue', v)} />
          </>
        ) : (
          <>
            <EditableField label="Original Cost" value={tx.refinanceOriginalCost} type="currency" onSave={(v) => onSave('refinanceOriginalCost', v)} />
            <EditableField label="Year Acquired" value={tx.yearAcquired} type="text" onSave={(v) => onSave('yearAcquired', v)} />
            <EditableField label="Existing Liens" value={tx.existingLiens} type="currency" onSave={(v) => onSave('existingLiens', v)} />
          </>
        )}
        <EditableField label="Closing Costs Est." value={tx.closingCostsEstimate} type="currency" onSave={(v) => onSave('closingCostsEstimate', v)} />
        <EditableField label="Discount Points" value={tx.discountPoints} type="currency" onSave={(v) => onSave('discountPoints', v)} />
        <EditableField label="PMI/MIP" value={tx.pmiMip} type="currency" onSave={(v) => onSave('pmiMip', v)} />
        <EditableField label="Seller Concessions" value={tx.sellerConcessions} type="currency" onSave={(v) => onSave('sellerConcessions', v)} />
        <EditableField label="Subordinate Financing" value={tx.subordinateFinancing} type="currency" onSave={(v) => onSave('subordinateFinancing', v)} />
        <EditableField label="Cash from Borrower" value={tx.cashFromBorrower} type="currency" onSave={(v) => onSave('cashFromBorrower', v)} />
        <EditableField label="Source of Down Payment" value={tx.sourceOfDownPayment} type="text" onSave={(v) => onSave('sourceOfDownPayment', v)} />
      </div>
    </SectionCard>
  );
}

function DeclarationsCard({ borrower, onSave }) {
  const decl = borrower.declaration || {};

  const boolField = (label, field) => (
    <label className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={decl[field] ?? false}
        onChange={(e) => onSave(field, e.target.checked)}
        className="rounded border-gray-300 text-brand focus:ring-brand"
      />
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  );

  return (
    <SectionCard title="Declarations" icon="✋" defaultOpen={false}>
      <div className="space-y-1">
        {boolField('Outstanding judgments against you?', 'outstandingJudgments')}
        {boolField('Declared bankruptcy within past 7 years?', 'bankruptcy')}
        {decl.bankruptcy && (
          <div className="ml-6 grid grid-cols-2 gap-3">
            <EditableField label="Bankruptcy Type" value={decl.bankruptcyType} type="text" onSave={(v) => onSave('bankruptcyType', v)} />
            <EditableField label="Bankruptcy Date" value={decl.bankruptcyDate} type="date" onSave={(v) => onSave('bankruptcyDate', v)} />
          </div>
        )}
        {boolField('Property foreclosed upon in last 7 years?', 'foreclosure')}
        {decl.foreclosure && (
          <div className="ml-6">
            <EditableField label="Foreclosure Date" value={decl.foreclosureDate} type="date" onSave={(v) => onSave('foreclosureDate', v)} />
          </div>
        )}
        {boolField('Party to a lawsuit?', 'partyToLawsuit')}
        {boolField('Directly or indirectly obligated on any loan resulting in default?', 'loanDefault')}
        {boolField('Obligated to pay alimony, child support, or maintenance?', 'alimonyObligation')}
        {boolField('Delinquent or in default on any Federal debt?', 'delinquentFederalDebt')}
        {boolField('Co-signer or endorser on a note?', 'coSignerOnOtherLoan')}
        {boolField('Intend to occupy the property as your primary residence?', 'intentToOccupy')}
        {boolField('Ownership interest in a property in the last 3 years?', 'ownershipInterestLastThreeYears')}
        {decl.ownershipInterestLastThreeYears && (
          <div className="ml-6">
            <EditableField label="Property Type" value={decl.propertyTypeOfOwnership} type="text" onSave={(v) => onSave('propertyTypeOfOwnership', v)} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function LoanDetailsCard({ appData, onSave }) {
  const isArm = appData.amortizationType === 'arm';

  return (
    <SectionCard title="Loan Details" icon="📋" defaultOpen={true}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EditableField label="Amortization" value={appData.amortizationType} type="select" options={AMORT_OPTIONS} onSave={(v) => onSave('amortizationType', v)} />
        <EditableField label="Title Held As" value={appData.titleHeldAs} type="select" options={TITLE_OPTIONS} onSave={(v) => onSave('titleHeldAs', v)} />
        <EditableField label="Estate Held In" value={appData.estateHeldIn} type="text" onSave={(v) => onSave('estateHeldIn', v)} />
      </div>
      {isArm && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ARM Details</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <EditableField label="Index" value={appData.armIndex} type="text" onSave={(v) => onSave('armIndex', v)} />
            <EditableField label="Margin" value={appData.armMargin} type="text" onSave={(v) => onSave('armMargin', v)} />
            <EditableField label="Initial Cap" value={appData.armInitialCap} type="text" onSave={(v) => onSave('armInitialCap', v)} />
            <EditableField label="Periodic Cap" value={appData.armPeriodicCap} type="text" onSave={(v) => onSave('armPeriodicCap', v)} />
            <EditableField label="Lifetime Cap" value={appData.armLifetimeCap} type="text" onSave={(v) => onSave('armLifetimeCap', v)} />
            <EditableField label="Adjustment Period" value={appData.armAdjustmentPeriod} type="text" onSave={(v) => onSave('armAdjustmentPeriod', v)} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Inline Edit Components (lightweight, for table rows)
// ═══════════════════════════════════════════════════════════════════════

function ExportXmlButton({ loanId, exporting, setExporting, setExportResult }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleDownload = () => {
    setShowMenu(false);
    window.open(`/api/portal/mlo/loans/${loanId}/xml`, '_blank');
  };

  const handleSnapshot = async (lender) => {
    setShowMenu(false);
    setExporting(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loanId}/xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender }),
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      setExportResult(data);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
      >
        {exporting ? (
          <span className="animate-pulse">Exporting...</span>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export XML
          </>
        )}
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-56 z-10">
          <button
            onClick={handleDownload}
            className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            Download XML File
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={() => handleSnapshot('LenDox')}
            className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            Export to LenDox + Save Snapshot
          </button>
          <button
            onClick={() => handleSnapshot(null)}
            className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            Save Submission Snapshot
          </button>
        </div>
      )}
    </div>
  );
}

function InlineEdit({ value, onSave, format }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const display = format === 'currency' && value != null
    ? `$${Number(value).toLocaleString()}`
    : (value ?? '—');

  const handleBlur = async () => {
    setEditing(false);
    if (draft !== (value ?? '')) {
      await onSave(draft || null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
  };

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        className="text-xs text-gray-800 cursor-pointer hover:text-brand"
      >
        {display}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="text-xs w-full border-b border-brand bg-transparent outline-none py-0.5"
    />
  );
}

function InlineSelect({ value, options, onSave }) {
  const handleChange = async (e) => {
    await onSave(e.target.value || null);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      className="text-xs bg-transparent border-none outline-none cursor-pointer text-gray-800 hover:text-brand p-0"
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
