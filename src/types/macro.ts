// Tipos del bloque macro (/api/macro). Espejo de api/_lib/providers/fred.ts.

export type MacroFrequency = 'diaria' | 'semanal' | 'mensual';

export interface MacroHistoryPoint {
  period: string;
  value: number;
  at: string;
}

export interface MacroSeries {
  id: string;
  fredId: string;
  label: string;
  value: number;
  unit: string;
  observedAt: string;
  frequency: MacroFrequency;
  change: number | null;
  changeLabel: string;
  definicion: string;
  history?: MacroHistoryPoint[];
}

export interface MacroData {
  series: MacroSeries[];
}

export interface MacroResponse {
  macro: MacroData | null;
}
