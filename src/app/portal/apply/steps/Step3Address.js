// Step 3: Address History + Co-Borrower
// Fields: Current Address (with same-as-subject option), Duration, Mailing Address, Marital Status
// Co-borrower: If married, prompts to add spouse. Collects identity + address for each co-borrower.

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step3Schema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { TextField, SelectField, AddressGroup, parsePlaceComponents } from '@/components/Portal/FormFields';
import CoBorrowerPrompt from '@/components/Portal/CoBorrowerPrompt';
import CoBorrowerIdentityForm from '@/components/Portal/CoBorrowerIdentityForm';
import BorrowerTabs from '@/components/Portal/BorrowerTabs';
import CoBorrowerNav from '@/components/Portal/CoBorrowerNav';

const MARITAL_OPTIONS = [
  { value: 'married', label: 'Married' },
  { value: 'unmarried', label: 'Unmarried' },
  { value: 'separated', label: 'Separated' },
];

export default function Step3Address({ onNext, onBack }) {
  const { data, updateData, addCoBorrower, removeCoBorrower, updateCoBorrower } = useApplication();

  // Track whether current address is same as subject property
  const [sameAsProperty, setSameAsProperty] = useState(
    data.currentAddressSameAsProperty ?? false
  );

  // Active tab for co-borrower address section
  const [activeAddressTab, setActiveAddressTab] = useState('primary');

  // Track whether spouse/solo validation error should show
  const [showCoBorrowerError, setShowCoBorrowerError] = useState(false);

  // Only show checkbox if we have a property address from Step 2
  const hasPropertyAddress = data.propertyAddress?.street?.trim();

  const hasCoBorrowers = data.coBorrowers?.length > 0;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      currentAddress: data.currentAddress || { street: '', city: '', state: '', zip: '' },
      addressYears: data.addressYears ?? '',
      addressMonths: data.addressMonths ?? '',
      mailingAddressSame: data.mailingAddressSame ?? true,
      mailingAddress: data.mailingAddress || { street: '', city: '', state: '', zip: '' },
      maritalStatus: data.maritalStatus || '',
    },
  });

  const mailingAddressSame = watch('mailingAddressSame');
  const maritalStatus = watch('maritalStatus');

  // When same-as-property is toggled on, fill address from property data
  useEffect(() => {
    if (sameAsProperty && data.propertyAddress) {
      setValue('currentAddress.street', data.propertyAddress.street || '');
      setValue('currentAddress.city', data.propertyAddress.city || '');
      setValue('currentAddress.state', data.propertyAddress.state || '');
      setValue('currentAddress.zip', data.propertyAddress.zip || '');
    }
  }, [sameAsProperty, data.propertyAddress, setValue]);

  const handleAddCoBorrower = () => {
    addCoBorrower({ relationship: 'spouse' });
    updateData({ coBorrowerDecisionMade: true });
    setShowCoBorrowerError(false);
  };

  const handleDeclineCoBorrower = () => {
    updateData({ coBorrowerDecisionMade: true });
    setShowCoBorrowerError(false);
  };

  const handleRemoveCoBorrower = (id) => {
    removeCoBorrower(id);
    setActiveAddressTab('primary');
  };

  const onSubmit = (stepData) => {
    // Block if married but hasn't chosen add-spouse or solo
    if (stepData.maritalStatus === 'married' && !hasCoBorrowers && !data.coBorrowerDecisionMade) {
      setShowCoBorrowerError(true);
      return;
    }

    // If mailing is same, clear mailing address data
    if (stepData.mailingAddressSame) {
      stepData.mailingAddress = null;
    }
    // Persist the same-as-property preference
    stepData.currentAddressSameAsProperty = sameAsProperty;
    updateData(stepData);
    onNext();
  };

  // Check if a co-borrower's address is complete (for tab badges)
  const isAddressTabComplete = (tabId) => {
    if (tabId === 'primary') {
      return !!(data.currentAddress?.street && data.currentAddress?.city);
    }
    const cb = data.coBorrowers?.find((c) => c.id === tabId);
    return !!(cb?.currentAddress?.street && cb?.currentAddress?.city);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">

        {/* ── Primary Borrower Address ─────────────────────────── */}

        {/* Show tabs when co-borrowers exist */}
        {hasCoBorrowers && (
          <BorrowerTabs
            coBorrowers={data.coBorrowers}
            activeTab={activeAddressTab}
            onTabChange={setActiveAddressTab}
            isTabComplete={isAddressTabComplete}
          />
        )}

        {/* Primary borrower address (always shown, or when primary tab active) */}
        {(!hasCoBorrowers || activeAddressTab === 'primary') && (
          <>
            {/* Same as subject property checkbox */}
            {hasPropertyAddress && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsProperty}
                    onChange={(e) => setSameAsProperty(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="text-sm text-gray-700">My current address is the same as the subject property</span>
                </label>
              </div>
            )}

            <AddressGroup
              prefix="currentAddress"
              register={register}
              errors={errors}
              label="Current Address"
              disabled={sameAsProperty}
              setValue={setValue}
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Years at This Address"
                name="addressYears"
                type="number"
                register={register}
                errors={errors}
                required
              />
              <TextField
                label="Months (if less than 1 year)"
                name="addressMonths"
                type="number"
                register={register}
                errors={errors}
              />
            </div>

            {/* Mailing Address Toggle */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('mailingAddressSame')}
                  className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <span className="text-sm text-gray-700">Mailing address is the same as current address</span>
              </label>
            </div>

            {!mailingAddressSame && (
              <AddressGroup
                prefix="mailingAddress"
                register={register}
                errors={errors}
                label="Mailing Address"
                setValue={setValue}
              />
            )}
          </>
        )}

        {/* Co-borrower address tab content */}
        {hasCoBorrowers && activeAddressTab !== 'primary' && (
          <CoBorrowerAddressSection
            coBorrower={data.coBorrowers.find((cb) => cb.id === activeAddressTab)}
            primaryAddress={data.currentAddress}
            onUpdate={updateCoBorrower}
          />
        )}

        {/* ── Marital Status ──────────────────────────────────── */}

        <SelectField
          label="Marital Status"
          name="maritalStatus"
          register={register}
          errors={errors}
          options={MARITAL_OPTIONS}
          required
        />

        {/* ── Co-Borrower Prompt ──────────────────────────────── */}
        <CoBorrowerPrompt
          maritalStatus={maritalStatus}
          hasCoBorrowers={hasCoBorrowers}
          coBorrowerCount={data.coBorrowers?.length || 0}
          onAddSpouse={handleAddCoBorrower}
          onDeclineCoBorrower={handleDeclineCoBorrower}
          showError={showCoBorrowerError}
        />

        {/* ── Co-Borrower Identity Forms ──────────────────────── */}
        {data.coBorrowers?.map((cb, i) => (
          <CoBorrowerIdentityForm
            key={cb.id}
            coBorrower={cb}
            index={i}
            onUpdate={updateCoBorrower}
            onRemove={handleRemoveCoBorrower}
          />
        ))}

        {/* ── Navigation ──────────────────────────────────────── */}
        {hasCoBorrowers ? (
          <CoBorrowerNav
            activeTab={activeAddressTab}
            coBorrowers={data.coBorrowers}
            onBack={onBack}
            onTabChange={setActiveAddressTab}
            nextStepLabel="Employment"
            isTabComplete={isAddressTabComplete}
            sectionLabel="Address"
          />
        ) : (
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={onBack}
              className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium transition-colors"
            >
              &larr; Back
            </button>
            <button
              type="submit"
              className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
            >
              Next: Employment &rarr;
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

// ─── Co-Borrower Address Section (shown in tab) ─────────────────
// Inline component for co-borrower address fields within the tab.
// Uses controlled inputs (not react-hook-form) since co-borrower data
// is managed via ApplicationContext, not the form's own state.

function CoBorrowerAddressSection({ coBorrower, primaryAddress, onUpdate }) {
  const streetRef = useRef(null);
  const autocompleteRef = useRef(null);

  if (!coBorrower) return null;

  const sameAsPrimary = coBorrower.addressSameAsPrimary ?? false;

  const handleChange = (field, value) => {
    onUpdate(coBorrower.id, { [field]: value });
  };

  const handleAddressChange = (field, value) => {
    onUpdate(coBorrower.id, {
      currentAddress: { ...coBorrower.currentAddress, [field]: value },
    });
  };

  const handleSameAsPrimary = (checked) => {
    onUpdate(coBorrower.id, { addressSameAsPrimary: checked });
    if (checked && primaryAddress) {
      onUpdate(coBorrower.id, {
        currentAddress: { ...primaryAddress },
      });
    }
  };

  // Google Places Autocomplete for co-borrower street (with retry for async script)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (sameAsPrimary) return;

    function attach() {
      const input = streetRef.current;
      if (!input || autocompleteRef.current) return true;
      if (!window.google?.maps?.places) return false;

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'us' },
        types: ['address'],
        fields: ['address_components'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;
        const parsed = parsePlaceComponents(place);
        onUpdate(coBorrower.id, {
          currentAddress: { street: parsed.street, city: parsed.city, state: parsed.state, zip: parsed.zip },
        });
      });

      autocompleteRef.current = autocomplete;
      return true;
    }

    if (!attach()) {
      const interval = setInterval(() => {
        if (attach()) clearInterval(interval);
      }, 200);
      return () => clearInterval(interval);
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [sameAsPrimary, coBorrower.id, onUpdate]);

  return (
    <div className="space-y-4">
      {/* Same as primary borrower checkbox */}
      {primaryAddress?.street && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sameAsPrimary}
            onChange={(e) => handleSameAsPrimary(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-sm text-gray-700">Same address as primary borrower</span>
        </label>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Current Address</legend>
        <div className="space-y-3">
          <input
            ref={streetRef}
            placeholder="Street address"
            autoComplete="off"
            readOnly={sameAsPrimary}
            tabIndex={sameAsPrimary ? -1 : undefined}
            value={coBorrower.currentAddress?.street || ''}
            onChange={(e) => handleAddressChange('street', e.target.value)}
            className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand ${sameAsPrimary ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          />
          <div className="grid grid-cols-6 gap-3">
            <input
              className={`col-span-3 px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand ${sameAsPrimary ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="City"
              readOnly={sameAsPrimary}
              tabIndex={sameAsPrimary ? -1 : undefined}
              value={coBorrower.currentAddress?.city || ''}
              onChange={(e) => handleAddressChange('city', e.target.value)}
            />
            <input
              className={`col-span-1 px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors uppercase focus:ring-2 focus:ring-brand/20 focus:border-brand ${sameAsPrimary ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="ST"
              maxLength={2}
              readOnly={sameAsPrimary}
              tabIndex={sameAsPrimary ? -1 : undefined}
              value={coBorrower.currentAddress?.state || ''}
              onChange={(e) => handleAddressChange('state', e.target.value)}
            />
            <input
              className={`col-span-2 px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand ${sameAsPrimary ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="ZIP"
              maxLength={5}
              inputMode="numeric"
              readOnly={sameAsPrimary}
              tabIndex={sameAsPrimary ? -1 : undefined}
              value={coBorrower.currentAddress?.zip || ''}
              onChange={(e) => handleAddressChange('zip', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Years at This Address</label>
          <input
            type="number"
            value={coBorrower.addressYears ?? ''}
            onChange={(e) => handleChange('addressYears', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Months (if less than 1 year)</label>
          <input
            type="number"
            value={coBorrower.addressMonths ?? ''}
            onChange={(e) => handleChange('addressMonths', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
      </div>
    </div>
  );
}
