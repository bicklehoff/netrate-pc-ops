// ContactCard — Inline contact detail panel for the PhonePanel.
// Shows contact info, loan summary, activity timeline, and quick actions.
// Editable inline — no page navigation needed.

'use client';

import { useState, useEffect, useCallback } from 'react';

export default function ContactCard({ contact, onUpdate }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch full contact detail (includes loans, activity)
  const fetchDetail = useCallback(async () => {
    if (!contact?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dialer/contacts/${contact.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data.contact || data);
      }
    } catch (e) {
      console.error('Failed to fetch contact detail:', e);
    } finally {
      setLoading(false);
    }
  }, [contact?.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({
      first_name: detail?.first_name || '',
      last_name: detail?.last_name || '',
      email: detail?.email || '',
      phone: detail?.phone || '',
      company: detail?.company || '',
      tags: (detail?.tags || []).join(', '),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/dialer/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          tags: editData.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDetail(prev => ({ ...prev, ...data.contact }));
        if (onUpdate) onUpdate({ ...contact, ...data.contact });
        setIsEditing(false);
      }
    } catch (e) {
      console.error('Failed to save contact:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${contact.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText }),
      });
      if (res.ok) {
        setNoteText('');
        fetchDetail(); // Refresh to get new note in timeline
      }
    } catch (e) {
      console.error('Failed to add note:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLead = async () => {
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${contact.id}/create-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        fetchDetail();
      }
    } catch (e) {
      console.error('Failed to create lead:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-4 text-center text-xs text-gray-400">
        Contact not found
      </div>
    );
  }

  const loans = detail.borrower?.loans || [];
  const recentActivity = [
    ...(detail.callLogs || []).slice(0, 5).map(c => ({
      type: 'call',
      title: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} call${c.duration ? ` · ${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}` : ''}`,
      desc: c.notes?.[0]?.content || '',
      time: c.started_at,
    })),
    ...(detail.smsMessages || []).slice(0, 5).map(m => ({
      type: 'sms',
      title: m.direction === 'inbound' ? 'SMS Received' : 'SMS Sent',
      desc: m.body?.slice(0, 80) || '',
      time: m.sent_at,
    })),
    ...(detail.contactNotes || []).slice(0, 5).map(n => ({
      type: 'note',
      title: 'Note',
      desc: n.content?.slice(0, 80) || '',
      time: n.created_at,
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

  return (
    <div className="divide-y divide-gray-100">
      {/* Contact Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Contact Info</h4>
          <div className="flex gap-1">
            {!isEditing ? (
              <button
                onClick={handleEdit}
                className="text-[10px] text-brand font-medium hover:underline"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="text-[10px] text-gray-400 hover:underline">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="text-[10px] text-brand font-medium hover:underline">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-brand focus:outline-none"
                value={editData.first_name}
                onChange={e => setEditData(d => ({ ...d, first_name: e.target.value }))}
                placeholder="First name"
              />
              <input
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-brand focus:outline-none"
                value={editData.last_name}
                onChange={e => setEditData(d => ({ ...d, last_name: e.target.value }))}
                placeholder="Last name"
              />
            </div>
            <input
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-brand focus:outline-none"
              value={editData.phone}
              onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))}
              placeholder="Phone"
            />
            <input
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-brand focus:outline-none"
              value={editData.email}
              onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
              placeholder="Email"
            />
            <input
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-brand focus:outline-none"
              value={editData.company}
              onChange={e => setEditData(d => ({ ...d, company: e.target.value }))}
              placeholder="Company"
            />
            <input
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-brand focus:outline-none"
              value={editData.tags}
              onChange={e => setEditData(d => ({ ...d, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-[10px] text-gray-400">Phone</div>
                <div className="text-xs font-medium">{detail.phone || '—'}</div>
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-gray-400">Email</div>
                <div className="text-xs font-medium truncate">{detail.email || '—'}</div>
              </div>
            </div>
            {detail.company && (
              <div>
                <div className="text-[10px] text-gray-400">Company</div>
                <div className="text-xs font-medium">{detail.company}</div>
              </div>
            )}
            {detail.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {detail.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loans */}
      {loans.length > 0 && (
        <div className="p-4">
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Loans</h4>
          <div className="space-y-2">
            {loans.slice(0, 3).map(loan => (
              <div key={loan.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">
                    {loan.loan_type || 'Loan'} · {loan.status}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {loan.loan_amount ? `$${Number(loan.loan_amount).toLocaleString()}` : ''}
                    {loan.lender_name ? ` · ${loan.lender_name}` : ''}
                  </div>
                </div>
                <a
                  href={`/portal/mlo/loans/${loan.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-brand hover:underline flex-shrink-0"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!detail.borrower?.leads?.length && (
        <div className="px-4 py-2">
          <button
            onClick={handleCreateLead}
            className="w-full py-1.5 text-xs font-medium text-brand bg-brand/5 rounded-lg hover:bg-brand/10 transition-colors"
          >
            + Create Lead
          </button>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="p-4">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h4>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  item.type === 'call' ? 'bg-blue-100 text-blue-600' :
                  item.type === 'sms' ? 'bg-teal-50 text-brand' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {item.type === 'call' ? 'C' : item.type === 'sms' ? 'S' : 'N'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold">{item.title}</div>
                  {item.desc && <div className="text-[10px] text-gray-500 truncate">{item.desc}</div>}
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    {item.time ? new Date(item.time).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    }) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-400 text-center py-4">No activity yet</p>
        )}
      </div>

      {/* Add note */}
      <div className="p-3 bg-gray-50/80 flex gap-2">
        <input
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-brand focus:outline-none bg-white"
          placeholder="Add a note..."
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
        />
        <button
          onClick={handleAddNote}
          disabled={!noteText.trim() || saving}
          className="px-3 py-1.5 bg-go text-white text-xs font-bold rounded-lg hover:bg-go-dark disabled:opacity-50 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
