// Shared chart configuration for Rate Tool visualizations
// Used by RateCostChart and BreakEvenChart

export const CHART_COLORS = {
  brand: '#0891b2',
  brandDark: '#164e63',
  credit: '#059669',       // green-600
  creditLight: '#dcfce7',  // green-100
  cost: '#dc2626',         // red-600
  costLight: '#fee2e2',    // red-100
  savings: '#059669',
  savingsLight: '#d1fae5',
  costLine: '#dc2626',
  neutral: '#64748b',      // gray-500
  grid: '#e2e8f0',         // gray-200
};

export const CHART_FONTS = {
  tick: { fontSize: 11, fontFamily: 'Inter, sans-serif', fill: '#64748b' },
  label: { fontSize: 12, fontFamily: 'Inter, sans-serif', fill: '#334155' },
};

export const TOOLTIP_STYLE = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

export function formatDollar(value) {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const prefix = value < 0 ? '-' : '';
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}K`;
  return `${prefix}$${abs.toFixed(0)}`;
}

export function formatDollarFull(value) {
  if (value === null || value === undefined) return '—';
  const prefix = value < 0 ? '-' : '';
  return `${prefix}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatRate(value) {
  return `${value.toFixed(3)}%`;
}

export function formatPI(value) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
