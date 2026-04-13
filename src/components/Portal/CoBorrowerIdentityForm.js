// Co-Borrower Identity Form — collects name, DOB, SSN, email, phone
// Rendered inline in Step 3 when a co-borrower is added.
// Each co-borrower gets its own card with a remove button.

'use client';

import { useState } from 'react';

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
];

export default function CoBorrowerIdentityForm({ coBorrower, index, onUpdate, onRemove }) {
  const [ssnVisible, setSsnVisible] = useState(false);

  const handleChange = (field, value) => {
    onUpdate(coBorrower.id, { [field]: value });
  };

  const handleSsnChange = (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 9);
    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    handleChange('ssn', formatted);
  };

  return (
    <div className="bg-surface-alt border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">
          Co-Borrower {index + 1}
        </h4>
        <button
          type="button"
          onClick={() => onRemove(coBorrower.id)}
          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Relationship */}
      <div>
        <label className="block text-sm font-medium text-ink-mid mb-1">
          Relationship to Primary Borrower <span className="text-red-400">*</span>
        </label>
        <select
          value={coBorrower.relationship || ''}
          onChange={(e) => handleChange('relationship', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">Select...</option>
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            First Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={coBorrower.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="First name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            Last Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={coBorrower.lastName || ''}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Last name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
      </div>

      {/* Email & Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={coBorrower.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@example.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            Phone <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={coBorrower.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="(303) 555-1234"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
      </div>

      {/* DOB & SSN */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            Date of Birth <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={coBorrower.dob || ''}
            onChange={(e) => handleChange('dob', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            Social Security Number <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type={ssnVisible ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={11}
              placeholder="XXX-XX-XXXX"
              value={coBorrower.ssn || ''}
              onChange={handleSsnChange}
              className="w-full px-4 pr-10 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors font-mono focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <button
              type="button"
              onClick={() => setSsnVisible((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink-mid transition-colors"
              aria-label={ssnVisible ? 'Hide SSN' : 'Show SSN'}
            >
              {ssnVisible ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-ink-subtle mt-1">
            Encrypted with AES-256 — never stored in plaintext.
          </p>
        </div>
      </div>
    </div>
  );
}
