// Pipeline Table — Spreadsheet-style loan list for MLO dashboard
// Features: sortable columns, per-column filters, column visibility, saved views
// Inline editing: click a cell to edit (Status, LO, Lender, Loan #)
// Bulk selection: checkboxes + floating action bar for multi-loan updates

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

// ─── Constants ──────────────────────────────────────────────

const STATUS_LABELS = {
  prospect: 'Prospect', applied: 'Applied', processing: 'Processing',
  submitted_uw: 'In UW', cond_approved: 'Cond. Approved', suspended: 'Suspended',
  ctc: 'Clear to Close', docs_out: 'Docs Out', funded: 'Funded',
  settled: 'Settled', withdrawn: 'Withdrawn', denied: 'Denied', archived: 'Archived',
};

const STATUS_COLORS = {
  prospect: 'bg-gray-100 text-gray-700', applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800', submitted_uw: 'bg-purple-100 text-purple-800',
  cond_approved: 'bg-orange-100 text-orange-800', suspended: 'bg-red-50 text-red-700',
  ctc: 'bg-green-100 text-green-800', docs_out: 'bg-green-100 text-green-800',
  funded: 'bg-emerald-100 text-emerald-800', settled: 'bg-green-200 text-green-900',
  withdrawn: 'bg-gray-200 text-gray-500', denied: 'bg-red-100 text-red-800',
  archived: 'bg-gray-200 text-gray-500',
};

const ALL_STATUSES = [
  'prospect', 'applied', 'processing', 'submitted_uw',
  'cond_approved', 'ctc', 'docs_out', 'funded',
  'settled', 'withdrawn', 'suspended', 'denied', 'archived',
];

const PURPOSE_LABELS = { purchase: 'Purch', refinance: 'Refi', cash_out: 'C/O', heloc: 'HELOC', hecm: 'HECM' };
const PURPOSE_COLORS = { purchase: 'bg-blue-50 text-blue-700', refinance: 'bg-purple-50 text-purple-700', cash_out: 'bg-orange-50 text-orange-700', heloc: 'bg-teal-50 text-teal-700', hecm: 'bg-pink-50 text-pink-700' };
const TYPE_LABELS = { conventional: 'Conv', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo', Conventional: 'Conv' };

const STORAGE_KEY = 'netrate_pipeline_state';
const VIEWS_KEY = 'netrate_pipeline_views';

// ─── Column Definitions ─────────────────────────────────────

const COLUMNS = [
  { key: 'borrowerName', label: 'Borrower', align: 'left', sortable: true, filterable: 'text', defaultVisible: true, minW: 'min-w-[160px]' },
  { key: 'loanNumber', label: 'Loan #', align: 'left', sortable: true, filterable: 'text', defaultVisible: true, editable: true },
  { key: 'lenderName', label: 'Lender', align: 'left', sortable: true, filterable: 'text', defaultVisible: true, editable: true },
  { key: 'purpose', label: 'Purpose', align: 'center', sortable: true, filterable: 'select', defaultVisible: true },
  { key: 'loanType', label: 'Type', align: 'center', sortable: true, filterable: 'select', defaultVisible: false },
  { key: 'interestRate', label: 'Rate', align: 'right', sortable: true, filterable: false, defaultVisible: true },
  { key: 'loanTerm', label: 'Term', align: 'center', sortable: true, filterable: false, defaultVisible: false },
  { key: 'mloName', label: 'LO', align: 'left', sortable: true, filterable: 'select', defaultVisible: true, editable: 'select' },
  { key: 'status', label: 'Status', align: 'left', sortable: true, filterable: 'select', defaultVisible: true, editable: 'select' },
  { key: 'loanAmount', label: 'Amount', align: 'right', sortable: true, filterable: false, defaultVisible: true },
  { key: 'lockExpiration', label: 'Lock Exp', align: 'center', sortable: true, filterable: false, defaultVisible: false },
  { key: 'closingDate', label: 'Closing', align: 'center', sortable: true, filterable: false, defaultVisible: true },
  { key: 'pendingDocs', label: 'Docs', align: 'center', sortable: true, filterable: false, defaultVisible: false },
  { key: 'creditScore', label: 'FICO', align: 'right', sortable: true, filterable: false, defaultVisible: false },
  { key: 'propertyState', label: 'State', align: 'center', sortable: true, filterable: 'select', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', align: 'center', sortable: true, filterable: false, defaultVisible: false },
];

const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const diffDays = (new Date(dateStr) - new Date()) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function getSortValue(loan, key) {
  switch (key) {
    case 'loanAmount': return Number(loan.loanAmount || loan.purchasePrice || loan.estimatedValue || 0);
    case 'interestRate': return Number(loan.interestRate || 0);
    case 'creditScore': return Number(loan.creditScore || 0);
    case 'loanTerm': return Number(loan.loanTerm || 0);
    case 'pendingDocs': return Number(loan.pendingDocs || 0);
    case 'closingDate': return new Date(loan.closingDate || loan.estimatedClosing || '2099-01-01').getTime();
    case 'lockExpiration': return new Date(loan.lockExpiration || '2099-01-01').getTime();
    case 'updatedAt': return new Date(loan.updatedAt || 0).getTime();
    default: return (loan[key] || '').toString().toLowerCase();
  }
}

function getFilterOptions(loans, key) {
  const values = new Set();
  loans.forEach(l => {
    const v = l[key];
    if (v != null && v !== '') values.add(v);
  });
  return Array.from(values).sort();
}

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadViews() {
  try {
    const s = localStorage.getItem(VIEWS_KEY);
    return s ? JSON.parse(s) : { views: [], activeView: null };
  } catch { return { views: [], activeView: null }; }
}

function saveViews(views) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch {}
}

// ─── Editable Cells ─────────────────────────────────────────

function EditableText({ value, onSave, placeholder = '—' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === (value || '')) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(trimmed); setEditing(false); } catch {} finally { setSaving(false); }
  }, [draft, value, onSave]);

  if (editing) {
    return (
      <input ref={inputRef} type="text" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
        disabled={saving}
        className={`w-full px-1.5 py-0.5 text-sm border rounded focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none ${saving ? 'opacity-50' : ''} border-gray-300`}
      />
    );
  }
  return (
    <span onClick={() => setEditing(true)}
      className={`inline-block px-1.5 py-0.5 rounded cursor-pointer text-sm transition-colors hover:bg-gray-100 border border-transparent hover:border-dashed hover:border-gray-300 min-w-[40px] ${value ? 'text-gray-700' : 'text-gray-300'}`}
      title="Click to edit">
      {value || placeholder}
    </span>
  );
}

function EditableSelect({ value, options, onSave, renderValue }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => { if (editing && selectRef.current) selectRef.current.focus(); }, [editing]);

  const save = useCallback(async (newVal) => {
    if (newVal === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(newVal); setEditing(false); } catch {} finally { setSaving(false); }
  }, [value, onSave]);

  if (editing) {
    return (
      <select ref={selectRef} value={value} onChange={e => save(e.target.value)}
        onBlur={() => setEditing(false)} disabled={saving}
        className={`text-sm border border-gray-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none ${saving ? 'opacity-50' : ''}`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <span onClick={() => setEditing(true)} className="cursor-pointer" title="Click to edit">
      {renderValue(value)}
    </span>
  );
}

// ─── Column Filter Dropdown ─────────────────────────────────

function ColumnFilterDropdown({ column, allLoans, filter, onFilterChange, onClose }) {
  const ref = useRef(null);
  const [textVal, setTextVal] = useState(filter || '');

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (column.filterable === 'text') {
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 min-w-[180px]">
        <input type="text" value={textVal} onChange={e => setTextVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onFilterChange(textVal || null); onClose(); } }}
          placeholder={`Filter ${column.label}...`}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
          autoFocus
        />
        <div className="flex gap-1 mt-1.5">
          <button onClick={() => { onFilterChange(textVal || null); onClose(); }}
            className="flex-1 text-xs bg-brand text-white rounded px-2 py-1 hover:bg-brand-dark">Apply</button>
          <button onClick={() => { onFilterChange(null); onClose(); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Clear</button>
        </div>
      </div>
    );
  }

  if (column.filterable === 'select') {
    const options = getFilterOptions(allLoans, column.key);
    const selected = new Set(Array.isArray(filter) ? filter : []);
    const labelMap = column.key === 'status' ? STATUS_LABELS
      : column.key === 'purpose' ? PURPOSE_LABELS
      : column.key === 'loanType' ? TYPE_LABELS
      : null;

    const toggle = (val) => {
      const next = new Set(selected);
      if (next.has(val)) next.delete(val); else next.add(val);
      onFilterChange(next.size > 0 ? Array.from(next) : null);
    };

    return (
      <div ref={ref} className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 min-w-[160px] max-h-64 overflow-y-auto">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
            <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)}
              className="rounded border-gray-300 text-brand focus:ring-brand/30" />
            <span className="text-xs text-gray-700">{(labelMap && labelMap[opt]) || opt}</span>
          </label>
        ))}
        <div className="border-t border-gray-100 mt-1 pt-1">
          <button onClick={() => { onFilterChange(null); onClose(); }}
            className="w-full text-xs text-gray-500 hover:text-gray-700 px-2 py-1 text-left">Clear filter</button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Column Visibility Dropdown ─────────────────────────────

function ColumnVisibilityDropdown({ visibleColumns, onToggle, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 min-w-[160px]">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 pb-1">Show Columns</p>
      {COLUMNS.map(col => (
        <label key={col.key} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
          <input type="checkbox" checked={visibleColumns.has(col.key)} onChange={() => onToggle(col.key)}
            className="rounded border-gray-300 text-brand focus:ring-brand/30" />
          <span className="text-xs text-gray-700">{col.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Saved Views Dropdown ───────────────────────────────────

function SavedViewsDropdown({ views, activeView, onSelect, onSave, onDelete, onClose }) {
  const ref = useRef(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 min-w-[200px]">
      <button onClick={() => { onSelect(null); onClose(); }}
        className={`w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${!activeView ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
        Default View
      </button>
      {views.map(v => (
        <div key={v.name} className="flex items-center group">
          <button onClick={() => { onSelect(v.name); onClose(); }}
            className={`flex-1 text-left px-3 py-1.5 text-sm rounded transition-colors ${activeView === v.name ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
            {v.name}
          </button>
          <button onClick={() => onDelete(v.name)}
            className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 px-2 transition-opacity">
            ×
          </button>
        </div>
      ))}
      <div className="border-t border-gray-100 mt-1 pt-1">
        {naming ? (
          <div className="flex gap-1 px-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="View name..."
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-brand/30 outline-none" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setNaming(false); setName(''); onClose(); } }}
            />
            <button onClick={() => { if (name.trim()) { onSave(name.trim()); setNaming(false); setName(''); onClose(); } }}
              className="text-xs bg-brand text-white rounded px-2 py-1">Save</button>
          </div>
        ) : (
          <button onClick={() => setNaming(true)}
            className="w-full text-left px-3 py-1.5 text-sm text-brand hover:bg-brand/5 rounded transition-colors">
            + Save Current View
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Expanded Detail Row ────────────────────────────────────

function DetailField({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-gray-400 block">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

function ExpandedDetail({ loan }) {
  const addr = loan.propertyAddress;
  const addrStr = addr ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') : null;
  const d = loan.dates || {};

  return (
    <div className="grid grid-cols-4 gap-x-6 gap-y-3 p-4 text-sm">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1">Borrower</div>
        <DetailField label="Name" value={loan.borrowerName} />
        <DetailField label="Email" value={loan.borrowerEmail} />
        <DetailField label="Phone" value={loan.borrowerPhone} />
        <DetailField label="FICO" value={loan.creditScore} />
        {loan.coBorrowers?.length > 0 && (
          <div className="pt-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Co-Borrowers</span>
            {loan.coBorrowers.map((cb, i) => (
              <div key={i} className="text-xs text-gray-600 mb-1">{cb.name}{cb.email ? ` · ${cb.email}` : ''}</div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1">Property</div>
        <DetailField label="Address" value={addrStr} />
        <DetailField label="Type" value={loan.propertyType} />
        <DetailField label="Occupancy" value={loan.occupancy} />
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mt-3">Financials</div>
        <DetailField label="Amount" value={formatCurrency(loan.loanAmount)} />
        <DetailField label="Purchase Price" value={formatCurrency(loan.purchasePrice)} />
        <DetailField label="Down Payment" value={formatCurrency(loan.downPayment)} />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1">Key Dates</div>
        <DetailField label="Application" value={formatShortDate(d.applicationDate)} />
        <DetailField label="Lock Exp" value={formatShortDate(loan.lockExpiration)} />
        <DetailField label="Appraisal" value={formatShortDate(d.appraisalReceived)} />
        <DetailField label="Est. Closing" value={formatShortDate(d.estimatedClosing)} />
        <DetailField label="Closing" value={formatShortDate(loan.closingDate)} />
        <DetailField label="Funding" value={formatShortDate(d.fundingDate)} />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1">Source</div>
        <DetailField label="Lead Source" value={loan.leadSource} />
        <DetailField label="Referral" value={loan.referralSource} />
        <DetailField label="Channel" value={loan.applicationChannel} />
        <DetailField label="LDox ID" value={loan.ldoxLoanId} />
      </div>
    </div>
  );
}

// ─── Pipeline Table ─────────────────────────────────────────

export default function PipelineTable({ loans, allLoans, mloList, selectedIds, onSelectionChange, onLoanUpdate }) {
  // Use allLoans for filter options (unfiltered), loans for display (tier-filtered from parent)
  const filterSourceLoans = allLoans || loans;

  // Load persisted state
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [columnFilters, setColumnFilters] = useState({});
  const [visibleColumns, setVisibleColumns] = useState(new Set(DEFAULT_VISIBLE));
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [savedViews, setSavedViews] = useState({ views: [], activeView: null });

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      if (saved.sortKey) setSortKey(saved.sortKey);
      if (saved.sortDir) setSortDir(saved.sortDir);
      if (saved.columnFilters) setColumnFilters(saved.columnFilters);
      if (saved.visibleColumns) setVisibleColumns(new Set(saved.visibleColumns));
    }
    setSavedViews(loadViews());
  }, []);

  // Persist state on change
  useEffect(() => {
    saveState({
      sortKey, sortDir, columnFilters,
      visibleColumns: Array.from(visibleColumns),
    });
  }, [sortKey, sortDir, columnFilters, visibleColumns]);

  // ─── Column filter application ────────────────────────────
  const columnFilteredLoans = useMemo(() => {
    return loans.filter(loan => {
      for (const [key, filter] of Object.entries(columnFilters)) {
        if (filter == null) continue;
        const col = COLUMNS.find(c => c.key === key);
        if (!col) continue;

        if (col.filterable === 'text') {
          const val = (loan[key] || '').toString().toLowerCase();
          if (!val.includes(filter.toLowerCase())) return false;
        } else if (col.filterable === 'select' && Array.isArray(filter)) {
          const val = loan[key];
          if (!filter.includes(val)) return false;
        }
      }
      return true;
    });
  }, [loans, columnFilters]);

  // ─── Sorting ──────────────────────────────────────────────
  const sortedLoans = useMemo(() => {
    if (!sortKey) return columnFilteredLoans;
    const sorted = [...columnFilteredLoans].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [columnFilteredLoans, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); setSortDir('asc'); } // Third click clears
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleColumnFilter = (key, value) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (value == null) delete next[key]; else next[key] = value;
      return next;
    });
  };

  const toggleColumnVisibility = (key) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ─── Saved Views ──────────────────────────────────────────
  const handleSaveView = (name) => {
    const view = {
      name,
      sortKey, sortDir, columnFilters,
      visibleColumns: Array.from(visibleColumns),
    };
    const updated = {
      views: [...savedViews.views.filter(v => v.name !== name), view],
      activeView: name,
    };
    setSavedViews(updated);
    saveViews(updated);
  };

  const handleSelectView = (name) => {
    if (!name) {
      // Reset to defaults
      setSortKey(null); setSortDir('asc');
      setColumnFilters({});
      setVisibleColumns(new Set(DEFAULT_VISIBLE));
      const updated = { ...savedViews, activeView: null };
      setSavedViews(updated);
      saveViews(updated);
      return;
    }
    const view = savedViews.views.find(v => v.name === name);
    if (view) {
      setSortKey(view.sortKey || null);
      setSortDir(view.sortDir || 'asc');
      setColumnFilters(view.columnFilters || {});
      setVisibleColumns(new Set(view.visibleColumns || DEFAULT_VISIBLE));
      const updated = { ...savedViews, activeView: name };
      setSavedViews(updated);
      saveViews(updated);
    }
  };

  const handleDeleteView = (name) => {
    const updated = {
      views: savedViews.views.filter(v => v.name !== name),
      activeView: savedViews.activeView === name ? null : savedViews.activeView,
    };
    setSavedViews(updated);
    saveViews(updated);
  };

  // ─── Selection ────────────────────────────────────────────
  const allSelected = sortedLoans.length > 0 && sortedLoans.every(l => selectedIds.has(l.id));
  const someSelected = sortedLoans.some(l => selectedIds.has(l.id));
  const toggleAll = () => {
    if (allSelected) { onSelectionChange(new Set()); }
    else { onSelectionChange(new Set(sortedLoans.map(l => l.id))); }
  };

  // ─── Edit helpers ─────────────────────────────────────────
  const statusOptions = ALL_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] || s }));
  const mloOptions = [{ value: '', label: 'Unassigned' }, ...mloList.map(m => ({ value: m.id, label: m.name }))];

  const activeFiltersCount = Object.keys(columnFilters).length;
  const visibleCols = COLUMNS.filter(c => visibleColumns.has(c.key));
  const colSpanTotal = visibleCols.length + 2; // + expand chevron + checkbox

  // ─── Render cell value ────────────────────────────────────
  const renderCell = (loan, col) => {
    switch (col.key) {
      case 'borrowerName':
        return (
          <Link href={`/portal/mlo/loans/${loan.id}`} className="block">
            <span className="font-medium text-gray-900">{loan.borrowerName}</span>
            <span className="block text-xs text-gray-400 mt-0.5 truncate">
              ···{loan.ssnLastFour}{loan.propertyStreet ? ` · ${loan.propertyStreet}` : ''}
            </span>
          </Link>
        );
      case 'loanNumber':
        return <EditableText value={loan.loanNumber} placeholder="—" onSave={val => onLoanUpdate(loan.id, { loanNumber: val })} />;
      case 'lenderName':
        return <EditableText value={loan.lenderName} placeholder="—" onSave={val => onLoanUpdate(loan.id, { lenderName: val })} />;
      case 'purpose':
        return loan.purpose ? (
          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${PURPOSE_COLORS[loan.purpose] || 'bg-gray-50 text-gray-600'}`}>
            {PURPOSE_LABELS[loan.purpose] || loan.purpose}
          </span>
        ) : <span className="text-xs text-gray-300">—</span>;
      case 'loanType':
        return loan.loanType ? (
          <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
            {TYPE_LABELS[loan.loanType] || loan.loanType}
          </span>
        ) : <span className="text-xs text-gray-300">—</span>;
      case 'interestRate':
        return <span className="text-xs text-gray-700">{loan.interestRate ? `${loan.interestRate}%` : '—'}</span>;
      case 'loanTerm':
        return <span className="text-xs text-gray-600">{loan.loanTerm ? `${loan.loanTerm}yr` : '—'}</span>;
      case 'mloName':
        return (
          <EditableSelect value={loan.mloId || ''} options={mloOptions}
            onSave={val => onLoanUpdate(loan.id, { mloId: val || null })}
            renderValue={val => {
              if (!val) return <span className="text-gray-300 text-sm">Unassigned</span>;
              const mlo = mloList.find(m => m.id === val);
              return <span className="text-sm text-gray-700">{mlo ? mlo.name : 'Unknown'}</span>;
            }}
          />
        );
      case 'status':
        return (
          <EditableSelect value={loan.status} options={statusOptions}
            onSave={val => onLoanUpdate(loan.id, { status: val })}
            renderValue={val => (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[val] || 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABELS[val] || val}
              </span>
            )}
          />
        );
      case 'loanAmount':
        return <span className="text-gray-700">{formatCurrency(loan.loanAmount || loan.purchasePrice || loan.estimatedValue)}</span>;
      case 'lockExpiration':
        return loan.lockExpiration ? (
          <span className={`text-xs ${isExpired(loan.lockExpiration) ? 'text-red-600 font-medium' : isExpiringSoon(loan.lockExpiration) ? 'text-amber-600 font-medium' : 'text-gray-600'}`}>
            {formatShortDate(loan.lockExpiration)}
          </span>
        ) : <span className="text-xs text-gray-300">—</span>;
      case 'closingDate':
        return <span className="text-xs text-gray-600">{formatShortDate(loan.closingDate || loan.estimatedClosing)}</span>;
      case 'pendingDocs':
        return loan.pendingDocs > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{loan.pendingDocs} pending</span>
        ) : loan.totalDocs > 0 ? (
          <span className="text-xs text-gray-400">{loan.totalDocs} docs</span>
        ) : <span className="text-xs text-gray-300">—</span>;
      case 'creditScore':
        return <span className="text-xs text-gray-700">{loan.creditScore || '—'}</span>;
      case 'propertyState':
        return <span className="text-xs text-gray-600">{loan.propertyState || '—'}</span>;
      case 'updatedAt':
        return <span className="text-xs text-gray-500">{formatShortDate(loan.updatedAt)}</span>;
      default:
        return <span className="text-xs text-gray-500">{loan[col.key] || '—'}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar: saved views + column picker + active filters count */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          {/* Saved Views */}
          <div className="relative">
            <button onClick={() => setShowViewPicker(!showViewPicker)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              {savedViews.activeView || 'Default View'}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showViewPicker && (
              <SavedViewsDropdown views={savedViews.views} activeView={savedViews.activeView}
                onSelect={handleSelectView} onSave={handleSaveView} onDelete={handleDeleteView}
                onClose={() => setShowViewPicker(false)} />
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button onClick={() => setColumnFilters({})}
              className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
              {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
              <span className="text-orange-400 ml-0.5">×</span>
            </button>
          )}
        </div>

        {/* Column Picker */}
        <div className="relative">
          <button onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Show/hide columns">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Columns
          </button>
          {showColumnPicker && (
            <ColumnVisibilityDropdown visibleColumns={visibleColumns}
              onToggle={toggleColumnVisibility} onClose={() => setShowColumnPicker(false)} />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="w-6"></th>
              <th className="px-3 py-3 w-10">
                <input type="checkbox" checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30"
                />
              </th>
              {visibleCols.map(col => {
                const isSorted = sortKey === col.key;
                const hasFilter = columnFilters[col.key] != null;
                return (
                  <th key={col.key} className={`px-3 py-3 font-medium text-xs uppercase tracking-wider ${col.minW || ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                      {/* Sort button */}
                      {col.sortable ? (
                        <button onClick={() => handleSort(col.key)}
                          className={`flex items-center gap-0.5 transition-colors ${isSorted ? 'text-brand' : 'text-gray-500 hover:text-gray-700'}`}>
                          {col.label}
                          {isSorted && (
                            <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-500">{col.label}</span>
                      )}

                      {/* Filter button */}
                      {col.filterable && (
                        <div className="relative">
                          <button onClick={e => { e.stopPropagation(); setActiveFilterCol(activeFilterCol === col.key ? null : col.key); }}
                            className={`ml-0.5 p-0.5 rounded transition-colors ${hasFilter ? 'text-orange-500' : 'text-gray-300 hover:text-gray-500'}`}
                            title={`Filter ${col.label}`}>
                            <svg className="w-3 h-3" fill={hasFilter ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                          {activeFilterCol === col.key && (
                            <ColumnFilterDropdown column={col} allLoans={filterSourceLoans}
                              filter={columnFilters[col.key]}
                              onFilterChange={val => handleColumnFilter(col.key, val)}
                              onClose={() => setActiveFilterCol(null)} />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedLoans.map(loan => {
              const isExpanded = expandedId === loan.id;
              return (
                <React.Fragment key={loan.id}>
                  <tr className={`transition-colors ${selectedIds.has(loan.id) ? 'bg-brand/5' : isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                    <td className="pl-2 py-3 w-6">
                      <button onClick={() => setExpandedId(isExpanded ? null : loan.id)} className="text-gray-400 hover:text-gray-600 text-xs">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.has(loan.id)} onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(loan.id)) next.delete(loan.id); else next.add(loan.id);
                        onSelectionChange(next);
                      }} className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                    </td>
                    {visibleCols.map(col => (
                      <td key={col.key} className={`px-3 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.key === 'borrowerName' ? 'max-w-[200px]' : ''}`}>
                        {renderCell(loan, col)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50/80">
                      <td colSpan={colSpanTotal} className="px-0 py-0 border-b border-gray-200">
                        <ExpandedDetail loan={loan} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
