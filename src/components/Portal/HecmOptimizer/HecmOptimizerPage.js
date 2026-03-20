'use client';

// useState removed — no longer needed after Save/Load removal
import { ScenarioProvider } from './ScenarioContext';
import BorrowerInputs from './BorrowerInputs';
import RateInputs from './RateInputs';
import ScenarioTable from './ScenarioTable';
import OptimizerGrid from './OptimizerGrid';
import RefiSection from './RefiSection';
import FeesSection from './FeesSection';
import ApplicationSection from './ApplicationSection';
import PrintView from './PrintView';
// SaveLoadModal removed — not borrower-facing

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 bg-yellow-50 border border-yellow-300 rounded" />
        Input
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 bg-emerald-50 border border-emerald-200 rounded" />
        Calculated
      </span>
    </div>
  );
}

function PageContent() {

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reverse Mortgage Calculator</h1>
          <p className="text-sm text-gray-500">See how much equity you could access with a reverse mortgage</p>
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 print:hidden"
          >
            Print
          </button>
        </div>
      </div>

      {/* Inputs */}
      <BorrowerInputs />
      <RateInputs />

      {/* Fee Calculation */}
      <FeesSection />

      {/* Scenario Table */}
      <ScenarioTable />

      {/* Optimizer Grid */}
      <OptimizerGrid />

      {/* Refi Analysis */}
      <RefiSection />

      {/* Application Details */}
      <ApplicationSection />

      {/* Print View (hidden on screen) */}
      <PrintView />

      {/* Save/Load removed — not borrower-facing */}
    </div>
  );
}

export default function HecmOptimizerPage() {
  return (
    <ScenarioProvider>
      <PageContent />
    </ScenarioProvider>
  );
}
