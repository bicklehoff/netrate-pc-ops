'use client';

const SEVERITY_STYLES = {
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const SEVERITY_ICONS = {
  error: '\u26D4',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
};

export default function EligibilityPanel({ eligibility }) {
  if (!eligibility || eligibility.warnings.length === 0) return null;

  const errors = eligibility.warnings.filter(w => w.severity === 'error');
  const warns = eligibility.warnings.filter(w => w.severity === 'warning');
  const infos = eligibility.warnings.filter(w => w.severity === 'info');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Eligibility Check</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600 font-medium">
            {eligibility.eligibleLenders.length} eligible
          </span>
          {eligibility.ineligibleLenders.length > 0 && (
            <span className="text-amber-600 font-medium">
              {eligibility.ineligibleLenders.length} ineligible
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {errors.map((w, i) => (
          <WarningRow key={`e${i}`} warning={w} />
        ))}
        {warns.map((w, i) => (
          <WarningRow key={`w${i}`} warning={w} />
        ))}
        {infos.length > 0 && (
          <details className="group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              {infos.length} disclosure{infos.length > 1 ? 's' : ''} — click to expand
            </summary>
            <div className="mt-2 space-y-2">
              {infos.map((w, i) => (
                <WarningRow key={`i${i}`} warning={w} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function WarningRow({ warning }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${SEVERITY_STYLES[warning.severity]}`}>
      <span className="flex-shrink-0 mt-0.5">{SEVERITY_ICONS[warning.severity]}</span>
      <span>{warning.message}</span>
    </div>
  );
}
