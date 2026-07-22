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

export interface BtcIndicators {
  rsi: number;
  trend: 'alcista' | 'bajista' | 'lateral';
  minYear: number;
  maxYear: number;
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
