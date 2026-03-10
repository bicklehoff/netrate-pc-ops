// ProcessingSection — Processing checklist from LoanDates + conditions list
// Each processing task card shows dates from LoanDates model.
// Dates are click-to-edit. Checkmark when non-null. Warning icon within 30 days of expiry.
// Conditions grouped by stage (Prior to Docs / Prior to Funding / At Closing)

'use client';

import { useState } from 'react';
import SectionCard from '../SectionCard';

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (d - now) / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= 30;
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// Processing task definitions — each maps to LoanDates fields
const PROCESSING_TASKS = [
  {
    key: 'credit',
    label: 'Credit',
    icon: '📊',
    dateFields: [
      { key: 'creditPulledDate', label: 'Pulled' },
      { key: 'creditExpiration', label: 'Expires', isExpiry: true },
    ],
  },
  {
    key: 'appraisal',
    label: 'Appraisal',
    icon: '🏠',
    dateFields: [
      { key: 'appraisalOrdered', label: 'Ordered' },
      { key: 'appraisalScheduled', label: 'Scheduled' },
      { key: 'appraisalReceived', label: 'Received' },
      { key: 'appraisalDue', label: 'Due', isExpiry: true },
      { key: 'appraisalExpiry', label: 'Expires', isExpiry: true },
    ],
    toggleField: 'appraisalWaiver',
    toggleLabel: 'Waiver',
  },
  {
    key: 'title',
    label: 'Title',
    icon: '📜',
    dateFields: [
      { key: 'titleOrdered', label: 'Ordered' },
      { key: 'titleReceived', label: 'Received' },
      { key: 'titleExpiry', label: 'Expires', isExpiry: true },
    ],
  },
  {
    key: 'flood',
    label: 'Flood Cert',
    icon: '🌊',
    dateFields: [
      { key: 'floodCertOrdered', label: 'Ordered' },
      { key: 'floodCertReceived', label: 'Received' },
    ],
  },
  {
    key: 'hoi',
    label: 'Homeowners Insurance',
    icon: '🛡️',
    dateFields: [
      { key: 'hoiOrdered', label: 'Ordered' },
      { key: 'hoiReceived', label: 'Received' },
      { key: 'hoiBound', label: 'Bound' },
    ],
  },
];

const CONDITION_STAGES = [
  { key: 'prior_to_docs', label: 'Prior to Docs' },
  { key: 'prior_to_funding', label: 'Prior to Funding' },
  { key: 'at_closing', label: 'At Closing' },
];

const CONDITION_STATUS_COLORS = {
  needed: 'bg-amber-100 text-amber-700',
  received: 'bg-blue-100 text-blue-700',
  cleared: 'bg-green-100 text-green-700',
  waived: 'bg-gray-100 text-gray-600',
};

export default function ProcessingSection({ loan, updateDates }) {
  const dates = loan.dates || {};
  const conditions = loan.conditions || [];

  return (
    <div className="space-y-6">
      {/* ─── Processing Task Cards ─── */}
      <SectionCard title="Processing Checklist" icon="⚙️" defaultOpen={true}>
        <div className="space-y-4">
          {PROCESSING_TASKS.map((task) => (
            <ProcessingTaskCard
              key={task.key}
              task={task}
              dates={dates}
              onUpdateDate={updateDates}
            />
          ))}
        </div>
      </SectionCard>

      {/* ─── Conditions ─── */}
      <SectionCard
        title="Conditions"
        icon="📋"
        badge={conditions.length > 0 ? `${conditions.length}` : null}
        defaultOpen={true}
      >
        {conditions.length === 0 ? (
          <p className="text-sm text-gray-400">No conditions tracked yet.</p>
        ) : (
          <div className="space-y-6">
            {CONDITION_STAGES.map((stage) => {
              const stageConds = conditions.filter((c) => c.stage === stage.key);
              if (stageConds.length === 0) return null;

              return (
                <div key={stage.key}>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {stage.label}
                  </h4>
                  <div className="space-y-1.5">
                    {stageConds.map((cond) => (
                      <div
                        key={cond.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            cond.status === 'needed' ? 'bg-amber-400' :
                            cond.status === 'cleared' || cond.status === 'waived' ? 'bg-green-400' :
                            'bg-blue-400'
                          }`} />
                          <div>
                            <span className="text-sm text-gray-700">{cond.title}</span>
                            {cond.description && (
                              <span className="block text-xs text-gray-400">{cond.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {cond.blockingProgress && (
                            <span className="text-xs text-red-500 font-medium">🚫 Blocking</span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            CONDITION_STATUS_COLORS[cond.status] || 'bg-gray-100 text-gray-600'
                          }`}>
                            {cond.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Processing Task Card ───

function ProcessingTaskCard({ task, dates, onUpdateDate }) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Check completion: task is "done" if at least one date is filled
  const hasAnyDate = task.dateFields.some((df) => dates[df.key]);
  // Check warnings
  const hasExpiry = task.dateFields.some((df) => df.isExpiry && isExpiringSoon(dates[df.key]));
  const hasExpired = task.dateFields.some((df) => df.isExpiry && isExpired(dates[df.key]));

  const handleDateClick = (fieldKey, currentValue) => {
    setEditingField(fieldKey);
    setEditValue(currentValue ? new Date(currentValue).toISOString().split('T')[0] : '');
  };

  const handleDateSave = async (fieldKey) => {
    setSaving(true);
    try {
      const dateVal = editValue ? new Date(editValue).toISOString() : null;
      await onUpdateDate({ [fieldKey]: dateVal });
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  };

  return (
    <div className={`border rounded-lg p-4 transition-colors ${
      hasExpired ? 'border-red-200 bg-red-50/30' :
      hasExpiry ? 'border-amber-200 bg-amber-50/30' :
      hasAnyDate ? 'border-green-200 bg-green-50/30' :
      'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{task.icon}</span>
        <h4 className="text-sm font-semibold text-gray-800">{task.label}</h4>
        {hasAnyDate && !hasExpired && !hasExpiry && (
          <span className="text-green-500 text-sm">✓</span>
        )}
        {hasExpiry && !hasExpired && (
          <span className="text-amber-500 text-xs font-medium">⚠️ Expiring Soon</span>
        )}
        {hasExpired && (
          <span className="text-red-500 text-xs font-medium">🚫 Expired</span>
        )}

        {/* Toggle (e.g., appraisal waiver) */}
        {task.toggleField && (
          <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dates[task.toggleField] || false}
              onChange={async (e) => {
                await onUpdateDate({ [task.toggleField]: e.target.checked });
              }}
              className="rounded border-gray-300 text-brand focus:ring-brand/30"
            />
            <span className="text-xs text-gray-500">{task.toggleLabel}</span>
          </label>
        )}
      </div>

      {/* Date fields grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {task.dateFields.map((df) => {
          const dateVal = dates[df.key];
          const isEditing = editingField === df.key;
          const expiring = df.isExpiry && isExpiringSoon(dateVal);
          const expired = df.isExpiry && isExpired(dateVal);

          return (
            <div key={df.key}>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                {df.label}
              </span>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleDateSave(df.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDateSave(df.key);
                      if (e.key === 'Escape') setEditingField(null);
                    }}
                    autoFocus
                    disabled={saving}
                    className="text-xs px-1.5 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                  />
                </div>
              ) : (
                <span
                  onClick={() => handleDateClick(df.key, dateVal)}
                  className={`inline-block text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors border border-transparent hover:border-dashed hover:border-gray-300 hover:bg-gray-50 min-w-[60px] ${
                    expired ? 'text-red-600 font-medium' :
                    expiring ? 'text-amber-600 font-medium' :
                    dateVal ? 'text-gray-700' : 'text-gray-300'
                  }`}
                  title="Click to edit"
                >
                  {formatDate(dateVal) || '—'}
                  {expired && ' 🚫'}
                  {expiring && !expired && ' ⚠️'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
