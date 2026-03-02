// Step 3: Address History
// Fields: Current Address (with same-as-subject option), Duration, Mailing Address, Marital Status

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step3Schema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { TextField, SelectField, AddressGroup } from '@/components/Portal/FormFields';

const MARITAL_OPTIONS = [
  { value: 'married', label: 'Married' },
  { value: 'unmarried', label: 'Unmarried' },
  { value: 'separated', label: 'Separated' },
];

export default function Step3Address({ onNext, onBack }) {
  const { data, updateData } = useApplication();

  // Track whether current address is same as subject property
  const [sameAsProperty, setSameAsProperty] = useState(
    data.currentAddressSameAsProperty ?? false
  );

  // Only show checkbox if we have a property address from Step 2
  const hasPropertyAddress = data.propertyAddress?.street?.trim();

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

  // When same-as-property is toggled on, fill address from property data
  useEffect(() => {
    if (sameAsProperty && data.propertyAddress) {
      setValue('currentAddress.street', data.propertyAddress.street || '');
      setValue('currentAddress.city', data.propertyAddress.city || '');
      setValue('currentAddress.state', data.propertyAddress.state || '');
      setValue('currentAddress.zip', data.propertyAddress.zip || '');
    }
  }, [sameAsProperty, data.propertyAddress, setValue]);

  const onSubmit = (stepData) => {
    // If mailing is same, clear mailing address data
    if (stepData.mailingAddressSame) {
      stepData.mailingAddress = null;
    }
    // Persist the same-as-property preference
    stepData.currentAddressSameAsProperty = sameAsProperty;
    updateData(stepData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
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
            placeholder="5"
          />
          <TextField
            label="Months (if less than 1 year)"
            name="addressMonths"
            type="number"
            register={register}
            errors={errors}
            placeholder="0"
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

        <SelectField
          label="Marital Status"
          name="maritalStatus"
          register={register}
          errors={errors}
          options={MARITAL_OPTIONS}
          required
        />

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
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Next: Employment &rarr;
          </button>
        </div>
      </div>
    </form>
  );
}
