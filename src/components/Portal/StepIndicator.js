// Step Indicator — Progress bar for the multi-step application wizard
// Shows all steps with current/completed/upcoming states.
// Completed steps (with data) show a checkmark and are clickable for non-linear navigation.

'use client';

export default function StepIndicator({ steps, currentStep, stepCompletions, onStepClick }) {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        {steps.map((label, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          // A step is "done" if the user has progressed past it OR it has data
          const hasData = stepCompletions?.[stepNum] ?? false;
          const isPast = stepNum < currentStep;
          // Step 6 (Review) is reachable when all prior steps (1-5) have data
          const allPriorComplete = stepNum === 6
            && stepCompletions?.[1] && stepCompletions?.[2] && stepCompletions?.[3]
            && stepCompletions?.[4] && stepCompletions?.[5];
          const isCompleted = isPast || hasData || allPriorComplete;
          // Clickable if it has data and isn't the current step, OR it's any past step,
          // OR it's Review and all prior steps are complete
          const isClickable = !isActive && (hasData || isPast || allPriorComplete);

          const handleClick = () => {
            if (isClickable && onStepClick) {
              onStepClick(stepNum);
            }
          };

          return (
            <div key={label} className="flex items-center flex-1 last:flex-initial">
              {/* Step Circle + Label */}
              <div
                className={`flex flex-col items-center ${isClickable ? 'cursor-pointer group' : ''}`}
                onClick={handleClick}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
              >
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-200
                    ${isCompleted && !isActive
                      ? 'bg-brand text-white group-hover:ring-4 group-hover:ring-brand/20'
                      : isActive
                        ? 'bg-brand text-white ring-4 ring-brand/20'
                        : 'bg-gray-200 text-ink-subtle'
                    }
                  `}
                >
                  {isCompleted && !isActive ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`
                    mt-1.5 text-xs font-medium hidden sm:block transition-colors
                    ${isActive
                      ? 'text-brand'
                      : isCompleted
                        ? 'text-ink-mid group-hover:text-brand'
                        : 'text-ink-subtle'
                    }
                  `}
                >
                  {label}
                </span>
              </div>

              {/* Connector Line (skip after last step) */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 mb-5 sm:mb-0
                    ${isCompleted ? 'bg-brand' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
