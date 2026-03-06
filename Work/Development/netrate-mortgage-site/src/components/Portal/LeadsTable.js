// Leads Table — Lead list for MLO dashboard
// Shows name, email, phone, source, status, and quick-action status buttons

'use client';

import { useState } from 'react';

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  closed: 'Closed',
};

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-cyan-100 text-cyan-800',
  closed: 'bg-gray-100 text-gray-600',
};

const NEXT_STATUS = {
  new: 'contacted',
  contacted: 'qualified',
  qualified: 'converted',
};

const SOURCE_LABELS = {
  homepage_rate_table: 'Homepage',
  rate_tool: 'Rate Tool',
  contact_form: 'Contact',
  website: 'Website',
};

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LeadsTable({ leads, onStatusChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const handleStatusClick = async (e, lead) => {
    e.stopPropagation();
    const nextStatus = NEXT_STATUS[lead.status];
    if (!nextStatus) return;

    try {
      const res = await fetch(`/api/portal/mlo/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok && onStatusChange) {
        onStatusChange();
      }
    } catch {
      // silently fail
    }
  };

  const handleAddNote = async (leadId) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/portal/mlo/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText('');
        if (onStatusChange) onStatusChange();
      }
    } catch {
      // silently fail
    } finally {
      setSavingNote(false);
    }
  };

  const handleClose = async (e, lead) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/portal/mlo/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      if (res.ok && onStatusChange) {
        onStatusChange();
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Contact
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Source
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Received
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  <span className="font-medium text-gray-900">{lead.name}</span>
                  {lead.sourceDetail && (
                    <span className="block text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                      {lead.sourceDetail}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <a href={`mailto:${lead.email}`} className="text-brand hover:text-brand-dark text-sm">
                    {lead.email}
                  </a>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="block text-xs text-gray-500 mt-0.5 hover:text-gray-700">
                      {lead.phone}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-600 text-sm">
                    {SOURCE_LABELS[lead.source] || lead.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-gray-400">{timeAgo(lead.createdAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {NEXT_STATUS[lead.status] && (
                      <button
                        onClick={(e) => handleStatusClick(e, lead)}
                        className="text-xs font-medium text-brand hover:text-brand-dark transition-colors"
                        title={`Mark as ${STATUS_LABELS[NEXT_STATUS[lead.status]]}`}
                      >
                        {STATUS_LABELS[NEXT_STATUS[lead.status]]} &rarr;
                      </button>
                    )}
                    {lead.status !== 'closed' && lead.status !== 'converted' && (
                      <button
                        onClick={(e) => handleClose(e, lead)}
                        className="text-xs text-gray-400 hover:text-red-600 transition-colors ml-2"
                        title="Close lead"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded detail panel */}
      {expandedId && (() => {
        const lead = leads.find((l) => l.id === expandedId);
        if (!lead) return null;
        return (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Details</h4>
                <p className="text-sm text-gray-700"><strong>Name:</strong> {lead.name}</p>
                <p className="text-sm text-gray-700"><strong>Email:</strong> {lead.email}</p>
                {lead.phone && <p className="text-sm text-gray-700"><strong>Phone:</strong> {lead.phone}</p>}
                <p className="text-sm text-gray-700"><strong>Source:</strong> {SOURCE_LABELS[lead.source] || lead.source}</p>
                {lead.sourceDetail && <p className="text-sm text-gray-700"><strong>Rate:</strong> {lead.sourceDetail}</p>}
                {lead.utmSource && (
                  <p className="text-sm text-gray-500 mt-1">
                    UTM: {lead.utmSource}/{lead.utmMedium}/{lead.utmCampaign}
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                {lead.message ? (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded p-3 max-h-40 overflow-y-auto">
                    {lead.message}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-400">No notes yet.</p>
                )}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(lead.id); }}
                    className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-brand"
                  />
                  <button
                    onClick={() => handleAddNote(lead.id)}
                    disabled={savingNote || !noteText.trim()}
                    className="bg-brand text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
                  >
                    {savingNote ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
