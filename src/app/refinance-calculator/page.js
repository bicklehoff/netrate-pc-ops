'use client';

import { getCurrentModule } from '@/lib/calc-modules';

export default function RefinanceCalculatorPage() {
  // Local var named `mod` not `module` — Next.js ESLint reserves `module`.
  const mod = getCurrentModule('refinance-calculator');
  if (!mod) {
    throw new Error('Module refinance-calculator not registered');
  }
  const Standalone = mod.views.standalone;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Standalone />
      </div>
    </div>
  );
}
