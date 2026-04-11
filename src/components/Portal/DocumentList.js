// Document List — Shows requested and uploaded documents with upload functionality

'use client';

import { useState } from 'react';

const DOC_STATUS_LABELS = {
  requested: 'Requested',
  uploaded: 'Uploaded',
  reviewed: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Needs Resubmission',
};

const DOC_STATUS_COLORS = {
  requested: 'bg-amber-100 text-amber-800',
  uploaded: 'bg-blue-100 text-blue-800',
  reviewed: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function DocumentList({ loan }) {
  const [uploading, setUploading] = useState(null); // documentId being uploaded
  const [uploadError, setUploadError] = useState('');

  const documents = loan.documents || [];
  const requestedDocs = documents.filter((d) => d.status === 'requested');
  const uploadedDocs = documents.filter((d) => d.status !== 'requested');

  const handleUpload = async (documentId, file) => {
    setUploading(documentId || 'new');
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);
    if (documentId) {
      formData.append('documentId', documentId);
    }

    try {
      const res = await fetch(`/api/portal/loans/${loan.id}/docs`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || 'Upload failed');
        return;
      }

      // Refresh the page to show updated document list
      window.location.reload();
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>

      {documents.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents requested yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Requested Documents (need upload) */}
          {requestedDocs.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                Needs Upload
              </h3>
              {requestedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{doc.label}</span>
                    {doc.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{doc.notes}</p>
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleUpload(doc.id, e.target.files[0]);
                        }
                      }}
                      disabled={uploading === doc.id}
                    />
                    <span className="inline-flex items-center px-3 py-1.5 bg-go text-white text-xs font-bold rounded-lg hover:bg-go-dark transition-colors">
                      {uploading === doc.id ? 'Uploading...' : 'Upload'}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Uploaded / Processed Documents */}
          {uploadedDocs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Submitted
              </h3>
              {uploadedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{doc.label}</span>
                    {doc.fileName && (
                      <p className="text-xs text-gray-400 mt-0.5">{doc.fileName}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-600'}`}>
                    {DOC_STATUS_LABELS[doc.status] || doc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* General Upload (borrower-initiated) */}
      <div className="mt-4 pt-4 border-t border-gray-100">
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
            disabled={uploading === 'new'}
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {uploading === 'new' ? 'Uploading...' : 'Upload additional document'}
          </span>
        </label>
        <p className="text-xs text-gray-400 mt-1">PDF, PNG, or JPG — 10 MB max</p>
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 mt-2">{uploadError}</p>
      )}
    </div>
  );
}
