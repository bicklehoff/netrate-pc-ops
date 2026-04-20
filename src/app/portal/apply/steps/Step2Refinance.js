// Step 2: Property Details — Refinance Path
// Fields: Refi Purpose, Occupancy, Estimated Value, Current Balance, Cash Out, Address, Type

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step2RefinanceSchema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { SelectField, CurrencyField, AddressGroup } from '@/components/Portal/FormFields';

const REFI_PURPOSE_OPTIONS = [
  { value: 'rate_term',  label: 'Lower My Rate' },
  { value: 'limited',    label: 'Limited Cash-Out' },
  { value: 'cashout',    label: 'Cash Out Equity' },
  { value: 'streamline', label: 'Streamline / FHA / VA' },
];

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

export default function Step2Refinance({ onNext, onBack }) {
  const { data, updateData } = useApplication();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(step2RefinanceSchema),
    defaultValues: {
      refiPurpose: data.refiPurpose || '',
      occupancy: data.occupancy || '',
      estimatedValue: data.estimatedValue ?? '',
      currentBalance: data.currentBalance ?? '',
      cashOutAmount: data.cashOutAmount ?? '',
      propertyAddress: data.propertyAddress || { street: '', city: '', state: '', zip: '' },
      propertyType: data.propertyType || '',
      numUnits: data.numUnits ?? '',
    },
  });

  const refiPurpose = watch('refiPurpose');
  const propertyType = watch('propertyType');
  const estimatedValue = watch('estimatedValue');
  const currentBalance = watch('currentBalance');
  const cashOutAmount = watch('cashOutAmount');

  // Compute LTV for refinances
  const ltvPct = (() => {
    const val = parseFloat(estimatedValue) || 0;
    const bal = parseFloat(currentBalance) || 0;
    const cash = refiPurpose === 'cashout' ? (parseFloat(cashOutAmount) || 0) : 0;
    if (val <= 0) return null;
    return ((bal + cash) / val) * 100;
  })();

  const onSubmit = (stepData) => {
    updateData(stepData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
        <SelectField
          label="Refinance Purpose"
          name="refiPurpose"
          register={register}
          errors={errors}
          options={REFI_PURPOSE_OPTIONS}
          required
        />

        <SelectField
          label="How do you use this property?"
          name="occupancy"
          register={register}
          errors={errors}
          options={OCCUPANCY_OPTIONS}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <CurrencyField
            label="Estimated Property Value"
            name="estimatedValue"
            register={register}
            errors={errors}
            required
            setValue={setValue}
            watch={watch}
          />
          <CurrencyField
            label="Current Mortgage Balance"
            name="currentBalance"
            register={register}
            errors={errors}
            required
            setValue={setValue}
            watch={watch}
          />
        </div>

        {/* LTV Indicator — computed from estimated value and balance */}
        {ltvPct !== null && (
          <div className="rounded-lg border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Estimated Loan-to-Value (LTV)</span>
              <span className={`text-sm font-semibold ${
                ltvPct <= 80 ? 'text-green-600' : ltvPct <= 90 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {ltvPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  ltvPct <= 80 ? 'bg-green-500' : ltvPct <= 90 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(ltvPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {ltvPct <= 80
                ? 'Great — under 80% LTV typically means no private mortgage insurance (PMI).'
                : ltvPct <= 90
                  ? 'Between 80-90% LTV — PMI may be required.'
                  : 'Over 90% LTV — higher rates and PMI are likely. Consider adjusting your cash-out amount.'}
            </p>
          </div>
        )}

        {refiPurpose === 'cashout' && (
          <CurrencyField
            label="Cash-Out Amount"
            name="cashOutAmount"
            register={register}
            errors={errors}
            required
            setValue={setValue}
            watch={watch}
          />
        )}

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

        <AddressGroup
          prefix="propertyAddress"
          register={register}
          errors={errors}
          label="Property Address"
          setValue={setValue}
        />

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium transition-colors"
          >
            ← Back
          </button>
          <button
            type="submit"
            className="bg-go text-white px-6 py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors"
          >
            Next: Address →
          </button>
        </div>
      </div>
    </form>
  );
}
