// Step 4: Employment & Income
// Fields: Employment Status, Employer, Position, Years, Income, Other Income
// Co-borrower: Shows borrower tabs when co-borrowers exist.

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step4Schema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { TextField, SelectField, CurrencyField } from '@/components/Portal/FormFields';
import BorrowerTabs from '@/components/Portal/BorrowerTabs';

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
];

export default function Step4Employment({ onNext, onBack }) {
  const { data, updateData, updateCoBorrower } = useApplication();

  const hasCoBorrowers = data.coBorrowers?.length > 0;
  const [activeTab, setActiveTab] = useState('primary');

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

  const isTabComplete = (tabId) => {
    if (tabId === 'primary') {
      return !!(data.employmentStatus && data.monthlyBaseIncome);
    }
    const cb = data.coBorrowers?.find((c) => c.id === tabId);
    return !!(cb?.employmentStatus && cb?.monthlyBaseIncome);
  };

  const onSubmit = (stepData) => {
    updateData(stepData);
    // If co-borrowers exist, check all tabs before advancing
    if (hasCoBorrowers) {
      const allComplete = data.coBorrowers.every(
        (cb) => cb.employmentStatus && cb.monthlyBaseIncome
      );
      if (!allComplete) {
        // Switch to first incomplete co-borrower tab
        const incomplete = data.coBorrowers.find(
          (cb) => !cb.employmentStatus || !cb.monthlyBaseIncome
        );
        if (incomplete) {
          setActiveTab(incomplete.id);
          return;
        }
      }
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">

        {hasCoBorrowers && (
          <BorrowerTabs
            coBorrowers={data.coBorrowers}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isTabComplete={isTabComplete}
          />
        )}

        {/* ── Primary Borrower Employment ──────────────────────── */}
        {(!hasCoBorrowers || activeTab === 'primary') && (
          <>
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
          </>
        )}

        {/* ── Co-Borrower Employment ───────────────────────────── */}
        {hasCoBorrowers && activeTab !== 'primary' && (
          <CoBorrowerEmploymentSection
            coBorrower={data.coBorrowers.find((cb) => cb.id === activeTab)}
            onUpdate={updateCoBorrower}
          />
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
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Next: Declarations &rarr;
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Co-Borrower Employment Section ─────────────────────────────
// Controlled inputs bound to ApplicationContext co-borrower data.

function CoBorrowerEmploymentSection({ coBorrower, onUpdate }) {
  if (!coBorrower) return null;

  const handleChange = (field, value) => {
    onUpdate(coBorrower.id, { [field]: value });
  };

  const showEmployerFields =
    coBorrower.employmentStatus === 'employed' || coBorrower.employmentStatus === 'self_employed';

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Employment Status <span className="text-red-400">*</span>
        </label>
        <select
          value={coBorrower.employmentStatus || ''}
          onChange={(e) => handleChange('employmentStatus', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">Select...</option>
          {EMPLOYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {showEmployerFields && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {coBorrower.employmentStatus === 'self_employed' ? 'Business Name' : 'Employer Name'}
            </label>
            <input
              type="text"
              value={coBorrower.employerName || ''}
              onChange={(e) => handleChange('employerName', e.target.value)}
              placeholder="Acme Corp"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position / Title</label>
              <input
                type="text"
                value={coBorrower.positionTitle || ''}
                onChange={(e) => handleChange('positionTitle', e.target.value)}
                placeholder="Senior Engineer"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years in Position</label>
              <input
                type="number"
                value={coBorrower.yearsInPosition ?? ''}
                onChange={(e) => handleChange('yearsInPosition', e.target.value)}
                placeholder="3"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Monthly Base Income (gross) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={coBorrower.monthlyBaseIncome ?? ''}
            onChange={(e) => handleChange('monthlyBaseIncome', e.target.value.replace(/[^0-9.-]/g, ''))}
            placeholder="0.00"
            className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Other Monthly Income</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={coBorrower.otherMonthlyIncome ?? ''}
              onChange={(e) => handleChange('otherMonthlyIncome', e.target.value.replace(/[^0-9.-]/g, ''))}
              placeholder="0.00"
              className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        </div>
        {parseFloat(coBorrower.otherMonthlyIncome) > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source of Other Income</label>
            <input
              type="text"
              value={coBorrower.otherIncomeSource || ''}
              onChange={(e) => handleChange('otherIncomeSource', e.target.value)}
              placeholder="Rental income, alimony, etc."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        )}
      </div>
    </div>
  );
}
