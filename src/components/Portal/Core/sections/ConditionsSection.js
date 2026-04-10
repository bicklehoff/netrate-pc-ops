// ConditionsSection — Full conditions management for loan detail
// Grouped by stage, with add/edit/status-change actions
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import SectionCard from '../SectionCard';
import {
  CONDITION_STAGE_ORDER,
  CONDITION_STAGE_LABELS,
  CONDITION_STATUS_LABELS,
  CONDITION_OWNER_LABELS,
} from '@/lib/constants/conditions';

const EMPTY_FORM = {
  conditionNumber: '',
  title: '',
  description: '',
  conditionType: 'document',
  stage: 'prior_to_close',
  ownerRole: 'mlo',
  borrowerFacing: false,
  blockingProgress: false,
  due_date: '',
};

export default function ConditionsSection({ loan, onRefresh }) {
  const conditions = loan.conditions || [];
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);

  // Approval documents — filter from loan.documents, newest first
  const approvals = (loan.documents || [])
    .filter((d) => d.docType === 'approval')
    .sort((a, b) => new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at));

  const apiCall = useCallback(async (method, body) => {
    const res = await fetch(`/api/portal/mlo/loans/${loan.id}/conditions`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return res.json();
  }, [loan.id]);

  // ─── Upload approval doc + extract ───
  const handleApprovalUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setExtraction(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/conditions`, { method: 'PUT', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const result = await res.json();
      if (result.extraction?.status === 'error') {
        setError(`Extraction failed: ${result.extraction.error}`);
        onRefresh();
      } else {
        setExtraction(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Confirm extracted conditions ───
  const handleConfirmExtraction = async () => {
    if (!extraction) return;
    setConfirming(true);
    setError('');
    try {
      await apiCall('POST', {
        action: 'confirm_approval',
        documentId: extraction.document.id,
        extractedConditions: extraction.extraction.data.conditions,
        extractedLoanData: extraction.extraction.data.loanData,
      });
      setExtraction(null);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Approval Documents ─── */}
      <SectionCard
        title="Approvals"
        icon="📄"
        badge={approvals.length > 0 ? `${approvals.length}` : null}
        defaultOpen={true}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleApprovalUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-xs font-medium text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? 'Extracting...' : '+ Upload Approval'}
            </button>
          </>
        }
      >
        {approvals.length === 0 ? (
          <p className="text-sm text-gray-400">No approval documents uploaded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {approvals.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-gray-400 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 truncate block">{doc.file_name || doc.label}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      {doc.fileSize && ` · ${(doc.fileSize / 1024).toFixed(0)} KB`}
                    </span>
                  </div>
                </div>
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand hover:text-brand-dark font-medium flex-shrink-0 ml-3"
                  >
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Extraction Review ─── */}
      {extraction && extraction.extraction?.status === 'success' && (
        <SectionCard title="Review Extracted Conditions" icon="🔍" defaultOpen={true}>
          <div className="space-y-4">
            {/* Loan Data */}
            {extraction.extraction.data.loanData && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Loan Data</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(extraction.extraction.data.loanData).filter(([, v]) => v != null && v !== '' && !Array.isArray(v)).map(([key, val]) => (
                    <div key={key} className="px-3 py-1.5 bg-gray-50 rounded text-sm">
                      <span className="text-[10px] text-gray-400 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="block text-gray-700 truncate">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Conditions */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Conditions ({extraction.extraction.data.conditions.length} found)
              </h4>
              <div className="max-h-80 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                {CONDITION_STAGE_ORDER.map((stageKey) => {
                  const stageConds = extraction.extraction.data.conditions.filter((c) => c.stage === stageKey);
                  if (stageConds.length === 0) return null;
                  return (
                    <div key={stageKey} className="mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {CONDITION_STAGE_LABELS[stageKey] || stageKey} ({stageConds.length})
                      </span>
                      {stageConds.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 py-1 px-2 text-sm hover:bg-gray-50 rounded">
                          <span className="text-xs text-gray-400 font-mono flex-shrink-0 w-8">#{c.conditionNumber}</span>
                          <span className="text-gray-700 text-xs line-clamp-2">{c.title}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-auto">
                            {CONDITION_OWNER_LABELS[c.ownerRole] || c.ownerRole}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Existing approval conditions warning */}
            {conditions.filter((c) => c.source === 'approval').length > 0 && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                {conditions.filter((c) => c.source === 'approval').length} existing approval conditions will be replaced. Manual conditions ({conditions.filter((c) => c.source === 'manual').length}) will not be affected.
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleConfirmExtraction}
                disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {confirming ? 'Importing...' : `Confirm & Import ${extraction.extraction.data.conditions.length} Conditions`}
              </button>
              <button
                onClick={() => { setExtraction(null); onRefresh(); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ─── Conditions Spreadsheet ─── */}
      <ConditionsTable
        conditions={conditions}
        apiCall={apiCall}
        onRefresh={onRefresh}
        error={error}
        setError={setError}
      />
    </div>
  );
}

// ─── Summary Pill ───
function SummaryPill({ color, label, count }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm text-gray-600">{count} {label.toLowerCase()}</span>
    </div>
  );
}

// ─── Conditions Table (Spreadsheet Mode) ───
function ConditionsTable({ conditions, apiCall, onRefresh, error, setError }) {
  // Local editable copy — initialized from server data
  const [localRows, setLocalRows] = useState(() => conditions.map((c) => ({ ...c })));
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sortField, setSortField] = useState('stage');
  const [sortDir, setSortDir] = useState('asc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);

  // Sync local rows when server data changes (after save/refresh)
  useEffect(() => {
    if (!saving) {
      setLocalRows(conditions.map((c) => ({ ...c })));
      setDirtyIds(new Set());
    }
  }, [conditions, saving]);

  // Warn on navigate away with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (dirtyIds.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyIds.size]);

  const isDirty = dirtyIds.size > 0;

  // ─── Edit a cell ───
  const editCell = (id, field, value) => {
    setLocalRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  // ─── Save all dirty rows ───
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const batch = [...dirtyIds].map((id) => {
        const row = localRows.find((r) => r.id === id);
        if (!row) return null;
        return {
          conditionId: id,
          status: row.status,
          stage: row.stage,
          ownerRole: row.ownerRole,
          conditionType: row.conditionType,
          blockingProgress: row.blockingProgress,
        };
      }).filter(Boolean);

      await apiCall('PATCH', { batch });
      setDirtyIds(new Set());
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Discard changes ───
  const handleDiscard = () => {
    setLocalRows(conditions.map((c) => ({ ...c })));
    setDirtyIds(new Set());
    setSelected(new Set());
  };

  // ─── Bulk status change ───
  const bulkSetStatus = (newStatus) => {
    setLocalRows((prev) => prev.map((r) => selected.has(r.id) ? { ...r, status: newStatus } : r));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      selected.forEach((id) => next.add(id));
      return next;
    });
  };

  // ─── Add condition ───
  const handleCreate = async () => {
    if (!formData.title.trim()) { setError('Title is required'); return; }
    setAddLoading(true);
    setError('');
    try {
      await apiCall('POST', formData);
      setShowAddForm(false);
      setFormData(EMPTY_FORM);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Sort ───
  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const stageOrder = Object.fromEntries(CONDITION_STAGE_ORDER.map((s, i) => [s, i]));
  const statusOrder = { needed: 0, received: 1, cleared: 2, waived: 3 };

  const sorted = [...localRows].sort((a, b) => {
    let av, bv;
    if (sortField === 'stage') { av = stageOrder[a.stage] ?? 99; bv = stageOrder[b.stage] ?? 99; }
    else if (sortField === 'status') { av = statusOrder[a.status] ?? 99; bv = statusOrder[b.status] ?? 99; }
    else if (sortField === 'conditionNumber') { av = a.conditionNumber || 9999; bv = b.conditionNumber || 9999; }
    else if (sortField === 'ownerRole') { av = a.ownerRole || ''; bv = b.ownerRole || ''; }
    else { av = a[sortField] || ''; bv = b[sortField] || ''; }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  };

  // Counts from local state
  const needed = localRows.filter((c) => c.status === 'needed').length;
  const received = localRows.filter((c) => c.status === 'received').length;
  const cleared = localRows.filter((c) => c.status === 'cleared' || c.status === 'waived').length;

  const cellSelect = 'px-1.5 py-1 text-xs border border-transparent hover:border-gray-300 rounded bg-transparent focus:border-brand focus:ring-0 cursor-pointer w-full';

  return (
    <SectionCard
      title="Conditions"
      icon="📋"
      badge={localRows.length > 0 ? `${localRows.length}` : null}
      defaultOpen={true}
      actions={
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button onClick={handleSave} disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : `Save ${dirtyIds.size} change${dirtyIds.size > 1 ? 's' : ''}`}
              </button>
              <button onClick={handleDiscard}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                Discard
              </button>
            </>
          )}
          <button onClick={() => { setShowAddForm(!showAddForm); setFormData(EMPTY_FORM); }}
            className="px-3 py-1.5 text-xs font-medium text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 rounded-lg transition-colors">
            + Add
          </button>
        </div>
      }
    >
      {/* Summary bar */}
      {localRows.length > 0 && (
        <div className="flex items-center gap-5 mb-3 pb-3 border-b border-gray-100">
          <SummaryPill color="bg-amber-400" label="Needed" count={needed} />
          <SummaryPill color="bg-blue-400" label="Received" count={received} />
          <SummaryPill color="bg-green-400" label="Cleared" count={cleared} />
          <span className="text-xs text-gray-400 ml-auto">{localRows.length} total</span>
          {isDirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">x</button>
        </div>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 px-2 py-1.5 bg-brand/5 rounded-lg">
          <span className="text-xs text-gray-600">{selected.size} selected:</span>
          <button onClick={() => bulkSetStatus('received')} className="px-2 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100">Received</button>
          <button onClick={() => bulkSetStatus('cleared')} className="px-2 py-0.5 text-[10px] font-medium text-green-600 bg-green-50 rounded hover:bg-green-100">Cleared</button>
          <button onClick={() => bulkSetStatus('waived')} className="px-2 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Waived</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="grid grid-cols-6 gap-2 mb-2">
            <input type="number" placeholder="#" value={formData.conditionNumber} onChange={(e) => setFormData({ ...formData, conditionNumber: e.target.value })}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-md" />
            <input type="text" placeholder="Title *" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="col-span-3 px-2 py-1.5 text-xs border border-gray-300 rounded-md" />
            <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-md">
              {Object.entries(CONDITION_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={formData.ownerRole} onChange={(e) => setFormData({ ...formData, ownerRole: e.target.value })}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-md">
              {Object.entries(CONDITION_OWNER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate} disabled={addLoading}
              className="px-3 py-1 text-xs font-medium text-white bg-brand hover:bg-brand-dark rounded-md disabled:opacity-50">
              {addLoading ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {localRows.length === 0 ? (
        <p className="text-sm text-gray-400">No conditions yet. Upload an approval or add manually.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                </th>
                <SortHeader field="conditionNumber" label="#" current={sortField} dir={sortDir} onClick={toggleSort} className="w-12" />
                <SortHeader field="title" label="Description" current={sortField} dir={sortDir} onClick={toggleSort} className="min-w-[200px]" />
                <SortHeader field="stage" label="Stage" current={sortField} dir={sortDir} onClick={toggleSort} className="w-32" />
                <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onClick={toggleSort} className="w-28" />
                <SortHeader field="ownerRole" label="Owner" current={sortField} dir={sortDir} onClick={toggleSort} className="w-24" />
                <th className="px-2 py-2 text-left text-gray-500 font-medium w-10">BLK</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const dirty = dirtyIds.has(row.id);
                return (
                  <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${dirty ? 'bg-amber-50/30' : ''} ${selected.has(row.id) ? 'bg-brand/5' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={selected.has(row.id)}
                        onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(row.id)) { n.delete(row.id); } else { n.add(row.id); } return n; })}
                        className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                    </td>
                    <td className="px-2 py-1.5 text-gray-400 font-mono">{row.conditionNumber || '—'}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-gray-700 line-clamp-2">{row.title}</span>
                      {row.source === 'approval' && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-400">auto</span>}
                    </td>
                    <td className="px-1 py-1.5">
                      <select value={row.stage} onChange={(e) => editCell(row.id, 'stage', e.target.value)} className={cellSelect}>
                        {Object.entries(CONDITION_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <select value={row.status} onChange={(e) => editCell(row.id, 'status', e.target.value)}
                        className={`${cellSelect} ${row.status === 'needed' ? 'text-amber-700' : row.status === 'received' ? 'text-blue-700' : row.status === 'cleared' ? 'text-green-700' : 'text-gray-500'}`}>
                        {Object.entries(CONDITION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <select value={row.ownerRole || 'mlo'} onChange={(e) => editCell(row.id, 'ownerRole', e.target.value)} className={cellSelect}>
                        {Object.entries(CONDITION_OWNER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={row.blockingProgress || false}
                        onChange={(e) => editCell(row.id, 'blockingProgress', e.target.checked)}
                        className="rounded border-gray-300 text-red-500 focus:ring-red-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Sortable Header ───
function SortHeader({ field, label, current, dir, onClick, className = '' }) {
  const active = current === field;
  return (
    <th className={`px-2 py-2 text-left text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700 ${className}`}
      onClick={() => onClick(field)}>
      {label}
      {active && <span className="ml-0.5 text-brand">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}
