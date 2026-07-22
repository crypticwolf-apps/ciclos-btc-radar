import { z } from 'zod';
import { fetchJson } from '../http';
import { swr } from '../cache';
import { metaFromCache, type ProviderResult } from '../respond';
import { readEnv } from '../runtimeEnv';

// =============================================================================
// Proveedor: CoinGecko (gratis, sin clave; opcionalmente clave demo por env).
// Precio multi-moneda, variaciones, market cap/volumen global e histórico.
// =============================================================================

const BASE = 'https://api.coingecko.com/api/v3';

function url(path: string): string {
  const u = new URL(BASE + path);
  const key = readEnv('COINGECKO_API_KEY');
  if (key) u.searchParams.set('x_cg_demo_api_key', key);
  return u.toString();
}

// --- Esquemas Zod (validamos solo lo que usamos; el resto se ignora) ---------

const num = z.number();
const numNull = z.number().nullable().optional();
const byCur = z.object({ usd: numNull, eur: numNull }).partial();

const CoinSchema = z.object({
  market_data: z.object({
    current_price: byCur,
    price_change_percentage_1h_in_currency: byCur.optional(),
    price_change_percentage_24h_in_currency: byCur.optional(),
    price_change_percentage_7d_in_currency: byCur.optional(),
    price_change_percentage_30d_in_currency: byCur.optional(),
    price_change_percentage_1y_in_currency: byCur.optional(),
    market_cap: byCur,
    total_volume: byCur,
    ath: byCur,
    ath_date: z.object({ usd: z.string().nullable().optional() }).partial(),
    ath_change_percentage: byCur,
  }),
});

const GlobalSchema = z.object({
  data: z.object({
    total_market_cap: z.object({ usd: num }),
    total_volume: z.object({ usd: num }),
    market_cap_percentage: z.object({ btc: num }),
    market_cap_change_percentage_24h_usd: num,
  }),
});

const ChartSchema = z.object({
  prices: z.array(z.tuple([num, num])),
});

const KrakenSchema = z.object({
  error: z.array(z.string()),
  result: z.record(z.string(), z.unknown()),
});

// --- Tipos normalizados ------------------------------------------------------

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

export interface PricePoint {
  t: number; // epoch ms
  price: number;
}

interface PriceHistoryResult {
  points: PricePoint[];
  provider: string;
}

const TTL = { ttlMs: 60_000, staleMs: 30 * 60_000 };

export async function getMarketSummary(): Promise<ProviderResult<MarketSummary>> {
  const r = await swr('cg:coin', TTL, async () => {
    const raw = await fetchJson<unknown>(
      url(
        '/coins/bitcoin?localization=false&tickers=false&market_data=true' +
          '&community_data=false&developer_data=false&sparkline=false',
      ),
      { provider: 'coingecko', timeoutMs: 9000 },
    );
    const m = CoinSchema.parse(raw).market_data;
    const summary: MarketSummary = {
      priceUsd: m.current_price.usd ?? NaN,
      priceEur: m.current_price.eur ?? null,
      change1h: m.price_change_percentage_1h_in_currency?.usd ?? null,
      change24h: m.price_change_percentage_24h_in_currency?.usd ?? null,
      change7d: m.price_change_percentage_7d_in_currency?.usd ?? null,
      change30d: m.price_change_percentage_30d_in_currency?.usd ?? null,
      change1y: m.price_change_percentage_1y_in_currency?.usd ?? null,
      marketCapUsd: m.market_cap.usd ?? NaN,
      volume24hUsd: m.total_volume.usd ?? NaN,
      ath: m.ath.usd ?? NaN,
      athDate: m.ath_date.usd ?? null,
      fromAthPct: m.ath_change_percentage.usd ?? NaN,
    };
    if (Number.isNaN(summary.priceUsd)) throw new Error('CoinGecko sin precio USD');
    return summary;
  });
  return { data: r.value, meta: metaFromCache('coingecko', r.status, r.storedAt) };
}

export async function getGlobal(): Promise<ProviderResult<GlobalSummary>> {
  const r = await swr('cg:global', TTL, async () => {
    const raw = await fetchJson<unknown>(url('/global'), { provider: 'coingecko', timeoutMs: 9000 });
    const d = GlobalSchema.parse(raw).data;
    return {
      marketCapUsd: d.total_market_cap.usd,
      volume24hUsd: d.total_volume.usd,
      btcDominance: Number(d.market_cap_percentage.btc.toFixed(1)),
      marketCapChange24h: Number(d.market_cap_change_percentage_24h_usd.toFixed(2)),
    } satisfies GlobalSummary;
  });
  return { data: r.value, meta: metaFromCache('coingecko:global', r.status, r.storedAt) };
}

// --- Indicadores derivados del histórico (RSI, tendencia, extremos anuales) ---

export interface BtcIndicators {
  rsi: number;
  trend: 'alcista' | 'bajista' | 'lateral';
  minYear: number;
  maxYear: number;
}

/** RSI clásico de Wilder sobre una serie de cierres. */
function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}

function trend(closes: number[]): BtcIndicators['trend'] {
  if (closes.length < 30) return 'lateral';
  const last = closes[closes.length - 1]!;
  const window = closes.slice(-30);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const diff = (last - sma) / sma;
  if (diff > 0.03) return 'alcista';
  if (diff < -0.03) return 'bajista';
  return 'lateral';
}

/** Calcula RSI(14), tendencia y mínimo/máximo del último año. */
export async function getIndicators(): Promise<ProviderResult<BtcIndicators>> {
  const r = await swr('cg:indicators', { ttlMs: 60 * 60_000, staleMs: 24 * 60 * 60_000 }, async () => {
    const hist = await getPriceHistory('365');
    const closes = hist.data.map((p) => p.price);
    if (closes.length < 30) throw new Error('histórico insuficiente para indicadores');
    return {
      rsi: rsi(closes),
      trend: trend(closes),
      minYear: Math.round(Math.min(...closes)),
      maxYear: Math.round(Math.max(...closes)),
    } satisfies BtcIndicators;
  });
  return { data: r.value, meta: metaFromCache('coingecko:indicators', r.status, r.storedAt) };
}

/** Histórico de precios. days: 1,7,30,90,365 o 'max'. vs: usd|eur. Cache 1-6h. */
export async function getPriceHistory(
  days: string,
  vs = 'usd',
): Promise<ProviderResult<PricePoint[]>> {
  const safeDays = /^(1|7|30|90|365|max)$/.test(days) ? days : '30';
  const safeVs = /^(usd|eur)$/.test(vs) ? vs : 'usd';
  const ttlMs = safeDays === '1' ? 60 * 60_000 : 6 * 60 * 60_000;
  const r = await swr<PriceHistoryResult>(`price:chart:${safeVs}:${safeDays}`, { ttlMs, staleMs: 24 * 60 * 60_000 }, async () => {
    try {
      const raw = await fetchJson<unknown>(
        url(`/coins/bitcoin/market_chart?vs_currency=${safeVs}&days=${safeDays}`),
        { provider: 'coingecko', timeoutMs: 12_000 },
      );
      const prices = ChartSchema.parse(raw).prices;
      return {
        points: prices.map(([t, price]) => ({ t, price })),
        provider: 'coingecko:chart',
      };
    } catch {
      // Kraken ofrece OHLC público sin clave y evita que el gráfico quede vacío
      // cuando CoinGecko aplica su límite gratuito.
      const interval: Record<string, number> = {
        '1': 5,
        '7': 15,
        '30': 60,
        '90': 240,
        '365': 1440,
        max: 1440,
      };
      const pair = safeVs === 'eur' ? 'XBTEUR' : 'XBTUSD';
      const raw = KrakenSchema.parse(
        await fetchJson<unknown>(
          `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval[safeDays]}`,
          { provider: 'kraken', timeoutMs: 12_000 },
        ),
      );
      if (raw.error.length > 0) throw new Error(raw.error.join(', '));
      const key = Object.keys(raw.result).find((name) => name !== 'last');
      const rows = key ? raw.result[key] : null;
      if (!Array.isArray(rows)) throw new Error('Kraken no devolvió velas OHLC.');
      const points = rows
        .filter((row): row is unknown[] => Array.isArray(row) && row.length >= 5)
        .map((row) => ({ t: Number(row[0]) * 1000, price: Number(row[4]) }))
        .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.price));
      if (points.length === 0) throw new Error('Kraken devolvió un histórico vacío.');
      return { points, provider: 'kraken:ohlc' };
    }
  });
  return {
    data: r.value.points,
    meta: metaFromCache(r.value.provider, r.status, r.storedAt),
  };
}
