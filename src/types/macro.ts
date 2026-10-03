// Tipos del bloque macro. Espejo de api/_lib/providers/fred.ts.

export type MacroFrequency = 'diaria' | 'semanal' | 'mensual';
export type MacroGroup = 'liquidez' | 'politica' | 'crecimiento' | 'condiciones';
export type MacroFormat = 'pct' | 'pp' | 'indice' | 'difusion' | 'usd-bn';
export type MacroTrend = 'sube' | 'baja' | 'estable';

export interface MacroHistoryPoint {
  period: string;
  value: number;
  at: string;
}

export interface MacroSeries {
  id: string;
  fredId: string;
  label: string;
  group: MacroGroup;
  format: MacroFormat;
  unit: string;
  value: number;
  /** Fecha REAL de la observación (YYYY-MM-DD). */
  observedAt: string;
  previous: number | null;
  previousAt: string | null;
  change: number | null;
  changeLabel: string;
  trend: MacroTrend | null;
  /** Dato al inicio de la ventana de la tendencia. Ausente en respuestas antiguas. */
  trendFrom?: { value: number; at: string } | null;
  spark: number[];
  frequency: MacroFrequency;
  cadence: string;
  /** Cuándo lo obtuvo el servidor de FRED (ISO). */
  fetchedAt: string;
  definicion: string;
  history?: MacroHistoryPoint[];
}

export interface MacroMissing {
  id: string;
  label: string;
  reason: string;
}

export interface MacroData {
  series: MacroSeries[];
  missing: MacroMissing[];
}

export interface MacroResponse {
  macro: MacroData | null;
}
