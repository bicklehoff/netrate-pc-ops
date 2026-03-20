// CallNotes — Note-taking component for during/after calls
// Shows a text area + disposition selector
// Saves notes to the call log via API

'use client';

import { useState } from 'react';

const DISPOSITIONS = [
  { value: 'interested', label: 'Interested', color: 'bg-green-100 text-green-700' },
  { value: 'callback', label: 'Callback', color: 'bg-blue-100 text-blue-700' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-gray-100 text-gray-700' },
  { value: 'wrong_number', label: 'Wrong Number', color: 'bg-red-100 text-red-700' },
  { value: 'voicemail', label: 'Voicemail', color: 'bg-amber-100 text-amber-700' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-gray-100 text-gray-500' },
];

export default function CallNotes({ callLogId, onSaved }) {
  const [content, setContent] = useState('');
  const [disposition, setDisposition] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim() || !callLogId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/dialer/calls/${callLogId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), disposition }),
      });

      if (!res.ok) throw new Error('Failed to save note');

      setContent('');
      setDisposition(null);
      if (onSaved) onSaved();
    } catch (e) {
      console.error('Save note failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add call notes..."
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
      />

      {/* Disposition chips */}
      <div className="flex flex-wrap gap-1">
        {DISPOSITIONS.map((d) => (
          <button
            key={d.value}
            onClick={() => setDisposition(disposition === d.value ? null : d.value)}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
              disposition === d.value
                ? `${d.color} ring-2 ring-offset-1 ring-brand/30`
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={!content.trim() || saving}
        className="w-full py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : 'Save Note'}
      </button>
    </div>
  );
}
