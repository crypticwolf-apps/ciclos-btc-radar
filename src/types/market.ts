// Tipos del bloque de mercado (/api/market). Espejo de api/_lib/providers.

export interface MarketSummary {
  priceUsd: number;
  priceEur: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  change1y: number | null;
  marketCapUsd: number;
  volume24hUsd: number;
  ath: number;
  athDate: string | null;
  fromAthPct: number;
}

export interface GlobalSummary {
  marketCapUsd: number;
  volume24hUsd: number;
  btcDominance: number;
  marketCapChange24h: number;
}

export interface FearGreedPoint {
  value: number;
  date: string;
}

export interface FearGreed {
  value: number;
  classification: string;
  changeVsYesterday: number | null;
  updatedAt: string;
  history: FearGreedPoint[];
}

export type MaCross = 'golden' | 'death' | 'ninguno';
export type TrendLabel = 'alcista' | 'bajista' | 'lateral';

/**
 * Indicadores técnicos calculados sobre cierres diarios reales.
 * Los campos van a `null` cuando no hay histórico suficiente (por ejemplo, la
 * media de 200 semanas necesita 1.400 cierres): nunca se rellenan con valores
 * inventados.
 */
export interface BtcIndicators {
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  /** Media de 200 SEMANAS: referencia histórica de suelo de ciclo. */
  sma200w: number | null;
  cross: MaCross;
  volatility30d: number | null;
  return7d: number | null;
  return30d: number | null;
  return90d: number | null;
  return365d: number | null;
  trend: TrendLabel;
  /** Mínimo y máximo desde el último halving. */
  cycleLow: number | null;
  cycleHigh: number | null;
  minYear: number | null;
  maxYear: number | null;
  /** Nº de cierres diarios usados en el cálculo. */
  samples: number;
}

/** Tipo de cambio EUR/USD derivado del propio proveedor de mercado. */
export interface FxRate {
  eurPerUsd: number;
  source: string;
  observedAt: string;
}

export interface MarketResponse {
  summary: MarketSummary | null;
  global: GlobalSummary | null;
  indicators: BtcIndicators | null;
  sentiment: FearGreed | null;
}

export interface PricePoint {
  t: number;
  price: number;
}

export type Currency = 'usd' | 'eur';
export type ChartRange = '1' | '7' | '30' | '90' | '365' | 'max';

export interface PriceHistory {
  days: string;
  currency: Currency;
  points: PricePoint[];
}
