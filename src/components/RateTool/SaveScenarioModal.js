'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [name, setName] = useState(prefillName || '');
  const [email, setEmail] = useState(prefillEmail || '');
  const [phone, setPhone] = useState(prefillPhone || '');
  const [frequency, setFrequency] = useState('2x_week');
  const [days, setDays] = useState(['tue', 'thu']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [viewToken, setViewToken] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);

  // Auto-redirect to My Rates portal after save
  useEffect(() => {
    if (!submitted || !viewToken) return;
    setCountdown(4);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/portal/my-rates?token=${viewToken}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted, viewToken, router]);

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

  // Max days allowed per frequency
  const maxDays = { daily: 5, '3x_week': 3, '2x_week': 2, weekly: 1 };

  const toggleDay = (day) => {
    setDays(prev => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev; // must have at least one day
        return prev.filter(d => d !== day);
      }
      const max = maxDays[frequency] || 5;
      if (prev.length >= max) {
        // Swap: remove oldest selection, add new one
        return [...prev.slice(1), day];
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      if (data.viewToken) setViewToken(data.viewToken);
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
          <h2 className="text-white font-semibold text-lg">
            {submitted ? 'You\u2019re All Set' : 'Save & Track Your Rates'}
          </h2>
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
              <p className="text-sm text-gray-600 mb-1">
                We&apos;ll send rate updates to <strong>{email}</strong> — each one reviewed by your loan officer before it reaches you.
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Check your inbox for a welcome email with your scenario details.
              </p>
              {viewToken ? (
                <>
                  <a
                    href={`/portal/my-rates?token=${viewToken}`}
                    className="inline-block bg-brand text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-brand-dark transition-colors"
                  >
                    Go to My Rates Portal →
                  </a>
                  {countdown != null && countdown > 0 && (
                    <p className="text-xs text-gray-400 mt-2">Redirecting in {countdown}...</p>
                  )}
                </>
              ) : (
                <button onClick={onClose} className="mt-3 px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
                  Close
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Value prop explainer */}
              <div className="bg-cyan-50 rounded-lg p-4 mb-4 border border-cyan-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Why save this scenario?</h3>
                <ul className="space-y-1.5 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-brand shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span><strong>Rate alerts</strong> — we re-price your exact scenario on your schedule and email you when rates change</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-brand shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span><strong>Human reviewed</strong> — your loan officer checks every update before it reaches you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-brand shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span><strong>Your rates portal</strong> — reprice on demand, run calculators pre-filled with your numbers</span>
                  </li>
                </ul>
              </div>

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
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Which days? <span className="text-gray-400">({days.length}/{maxDays[frequency] || 5})</span>
                  </label>
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
                No credit pull. No obligation. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
