// Co-Borrower Navigation — Smart Next button for multi-borrower steps.
// Checks if any borrower tab still needs data; if so, routes there before advancing.
// Tab switching is handled by BorrowerTabs at the top — no duplicate switch links here.
// Used in Steps 3, 4, 5 when co-borrowers exist.

'use client';

export default function CoBorrowerNav({
  activeTab,
  coBorrowers,
  onBack,
  onTabChange,
  nextStepLabel, // e.g., "Employment", "Declarations", "Review"
  isTabComplete, // function(tabId) => boolean
  sectionLabel = 'Info', // e.g., "Address", "Employment" — clarifies what's incomplete
}) {
  const hasCoBorrowers = coBorrowers?.length > 0;

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
        nextLabel = `Next: Your ${sectionLabel} \u2192`;
      } else {
        const cb = coBorrowers.find((c) => c.id === nextIncompleteTab);
        const cbName = cb?.firstName || 'Co-Borrower';
        nextLabel = `Next: ${cbName}\u2019s ${sectionLabel} \u2192`;
      }
    }
  }

  return (
    <div className="flex justify-between pt-4">
      <button
        type="button"
        onClick={onBack}
        className="text-ink-subtle hover:text-ink-mid px-4 py-2.5 font-medium transition-colors"
      >
        &larr; Back
      </button>
      {nextIncompleteTab && hasCoBorrowers ? (
        <button
          type="button"
          onClick={() => {
            onTabChange(nextIncompleteTab);
            const container = document.getElementById('apply-scroll-container');
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="bg-go text-white px-6 py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors"
        >
          {nextLabel}
        </button>
      ) : (
        <button
          type="submit"
          className="bg-go text-white px-6 py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors"
        >
          Next: {nextStepLabel} &rarr;
        </button>
      )}
    </div>
  );
}
