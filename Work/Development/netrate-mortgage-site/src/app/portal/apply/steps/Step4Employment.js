// Step 4: Employment & Income
// Fields: Employment Status, Employer, Position, Years, Income, Other Income

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step4Schema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { TextField, SelectField, CurrencyField } from '@/components/Portal/FormFields';

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
];

export default function Step4Employment({ onNext, onBack }) {
  const { data, updateData } = useApplication();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      employmentStatus: data.employmentStatus || '',
      employerName: data.employerName || '',
      positionTitle: data.positionTitle || '',
      yearsInPosition: data.yearsInPosition ?? '',
      monthlyBaseIncome: data.monthlyBaseIncome ?? '',
      otherMonthlyIncome: data.otherMonthlyIncome ?? '',
      otherIncomeSource: data.otherIncomeSource || '',
    },
  });

  const employmentStatus = watch('employmentStatus');
  const otherMonthlyIncome = watch('otherMonthlyIncome');
  const showEmployerFields = employmentStatus === 'employed' || employmentStatus === 'self_employed';

  const onSubmit = (stepData) => {
    updateData(stepData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
        <SelectField
          label="Employment Status"
          name="employmentStatus"
          register={register}
          errors={errors}
          options={EMPLOYMENT_OPTIONS}
          required
        />

        {showEmployerFields && (
          <>
            <TextField
              label={employmentStatus === 'self_employed' ? 'Business Name' : 'Employer Name'}
              name="employerName"
              register={register}
              errors={errors}
              placeholder="Acme Corp"
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Position / Title"
                name="positionTitle"
                register={register}
                errors={errors}
                placeholder="Senior Engineer"
              />
              <TextField
                label="Years in Position"
                name="yearsInPosition"
                type="number"
                register={register}
                errors={errors}
                placeholder="3"
              />
            </div>
          </>
        )}

        <CurrencyField
          label="Monthly Base Income (gross)"
          name="monthlyBaseIncome"
          register={register}
          errors={errors}
          required
          setValue={setValue}
          watch={watch}
        />

        <div className="grid grid-cols-2 gap-4">
          <CurrencyField
            label="Other Monthly Income"
            name="otherMonthlyIncome"
            register={register}
            errors={errors}
            placeholder="0.00"
            setValue={setValue}
            watch={watch}
          />
          {parseFloat(otherMonthlyIncome) > 0 && (
            <TextField
              label="Source of Other Income"
              name="otherIncomeSource"
              register={register}
              errors={errors}
              placeholder="Rental income, alimony, etc."
            />
          )}
        </div>

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
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Next: Declarations →
          </button>
        </div>
      </div>
    </form>
  );
}
