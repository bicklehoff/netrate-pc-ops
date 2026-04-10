'use client';

import { useState, useEffect } from 'react';
import { useScenario } from './ScenarioContext';

export default function SaveLoadModal({ open, onClose }) {
  const { state, rawState, results, loadState } = useScenario();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(null); // Currently loaded scenario ID
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) fetchScenarios();
  }, [open]);

  const fetchScenarios = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/mlo/hecm-scenarios');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setScenarios(data.scenarios || []);
    } catch {
      setError('Failed to load scenarios.');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { input_state: rawState, results };
      if (activeId) {
        await fetch(`/api/portal/mlo/hecm-scenarios/${activeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch('/api/portal/mlo/hecm-scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.scenario) setActiveId(data.scenario.id);
      }
      await fetchScenarios();
    } catch {
      setError('Failed to save.');
    }
    setSaving(false);
  };

  const handleSaveNew = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { input_state: rawState, results };
      const res = await fetch('/api/portal/mlo/hecm-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.scenario) setActiveId(data.scenario.id);
      await fetchScenarios();
    } catch {
      setError('Failed to save.');
    }
    setSaving(false);
  };

  const handleLoad = async (id) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/mlo/hecm-scenarios/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      if (data.scenario?.input_state) {
        loadState(data.scenario.input_state);
        setActiveId(id);
        onClose();
      }
    } catch {
      setError('Failed to load scenario.');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this scenario?')) return;
    try {
      await fetch(`/api/portal/mlo/hecm-scenarios/${id}`, { method: 'DELETE' });
      if (activeId === id) setActiveId(null);
      await fetchScenarios();
    } catch {
      setError('Failed to delete.');
    }
  };

  if (!open) return null;

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const fmtDollar = (v) => v ? '$' + Number(v).toLocaleString() : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-800">HECM Scenarios</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        {/* Save buttons */}
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : activeId ? 'Save' : 'Save New'}
          </button>
          {activeId && (
            <button
              onClick={handleSaveNew}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Save as New
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {state.borrower_name || 'Untitled'} {state.home_value > 0 ? `— ${fmtDollar(state.home_value)}` : ''}
          </span>
        </div>

        {/* Scenario list */}
        <div className="max-h-64 overflow-y-auto">
          {error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">Loading...</p>
          ) : scenarios.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">No saved scenarios</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-2 py-2 text-left font-medium">Home Value</th>
                  <th className="px-2 py-2 text-left font-medium">Updated</th>
                  <th className="px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b hover:bg-gray-50 ${s.id === activeId ? 'bg-cyan-50' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium">{s.borrower_name || 'Untitled'}</td>
                    <td className="px-2 py-2 text-gray-600">{fmtDollar(s.home_value)}</td>
                    <td className="px-2 py-2 text-gray-400">{fmtDate(s.updated_at)}</td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button
                        onClick={() => handleLoad(s.id)}
                        className="text-cyan-600 hover:text-cyan-700 font-medium"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
