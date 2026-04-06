// Portal Apply — Step 1: About You
// Fields: First Name, Last Name, Email, Phone, DOB, SSN, Loan Purpose
// No auth required — anyone can start an application.
// When other steps already have data (e.g., returning to re-enter SSN/DOB),
// shows a "Jump to Review" option so the user doesn't re-traverse every step.

'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step1Schema } from '@/lib/validations/application';
import { useApplication } from '@/components/Portal/ApplicationContext';
import StepIndicator from '@/components/Portal/StepIndicator';
import { TextField, SSNField, SelectField, PhoneField } from '@/components/Portal/FormFields';

const STEPS = ['About You', 'Property', 'Address', 'Employment', 'Declarations', 'Review'];

const PURPOSE_OPTIONS = [
  { value: 'purchase', label: 'Purchase a home' },
  { value: 'refinance', label: 'Refinance existing mortgage' },
];

export default function ApplyPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep, stepCompletions, brpLoading } = useApplication();

  // Detect if the user already has data in later steps (returning to re-enter PII)
  const hasLaterStepsData = stepCompletions[2] || stepCompletions[3] || stepCompletions[4] || stepCompletions[5];

  // Track whether to jump to review on submit
  const jumpToReviewRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      dob: data.dob,
      ssn: data.ssn,
      purpose: data.purpose,
    },
  });

  const onSubmit = (stepData) => {
    updateData(stepData);

    if (jumpToReviewRef.current) {
      // Jump directly to Review
      setCurrentStep(6);
      router.push('/portal/apply/6');
    } else {
      setCurrentStep(2);
      router.push('/portal/apply/2');
    }
    jumpToReviewRef.current = false;
  };

  // Non-linear step navigation — jump to any step that has data
  const handleStepClick = (targetStep) => {
    setCurrentStep(targetStep);
    if (targetStep === 1) {
      // Already here
      return;
    }
    router.push(`/portal/apply/${targetStep}`);
  };

  // Wait for BRP pre-fill before rendering form (prevents stale defaultValues)
  if (brpLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your scenario details...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator
        steps={STEPS}
        currentStep={1}
        stepCompletions={stepCompletions}
        onStepClick={handleStepClick}
      />

      <div className="mt-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Let&apos;s get started
        </h1>
        <p className="text-gray-500 mb-8">
          Tell us about yourself. This information is encrypted and secure.
        </p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
            {/* Returning-user callout when other steps have data */}
            {hasLaterStepsData && (!data.ssn || !data.dob) && (
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Welcome back — just re-enter your SSN and date of birth
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Your other information is saved. After confirming this step you can jump straight to Review.
                  </p>
                </div>
              </div>
            )}

            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="First Name"
                name="firstName"
                register={register}
                errors={errors}
                required
                placeholder="John"
              />
              <TextField
                label="Last Name"
                name="lastName"
                register={register}
                errors={errors}
                required
                placeholder="Doe"
              />
            </div>

            {/* Email */}
            <TextField
              label="Email"
              name="email"
              type="email"
              register={register}
              errors={errors}
              required
              placeholder="john@example.com"
              helper="This becomes your portal login."
            />

            {/* Phone — auto-formatted as (XXX) XXX-XXXX */}
            <PhoneField
              name="phone"
              setValue={setValue}
              watch={watch}
              errors={errors}
              helper="We'll text a verification code to this number when you log in to check your loan status."
            />

            {/* Security callout before PII fields */}
            <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4 -mb-1">
              <svg className="w-5 h-5 text-brand mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Your information is protected</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  This page is secured with SSL encryption. Your SSN and date of birth are
                  encrypted with AES-256 before storage and are never saved in your browser.
                </p>
              </div>
            </div>

            {/* DOB and SSN Row */}
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Date of Birth"
                name="dob"
                type="date"
                register={register}
                errors={errors}
                required
              />
              <SSNField
                label="Social Security Number"
                name="ssn"
                register={register}
                errors={errors}
                setValue={setValue}
                watch={watch}
              />
            </div>

            {/* Loan Purpose */}
            <SelectField
              label="What would you like to do?"
              name="purpose"
              register={register}
              errors={errors}
              options={PURPOSE_OPTIONS}
              required
              placeholder="Select loan purpose..."
            />

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4">
              <div />
              <div className="flex items-center gap-3">
                {/* Jump to Review — only show when returning to re-enter PII */}
                {hasLaterStepsData && (
                  <button
                    type="submit"
                    onClick={() => { jumpToReviewRef.current = true; }}
                    className="text-brand border border-brand px-5 py-2.5 rounded-lg font-medium hover:bg-brand/5 transition-colors"
                  >
                    Skip to Review &rarr;
                  </button>
                )}
                <button
                  type="submit"
                  onClick={() => { jumpToReviewRef.current = false; }}
                  className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
                >
                  Next: Property &rarr;
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-4">
                Have questions? <a href="/book" className="text-brand hover:text-brand-dark underline">Schedule a call with David &rarr;</a>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
