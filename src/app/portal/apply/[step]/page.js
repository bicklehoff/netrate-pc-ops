// Portal Apply — Dynamic Step Route
// Renders the correct step component (2-6) based on the URL.
// Supports non-linear navigation: clicking a completed step in the
// StepIndicator jumps directly to that step without re-traversing.
// No auth required.

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApplication } from '@/components/Portal/ApplicationContext';
import StepIndicator from '@/components/Portal/StepIndicator';
import Step2Purchase from '../steps/Step2Purchase';
import Step2Refinance from '../steps/Step2Refinance';
import Step3Address from '../steps/Step3Address';
import Step4Employment from '../steps/Step4Employment';
import Step5Declarations from '../steps/Step5Declarations';
import Step6Review from '../steps/Step6Review';

const STEPS = ['About You', 'Property', 'Address', 'Employment', 'Declarations', 'Review'];

const STEP_TITLES = {
  2: { title: 'Property Details', description: 'Tell us about the property.' },
  3: { title: 'Address History', description: 'Where do you currently live?' },
  4: { title: 'Employment & Income', description: 'Your employment and income details.' },
  5: { title: 'Declarations', description: 'A few standard disclosure questions.' },
  6: { title: 'Review & Submit', description: 'Review your application before submitting.' },
};

export default function StepPage() {
  const params = useParams();
  const router = useRouter();
  const { data, setCurrentStep, stepCompletions } = useApplication();
  const step = parseInt(params.step, 10);

  // Scroll to top of the apply overlay when step changes
  useEffect(() => {
    const container = document.getElementById('apply-scroll-container');
    if (container) container.scrollTo({ top: 0 });
  }, [step]);

  // Validate step number
  if (isNaN(step) || step < 2 || step > 6) {
    router.push('/portal/apply');
    return null;
  }

  const { title, description } = STEP_TITLES[step] || {};

  const handleBack = () => {
    const prevStep = step - 1;
    setCurrentStep(prevStep);
    if (prevStep === 1) {
      router.push('/portal/apply');
    } else {
      router.push(`/portal/apply/${prevStep}`);
    }
  };

  const handleNext = () => {
    const nextStep = step + 1;
    setCurrentStep(nextStep);
    router.push(`/portal/apply/${nextStep}`);
  };

  // Non-linear step navigation — jump to any step that has data
  const handleStepClick = (targetStep) => {
    setCurrentStep(targetStep);
    if (targetStep === 1) {
      router.push('/portal/apply');
    } else {
      router.push(`/portal/apply/${targetStep}`);
    }
  };

  // Render the correct step component
  const renderStep = () => {
    switch (step) {
      case 2:
        return data.purpose === 'refinance' ? (
          <Step2Refinance onNext={handleNext} onBack={handleBack} />
        ) : (
          <Step2Purchase onNext={handleNext} onBack={handleBack} />
        );
      case 3:
        return <Step3Address onNext={handleNext} onBack={handleBack} />;
      case 4:
        return <Step4Employment onNext={handleNext} onBack={handleBack} />;
      case 5:
        return <Step5Declarations onNext={handleNext} onBack={handleBack} />;
      case 6:
        return <Step6Review onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <StepIndicator
        steps={STEPS}
        currentStep={step}
        stepCompletions={stepCompletions}
        onStepClick={handleStepClick}
      />

      <div className="mt-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500 mb-8">{description}</p>

        {renderStep()}
      </div>
    </div>
  );
}
