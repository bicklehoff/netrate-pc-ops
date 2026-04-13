// WorkDrive File Browser Panel
// Embedded file manager for loan folders — FLOOR, SUBMITTED, EXTRA, CLOSING tabs.
// Lists files, upload per-folder, download, delete. All via /api/portal/mlo/loans/:id/files.

'use client';

import { useState, useEffect, useCallback } from 'react';

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

export default function WorkDrivePanel({ loanId }) {
  const [activeTab, setActiveTab] = useState('FLOOR');
  const [allFiles, setAllFiles] = useState({ FLOOR: [], SUBMITTED: [], EXTRA: [], CLOSING: [] });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [hasWorkDrive, setHasWorkDrive] = useState(false);
  const [identifying, setIdentifying] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [renaming, setRenaming] = useState(null);

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

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', activeTab);
      const res = await fetch(`/api/portal/mlo/loans/${loanId}/files`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed');
        return;
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
    // Open the proxy download URL directly — API streams the file with proper auth
    window.open(`/api/portal/mlo/loans/${loanId}/files?download=${fileId}`, '_blank');
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

  if (loading) {
    return (
      <div className="bg-white rounded-nr-xl border border-gray-200 p-6 shadow-nr-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-40" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!hasWorkDrive) {
    return (
      <div className="bg-white rounded-nr-xl border border-gray-200 p-6 shadow-nr-sm">
        <h2 className="text-lg font-semibold text-ink mb-2">Loan Files</h2>
        <p className="text-sm text-ink-subtle">
          No WorkDrive folder for this loan. Folders are created automatically when a new application is submitted.
        </p>
      </div>
    );
  }

  const currentFiles = allFiles[activeTab] || [];

  return (
    <div className="bg-white rounded-nr-xl border border-gray-200 shadow-nr-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Loan Files</h2>
        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
          uploading
            ? 'bg-gray-100 text-ink-subtle pointer-events-none'
            : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
        }`}>
          {uploading ? 'Uploading...' : `📎 Upload to ${FOLDER_TABS.find(t => t.key === activeTab)?.label || activeTab}`}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
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
                  : 'border-transparent text-ink-subtle hover:text-ink-mid hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === tab.key ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-ink-subtle'
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
          <div className="flex flex-col items-center justify-center py-8 text-ink-subtle">
            <span className="text-3xl mb-2">📂</span>
            <p className="text-sm">No files in {activeTab}</p>
            <p className="text-xs mt-1">{FOLDER_TABS.find(t => t.key === activeTab)?.desc}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {currentFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between py-2.5 group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0">{fileIcon(file.name)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-ink-subtle">
                      {file.size && <span>{formatBytes(file.size)}</span>}
                      {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {activeTab === 'FLOOR' && (
                    <button
                      onClick={() => handleIdentify(file.id, file.name)}
                      disabled={identifying === file.id}
                      className="px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50"
                      title="Identify with CoreBot AI"
                    >
                      {identifying === file.id ? '...' : 'Identify'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(file.id)}
                    className="px-3 py-2 text-sm text-brand hover:bg-brand/10 rounded-lg transition-colors"
                    title="Download"
                  >
                    ⬇ Download
                  </button>
                  <button
                    onClick={() => handleDelete(file.id, file.name)}
                    className="p-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete file"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
