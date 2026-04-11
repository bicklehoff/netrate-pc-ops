// Step 2: Property Details — Purchase Path
// Fields: Occupancy, Purchase Price, Down Payment (LTV slider), Property Address, Property Type, Units

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step2PurchaseSchema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { SelectField, CurrencyField, AddressGroup } from '@/components/Portal/FormFields';

const OCCUPANCY_OPTIONS = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'secondary', label: 'Second Home' },
  { value: 'investment', label: 'Investment Property' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'sfr', label: 'Single Family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhome', label: 'Townhome' },
  { value: 'multi_unit', label: 'Multi-Unit (2-4)' },
  { value: 'manufactured', label: 'Manufactured Home' },
];

const UNIT_OPTIONS = [
  { value: '2', label: '2 units' },
  { value: '3', label: '3 units' },
  { value: '4', label: '4 units' },
];

function formatDollar(val) {
  if (!val && val !== 0) return '$0';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Step2Purchase({ onNext, onBack }) {
  const { data, updateData } = useApplication();

  // Determine initial LTV from existing data
  const initialLtv = (() => {
    const price = parseFloat(data.purchasePrice);
    const dp = parseFloat(data.downPayment);
    if (price > 0 && dp >= 0) {
      const computed = Math.round(((price - dp) / price) * 100);
      return Math.max(0, Math.min(100, computed));
    }
    return 80; // default 80% LTV = 20% down
  })();

  const [ltv, setLtv] = useState(initialLtv);
  const [propertyIdentified, setPropertyIdentified] = useState(
    data.propertyIdentified ?? ''
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(step2PurchaseSchema),
    defaultValues: {
      occupancy: data.occupancy || '',
      purchasePrice: data.purchasePrice ?? '',
      downPayment: data.downPayment ?? '',
      propertyAddress: data.propertyAddress || { street: '', city: '', state: '', zip: '' },
      propertyType: data.propertyType || '',
      numUnits: data.numUnits ?? '',
    },
  });

  const purchasePrice = watch('purchasePrice');
  const propertyType = watch('propertyType');

  // Track whether the slider is driving updates (vs the input box)
  const [sliderDriving, setSliderDriving] = useState(true);

  // When LTV slider changes, update down payment
  useEffect(() => {
    if (!sliderDriving) return;
    const price = parseFloat(purchasePrice);
    if (price > 0) {
      const dp = Math.round(price * (1 - ltv / 100));
      setValue('downPayment', dp, { shouldValidate: true });
    }
  }, [ltv, purchasePrice, setValue, sliderDriving]);

  // When down payment input changes, update slider
  const handleDpInputChange = (rawVal) => {
    setSliderDriving(false);
    const dp = parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
    const price = parseFloat(purchasePrice);
    if (price > 0 && !isNaN(dp)) {
      const newLtv = Math.round(((price - dp) / price) * 100);
      setLtv(Math.max(0, Math.min(100, newLtv)));
    }
    // Re-enable slider driving on next slider interaction
  };

  // Set TBD when property not identified
  useEffect(() => {
    if (propertyIdentified === 'no') {
      setValue('propertyAddress.street', 'TBD');
      setValue('propertyAddress.city', 'TBD');
      setValue('propertyAddress.state', '');
      setValue('propertyAddress.zip', '');
    } else if (propertyIdentified === 'yes') {
      // Clear TBD values when switching to "yes"
      const currentStreet = watch('propertyAddress.street');
      if (currentStreet === 'TBD') {
        setValue('propertyAddress.street', '');
        setValue('propertyAddress.city', '');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyIdentified, setValue]);

  const onSubmit = (stepData) => {
    stepData.propertyIdentified = propertyIdentified;
    updateData(stepData);
    onNext();
  };

  const priceNum = parseFloat(purchasePrice) || 0;
  const dpAmount = priceNum > 0 ? Math.round(priceNum * (1 - ltv / 100)) : 0;
  const dpPercent = 100 - ltv;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
        <SelectField
          label="How will you use this property?"
          name="occupancy"
          register={register}
          errors={errors}
          options={OCCUPANCY_OPTIONS}
          required
        />

        {/* Purchase Price */}
        <CurrencyField
          label="Estimated Purchase Price"
          name="purchasePrice"
          register={register}
          errors={errors}
          required
          setValue={setValue}
          watch={watch}
        />

        {/* Down Payment — currency input + LTV slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Down Payment <span className="text-red-400">*</span>
          </label>

          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Currency input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                id="downPayment"
                type="text"
                inputMode="decimal"
                placeholder="0"
                defaultValue={dpAmount > 0 ? dpAmount.toLocaleString('en-US') : ''}
                key={sliderDriving ? `slider-${ltv}-${priceNum}` : 'manual'}
                onFocus={(e) => {
                  e.target.value = String(e.target.value).replace(/[^0-9.-]/g, '');
                }}
                onBlur={(e) => {
                  handleDpInputChange(e.target.value);
                  const num = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
                  if (!isNaN(num)) {
                    e.target.value = num.toLocaleString('en-US');
                    setValue('downPayment', num, { shouldValidate: true });
                  }
                }}
                onChange={() => {
                  setSliderDriving(false);
                }}
                className={`
                  w-full pl-7 pr-4 py-2.5 border rounded-lg outline-none transition-colors
                  ${errors?.downPayment
                    ? 'border-red-300 focus:ring-2 focus:ring-red-100 focus:border-red-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-brand/20 focus:border-brand'
                  }
                `}
              />
            </div>

            {/* LTV / Loan summary */}
            <div className="text-sm text-gray-500 pt-2.5">
              {priceNum > 0 ? (
                <>
                  <span className="font-medium text-gray-700">{dpPercent}% down</span>
                  {' '}/ Loan: {formatDollar(priceNum - dpAmount)} ({ltv}% LTV)
                </>
              ) : (
                <span className="text-gray-400">Enter a purchase price first</span>
              )}
            </div>
          </div>

          {/* Slider — only show when we have a price */}
          {priceNum > 0 && (
            <>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={ltv}
                onChange={(e) => {
                  setSliderDriving(true);
                  setLtv(parseInt(e.target.value));
                }}
                className="w-full h-2 mt-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand"
              />

              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>50% down</span>
                <span>20% down</span>
                <span>5%</span>
                <span>0%</span>
              </div>
            </>
          )}

          <p className="text-xs text-gray-400 mt-2">
            Type an amount or drag the slider. A larger down payment means a smaller loan and typically better rates. Most lenders require at least 3-5% down.
          </p>

          {errors?.downPayment && (
            <p className="text-xs text-red-500 mt-1">{errors.downPayment.message}</p>
          )}

          {/* Hidden input for form validation */}
          <input type="hidden" {...register('downPayment')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Property Type"
            name="propertyType"
            register={register}
            errors={errors}
            options={PROPERTY_TYPE_OPTIONS}
            required
          />
          {propertyType === 'multi_unit' && (
            <SelectField
              label="Number of Units"
              name="numUnits"
              register={register}
              errors={errors}
              options={UNIT_OPTIONS}
              required
            />
          )}
        </div>

        {/* Property Identified? */}
        <div>
          <label htmlFor="propertyIdentified" className="block text-sm font-medium text-gray-700 mb-1">
            Do you have a property in mind?
          </label>
          <select
            id="propertyIdentified"
            value={propertyIdentified}
            onChange={(e) => setPropertyIdentified(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            <option value="">Select...</option>
            <option value="yes">Yes, I have a property in mind</option>
            <option value="no">No, still looking</option>
          </select>
        </div>

        {propertyIdentified === 'yes' && (
          <AddressGroup
            prefix="propertyAddress"
            register={register}
            errors={errors}
            label="Property Address"
            setValue={setValue}
          />
        )}

        {propertyIdentified === 'no' && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
            No problem! The property address will be set to &ldquo;TBD&rdquo; for now. You can update it later with your loan officer.
          </div>
        )}

        {/* Navigation */}
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
            className="bg-go text-white px-6 py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors"
          >
            Next: Address &rarr;
          </button>
        </div>
      </div>
    </form>
  );
}
