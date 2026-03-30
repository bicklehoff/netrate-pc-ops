// ConditionsSection — Full conditions management for loan detail
// Grouped by stage, with add/edit/status-change actions
'use client';

import { useState, useCallback, useRef } from 'react';
import SectionCard from '../SectionCard';
import {
  CONDITION_STAGE_ORDER,
  CONDITION_STAGE_LABELS,
  CONDITION_STATUS_COLORS,
  CONDITION_STATUS_DOTS,
  CONDITION_STATUS_LABELS,
  CONDITION_TYPE_LABELS,
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
  dueDate: '',
};

export default function ConditionsSection({ loan, onRefresh }) {
  const conditions = loan.conditions || [];
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState(null); // { document, extraction }
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);

  // Approval documents — filter from loan.documents, newest first
  const approvals = (loan.documents || [])
    .filter((d) => d.docType === 'approval')
    .sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt));

  // Counts
  const needed = conditions.filter((c) => c.status === 'needed').length;
  const received = conditions.filter((c) => c.status === 'received').length;
  const cleared = conditions.filter((c) => c.status === 'cleared' || c.status === 'waived').length;

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

      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/conditions`, {
        method: 'PUT',
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const result = await res.json();

      if (result.extraction?.status === 'error') {
        setError(`Extraction failed: ${result.extraction.error}`);
        onRefresh(); // Still refresh to show the uploaded doc
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

  // ─── Quick status change ───
  const updateStatus = async (conditionId, newStatus) => {
    setLoading(true);
    setError('');
    try {
      await apiCall('PATCH', { conditionId, status: newStatus });
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Create condition ───
  const handleCreate = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiCall('POST', formData);
      setShowAddForm(false);
      setFormData(EMPTY_FORM);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Edit condition ───
  const startEdit = (cond) => {
    setEditingId(cond.id);
    setFormData({
      conditionNumber: cond.conditionNumber || '',
      title: cond.title,
      description: cond.description || '',
      conditionType: cond.conditionType,
      stage: cond.stage,
      ownerRole: cond.ownerRole || 'mlo',
      borrowerFacing: cond.borrowerFacing,
      blockingProgress: cond.blockingProgress,
      dueDate: cond.dueDate ? cond.dueDate.split('T')[0] : '',
    });
    setShowAddForm(false);
  };

  const handleUpdate = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiCall('PATCH', { conditionId: editingId, ...formData });
      setEditingId(null);
      setFormData(EMPTY_FORM);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError('');
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
                    <span className="text-sm text-gray-700 truncate block">{doc.fileName || doc.label}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString('en-US', {
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

      {/* ─── Conditions ─── */}
      <SectionCard
        title="Conditions"
        icon="📋"
        badge={conditions.length > 0 ? `${conditions.length}` : null}
        defaultOpen={true}
        actions={
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); setFormData(EMPTY_FORM); }}
            className="px-3 py-1.5 text-xs font-medium text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 rounded-lg transition-colors"
          >
            + Add Condition
          </button>
        }
      >
        {/* Summary bar */}
        {conditions.length > 0 && (
          <div className="flex items-center gap-5 mb-4 pb-3 border-b border-gray-100">
            <SummaryPill color="bg-amber-400" label="Needed" count={needed} />
            <SummaryPill color="bg-blue-400" label="Received" count={received} />
            <SummaryPill color="bg-green-400" label="Cleared" count={cleared} />
            <span className="text-xs text-gray-400 ml-auto">{conditions.length} total</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex justify-between items-center">
            {error}
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">x</button>
          </div>
        )}

        {/* Add/Edit form */}
        {(showAddForm || editingId) && (
          <ConditionForm
            formData={formData}
            setFormData={setFormData}
            onSave={editingId ? handleUpdate : handleCreate}
            onCancel={cancelForm}
            loading={loading}
            isEdit={!!editingId}
          />
        )}

        {/* Conditions grouped by stage */}
        {conditions.length === 0 && !showAddForm ? (
          <p className="text-sm text-gray-400">No conditions tracked yet. Add conditions from the approval package.</p>
        ) : (
          <div className="space-y-5">
            {CONDITION_STAGE_ORDER.map((stageKey) => {
              const stageConds = conditions.filter((c) => c.stage === stageKey);
              if (stageConds.length === 0) return null;

              const stageCleared = stageConds.filter((c) => c.status === 'cleared' || c.status === 'waived').length;

              return (
                <div key={stageKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {CONDITION_STAGE_LABELS[stageKey] || stageKey}
                    </h4>
                    <span className="text-[10px] text-gray-400">
                      {stageCleared}/{stageConds.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {stageConds.map((cond) => (
                      <ConditionRow
                        key={cond.id}
                        cond={cond}
                        onStatusChange={updateStatus}
                        onEdit={startEdit}
                        loading={loading}
                        isEditing={editingId === cond.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
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

// ─── Condition Row ───
function ConditionRow({ cond, onStatusChange, onEdit, loading, isEditing }) {
  const isOverdue = cond.dueDate && new Date(cond.dueDate) < new Date() && cond.status === 'needed';

  return (
    <div className={`flex items-start justify-between py-2 px-3 rounded-lg transition-colors group ${
      isEditing ? 'bg-brand/5 ring-1 ring-brand/20' : 'hover:bg-gray-50'
    }`}>
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
          CONDITION_STATUS_DOTS[cond.status] || 'bg-gray-400'
        }`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {cond.conditionNumber && (
              <span className="text-xs text-gray-400 font-mono">#{cond.conditionNumber}</span>
            )}
            <span className="text-sm text-gray-700">{cond.title}</span>
            {cond.ownerRole && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                {CONDITION_OWNER_LABELS[cond.ownerRole] || cond.ownerRole}
              </span>
            )}
            {cond.source === 'approval' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500 font-medium">auto</span>
            )}
          </div>
          {cond.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{cond.description}</p>
          )}
          {isOverdue && (
            <span className="text-[10px] text-red-500 font-medium">Overdue — due {new Date(cond.dueDate).toLocaleDateString()}</span>
          )}
          {cond.dueDate && !isOverdue && cond.status === 'needed' && (
            <span className="text-[10px] text-gray-400">Due {new Date(cond.dueDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {cond.blockingProgress && (
          <span className="text-[10px] text-red-500 font-semibold px-1.5 py-0.5 bg-red-50 rounded">BLOCKING</span>
        )}

        {/* Status badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
          CONDITION_STATUS_COLORS[cond.status] || 'bg-gray-100 text-gray-600'
        }`}>
          {CONDITION_STATUS_LABELS[cond.status] || cond.status}
        </span>

        {/* Quick actions — show on hover */}
        <div className="hidden group-hover:flex items-center gap-1">
          {cond.status === 'needed' && (
            <>
              <QuickBtn label="Received" onClick={() => onStatusChange(cond.id, 'received')} disabled={loading} />
              <QuickBtn label="Waive" onClick={() => onStatusChange(cond.id, 'waived')} disabled={loading} muted />
            </>
          )}
          {cond.status === 'received' && (
            <QuickBtn label="Clear" onClick={() => onStatusChange(cond.id, 'cleared')} disabled={loading} />
          )}
          <button
            onClick={() => onEdit(cond)}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action Button ───
function QuickBtn({ label, onClick, disabled, muted }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
        muted
          ? 'text-gray-500 bg-gray-100 hover:bg-gray-200'
          : 'text-brand bg-brand/10 hover:bg-brand/20'
      } disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

// ─── Condition Form (Add / Edit) ───
function ConditionForm({ formData, setFormData, onSave, onCancel, loading, isEdit }) {
  const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">{isEdit ? 'Edit Condition' : 'Add Condition'}</h4>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Condition #</label>
          <input
            type="number"
            value={formData.conditionNumber}
            onChange={(e) => update('conditionNumber', e.target.value)}
            placeholder="100"
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand"
          />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Provide current year tax cert"
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-gray-500 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand resize-none"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Type</label>
          <select
            value={formData.conditionType}
            onChange={(e) => update('conditionType', e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand"
          >
            {Object.entries(CONDITION_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Stage</label>
          <select
            value={formData.stage}
            onChange={(e) => update('stage', e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand"
          >
            {Object.entries(CONDITION_STAGE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Owner</label>
          <select
            value={formData.ownerRole}
            onChange={(e) => update('ownerRole', e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand"
          >
            {Object.entries(CONDITION_OWNER_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Due Date</label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => update('dueDate', e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-brand/30 focus:border-brand"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.borrowerFacing}
            onChange={(e) => update('borrowerFacing', e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand/30"
          />
          <span className="text-xs text-gray-600">Borrower Visible</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.blockingProgress}
            onChange={(e) => update('blockingProgress', e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand/30"
          />
          <span className="text-xs text-gray-600">Blocking Progress</span>
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={loading}
          className="px-4 py-1.5 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Condition'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
