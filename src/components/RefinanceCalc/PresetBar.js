'use client';

const PRESETS = [
  {
    key: 'noCost',
    label: 'No-Cost',
    desc: 'Lender credit covers closing costs',
    color: 'border-emerald-500 bg-emerald-50 text-emerald-800',
    inactive: 'border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50/50',
  },
  {
    key: 'zeroOop',
    label: 'Zero Out of Pocket',
    desc: 'Roll everything into the loan',
    color: 'border-blue-500 bg-blue-50 text-blue-800',
    inactive: 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50',
  },
  {
    key: 'lowestRate',
    label: 'Lowest Rate',
    desc: 'Pay points for the best rate',
    color: 'border-purple-500 bg-purple-50 text-purple-800',
    inactive: 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50/50',
  },
  {
    key: 'custom',
    label: 'Custom',
    desc: 'Pick any rate from the curve',
    color: 'border-gray-500 bg-gray-50 text-gray-800',
    inactive: 'border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50/50',
  },
];

export default function PresetBar({ activePreset, onPresetChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map(p => {
        const isActive = activePreset === p.key;
        return (
          <button
            key={p.key}
            onClick={() => onPresetChange(p.key)}
            className={`border-2 rounded-xl px-4 py-2.5 text-left transition-all ${isActive ? p.color : p.inactive}`}
          >
            <div className="text-sm font-semibold leading-tight">{p.label}</div>
            <div className={`text-xs mt-0.5 ${isActive ? 'opacity-80' : 'text-gray-400'}`}>{p.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
