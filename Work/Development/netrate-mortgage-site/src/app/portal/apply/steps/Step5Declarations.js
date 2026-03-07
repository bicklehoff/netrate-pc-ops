// Step 5: Declarations — Full 1003 Sections 5a & 5b
// Matches Uniform Residential Loan Application (URLA) disclosure questions.
// Co-borrower: Shows borrower tabs when co-borrowers exist.

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step5Schema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import { YesNoField, SelectField, CurrencyField } from '@/components/Portal/FormFields';
import BorrowerTabs from '@/components/Portal/BorrowerTabs';
import CoBorrowerNav from '@/components/Portal/CoBorrowerNav';

const CITIZENSHIP_OPTIONS = [
  { value: 'citizen', label: 'U.S. Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident' },
  { value: 'non_permanent_resident', label: 'Non-Permanent Resident' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'PR', label: 'Primary Residence' },
  { value: 'SR', label: 'Second Residence' },
  { value: 'SH', label: 'Second Home' },
  { value: 'IP', label: 'Investment Property' },
];

const TITLE_HELD_OPTIONS = [
  { value: 'S', label: 'Solely by yourself' },
  { value: 'SP', label: 'Jointly with spouse' },
  { value: 'O', label: 'Jointly with another person' },
];

const BANKRUPTCY_CHAPTER_OPTIONS = [
  { value: '7', label: 'Chapter 7' },
  { value: '11', label: 'Chapter 11' },
  { value: '12', label: 'Chapter 12' },
  { value: '13', label: 'Chapter 13' },
];

export default function Step5Declarations({ onNext, onBack }) {
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
    resolver: zodResolver(step5Schema),
    defaultValues: {
      // Section 5a
      primaryResidence: data.primaryResidence ?? true,
      priorOwnership3Years: data.priorOwnership3Years ?? false,
      priorPropertyType: data.priorPropertyType || '',
      priorPropertyTitleHeld: data.priorPropertyTitleHeld || '',
      familyRelationshipSeller: data.familyRelationshipSeller ?? false,
      undisclosedBorrowing: data.undisclosedBorrowing ?? false,
      undisclosedBorrowingAmount: data.undisclosedBorrowingAmount ?? '',
      applyingForOtherMortgage: data.applyingForOtherMortgage ?? false,
      applyingForNewCredit: data.applyingForNewCredit ?? false,
      priorityLien: data.priorityLien ?? false,

      // Section 5b
      coSignerOnDebt: data.coSignerOnDebt ?? false,
      outstandingJudgments: data.outstandingJudgments ?? false,
      delinquentFederalDebt: data.delinquentFederalDebt ?? false,
      lawsuitParty: data.lawsuitParty ?? false,
      deedInLieu: data.deedInLieu ?? false,
      preForeclosureSale: data.preForeclosureSale ?? false,
      foreclosure: data.foreclosure ?? false,
      bankruptcy: data.bankruptcy ?? false,
      bankruptcyChapter: data.bankruptcyChapter || '',

      // General
      citizenshipStatus: data.citizenshipStatus || '',
    },
  });

  const primaryResidence = watch('primaryResidence');
  const priorOwnership3Years = watch('priorOwnership3Years');
  const undisclosedBorrowing = watch('undisclosedBorrowing');
  const bankruptcy = watch('bankruptcy');
  const isPurchase = data.purpose === 'purchase';

  const isTabComplete = (tabId) => {
    if (tabId === 'primary') {
      return !!data.citizenshipStatus;
    }
    const cb = data.coBorrowers?.find((c) => c.id === tabId);
    return !!cb?.declarations?.citizenshipStatus;
  };

  const onSubmit = (stepData) => {
    updateData(stepData);
    // Check co-borrower declarations are complete
    if (hasCoBorrowers) {
      const incomplete = data.coBorrowers.find(
        (cb) => !cb.declarations?.citizenshipStatus
      );
      if (incomplete) {
        setActiveTab(incomplete.id);
        return;
      }
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-6">

        {hasCoBorrowers && (
          <BorrowerTabs
            coBorrowers={data.coBorrowers}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isTabComplete={isTabComplete}
          />
        )}

        {/* ── Primary Borrower Declarations ────────────────────── */}
        {(!hasCoBorrowers || activeTab === 'primary') && (
          <>
            <p className="text-sm text-gray-500 -mt-1">
              Please answer these questions honestly. They are required on all mortgage applications per federal guidelines.
            </p>

            {/* ─── Section 5a: About this Property and Your Money ───── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                About this Property and Your Money
              </h3>
              <div className="space-y-5">
                <YesNoField
                  label="A. Will you occupy this property as your primary residence?"
                  name="primaryResidence"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />

                {primaryResidence && (
                  <div>
                    <YesNoField
                      label="A1. Besides the home you are buying / refinancing, have you owned any other property in the last 3 years?"
                      name="priorOwnership3Years"
                      register={register}
                      errors={errors}
                      watch={watch}
                      setValue={setValue}
                    />
                    <p className="text-xs text-gray-400 mt-2 ml-0.5">
                      This does <strong className="font-medium text-gray-500">not</strong> include
                      the home you are currently buying or refinancing. It means any <em>other</em> property
                      you have owned, co-owned, or been on the title of during the past three
                      years &mdash; including properties you sold, rented out, or held as an investment.
                    </p>
                  </div>
                )}

                {primaryResidence && priorOwnership3Years && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-gray-100">
                    <SelectField
                      label="A2. Type of property owned"
                      name="priorPropertyType"
                      register={register}
                      errors={errors}
                      options={PROPERTY_TYPE_OPTIONS}
                    />
                    <SelectField
                      label="How was title held?"
                      name="priorPropertyTitleHeld"
                      register={register}
                      errors={errors}
                      options={TITLE_HELD_OPTIONS}
                    />
                  </div>
                )}

                {isPurchase && (
                  <YesNoField
                    label="B. Do you have a family relationship or business affiliation with the seller of the property?"
                    name="familyRelationshipSeller"
                    register={register}
                    errors={errors}
                    watch={watch}
                    setValue={setValue}
                  />
                )}

                <YesNoField
                  label="C. Are you borrowing any money for this transaction (e.g., closing costs, down payment) that is not disclosed on this application?"
                  name="undisclosedBorrowing"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />

                {undisclosedBorrowing && (
                  <div className="pl-4 border-l-2 border-gray-100">
                    <CurrencyField
                      label="Amount of undisclosed borrowing"
                      name="undisclosedBorrowingAmount"
                      register={register}
                      errors={errors}
                      setValue={setValue}
                      watch={watch}
                    />
                  </div>
                )}

                <YesNoField
                  label="D1. Have you or will you be applying for a mortgage loan on another property before closing on this loan?"
                  name="applyingForOtherMortgage"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />

                <YesNoField
                  label="D2. Have you or will you be applying for any new credit (e.g., credit card, car loan) before closing on this loan?"
                  name="applyingForNewCredit"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />

                <YesNoField
                  label="E. Will this property be subject to a lien that could take priority over the first mortgage (e.g., clean energy / PACE financing)?"
                  name="priorityLien"
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                />
              </div>
            </div>

            {/* ─── Section 5b: About Your Finances ──────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                About Your Finances
              </h3>
              <div className="space-y-5">
                <YesNoField label="F. Are you a co-signer or guarantor on any debt or loan that is not disclosed on this application?" name="coSignerOnDebt" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="G. Are there any outstanding judgments against you?" name="outstandingJudgments" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="H. Are you currently delinquent or in default on a Federal debt?" name="delinquentFederalDebt" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="I. Are you a party to a lawsuit?" name="lawsuitParty" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="J. Have you conveyed title to any property in lieu of foreclosure in the past 7 years?" name="deedInLieu" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="K. Have you completed a pre-foreclosure sale or short sale in the past 7 years?" name="preForeclosureSale" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="L. Have you had property foreclosed upon in the last 7 years?" name="foreclosure" register={register} errors={errors} watch={watch} setValue={setValue} />
                <YesNoField label="M. Have you declared bankruptcy within the past 7 years?" name="bankruptcy" register={register} errors={errors} watch={watch} setValue={setValue} />

                {bankruptcy && (
                  <div className="pl-4 border-l-2 border-gray-100">
                    <SelectField label="Bankruptcy chapter" name="bankruptcyChapter" register={register} errors={errors} options={BANKRUPTCY_CHAPTER_OPTIONS} />
                  </div>
                )}
              </div>
            </div>

            {/* ─── General ──────────────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Citizenship
              </h3>
              <SelectField
                label="Citizenship Status"
                name="citizenshipStatus"
                register={register}
                errors={errors}
                options={CITIZENSHIP_OPTIONS}
                required
              />
            </div>
          </>
        )}

        {/* ── Co-Borrower Declarations ─────────────────────────── */}
        {hasCoBorrowers && activeTab !== 'primary' && (
          <CoBorrowerDeclarationsSection
            coBorrower={data.coBorrowers.find((cb) => cb.id === activeTab)}
            onUpdate={updateCoBorrower}
            isPurchase={isPurchase}
          />
        )}

        {/* Navigation */}
        {hasCoBorrowers ? (
          <CoBorrowerNav
            activeTab={activeTab}
            coBorrowers={data.coBorrowers}
            onBack={onBack}
            onTabChange={setActiveTab}
            nextStepLabel="Review"
            isTabComplete={isTabComplete}
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
              Next: Review &rarr;
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

// ─── Co-Borrower Declarations Section ────────────────────────────
// Simplified declarations for co-borrowers using controlled inputs.
// Focuses on Section 5b (finances) + citizenship since 5a is property-specific.

function CoBorrowerDeclarationsSection({ coBorrower, onUpdate }) {
  if (!coBorrower) return null;

  const decl = coBorrower.declarations || {};

  const setDecl = (field, value) => {
    onUpdate(coBorrower.id, {
      declarations: { ...decl, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 -mt-1">
        Please answer these questions for {coBorrower.firstName || 'the co-borrower'}.
      </p>

      {/* Section 5b — Finances */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          About {coBorrower.firstName || 'Co-Borrower'}&apos;s Finances
        </h3>
        <div className="space-y-5">
          <CoBorrowerYesNo label="F. Co-signer or guarantor on any undisclosed debt?" value={decl.coSignerOnDebt} onChange={(v) => setDecl('coSignerOnDebt', v)} />
          <CoBorrowerYesNo label="G. Any outstanding judgments?" value={decl.outstandingJudgments} onChange={(v) => setDecl('outstandingJudgments', v)} />
          <CoBorrowerYesNo label="H. Currently delinquent or in default on a Federal debt?" value={decl.delinquentFederalDebt} onChange={(v) => setDecl('delinquentFederalDebt', v)} />
          <CoBorrowerYesNo label="I. Party to a lawsuit?" value={decl.lawsuitParty} onChange={(v) => setDecl('lawsuitParty', v)} />
          <CoBorrowerYesNo label="J. Conveyed title in lieu of foreclosure in the past 7 years?" value={decl.deedInLieu} onChange={(v) => setDecl('deedInLieu', v)} />
          <CoBorrowerYesNo label="K. Pre-foreclosure sale or short sale in the past 7 years?" value={decl.preForeclosureSale} onChange={(v) => setDecl('preForeclosureSale', v)} />
          <CoBorrowerYesNo label="L. Property foreclosed upon in the last 7 years?" value={decl.foreclosure} onChange={(v) => setDecl('foreclosure', v)} />
          <CoBorrowerYesNo label="M. Declared bankruptcy within the past 7 years?" value={decl.bankruptcy} onChange={(v) => setDecl('bankruptcy', v)} />

          {decl.bankruptcy && (
            <div className="pl-4 border-l-2 border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bankruptcy chapter</label>
              <select
                value={decl.bankruptcyChapter || ''}
                onChange={(e) => setDecl('bankruptcyChapter', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">Select...</option>
                {BANKRUPTCY_CHAPTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Citizenship */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          Citizenship
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Citizenship Status <span className="text-red-400">*</span>
          </label>
          <select
            value={decl.citizenshipStatus || ''}
            onChange={(e) => setDecl('citizenshipStatus', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none transition-colors bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            <option value="">Select...</option>
            {CITIZENSHIP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// Simple Yes/No toggle for co-borrower declarations (controlled)
function CoBorrowerYesNo({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors border ${
            value === true
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors border ${
            value === false
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}
