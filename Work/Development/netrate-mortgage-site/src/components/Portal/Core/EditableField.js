// EditableField — Generic click-to-edit field for Core loan detail
// Extends PipelineTable's EditableText/EditableSelect pattern with type support:
//   text, select, currency, date, textarea
//
// Props:
//   value       — Current value
//   onSave      — (newValue) => Promise<void>
//   type        — 'text' | 'select' | 'currency' | 'date' | 'textarea'
//   options     — Array of { value, label } for select type
//   label       — Field label (displayed above)
//   placeholder — Placeholder text when empty
//   readOnly    — If true, shows value without edit affordance
//   source      — Data source badge ('app' | 'corebot' | 'xml' | 'manual')

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const SOURCE_BADGES = {
  app: { label: 'App', color: 'bg-blue-50 text-blue-600' },
  corebot: { label: 'Bot', color: 'bg-purple-50 text-purple-600' },
  xml: { label: 'XML', color: 'bg-orange-50 text-orange-600' },
  manual: { label: 'Edit', color: 'bg-gray-50 text-gray-500' },
};

function formatCurrencyDisplay(val) {
  if (val === null || val === undefined || val === '') return null;
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatDateDisplay(val) {
  if (!val) return null;
  const d = new Date(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EditableField({
  value,
  onSave,
  type = 'text',
  options = [],
  label,
  placeholder = '—',
  readOnly = false,
  source,
  className = '',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  // Sync draft with value when it changes externally
  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'currency' || type === 'textarea') {
        inputRef.current.select?.();
      }
    }
  }, [editing, type]);

  const save = useCallback(async () => {
    let finalValue = draft;

    // Normalize
    if (type === 'text' || type === 'textarea') {
      finalValue = typeof draft === 'string' ? draft.trim() : draft;
    }
    if (type === 'currency') {
      // Strip non-numeric chars except decimal
      const cleaned = String(draft).replace(/[^0-9.]/g, '');
      finalValue = cleaned ? parseFloat(cleaned) : null;
    }

    // No change? Just close
    if (finalValue === (value ?? '') || (finalValue === null && value === null)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(false);
    try {
      await onSave(finalValue || null);
      setEditing(false);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [draft, value, onSave, type]);

  const cancel = useCallback(() => {
    setDraft(value ?? '');
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && type !== 'textarea') save();
    if (e.key === 'Escape') cancel();
  }, [save, cancel, type]);

  // Format display value
  const getDisplayValue = () => {
    if (value === null || value === undefined || value === '') return null;
    if (type === 'currency') return formatCurrencyDisplay(value);
    if (type === 'date') return formatDateDisplay(value);
    if (type === 'select') {
      const opt = options.find((o) => o.value === value);
      return opt?.label || value;
    }
    return String(value);
  };

  const displayValue = getDisplayValue();
  const sourceBadge = source && SOURCE_BADGES[source];

  // ─── Read-only mode ───
  if (readOnly) {
    return (
      <div className={className}>
        {label && (
          <span className="block text-xs font-medium text-gray-400 mb-0.5">{label}</span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-800">
            {displayValue || <span className="text-gray-300">{placeholder}</span>}
          </span>
          {sourceBadge && (
            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${sourceBadge.color}`}>
              {sourceBadge.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ─── Editing mode ───
  if (editing) {
    const inputClasses = `w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none ${
      saving ? 'opacity-50' : ''
    } ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;

    return (
      <div className={className}>
        {label && (
          <span className="block text-xs font-medium text-gray-400 mb-0.5">{label}</span>
        )}
        {type === 'select' ? (
          <select
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Auto-save on select change
              const newVal = e.target.value;
              if (newVal !== (value ?? '')) {
                setSaving(true);
                setError(false);
                onSave(newVal || null)
                  .then(() => setEditing(false))
                  .catch(() => {
                    setError(true);
                    setTimeout(() => setError(false), 2000);
                  })
                  .finally(() => setSaving(false));
              } else {
                setEditing(false);
              }
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClasses}
          >
            <option value="">— None —</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel();
              // Ctrl+Enter saves
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
            }}
            disabled={saving}
            rows={3}
            className={inputClasses}
          />
        ) : type === 'date' ? (
          <input
            ref={inputRef}
            type="date"
            value={draft ? new Date(draft).toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const newVal = e.target.value || null;
              setDraft(newVal);
              // Auto-save on date pick
              if (newVal !== (value ? new Date(value).toISOString().split('T')[0] : '')) {
                setSaving(true);
                setError(false);
                onSave(newVal ? new Date(newVal).toISOString() : null)
                  .then(() => setEditing(false))
                  .catch(() => {
                    setError(true);
                    setTimeout(() => setError(false), 2000);
                  })
                  .finally(() => setSaving(false));
              }
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClasses}
          />
        ) : (
          <input
            ref={inputRef}
            type={type === 'currency' ? 'text' : 'text'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
            className={inputClasses}
          />
        )}
      </div>
    );
  }

  // ─── Display mode (click to edit) ───
  return (
    <div className={className}>
      {label && (
        <span className="block text-xs font-medium text-gray-400 mb-0.5">{label}</span>
      )}
      <div className="flex items-center gap-1.5">
        <span
          onClick={() => setEditing(true)}
          className={`inline-block px-1.5 py-0.5 rounded cursor-pointer text-sm transition-colors hover:bg-gray-100 border border-transparent hover:border-dashed hover:border-gray-300 min-w-[40px] ${
            error ? 'bg-red-50 border-red-300' : ''
          } ${displayValue ? 'text-gray-800' : 'text-gray-300'}`}
          title="Click to edit"
        >
          {displayValue || placeholder}
        </span>
        {sourceBadge && (
          <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${sourceBadge.color}`}>
            {sourceBadge.label}
          </span>
        )}
      </div>
    </div>
  );
}
