// DocWorkspace — Intelligent document workspace for MLOs
// Replaces WorkDrivePanel. Shows submission checklist progress at top,
// FLOOR with identify/rename, folder tabs, and file move actions.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { isNamedDoc, isLockedDoc } from '@/lib/constants/doc-types';

const FOLDER_TABS = [
  { key: 'FLOOR', label: 'Floor', icon: '📥', desc: 'Unsorted / incoming docs' },
  { key: 'SUBMITTED', label: 'Submitted', icon: '📄', desc: 'Submitted to lender' },
  { key: 'EXTRA', label: 'Extra', icon: '📎', desc: 'Supporting docs' },
  { key: 'CLOSING', label: 'Closing', icon: '🏠', desc: 'Closing docs' },
];

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fileIcon(name) {
  if (!name) return '📄';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '📕';
  if (['png', 'jpg', 'jpeg'].includes(ext)) return '🖼️';
  return '📄';
}

export default function DocWorkspace({ loanId, onRefresh }) {
  const [activeTab, setActiveTab] = useState('FLOOR');
  const [allFiles, setAllFiles] = useState({ FLOOR: [], SUBMITTED: [], EXTRA: [], CLOSING: [] });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [hasWorkDrive, setHasWorkDrive] = useState(false);

  // CoreBot state
  const [identifying, setIdentifying] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processReport, setProcessReport] = useState(null);

  // File move state
  const [moving, setMoving] = useState(null);

  // Create folder state
  const [creatingFolder, setCreatingFolder] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loanId}/files`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();

      if (!data.hasWorkDrive) {
        setHasWorkDrive(false);
        setLoading(false);
        return;
      }

      setHasWorkDrive(true);
      setAllFiles({
        FLOOR: data.files?.FLOOR || [],
        SUBMITTED: data.files?.SUBMITTED || [],
        EXTRA: data.files?.EXTRA || [],
        CLOSING: data.files?.CLOSING || [],
      });
    } catch {
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ─── Handlers ────────────────────────────────────────────

  const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // Vercel serverless body limit

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    const errors = [];
    let uploaded = 0;
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max 4.5MB)`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', activeTab);
        try {
          const res = await fetch(`/api/portal/mlo/loans/${loanId}/files`, {
            method: 'PUT',
            body: formData,
          });
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { const data = await res.json(); msg = data.error || msg; } catch {}
            errors.push(`${file.name}: ${msg}`);
          } else {
            uploaded++;
          }
        } catch {
          errors.push(`${file.name}: network error`);
        }
      }
      if (errors.length > 0) {
        setError(`${uploaded} uploaded, ${errors.length} failed: ${errors.join('; ')}`);
      }
      await fetchFiles();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = (fileId) => {
    window.open(`/api/portal/mlo/loans/${loanId}/files?download=${fileId}`, '_blank');
  };

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      const res = await fetch(
        `/api/portal/mlo/loans/${loanId}/files?fileId=${fileId}&fileName=${encodeURIComponent(fileName)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      await fetchFiles();
    } catch {
      setError('Delete failed');
    }
  };

  const handleIdentify = async (fileId, fileName) => {
    setIdentifying(fileId);
    setSuggestion(null);
    setError('');
    try {
      const res = await fetch('/api/corebot/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, fileId, fileName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Identification failed');
        return;
      }
      setSuggestion({ fileId, ...data.result });
    } catch {
      setError('Identification failed');
    } finally {
      setIdentifying(null);
    }
  };

  const handleRename = async (fileId, newFileName) => {
    setRenaming(fileId);
    setError('');
    try {
      const res = await fetch('/api/corebot/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, fileId, newFileName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Rename failed');
        return;
      }
      setSuggestion(null);
      await fetchFiles();
    } catch {
      setError('Rename failed');
    } finally {
      setRenaming(null);
    }
  };

  const handleProcessDocs = async () => {
    setProcessing(true);
    setProcessReport(null);
    setError('');
    try {
      const res = await fetch('/api/corebot/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Processing failed');
        return;
      }
      setProcessReport(data.report);
      await fetchFiles();
      if (onRefresh) onRefresh();
    } catch {
      setError('CoreBot processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleMoveFile = async (fileId, fileName, targetFolder) => {
    setMoving(fileId);
    setError('');
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loanId}/files/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName, targetFolder }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Move failed');
        return;
      }
      await fetchFiles();
    } catch {
      setError('Move failed');
    } finally {
      setMoving(null);
    }
  };

  // ─── Checklist Progress ──────────────────────────────────

  const checklistStatus = processReport?.checklistStatus || null;
  const namedFloorFiles = (allFiles.FLOOR || []).filter((f) => isNamedDoc(f.name));
  const unnamedFloorFiles = (allFiles.FLOOR || []).filter((f) => !f.isFolder && !isNamedDoc(f.name));

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-40" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const handleCreateFolder = async () => {
    setCreatingFolder(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loanId}/files/create-folder`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create folder');
        setCreatingFolder(false);
        return;
      }
      setCreatingFolder(false);
      await fetchFiles();
    } catch {
      setError('Failed to create folder');
      setCreatingFolder(false);
    }
  };

  if (!hasWorkDrive) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Document Workspace</h2>
        <p className="text-sm text-gray-400 mb-4">
          No WorkDrive folder for this loan.
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        <button
          onClick={handleCreateFolder}
          disabled={creatingFolder}
          className="px-4 py-2 text-sm font-bold bg-go text-white rounded-lg hover:bg-go-dark transition-colors disabled:opacity-50"
        >
          {creatingFolder ? 'Creating folder...' : 'Create WorkDrive Folder'}
        </button>
      </div>
    );
  }

  const currentFiles = allFiles[activeTab] || [];

  return (
    <div className="space-y-4">
      {/* ─── CoreBot + Checklist Status ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">CoreBot</h3>
            <p className="text-xs text-gray-500">AI document processing — identify, rename, and organize</p>
          </div>
          <div className="flex items-center gap-2">
            {unnamedFloorFiles.length > 0 && (
              <span className="text-xs text-amber-600 font-medium">
                {unnamedFloorFiles.length} unprocessed
              </span>
            )}
            <button
              onClick={handleProcessDocs}
              disabled={processing}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                processing
                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {processing ? 'Processing...' : 'Process Docs'}
            </button>
          </div>
        </div>

        {/* Checklist progress bar */}
        {checklistStatus && (
          <div className="px-6 pb-4 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">
                Submission Checklist: {checklistStatus.received}/{checklistStatus.total}
              </span>
              <span className="text-xs text-gray-400">{checklistStatus.phase?.replace(/_/g, ' ')}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{
                  width: checklistStatus.total > 0
                    ? `${(checklistStatus.received / checklistStatus.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
            {checklistStatus.missing?.length > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                Missing: {checklistStatus.missing.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Processing report */}
        {processReport && (
          <div className="px-6 pb-4 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{processReport.processed}</div>
                <div className="text-xs text-gray-500">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{processReport.renamed}</div>
                <div className="text-xs text-gray-500">Renamed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{processReport.conditionsUpdated}</div>
                <div className="text-xs text-gray-500">Conditions</div>
              </div>
              {processReport.errors?.length > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-600">{processReport.errors.length}</div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
              )}
            </div>

            {processReport.documents?.length > 0 && (
              <div className="space-y-1.5">
                {processReport.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                      doc.prefix === 'LOCKED' ? 'bg-amber-500' :
                      doc.action === 'renamed' ? 'bg-green-500' :
                      doc.action === 'suggest' ? 'bg-blue-500' :
                      doc.action === 'flagged' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <span className="text-gray-500 truncate flex-1">{doc.originalName}</span>
                    {doc.newFileName && (
                      <>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-gray-800 truncate">{doc.newFileName}</span>
                      </>
                    )}
                    <span className="text-gray-400 flex-shrink-0">
                      {Math.round((doc.confidence || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setProcessReport(null)}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              Dismiss report
            </button>
          </div>
        )}
      </div>

      {/* ─── File Browser ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Loan Files</h2>
          <div className="flex items-center gap-2">
            {/* Submit to Lender — move all named FLOOR files to SUBMITTED */}
            {activeTab === 'FLOOR' && namedFloorFiles.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`Move ${namedFloorFiles.length} named file(s) from Floor to Submitted?`)) return;
                  setError('');
                  for (const file of namedFloorFiles) {
                    await handleMoveFile(file.id, file.name, 'SUBMITTED');
                  }
                }}
                disabled={moving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
              >
                📤 Submit to Lender ({namedFloorFiles.length})
              </button>
            )}
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-100 text-gray-400 pointer-events-none'
                : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
            }`}>
              {uploading ? 'Uploading...' : `📎 Upload to ${FOLDER_TABS.find(t => t.key === activeTab)?.label || activeTab}`}
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {FOLDER_TABS.map((tab) => {
            const count = (allFiles[tab.key] || []).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.key ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="text-xs text-red-500 hover:underline">Dismiss</button>
          </div>
        )}

        {/* Suggestion banner */}
        {suggestion && (
          <div className="mx-6 mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-900">
                  CoreBot suggests: <span className="font-mono">{suggestion.newFileName || 'Unknown'}</span>
                </p>
                <p className="text-xs text-purple-600 mt-0.5">
                  {suggestion.prefix}-{suggestion.subtype} — {Math.round((suggestion.confidence || 0) * 100)}% confidence
                  {suggestion.extractedData?.notes && ` — ${suggestion.extractedData.notes}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {suggestion.newFileName && (
                  <button
                    onClick={() => handleRename(suggestion.fileId, suggestion.newFileName)}
                    disabled={renaming === suggestion.fileId}
                    className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {renaming === suggestion.fileId ? 'Renaming...' : 'Apply'}
                  </button>
                )}
                <button
                  onClick={() => setSuggestion(null)}
                  className="px-3 py-1.5 text-xs text-purple-600 hover:text-purple-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="px-6 py-3 min-h-[120px]">
          {currentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <span className="text-3xl mb-2">📂</span>
              <p className="text-sm">No files in {activeTab}</p>
              <p className="text-xs mt-1">{FOLDER_TABS.find(t => t.key === activeTab)?.desc}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {currentFiles.map((file) => {
                const named = isNamedDoc(file.name);
                const locked = isLockedDoc(file.name);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between py-2.5 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0">{locked ? '🔒' : fileIcon(file.name)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                          {locked ? (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded border border-amber-200">
                              Locked
                            </span>
                          ) : named && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded border border-green-200">
                              Named
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {file.size && <span>{formatBytes(file.size)}</span>}
                          {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      {/* Identify (FLOOR only, unnamed files) */}
                      {activeTab === 'FLOOR' && !named && (
                        <button
                          onClick={() => handleIdentify(file.id, file.name)}
                          disabled={identifying === file.id}
                          className="px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50"
                          title="Identify with CoreBot AI"
                        >
                          {identifying === file.id ? '...' : 'Identify'}
                        </button>
                      )}
                      {/* Move to folder */}
                      {activeTab === 'FLOOR' && named && (
                        <button
                          onClick={() => handleMoveFile(file.id, file.name, 'SUBMITTED')}
                          disabled={moving === file.id}
                          className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
                          title="Move to Submitted"
                        >
                          {moving === file.id ? '...' : '📤 Submit'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(file.id)}
                        className="px-2.5 py-1.5 text-xs text-brand hover:bg-brand/10 rounded-lg transition-colors"
                        title="Download"
                      >
                        ⬇
                      </button>
                      <button
                        onClick={() => handleDelete(file.id, file.name)}
                        className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
