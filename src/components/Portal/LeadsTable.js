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
  closed: 'bg-gray-100 text-ink-mid',
};

const NEXT_STATUS = {
  new: 'contacted',
  contacted: 'qualified',
  qualified: 'converted',
};

const SOURCE_LABELS = {
  homepage_rate_table: 'Homepage',
  rate_tool: 'Rate Tool',
  contact_form: 'Contact Form',
  contact: 'From Contact',
  website: 'Website',
  zoho: 'Zoho Import',
  icanbuy: 'ICanBuy',
  mcr: 'MCR',
  rate_update: 'Rate Update',
  referral: 'Referral',
  realtor_referral: 'Realtor',
  qed: 'QED',
  chat: 'Chat',
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
    <div className="bg-white rounded-nr-xl border border-gray-200 shadow-nr-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-surface-alt/50">
              <th className="text-left px-4 py-3 font-medium text-ink-subtle text-xs uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-ink-subtle text-xs uppercase tracking-wider">
                Contact
              </th>
              <th className="text-left px-4 py-3 font-medium text-ink-subtle text-xs uppercase tracking-wider">
                Source
              </th>
              <th className="text-left px-4 py-3 font-medium text-ink-subtle text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 font-medium text-ink-subtle text-xs uppercase tracking-wider">
                Received
              </th>
              <th className="text-right px-4 py-3 font-medium text-ink-subtle text-xs uppercase tracking-wider">
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
                  <a href={`/portal/mlo/leads/${lead.id}`} className="font-medium text-ink hover:text-brand" onClick={e => e.stopPropagation()}>{lead.name}</a>
                  {lead.source_detail && (
                    <span className="block text-xs text-ink-subtle mt-0.5 truncate max-w-[200px]">
                      {lead.source_detail}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <a href={`mailto:${lead.email}`} className="text-brand hover:text-brand-dark text-sm">
                    {lead.email}
                  </a>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="block text-xs text-ink-subtle mt-0.5 hover:text-ink-mid">
                      {lead.phone}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {lead.is_warm && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Warm</span>
                    )}
                    <span className="text-ink-mid text-sm">
                      {SOURCE_LABELS[lead.source] || lead.source}
                    </span>
                  </div>
                  {lead.contact && (
                    <a
                      href={`/portal/mlo/contacts/${lead.contact.id}`}
                      className="text-[11px] text-brand hover:underline mt-0.5 block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.contact.first_name} {lead.contact.last_name}
                      {lead.contact.status === 'past_client' && ' (returning)'}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[lead.status] || 'bg-gray-100 text-ink-mid'
                    }`}
                  >
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-ink-subtle">{timeAgo(lead.created_at)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {lead.status !== 'converted' && lead.status !== 'closed' && (
                      <a
                        href={`/portal/mlo/leads/${lead.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-300 px-2 py-0.5 rounded transition-colors"
                        title="Convert to Loan"
                      >
                        Convert
                      </a>
                    )}
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
                        className="text-xs text-ink-subtle hover:text-red-600 transition-colors ml-1"
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
          <div className="border-t border-gray-200 bg-surface-alt px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-2">Details</h4>
                <p className="text-sm text-ink-mid"><strong>Name:</strong> {lead.name}</p>
                <p className="text-sm text-ink-mid"><strong>Email:</strong> {lead.email}</p>
                {lead.phone && <p className="text-sm text-ink-mid"><strong>Phone:</strong> {lead.phone}</p>}
                <p className="text-sm text-ink-mid"><strong>Source:</strong> {SOURCE_LABELS[lead.source] || lead.source}</p>
                {lead.source_detail && <p className="text-sm text-ink-mid"><strong>Rate:</strong> {lead.source_detail}</p>}
                {lead.utm_source && (
                  <p className="text-sm text-ink-subtle mt-1">
                    UTM: {lead.utm_source}/{lead.utm_medium}/{lead.utm_campaign}
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-2">Notes</h4>
                {lead.message ? (
                  <pre className="text-sm text-ink-mid whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded p-3 max-h-40 overflow-y-auto">
                    {lead.message}
                  </pre>
                ) : (
                  <p className="text-sm text-ink-subtle">No notes yet.</p>
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
                    className="bg-go text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-go-dark transition-colors disabled:opacity-50"
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
