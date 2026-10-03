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
  /**
   * Referencias diarias para recalcular la fila con el precio en vivo:
   * precio con el que se calculó la capitalización, cierres de hace 7, 30 y
   * 90 días, máximo de 90 días y medias móviles.
   */
  ref?: AltcoinRef;
}

export interface AltcoinRef {
  price: number;
  close7: number | null;
  close30: number | null;
  /** Ausente en respuestas anteriores. */
  close60?: number | null;
  close90: number | null;
  high90: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
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
  /** Ausente en respuestas anteriores a la recalculación en vivo. */
  btcRef?: { close30?: number | null; close60?: number | null; close90: number | null };
  /** ETH/BTC de hace 1, 7, 30 y 90 días, para rehacer el par en vivo. */
  ethBtcRef?: { close1: number; close7: number; close30: number; close90: number } | null;
  /** Exchange de las velas; los precios en vivo se piden primero a ese. */
  exchange?: string;
  universeSize: number;
  excludedCount: number;
  observedAt: string;
}
