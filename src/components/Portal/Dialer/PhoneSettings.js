'use client';

import { useState, useEffect } from 'react';

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Row({ label, description, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function PhoneSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/dialer/settings')
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function patch(updates) {
    setSettings((prev) => ({ ...prev, ...updates }));
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/dialer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Settings save failed:', e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }
  if (!settings) return <p className="text-xs text-gray-400 text-center py-6">Failed to load settings.</p>;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Phone Settings</h3>
        {saving && <span className="text-[10px] text-gray-400">Saving…</span>}
        {saved && !saving && <span className="text-[10px] text-green-600">Saved ✓</span>}
      </div>

      <div className="px-4 py-2 flex-1">
        {/* ── Call Routing ─────────────────── */}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1">Call Routing</p>

        <Row
          label="Do Not Disturb"
          description="Skip ring — send callers straight to voicemail"
        >
          <Toggle
            checked={!!settings.dnd_enabled}
            onChange={(v) => patch({ dnd_enabled: v })}
          />
        </Row>

        <Row
          label="Forward all calls"
          description="Bypass browser + cell, forward to a number"
        >
          <Toggle
            checked={!!settings.call_forward_enabled}
            onChange={(v) => patch({ call_forward_enabled: v })}
          />
        </Row>

        {settings.call_forward_enabled && (
          <div className="pb-3">
            <input
              type="tel"
              value={settings.call_forward_number || ''}
              onChange={(e) => setSettings((p) => ({ ...p, call_forward_number: e.target.value }))}
              onBlur={() => patch({ call_forward_number: settings.call_forward_number })}
              placeholder="+1 (303) 555-0100"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
        )}

        {/* ── SMS Auto-Reply ─────────────── */}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-1">SMS</p>

        <Row
          label="Auto-reply"
          description="Send one auto-reply per sender per 24 hours"
        >
          <Toggle
            checked={!!settings.sms_auto_reply_enabled}
            onChange={(v) => patch({ sms_auto_reply_enabled: v })}
          />
        </Row>

        {settings.sms_auto_reply_enabled && (
          <div className="pb-3">
            <textarea
              rows={3}
              value={settings.sms_auto_reply_message || ''}
              onChange={(e) => setSettings((p) => ({ ...p, sms_auto_reply_message: e.target.value }))}
              onBlur={() => patch({ sms_auto_reply_message: settings.sms_auto_reply_message })}
              placeholder="I'm currently unavailable. I'll get back to you as soon as possible."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">{(settings.sms_auto_reply_message || '').length}/320 chars</p>
          </div>
        )}
      </div>
    </div>
  );
}
