export default function TrustBar() {
  return (
    <div className="bg-gray-50 border-y border-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        <span className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          No application or credit pull
        </span>
        <span className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Real wholesale rates, updated daily
        </span>
        <span className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Compare multiple loan options
        </span>
      </div>
    </div>
  );
}
