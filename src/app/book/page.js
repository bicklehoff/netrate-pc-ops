'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TrustBar from '@/components/TrustBar';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatZohoDate(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = MONTHS[date.getMonth()];
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function formatDisplayDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// Generate next 14 days (skip weekends)
function getBookableDates() {
  const dates = [];
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // Start tomorrow
  while (dates.length < 14) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) { // Skip Sun/Sat
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function BookPage() {
  const [step, setStep] = useState(1); // 1=date, 2=time, 3=info, 4=confirm
  const [dates] = useState(getBookableDates);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', loanPurpose: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  // slotRefreshKey forces a slot re-fetch even when the date hasn't changed —
  // used after a 409 slot-taken to pull fresh availability for the same day.
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  // Banner shown above the slot grid when a slot was just taken — clears when
  // the user picks a new time or jumps to a new date.
  const [slotTakenMsg, setSlotTakenMsg] = useState('');

  // Fetch slots when date is selected (or when slotRefreshKey bumps after a 409)
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedTime(null);
    setError(null);

    const zohoDate = formatZohoDate(selectedDate);
    fetch(`/api/book/slots?date=${zohoDate}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSlots(data.slots || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, slotRefreshKey]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSlotTakenMsg('');
    setStep(2);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setSlotTakenMsg('');
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/book/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formatZohoDate(selectedDate),
          time: selectedTime,
          name: form.name,
          email: form.email,
          phone: form.phone,
          loanPurpose: form.loanPurpose,
          notes: form.notes || undefined,
        }),
      });

      const data = await res.json();

      // 409 = slot taken (someone else booked it between slot-fetch and submit, or
      // a duplicate submit on our own. Bounce back to time selection, refresh
      // availability, preserve form state, surface a non-scary amber banner.
      if (res.status === 409) {
        setSlotTakenMsg(data.error || 'That time was just taken — pick another.');
        setSelectedTime(null);
        setStep(2);
        setSlotRefreshKey(k => k + 1);
        setError(null);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Booking failed');

      setBooking(data.booking);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <TrustBar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Book a Free Rate Consultation</h1>
          <p className="text-gray-600 mt-2">30 minutes with David Burson, NMLS #641790</p>
          <p className="text-sm text-gray-500 mt-1">No obligation. No credit pull. Just answers.</p>
        </div>

        {/* Progress */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {['Date', 'Time', 'Details'].map((label, i) => {
              const num = i + 1;
              const active = step === num;
              const done = step > num;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${done ? 'bg-brand' : 'bg-gray-300'}`} />}
                  <button
                    onClick={() => done && setStep(num)}
                    disabled={!done}
                    className={`w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center transition-colors ${
                      active ? 'bg-brand text-white' : done ? 'bg-brand/20 text-brand cursor-pointer' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {done ? '✓' : num}
                  </button>
                  <span className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 1: Date Selection */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Pick a day</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {dates.map((date) => {
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateSelect(date)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-brand bg-brand/5 ring-2 ring-brand'
                        : 'border-gray-200 hover:border-brand hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs text-gray-500 uppercase">{DAYS[date.getDay()]}</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {MONTHS[date.getMonth()]} {date.getDate()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Time Selection */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              {formatDisplayDate(selectedDate)}
            </h2>
            <p className="text-sm text-gray-500 mb-4">Mountain Time (Denver)</p>

            {slotTakenMsg && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                {slotTakenMsg}
              </div>
            )}

            {loadingSlots && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-gray-500">Loading available times...</span>
              </div>
            )}

            {!loadingSlots && slots.length === 0 && !error && (
              <div className="text-center py-12 text-gray-500">
                No available times for this date. Please pick another day.
              </div>
            )}

            {!loadingSlots && slots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className={`py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedTime === time
                        ? 'border-brand bg-brand text-white'
                        : 'border-gray-200 text-gray-700 hover:border-brand hover:text-brand'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Contact Info */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Almost there</h2>
            <p className="text-sm text-gray-500 mb-6">
              {formatDisplayDate(selectedDate)} at {selectedTime} MT
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none"
                  placeholder="(303) 555-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What&apos;s this about?</label>
                <select
                  required
                  value={form.loanPurpose}
                  onChange={(e) => setForm(f => ({ ...f, loanPurpose: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none bg-white"
                >
                  <option value="" disabled>Select one...</option>
                  <option value="purchase">Purchasing a home</option>
                  <option value="refinance">Refinancing (lower rate / shorter term)</option>
                  <option value="cashout">Cash-out refinance</option>
                  <option value="heloc">HELOC / second lien</option>
                  <option value="other">Something else</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anything else? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none resize-none"
                  placeholder="Purchase, refinance, questions about rates..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && booking && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked!</h2>
            <p className="text-gray-600 mb-6">
              {formatDisplayDate(selectedDate)} at {selectedTime} Mountain Time
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-left max-w-sm mx-auto mb-8">
              <p className="text-sm text-gray-500 mb-1">Consultation with</p>
              <p className="font-semibold text-gray-900">David Burson</p>
              <p className="text-sm text-gray-600">NetRate Mortgage | NMLS #641790</p>
              <p className="text-sm text-gray-600 mt-2">303-444-5251</p>
              <p className="text-sm text-gray-600">david@netratemortgage.com</p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              A confirmation email has been sent. We&apos;ll reach out before your appointment.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/rates"
                className="text-brand font-semibold hover:text-brand-dark transition-colors"
              >
                Check today&apos;s rates &rarr;
              </Link>
              <Link
                href="/"
                className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                Back to home
              </Link>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer info */}
        {step < 4 && (
          <div className="mt-10 text-center text-sm text-gray-400">
            <p>Or call directly: <a href="tel:303-444-5251" className="text-brand hover:text-brand-dark">303-444-5251</a></p>
            <p className="mt-1">
              <Link href="/contact" className="text-brand hover:text-brand-dark">Send a message instead</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
