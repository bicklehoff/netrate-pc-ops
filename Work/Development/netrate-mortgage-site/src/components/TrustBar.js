export default function TrustBar() {
  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">11</span>
          <span className="text-sm text-gray-400">Wholesale<br className="hidden sm:block" /> Lenders</span>
        </div>
        <div className="w-px h-8 bg-gray-700 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">13</span>
          <span className="text-sm text-gray-400">Years in<br className="hidden sm:block" /> Business</span>
        </div>
        <div className="w-px h-8 bg-gray-700 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">$26.6M</span>
          <span className="text-sm text-gray-400">Funded<br className="hidden sm:block" /> in 2025</span>
        </div>
        <div className="w-px h-8 bg-gray-700 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">87.7%</span>
          <span className="text-sm text-gray-400">App-to-Fund<br className="hidden sm:block" /> Rate</span>
        </div>
      </div>
    </div>
  );
}
