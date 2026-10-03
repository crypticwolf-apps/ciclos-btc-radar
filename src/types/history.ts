// =============================================================================
// Series históricas que el backend deriva de la serie diaria real de precio
// (ver `api/_lib/providers/history.ts`). Espejo de sus tipos: el front no
// recalcula nada, solo las pinta.
// =============================================================================

export interface CyclePhasePoint {
  label: string;
  price: number;
  at: string;
  kind: 'pico' | 'suelo' | 'actual';
}

export interface DrawdownRecord {
  period: string;
  drawdownPct: number;
  recoveryPct: number | null;
  current: boolean;
}

export interface YearlyLowRecord {
  year: string;
  low: number;
}

export interface RsiBottomRecord {
  label: string;
  rsi: number;
  return1yPct: number | null;
  current: boolean;
}

export interface HistoryData {
  cyclePoints: CyclePhasePoint[];
  drawdowns: DrawdownRecord[];
  yearlyLows: YearlyLowRecord[];
  rsiBottoms: RsiBottomRecord[];
  observedAt: string;
  source: string;
}
