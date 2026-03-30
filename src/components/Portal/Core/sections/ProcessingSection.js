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
// orderType matches /api/corebot/order-out orderType param
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
    orderType: 'appraisal',
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
    orderType: 'title',
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
    orderType: 'flood',
    dateFields: [
      { key: 'floodCertOrdered', label: 'Ordered' },
      { key: 'floodCertReceived', label: 'Received' },
    ],
  },
  {
    key: 'hoi',
    label: 'Homeowners Insurance',
    icon: '🛡️',
    orderType: 'hoi',
    dateFields: [
      { key: 'hoiOrdered', label: 'Ordered' },
      { key: 'hoiReceived', label: 'Received' },
      { key: 'hoiBound', label: 'Bound' },
    ],
  },
];

export default function ProcessingSection({ loan, updateDates }) {
  const dates = loan.dates || {};

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
              loanId={loan.id}
              onUpdateDate={updateDates}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Processing Task Card ───

function ProcessingTaskCard({ task, dates, loanId, onUpdateDate }) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [orderForm, setOrderForm] = useState(null); // { email, name, notes }
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');

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

  const handleOrder = async () => {
    if (!orderForm?.email?.trim()) return;
    setOrdering(true);
    setOrderError('');
    try {
      const res = await fetch('/api/corebot/order-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId,
          orderType: task.orderType,
          recipientEmail: orderForm.email.trim(),
          recipientName: orderForm.name?.trim() || undefined,
          notes: orderForm.notes?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || 'Order failed');
        return;
      }
      // Auto-fill the ordered date in the UI
      if (data.orderedAt) {
        await onUpdateDate({}); // trigger refresh from parent
      }
      setOrderForm(null);
    } catch {
      setOrderError('Order failed');
    } finally {
      setOrdering(false);
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

        {/* Order button */}
        {task.orderType && !orderForm && (
          <button
            onClick={() => setOrderForm({ email: '', name: '', notes: '' })}
            className="ml-auto px-2.5 py-1 text-xs font-medium text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 rounded-lg transition-colors"
          >
            📧 Order
          </button>
        )}

        {/* Toggle (e.g., appraisal waiver) */}
        {task.toggleField && (
          <label className={`${task.orderType ? '' : 'ml-auto '}flex items-center gap-1.5 cursor-pointer`}>
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

      {/* Inline order form */}
      {orderForm && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">Order {task.label}</p>
          {orderError && (
            <p className="text-xs text-red-600 mb-2">{orderError}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="email"
              placeholder="Recipient email *"
              value={orderForm.email}
              onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
            <input
              type="text"
              placeholder="Recipient name"
              value={orderForm.name}
              onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={orderForm.notes}
            onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleOrder}
              disabled={ordering || !orderForm.email.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {ordering ? 'Sending...' : 'Send Order'}
            </button>
            <button
              onClick={() => { setOrderForm(null); setOrderError(''); }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
