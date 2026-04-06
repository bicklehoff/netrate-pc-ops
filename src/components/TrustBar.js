export default function TrustBar() {
  return (
    <div className="bg-[#F5F7FA] border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-brand leading-none">2013</span>
          <span className="text-sm text-[#6B7280]">Licensed<br className="hidden sm:block" /> Since</span>
        </div>
        <div className="w-px h-8 bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-brand leading-none">CA · CO · OR · TX</span>
        </div>
        <div className="w-px h-8 bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-brand leading-none">$0</span>
          <span className="text-sm text-[#6B7280]">Upfront<br className="hidden sm:block" /> Fees</span>
        </div>
        <div className="w-px h-8 bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-extrabold text-brand leading-none">A+</span>
          <span className="text-sm text-[#6B7280]">BBB<br className="hidden sm:block" /> Rating</span>
        </div>
      </div>
    </div>
  );
}
