// Co-Borrower Navigation — Bottom context banner + smart Next button
// Shows whose info you're currently filling in and what the Next button will actually do.
// Used in Steps 3, 4, 5 when co-borrowers exist.

'use client';

export default function CoBorrowerNav({
  activeTab,
  coBorrowers,
  onBack,
  onTabChange,
  nextStepLabel, // e.g., "Employment", "Declarations", "Review"
  isTabComplete, // function(tabId) => boolean
}) {
  const hasCoBorrowers = coBorrowers?.length > 0;

  // Find the current borrower's name
  const isOnPrimary = activeTab === 'primary';
  const activeCoBorrower = !isOnPrimary
    ? coBorrowers?.find((cb) => cb.id === activeTab)
    : null;
  const activeName = isOnPrimary
    ? 'your'
    : activeCoBorrower?.firstName
      ? `${activeCoBorrower.firstName}'s`
      : "co-borrower's";

  // Figure out what the Next button should say
  let nextLabel = `Next: ${nextStepLabel} \u2192`;
  let nextIncompleteTab = null;

  if (hasCoBorrowers) {
    // Check if there's an incomplete tab after the current one
    const allTabs = ['primary', ...coBorrowers.map((cb) => cb.id)];
    const currentIdx = allTabs.indexOf(activeTab);

    for (let i = currentIdx + 1; i < allTabs.length; i++) {
      if (!isTabComplete(allTabs[i])) {
        nextIncompleteTab = allTabs[i];
        break;
      }
    }

    // Also check tabs before current (user might have skipped)
    if (!nextIncompleteTab) {
      for (let i = 0; i < currentIdx; i++) {
        if (!isTabComplete(allTabs[i])) {
          nextIncompleteTab = allTabs[i];
          break;
        }
      }
    }

    if (nextIncompleteTab) {
      if (nextIncompleteTab === 'primary') {
        nextLabel = 'Next: Complete Your Info \u2192';
      } else {
        const cb = coBorrowers.find((c) => c.id === nextIncompleteTab);
        const cbName = cb?.firstName || 'Co-Borrower';
        nextLabel = `Next: ${cbName}'s Info \u2192`;
      }
    }
  }

  return (
    <>
      {/* Context banner — only when co-borrowers exist */}
      {hasCoBorrowers && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
          isOnPrimary
            ? 'bg-brand/5 border border-brand/20 text-brand'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>
            {isOnPrimary
              ? 'Filling in your information'
              : `Filling in ${activeName} information`}
          </span>
          {/* Quick-switch links */}
          <span className="ml-auto flex gap-2 text-xs">
            {!isOnPrimary && (
              <button
                type="button"
                onClick={() => { onTabChange('primary'); window.scrollTo({ top: 200, behavior: 'smooth' }); }}
                className="underline hover:no-underline"
              >
                Switch to yours
              </button>
            )}
            {isOnPrimary && coBorrowers.map((cb) => (
              <button
                key={cb.id}
                type="button"
                onClick={() => { onTabChange(cb.id); window.scrollTo({ top: 200, behavior: 'smooth' }); }}
                className="underline hover:no-underline"
              >
                Switch to {cb.firstName || 'co-borrower'}
              </button>
            ))}
          </span>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium transition-colors"
        >
          &larr; Back
        </button>
        {nextIncompleteTab && hasCoBorrowers ? (
          <button
            type="button"
            onClick={() => {
              onTabChange(nextIncompleteTab);
              window.scrollTo({ top: 200, behavior: 'smooth' });
            }}
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            {nextLabel}
          </button>
        ) : (
          <button
            type="submit"
            className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Next: {nextStepLabel} &rarr;
          </button>
        )}
      </div>
    </>
  );
}
