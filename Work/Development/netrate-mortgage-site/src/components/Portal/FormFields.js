// Reusable Form Field Components for the Application Wizard
// Wraps React Hook Form's register with consistent styling and error display.

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Text input field with label, error display, and optional helper text.
 */
export function TextField({
  label,
  name,
  register,
  errors,
  type = 'text',
  required = false,
  helper = '',
  className = '',
  ...rest
}) {
  const error = errors?.[name];

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={name}
          type={type}
          placeholder=" "
          {...register(name)}
          className={`
            peer w-full px-4 pt-6 pb-2 h-14 border rounded-lg outline-none transition-colors text-sm
            ${error
              ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
              : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
            }
          `}
          {...rest}
        />
        <label
          htmlFor={name}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 transition-all pointer-events-none
            peer-focus:top-3.5 peer-focus:text-[11px] peer-focus:text-brand peer-focus:translate-y-0
            peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:translate-y-0"
        >
          {label}{required && ' *'}
        </label>
      </div>
      {helper && !error && (
        <p className="text-xs text-gray-400 mt-1">{helper}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message}</p>
      )}
    </div>
  );
}

/**
 * SSN masked input — shows dots as user types, formatted as XXX-XX-XXXX.
 * Eye icon toggles visibility so the user can verify what they typed.
 */
export function SSNField({ label, name, errors, setValue, watch }) {
  const error = errors?.[name];
  const rawValue = watch(name) || '';
  const [visible, setVisible] = useState(false);

  const handleChange = (e) => {
    // Strip non-digits
    let digits = e.target.value.replace(/\D/g, '').slice(0, 9);
    // Format as XXX-XX-XXXX
    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setValue(name, formatted, { shouldValidate: true });
  };

  return (
    <div>
      <div className="relative">
        <input
          id={name}
          type={visible ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={11}
          placeholder=" "
          value={rawValue}
          onChange={handleChange}
          className={`
            peer w-full px-4 pr-10 pt-6 pb-2 h-14 border rounded-lg outline-none transition-colors font-mono text-sm
            ${error
              ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
              : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
            }
          `}
        />
        <label
          htmlFor={name}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 transition-all pointer-events-none
            peer-focus:top-3.5 peer-focus:text-[11px] peer-focus:text-brand peer-focus:translate-y-0
            peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:translate-y-0"
        >
          {label} *
        </label>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={visible ? 'Hide SSN' : 'Show SSN'}
        >
          {visible ? (
            /* Eye-off icon */
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            /* Eye icon */
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        Encrypted with AES-256 — never stored in plaintext.
      </p>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message}</p>
      )}
    </div>
  );
}

/**
 * Select dropdown field.
 */
export function SelectField({
  label,
  name,
  register,
  errors,
  options,
  required = false,
  placeholder = 'Select...',
  className = '',
}) {
  const error = errors?.[name];

  return (
    <div className={className}>
      <div className="relative">
        <select
          id={name}
          {...register(name)}
          className={`
            peer w-full px-4 pt-6 pb-2 h-14 border rounded-lg outline-none transition-colors bg-white text-sm appearance-none
            ${error
              ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
              : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
            }
          `}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label
          htmlFor={name}
          className="absolute left-4 top-2 text-[11px] text-gray-400 pointer-events-none"
        >
          {label}{required && ' *'}
        </label>
        {/* Chevron */}
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message}</p>
      )}
    </div>
  );
}

/**
 * Currency input field — auto-formats as $1,234.56 on blur.
 * Stores raw numeric value in form state for validation/submission.
 */
export function CurrencyField({
  label,
  name,
  register,
  errors,
  required = false,
  placeholder = '0.00',
  className = '',
  helper = '',
  setValue,
  watch,
}) {
  const error = errors?.[name];

  // If setValue/watch provided, use controlled formatting; otherwise fall back to register
  if (setValue && watch) {
    const rawValue = watch(name);

    const formatCurrency = (val) => {
      if (val === '' || val === undefined || val === null) return '';
      const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (isNaN(num)) return '';
      return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const handleFocus = (e) => {
      // Strip formatting, show raw number for editing
      const raw = String(e.target.value).replace(/[^0-9.-]/g, '');
      e.target.value = raw;
    };

    const handleBlur = (e) => {
      const raw = e.target.value.replace(/[^0-9.-]/g, '');
      if (raw === '') {
        setValue(name, '', { shouldValidate: true });
        return;
      }
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        setValue(name, num, { shouldValidate: true });
        e.target.value = formatCurrency(num);
      }
    };

    const handleChange = (e) => {
      const raw = e.target.value.replace(/[^0-9.-]/g, '');
      setValue(name, raw, { shouldValidate: false });
    };

    const displayValue = typeof rawValue === 'number' ? formatCurrency(rawValue) : (rawValue || '');

    return (
      <div className={className}>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            id={name}
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            defaultValue={displayValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className={`
              w-full pl-7 pr-4 py-2.5 border rounded-lg outline-none transition-colors
              ${error
                ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
                : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
              }
            `}
          />
        </div>
        {helper && !error && (
          <p className="text-xs text-gray-400 mt-1">{helper}</p>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error.message}</p>
        )}
      </div>
    );
  }

  // Fallback: uncontrolled mode using register (for backward compatibility)
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          id={name}
          type="number"
          step="0.01"
          min="0"
          placeholder={placeholder}
          {...register(name)}
          className={`
            w-full pl-7 pr-4 py-2.5 border rounded-lg outline-none transition-colors
            ${error
              ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
              : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
            }
          `}
        />
      </div>
      {helper && !error && (
        <p className="text-xs text-gray-400 mt-1">{helper}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message}</p>
      )}
    </div>
  );
}

/**
 * Yes/No toggle (boolean) field — styled as pill buttons.
 */
export function YesNoField({ label, name, errors, watch, setValue }) {
  const error = errors?.[name];
  const value = watch(name);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-400">*</span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setValue(name, true, { shouldValidate: true })}
          className={`
            px-5 py-2 rounded-lg text-sm font-medium transition-colors border
            ${value === true
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }
          `}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setValue(name, false, { shouldValidate: true })}
          className={`
            px-5 py-2 rounded-lg text-sm font-medium transition-colors border
            ${value === false
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }
          `}
        >
          No
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message}</p>
      )}
    </div>
  );
}

/**
 * Parse a Google Places result into street, city, state, zip.
 */
function parsePlaceComponents(place) {
  const components = place.address_components || [];
  const get = (type, form = 'long_name') =>
    components.find((c) => c.types.includes(type))?.[form] || '';

  const streetNumber = get('street_number');
  const route = get('route');
  const street = [streetNumber, route].filter(Boolean).join(' ');

  // City: try locality first, then sublocality, then neighborhood
  const city = get('locality') || get('sublocality_level_1') || get('neighborhood');
  const state = get('administrative_area_level_1', 'short_name');
  const zip = get('postal_code');

  return { street, city, state, zip };
}

/**
 * Address group — street, city, state, zip in a grid.
 * When `setValue` is provided, attaches Google Places Autocomplete to the street input.
 */
export function AddressGroup({ prefix, register, errors, label = 'Address', disabled = false, setValue }) {
  const streetRef = useRef(null);
  const autocompleteRef = useRef(null);

  const getError = (field) => {
    // Handle nested errors like currentAddress.street
    const parts = `${prefix}.${field}`.split('.');
    let err = errors;
    for (const part of parts) {
      err = err?.[part];
    }
    return err;
  };

  // Merge register ref with our local ref for the street input
  const { ref: registerRef, ...streetRegister } = register(`${prefix}.street`);
  const streetRefCallback = useCallback(
    (el) => {
      registerRef(el);
      streetRef.current = el;
    },
    [registerRef]
  );

  // Attach Google Places Autocomplete
  useEffect(() => {
    const input = streetRef.current;
    if (!input || disabled || !setValue || autocompleteRef.current) return;
    if (typeof window === 'undefined' || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'us' },
      types: ['address'],
      fields: ['address_components'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      const parsed = parsePlaceComponents(place);

      // Update all fields via react-hook-form
      setValue(`${prefix}.street`, parsed.street, { shouldValidate: true });
      setValue(`${prefix}.city`, parsed.city, { shouldValidate: true });
      setValue(`${prefix}.state`, parsed.state, { shouldValidate: true });
      setValue(`${prefix}.zip`, parsed.zip, { shouldValidate: true });
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [disabled, setValue, prefix]);

  const disabledClass = disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : '';

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 mb-2">{label}</legend>
      <div className="space-y-3">
        <div>
          <input
            placeholder="Street address"
            readOnly={disabled}
            tabIndex={disabled ? -1 : undefined}
            autoComplete="off"
            ref={streetRefCallback}
            {...streetRegister}
            className={`
              w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${disabledClass}
              ${getError('street')
                ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
                : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
              }
            `}
          />
          {getError('street') && (
            <p className="text-xs text-red-500 mt-1">{getError('street').message}</p>
          )}
        </div>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <input
              placeholder="City"
              readOnly={disabled}
              tabIndex={disabled ? -1 : undefined}
              {...register(`${prefix}.city`)}
              className={`
                w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${disabledClass}
                ${getError('city')
                  ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
                  : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
                }
              `}
            />
            {getError('city') && (
              <p className="text-xs text-red-500 mt-1">{getError('city').message}</p>
            )}
          </div>
          <div className="col-span-1">
            <input
              placeholder="ST"
              maxLength={2}
              readOnly={disabled}
              tabIndex={disabled ? -1 : undefined}
              {...register(`${prefix}.state`)}
              className={`
                w-full px-4 py-2.5 border rounded-lg outline-none transition-colors uppercase ${disabledClass}
                ${getError('state')
                  ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
                  : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
                }
              `}
            />
            {getError('state') && (
              <p className="text-xs text-red-500 mt-1">{getError('state').message}</p>
            )}
          </div>
          <div className="col-span-2">
            <input
              placeholder="ZIP"
              maxLength={5}
              inputMode="numeric"
              readOnly={disabled}
              tabIndex={disabled ? -1 : undefined}
              {...register(`${prefix}.zip`)}
              className={`
                w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${disabledClass}
                ${getError('zip')
                  ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
                  : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
                }
              `}
            />
            {getError('zip') && (
              <p className="text-xs text-red-500 mt-1">{getError('zip').message}</p>
            )}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
