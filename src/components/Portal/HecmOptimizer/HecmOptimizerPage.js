'use client';

import { useState } from 'react';
import { ScenarioProvider } from './ScenarioContext';
import BorrowerInputs from './BorrowerInputs';
import RateInputs from './RateInputs';
import ScenarioTable from './ScenarioTable';
import OptimizerGrid from './OptimizerGrid';
import RefiSection from './RefiSection';
import FeesSection from './FeesSection';
import ApplicationSection from './ApplicationSection';
import PrintView from './PrintView';
import SaveLoadModal from './SaveLoadModal';

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
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">HECM Optimizer</h1>
          <p className="text-sm text-gray-500">Reverse mortgage scenario comparison & margin optimizer</p>
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          <button
            onClick={() => setShowSaveLoad(true)}
            className="px-3 py-1.5 text-xs font-medium text-cyan-600 border border-cyan-300 rounded hover:bg-cyan-50 print:hidden"
          >
            Save / Load
          </button>
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

      {/* Save/Load Modal */}
      <SaveLoadModal open={showSaveLoad} onClose={() => setShowSaveLoad(false)} />
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
