// Helpers de estilo para Recharts que leen las variables CSS del tema activo,
// de modo que los gráficos se adaptan a modo claro/oscuro automáticamente.

export function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v.trim() || fallback;
}

export const AXIS_TICK = { fontSize: 11 };

export const PALETTE = {
  btc: '#f59e0b',
  btcDeep: '#ea580c',
  bull: '#22c55e',
  bear: '#ef4444',
  macro: '#3b82f6',
  violet: '#8b5cf6',
};
