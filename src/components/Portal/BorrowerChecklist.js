// BorrowerChecklist — Simple borrower-facing checklist
// Shows what's needed (upload button) and what's been received (green check).
// Fetches from /api/portal/loans/:id/checklist

'use client';

import { useState, useEffect, useCallback } from 'react';

export default function BorrowerChecklist({ loan }) {
  const [checklist, setChecklist] = useState([]);
  const [summary, setSummary] = useState({ total: 0, needed: 0, received: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');

  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/loans/${loan.id}/checklist`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChecklist(data.checklist || []);
      setSummary(data.summary || { total: 0, needed: 0, received: 0 });
    } catch {
      setError('Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }, [loan.id]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handleUpload = async (itemId, file) => {
    setUploading(itemId);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (itemId) formData.append('documentId', itemId);

      const res = await fetch(`/api/portal/loans/${loan.id}/docs`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed');
        return;
      }
      await fetchChecklist();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-48" />
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-12 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const neededItems = checklist.filter((i) => i.status === 'needed');
  const receivedItems = checklist.filter((i) => i.status === 'received');
  const progressPercent = summary.total > 0 ? Math.round((summary.received / summary.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Document Checklist</h2>
      <p className="text-sm text-gray-500 mb-4">
        {summary.needed > 0
          ? `${summary.needed} item${summary.needed !== 1 ? 's' : ''} still needed`
          : 'All documents received!'}
      </p>

      {/* Progress bar */}
      {summary.total > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">
              {summary.received} of {summary.total} received
            </span>
            <span className="text-xs font-medium text-gray-500">{progressPercent}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100 ? 'bg-green-500' : 'bg-brand'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-4">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {checklist.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents requested yet. We&apos;ll let you know when we need anything.</p>
      ) : (
        <div className="space-y-4">
          {/* Still Needed */}
          {neededItems.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                Still Needed
              </h3>
              <div className="space-y-2">
                {neededItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-200 text-amber-700 text-xs flex-shrink-0">
                        !
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                        )}
                        {item.rejectedReason && (
                          <p className="text-xs text-red-600 mt-0.5">{item.rejectedReason}</p>
                        )}
                      </div>
                    </div>
                    {item.canUpload && (
                      <label className="cursor-pointer flex-shrink-0 ml-3">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUpload(item.id, e.target.files[0]);
                            }
                          }}
                          disabled={uploading === item.id}
                        />
                        <span className="inline-flex items-center px-3 py-1.5 bg-go text-white text-xs font-bold rounded-lg hover:bg-go-dark transition-colors">
                          {uploading === item.id ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Received */}
          {receivedItems.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">
                Received
              </h3>
              <div className="space-y-1.5">
                {receivedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-200 text-green-700 text-xs flex-shrink-0">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700">{item.label}</p>
                      {item.fileName && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.fileName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* General upload */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleUpload(null, e.target.files[0]);
              }
            }}
            disabled={uploading === 'general'}
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {uploading === 'general' ? 'Uploading...' : 'Upload additional document'}
          </span>
        </label>
        <p className="text-xs text-gray-400 mt-1">PDF, PNG, or JPG accepted</p>
      </div>
    </div>
  );
}
