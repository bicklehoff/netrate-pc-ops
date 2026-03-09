// Co-Borrower Prompt — conditional UI after marital status selection
// Married → "Add spouse as co-borrower?"
// Unmarried/Separated → info about separate applications

'use client';

export default function CoBorrowerPrompt({ maritalStatus, hasCoBorrowers, onAddSpouse, onDeclineCoBorrower, coBorrowerCount, showError }) {
  if (!maritalStatus) return null;

  // ── Married: offer to add spouse ──────────────────────────────
  if (maritalStatus === 'married' && !hasCoBorrowers) {
    return (
      <div className={`rounded-lg p-4 ${showError ? 'bg-red-50 border border-red-300' : 'bg-cyan-50 border border-cyan-200'}`}>
        <p className="text-sm text-gray-700 mb-3">
          Would you like to add your spouse as a co-borrower on this application?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onAddSpouse()}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            Yes, Add Spouse
          </button>
          <button
            type="button"
            onClick={() => onDeclineCoBorrower?.()}
            className="px-4 py-2 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
          >
            No, Continue Solo
          </button>
        </div>
        {showError && (
          <p className="text-xs text-red-600 mt-2">Please select one of the options above to continue.</p>
        )}
      </div>
    );
  }

  // ── Married with existing co-borrower(s): show "add another" option ──
  if (maritalStatus === 'married' && hasCoBorrowers && coBorrowerCount < 3) {
    return (
      <button
        type="button"
        onClick={() => onAddSpouse()}
        className="text-sm text-brand font-medium hover:text-brand-dark transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Another Co-Borrower
      </button>
    );
  }

  // ── Unmarried / Separated: info about separate applications ──
  if (maritalStatus === 'unmarried' || maritalStatus === 'separated') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">Adding a co-borrower?</span>{' '}
          Non-married co-borrowers must submit a separate application. You can send them a link
          to apply after you complete yours.
        </p>
      </div>
    );
  }

  return null;
}
