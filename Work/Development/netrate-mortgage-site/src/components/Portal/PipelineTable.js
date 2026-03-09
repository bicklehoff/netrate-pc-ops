// Pipeline Table — Editable loan list for MLO dashboard
// Inline editing: click a cell to edit (Status, LO, Lender, Loan #)
// Bulk selection: checkboxes + floating action bar for multi-loan updates
//
// Props:
//   loans        — Array of loan objects from pipeline API
//   mloList      — Array of { id, name } for LO dropdown
//   selectedIds  — Set of selected loan IDs
//   onSelectionChange — (newSet) => void
//   onLoanUpdate — (loanId, updates) => Promise<void>

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

const STATUS_LABELS = {
  draft: 'Draft',
  applied: 'Applied',
  processing: 'Processing',
  submitted_uw: 'In UW',
  cond_approved: 'Cond. Approved',
  suspended: 'Suspended',
  ctc: 'Clear to Close',
  docs_out: 'Docs Out',
  funded: 'Funded',
  denied: 'Denied',
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  submitted_uw: 'bg-purple-100 text-purple-800',
  cond_approved: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-50 text-red-700',
  ctc: 'bg-green-100 text-green-800',
  docs_out: 'bg-green-100 text-green-800',
  funded: 'bg-green-200 text-green-900',
  denied: 'bg-red-100 text-red-800',
};

const ALL_STATUSES = [
  'draft', 'applied', 'processing', 'submitted_uw',
  'cond_approved', 'ctc', 'docs_out', 'funded',
  'suspended', 'denied',
];

function formatCurrency(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Editable Text Cell ──────────────────────────────────────

function EditableText({ value, onSave, placeholder = '—' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync draft with value when value changes externally
  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === (value || '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value || '');
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') cancel();
        }}
        disabled={saving}
        className={`w-full px-1.5 py-0.5 text-sm border rounded focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none ${
          saving ? 'opacity-50' : ''
        } ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`inline-block px-1.5 py-0.5 rounded cursor-pointer text-sm transition-colors hover:bg-gray-100 border border-transparent hover:border-dashed hover:border-gray-300 min-w-[40px] ${
        error ? 'bg-red-50 border-red-300' : ''
      } ${value ? 'text-gray-700' : 'text-gray-300'}`}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}

// ─── Editable Select Cell ─────────────────────────────────────

function EditableSelect({ value, options, onSave, renderValue }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  const handleChange = useCallback(async (newValue) => {
    if (newValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await onSave(newValue);
      setEditing(false);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [value, onSave]);

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value || ''}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
        className={`px-1.5 py-0.5 text-sm border rounded focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none ${
          saving ? 'opacity-50' : ''
        } ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`inline-block cursor-pointer transition-colors hover:opacity-80 ${
        error ? 'ring-2 ring-red-300 rounded' : ''
      }`}
      title="Click to change"
    >
      {renderValue ? renderValue(value) : value}
    </span>
  );
}

// ─── Pipeline Table ───────────────────────────────────────────

export default function PipelineTable({ loans, mloList = [], selectedIds, onSelectionChange, onLoanUpdate }) {
  const allSelected = loans.length > 0 && loans.every((l) => selectedIds.has(l.id));
  const someSelected = loans.some((l) => selectedIds.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(loans.map((l) => l.id)));
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const statusOptions = ALL_STATUSES.map((s) => ({
    value: s,
    label: STATUS_LABELS[s] || s,
  }));

  const mloOptions = [
    { value: '', label: 'Unassigned' },
    ...mloList.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Borrower
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Loan #
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Lender
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                LO
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Amount
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Docs
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loans.map((loan) => (
              <tr
                key={loan.id}
                className={`transition-colors ${
                  selectedIds.has(loan.id) ? 'bg-brand/5' : 'hover:bg-gray-50'
                }`}
              >
                {/* Checkbox */}
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(loan.id)}
                    onChange={() => toggleOne(loan.id)}
                    className="rounded border-gray-300 text-brand focus:ring-brand/30"
                  />
                </td>

                {/* Borrower (read-only, links to detail) */}
                <td className="px-4 py-3">
                  <Link href={`/portal/mlo/loans/${loan.id}`} className="block">
                    <span className="font-medium text-gray-900">{loan.borrowerName}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      SSN ···{loan.ssnLastFour}
                    </span>
                  </Link>
                </td>

                {/* Loan # (editable text) */}
                <td className="px-4 py-3">
                  <EditableText
                    value={loan.loanNumber}
                    placeholder="—"
                    onSave={(val) => onLoanUpdate(loan.id, { loanNumber: val })}
                  />
                </td>

                {/* Lender (editable text) */}
                <td className="px-4 py-3">
                  <EditableText
                    value={loan.lenderName}
                    placeholder="—"
                    onSave={(val) => onLoanUpdate(loan.id, { lenderName: val })}
                  />
                </td>

                {/* LO (editable select) */}
                <td className="px-4 py-3">
                  <EditableSelect
                    value={loan.mloId || ''}
                    options={mloOptions}
                    onSave={(val) => onLoanUpdate(loan.id, { mloId: val || null })}
                    renderValue={(val) => {
                      if (!val) return <span className="text-gray-300 text-sm">Unassigned</span>;
                      const mlo = mloList.find((m) => m.id === val);
                      return (
                        <span className="text-sm text-gray-700">
                          {mlo ? mlo.name : 'Unknown'}
                        </span>
                      );
                    }}
                  />
                </td>

                {/* Status (editable select) */}
                <td className="px-4 py-3">
                  <EditableSelect
                    value={loan.status}
                    options={statusOptions}
                    onSave={(val) => onLoanUpdate(loan.id, { status: val })}
                    renderValue={(val) => (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[val] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATUS_LABELS[val] || val}
                      </span>
                    )}
                  />
                </td>

                {/* Amount (read-only) */}
                <td className="px-4 py-3 text-right">
                  <span className="text-gray-700">
                    {formatCurrency(loan.loanAmount || loan.purchasePrice || loan.estimatedValue)}
                  </span>
                </td>

                {/* Docs (read-only) */}
                <td className="px-4 py-3 text-center">
                  {loan.pendingDocs > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {loan.pendingDocs} pending
                    </span>
                  ) : loan.totalDocs > 0 ? (
                    <span className="text-xs text-gray-400">{loan.totalDocs} docs</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Updated (read-only) */}
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-gray-400">{timeAgo(loan.updatedAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
