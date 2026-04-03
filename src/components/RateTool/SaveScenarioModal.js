'use client';

import { useState, useEffect } from 'react';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily (Mon–Fri)', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { value: '3x_week', label: '3x / week', days: ['mon', 'wed', 'fri'] },
  { value: '2x_week', label: '2x / week', days: ['tue', 'thu'] },
  { value: 'weekly', label: 'Weekly', days: ['mon'] },
];

const ALL_DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
];

export default function SaveScenarioModal({ scenario, onClose, prefillName, prefillEmail, prefillPhone }) {
  const [name, setName] = useState(prefillName || '');
  const [email, setEmail] = useState(prefillEmail || '');
  const [phone, setPhone] = useState(prefillPhone || '');
  const [frequency, setFrequency] = useState('2x_week');
  const [days, setDays] = useState(['tue', 'thu']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const hasPrefill = !!(prefillName && prefillEmail);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleFrequencyChange = (val) => {
    setFrequency(val);
    const opt = FREQUENCY_OPTIONS.find(o => o.value === val);
    if (opt) setDays(opt.days);
  };

  const toggleDay = (day) => {
    setDays(prev => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev; // must have at least one day
        return prev.filter(d => d !== day);
      }
      return [...prev, day];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/saved-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          scenarioData: scenario,
          alertFrequency: frequency,
          alertDays: days,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-brand px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Save This Scenario</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Scenario Saved</h3>
              <p className="text-sm text-gray-600">
                You&apos;ll receive rate updates at <strong>{email}</strong> after review by your loan officer.
              </p>
              <button onClick={onClose} className="mt-4 px-4 py-2 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Get periodic rate updates for this scenario, reviewed and sent by your loan officer.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Contact info — skip if prefilled from lead form */}
                {!hasPrefill ? (
                  <div className="space-y-3">
                    <input type="text" placeholder="Full Name" required value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                    <input type="email" placeholder="Email Address" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                    <input type="tel" placeholder="Phone (optional)" value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                    Saving as <strong>{email}</strong>
                  </div>
                )}

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How often would you like updates?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FREQUENCY_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => handleFrequencyChange(opt.value)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          frequency === opt.value
                            ? 'border-brand bg-brand/5 text-brand font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day picker */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Which days?</label>
                  <div className="flex gap-1.5">
                    {ALL_DAYS.map(d => (
                      <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          days.includes(d.value)
                            ? 'border-brand bg-brand text-white'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button type="submit" disabled={submitting}
                  className="w-full bg-brand text-white rounded-lg py-3 font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save & Get Rate Alerts'}
                </button>
              </form>

              <p className="text-[10px] text-gray-400 text-center mt-3 leading-relaxed">
                By saving, you agree to receive periodic rate update emails from NetRate Mortgage.
                You can unsubscribe at any time. No credit pull. No obligation.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
