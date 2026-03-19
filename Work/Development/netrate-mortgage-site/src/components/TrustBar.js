export default function TrustBar() {
  return (
    <div className="bg-surface border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">2013</span>
          <span className="text-sm text-gray-400">Licensed<br className="hidden sm:block" /> Since</span>
        </div>
        <div className="w-px h-8 bg-white/10 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">4</span>
          <span className="text-sm text-gray-400">States<br className="hidden sm:block" /> Licensed</span>
        </div>
        <div className="w-px h-8 bg-white/10 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">$0</span>
          <span className="text-sm text-gray-400">Upfront<br className="hidden sm:block" /> Fees</span>
        </div>
        <div className="w-px h-8 bg-white/10 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-white leading-none">A+</span>
          <span className="text-sm text-gray-400">BBB<br className="hidden sm:block" /> Rating</span>
        </div>
      </div>
    </div>
  );
}
