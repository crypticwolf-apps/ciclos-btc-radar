// Tipos del bloque Altseason (/api/altseason). Espejo del proveedor del backend.
// El cálculo y su configuración viven en `@/lib/altseason`, compartidos por
// backend y frontend para que la fórmula sea única.

export type {
  AltseasonMetrics,
  AltseasonResult,
  AltseasonSignal,
  ScoreComponent,
  Confidence,
} from '@/lib/altseason/score';

export interface AltcoinRow {
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  volumeUsd: number;
  change7d: number | null;
  change30d: number | null;
  change60d: number | null;
  change90d: number | null;
  /** Rendimiento a 90 d menos el de BTC, en puntos porcentuales. */
  vsBtc90d: number | null;
  /** Distancia al máximo de los últimos 90 días, en % (negativa). */
  fromHigh90d: number | null;
  aboveSma20: boolean | null;
  aboveSma50: boolean | null;
  aboveSma200: boolean | null;
  volatility30d: number | null;
  beatsBtc: boolean;
}

export interface BreadthPoint {
  t: number;
  outperformPct: number;
}

export interface AltseasonResponse {
  result: import('@/lib/altseason/score').AltseasonResult;
  metrics: import('@/lib/altseason/score').AltseasonMetrics;
  ranking: AltcoinRow[];
  breadthHistory: BreadthPoint[];
  universeSize: number;
  excludedCount: number;
  observedAt: string;
}
