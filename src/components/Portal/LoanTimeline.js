// Loan Timeline — Shows a chronological list of events on the loan

import { STATUS_LABELS } from '@/lib/loan-states';

const EVENT_ICONS = {
  status_change: '🔄',
  doc_requested: '📋',
  doc_uploaded: '📎',
  field_updated: '✏️',
  note_added: '💬',
  ssn_revealed: '🔓',
  xml_export: '📤',
};

function formatEventMessage(event) {
  switch (event.eventType) {
    case 'status_change':
      return `Status changed from ${STATUS_LABELS[event.oldValue] || event.oldValue} to ${STATUS_LABELS[event.newValue] || event.newValue}`;
    case 'doc_requested':
      return `Document requested: ${event.newValue || 'Unknown'}`;
    case 'doc_uploaded':
      return `Document uploaded: ${event.newValue || 'Unknown'}`;
    case 'note_added':
      return `Note: ${event.newValue || ''}`;
    default:
      return event.eventType.replace(/_/g, ' ');
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function LoanTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
        <p className="text-gray-400 text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>

      <div className="space-y-0">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-brand mt-2 shrink-0" />
              {index < events.length - 1 && (
                <div className="w-0.5 bg-gray-200 flex-1 min-h-[24px]" />
              )}
            </div>

            {/* Event content */}
            <div className="pb-4">
              <p className="text-sm text-gray-800">
                <span className="mr-1">{EVENT_ICONS[event.eventType] || '•'}</span>
                {formatEventMessage(event)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(event.createdAt)}
                {event.actorType && event.actorType !== 'system' && (
                  <span> · by {event.actorType}</span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
