// NotesActivitySection — Migrated from LoanDetailView right column
// Notes input + Activity timeline (loan events)

'use client';

import { useState } from 'react';
import SectionCard from '../SectionCard';
import { STATUS_LABELS } from '@/lib/constants/loan-statuses';

const EVENT_ICONS = {
  status_change: '🔄',
  doc_requested: '📋',
  doc_uploaded: '📎',
  doc_deleted: '🗑',
  cd_uploaded: '📕',
  payroll_sent: '💰',
  field_updated: '✏️',
  note_added: '💬',
  ssn_revealed: '🔓',
  xml_export: '📤',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEventMessage(event) {
  switch (event.event_type) {
    case 'status_change':
      return `Status: ${STATUS_LABELS[event.old_value] || event.old_value} → ${STATUS_LABELS[event.new_value] || event.new_value}`;
    case 'doc_requested':
      return `Document requested: ${event.new_value || 'Unknown'}`;
    case 'doc_uploaded':
      return `Document uploaded: ${event.new_value || 'Unknown'}`;
    case 'doc_deleted':
      return `Document deleted: ${event.new_value || 'Unknown'}`;
    case 'cd_uploaded':
      return `Closing Disclosure uploaded: ${event.new_value || 'Unknown'}`;
    case 'payroll_sent':
      return 'Sent to payroll for commission processing';
    case 'note_added':
      return `Note: ${event.new_value || ''}`;
    case 'ssn_revealed':
      return 'SSN was revealed (audited)';
    case 'xml_export':
      return 'MISMO XML exported';
    case 'field_updated': {
      const details = event.details;
      if (details?.field) return `Field updated: ${details.field}`;
      if (details?.fields) return `Fields updated: ${Object.keys(details.fields).join(', ')}`;
      return 'Field updated';
    }
    default:
      return event.event_type?.replace(/_/g, ' ') || 'Activity';
  }
}

export default function NotesActivitySection({ loan, updateLoanField }) {
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState('');

  const events = loan.events || [];

  const handleAddNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    setNoteLoading(true);
    setNoteError('');
    try {
      await updateLoanField({ note: trimmed });
      setNoteText('');
    } catch {
      setNoteError('Failed to add note');
    } finally {
      setNoteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Add Note ─── */}
      <SectionCard title="Add Note" icon="📝" defaultOpen={true}>
        {noteError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
            <p className="text-xs text-red-700">{noteError}</p>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && noteText.trim()) handleAddNote();
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={noteLoading || !noteText.trim()}
            className="px-4 py-2 bg-go text-white text-sm font-bold rounded-lg hover:bg-go-dark transition-colors disabled:opacity-50"
          >
            {noteLoading ? '...' : 'Add'}
          </button>
        </div>
      </SectionCard>

      {/* ─── Activity Timeline ─── */}
      <SectionCard title="Activity" icon="📜" badge={events.length > 0 ? `${events.length}` : null} defaultOpen={true}>
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm">No activity yet.</p>
        ) : (
          <div className="space-y-0">
            {events.map((event, index) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand mt-2 shrink-0" />
                  {index < events.length - 1 && (
                    <div className="w-0.5 bg-gray-200 flex-1 min-h-[24px]" />
                  )}
                </div>
                <div className="pb-4">
                  <p className="text-sm text-gray-800">
                    <span className="mr-1">{EVENT_ICONS[event.event_type] || '•'}</span>
                    {formatEventMessage(event)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(event.created_at)}
                    {event.actor_type && (
                      <span> · {event.actor_type}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
