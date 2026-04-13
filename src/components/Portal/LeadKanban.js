// LeadKanban — Kanban board view for leads
// Drag-and-drop between columns to change status
// Each card shows: name, source badge, age, phone, quick actions

'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

const COLUMNS = [
  { key: 'new', label: 'New', color: 'border-blue-400', bg: 'bg-blue-50' },
  { key: 'contacted', label: 'Contacted', color: 'border-amber-400', bg: 'bg-amber-50' },
  { key: 'qualified', label: 'Qualified', color: 'border-green-400', bg: 'bg-green-50' },
  { key: 'quoted', label: 'Quoted', color: 'border-cyan-400', bg: 'bg-cyan-50' },
  { key: 'closed', label: 'Closed', color: 'border-gray-400', bg: 'bg-surface-alt' },
];

function daysAgo(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function ageColor(days) {
  if (days >= 14) return 'text-red-600 bg-red-50';
  if (days >= 7) return 'text-amber-600 bg-amber-50';
  return 'text-ink-subtle bg-gray-100';
}

export default function LeadKanban({ leads, onStatusChange }) {
  const [dragging, setDragging] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [updating, setUpdating] = useState(null);
  const dragRef = useRef(null);

  const updateStatus = async (leadId, newStatus) => {
    setUpdating(leadId);
    try {
      const res = await fetch(`/api/portal/mlo/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok && onStatusChange) onStatusChange();
    } catch {
      // Silently fail — will refresh
    } finally {
      setUpdating(null);
    }
  };

  const handleDragStart = (e, lead) => {
    setDragging(lead.id);
    dragRef.current = lead;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setDragOverCol(null);
    if (dragRef.current && dragRef.current.status !== colKey) {
      updateStatus(dragRef.current.id, colKey);
    }
    setDragging(null);
    dragRef.current = null;
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOverCol(null);
    dragRef.current = null;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
      {COLUMNS.map(col => {
        const colLeads = leads.filter(l => l.status === col.key);
        const isDragOver = dragOverCol === col.key;

        return (
          <div
            key={col.key}
            className={`flex-1 min-w-[240px] max-w-[320px] rounded-nr-xl border-t-4 ${col.color} bg-surface-alt/50 transition-colors ${
              isDragOver ? 'bg-brand/5 ring-2 ring-brand/20' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className="px-3 py-2 flex items-center justify-between">
              <h3 className="text-xs font-bold text-ink-subtle uppercase tracking-wider">{col.label}</h3>
              <span className="text-xs text-ink-subtle bg-white px-1.5 py-0.5 rounded">{colLeads.length}</span>
            </div>

            <div className="px-2 pb-2 space-y-2 max-h-[600px] overflow-y-auto">
              {colLeads.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-300">
                  {isDragOver ? 'Drop here' : 'No leads'}
                </div>
              )}
              {colLeads.map(lead => {
                const days = daysAgo(lead.created_at);
                const isDraggingThis = dragging === lead.id;
                const isUpdating = updating === lead.id;

                return (
                  <div
                    key={lead.id}
                    draggable={!isUpdating}
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-nr-sm hover:shadow transition-all ${
                      isDraggingThis ? 'opacity-40 scale-95' : ''
                    } ${isUpdating ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/portal/mlo/leads/${lead.id}`}
                        className="font-medium text-sm text-ink hover:text-brand truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.name || lead.first_name || 'Unknown'}
                      </Link>
                      {lead.is_warm && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex-shrink-0">
                          WARM
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-subtle">
                      {lead.source && (
                        <span className="truncate">{lead.source.replace(/_/g, ' ')}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ageColor(days)}`}>
                        {days === 0 ? 'Today' : `${days}d`}
                      </span>
                    </div>

                    {lead.loan_purpose && (
                      <div className="mt-1.5 text-xs text-ink-subtle capitalize">
                        {lead.loan_purpose.replace('_', ' ')}
                        {lead.loan_amount && ` — $${Number(lead.loan_amount).toLocaleString()}`}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="text-xs text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                          {lead.phone}
                        </a>
                      )}
                      {lead.contact && (
                        <Link
                          href={`/portal/mlo/contacts/${lead.contact.id || lead.contact_id}`}
                          className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded hover:bg-purple-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Contact
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
