import type { MarketIndicators } from '@/types';
import { MOCK_INDICATORS } from '@/data/mockData';
import { fetchJson, liveOrCache, LIVE_DATA_ENABLED } from './http';

// =============================================================================
// SERVICIO: Indicadores de momentum y sentimiento (RSI + Fear & Greed)
// -----------------------------------------------------------------------------
// Fear & Greed (sin API key, con CORS): https://api.alternative.me/fng/?limit=1
// RSI: se calcula a partir de los cierres diarios que provee bitcoinData
//      (CoinGecko market_chart). Si no hay cierres, se usa el RSI mock.
// =============================================================================

const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1';

interface FngResponse {
  data: { value: string; value_classification: string }[];
}

/** RSI clásico de Wilder sobre una serie de cierres. */
export function calcularRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

/** Tendencia simple: precio actual vs. media de los últimos 30 días. */
export function calcularTendencia(closes: number[]): MarketIndicators['tendencia'] {
  if (closes.length < 30) return 'lateral';
  const last = closes[closes.length - 1];
  const window = closes.slice(-30);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const diff = (last - sma) / sma;
  if (diff > 0.03) return 'alcista';
  if (diff < -0.03) return 'bajista';
  return 'lateral';
}

const FNG_LABELS_ES: Record<string, string> = {
  'Extreme Fear': 'Miedo extremo',
  Fear: 'Miedo',
  Neutral: 'Neutral',
  Greed: 'Codicia',
  'Extreme Greed': 'Codicia extrema',
};

export interface IndicatorsResult {
  indicators: MarketIndicators;
  live: boolean;
}

function mockResult(closes: number[] | null): IndicatorsResult {
  // Aun sin Fear & Greed, si tenemos cierres reales podemos calcular un RSI real.
  const rsi = closes && closes.length > 15 ? calcularRsi(closes) : MOCK_INDICATORS.rsi;
  const tendencia = closes ? calcularTendencia(closes) : MOCK_INDICATORS.tendencia;
  return {
    indicators: { ...MOCK_INDICATORS, rsi, tendencia, actualizado: new Date().toISOString() },
    live: false,
  };
}

interface FngValue {
  fearGreed: number;
  fearGreedLabel: string;
}

export async function getMarketIndicators(closes: number[] | null): Promise<IndicatorsResult> {
  if (!LIVE_DATA_ENABLED) return mockResult(null);

  const rsi = closes && closes.length > 15 ? calcularRsi(closes) : MOCK_INDICATORS.rsi;
  const tendencia = closes ? calcularTendencia(closes) : MOCK_INDICATORS.tendencia;

  const { value, live } = await liveOrCache<FngValue>(
    'feargreed',
    async () => {
      const fng = await fetchJson<FngResponse>(FEAR_GREED_URL);
      const item = fng.data[0];
      return {
        fearGreed: Number(item.value),
        fearGreedLabel: FNG_LABELS_ES[item.value_classification] ?? item.value_classification,
      };
    },
    { fearGreed: MOCK_INDICATORS.fearGreed, fearGreedLabel: MOCK_INDICATORS.fearGreedLabel },
  );

  return {
    indicators: {
      rsi,
      fearGreed: value.fearGreed,
      fearGreedLabel: value.fearGreedLabel,
      tendencia,
      actualizado: new Date().toISOString(),
    },
    // "live" si el F&G es real o si tenemos cierres reales para RSI/tendencia.
    live: live || Boolean(closes),
  };
}

/** Clasifica un valor de Fear & Greed en zona de sentimiento. */
export function fearGreedZone(value: number): { label: string; color: string } {
  if (value <= 20) return { label: 'Miedo extremo', color: '#b91c1c' };
  if (value <= 40) return { label: 'Miedo', color: '#ef4444' };
  if (value <= 60) return { label: 'Neutral', color: '#94a3b8' };
  if (value <= 80) return { label: 'Codicia', color: '#22c55e' };
  return { label: 'Codicia extrema', color: '#16a34a' };
}
