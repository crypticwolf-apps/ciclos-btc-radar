import { z } from 'zod';
import { fetchJson } from '../http';
import { swr } from '../cache';
import { metaFromCache, type ProviderResult } from '../respond';
import { readEnv } from '../runtimeEnv';
import { computeTechnicals, type Technicals } from '@/lib/indicators';

// =============================================================================
// Proveedor: CoinGecko (gratis, sin clave; opcionalmente clave demo por env).
// Precio multi-moneda, variaciones, market cap/volumen global e histórico.
// =============================================================================

const BASE = 'https://api.coingecko.com/api/v3';
const PAPRIKA_BASE = 'https://api.coinpaprika.com/v1';

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

const KrakenTickerRowSchema = z.object({
  c: z.array(z.string()).min(1),
  v: z.array(z.string()).min(2),
  o: z.string(),
});

const CryptoCompareHistorySchema = z.object({
  Response: z.string().optional(),
  Message: z.string().optional(),
  Data: z.object({
    Data: z.array(z.object({
      time: num,
      close: num,
    })),
  }),
});

const BlockchainPriceChartSchema = z.object({
  values: z.array(z.object({ x: num, y: num })),
});

const BlockchainTickerSchema = z.record(
  z.string(),
  z.object({ last: num }),
);

const CoinPaprikaQuoteSchema = z.object({
  price: num,
  volume_24h: num,
  market_cap: num,
  percent_change_1h: numNull,
  percent_change_24h: numNull,
  percent_change_7d: numNull,
  percent_change_30d: numNull,
  percent_change_1y: numNull,
  ath_price: numNull,
  ath_date: z.string().nullable().optional(),
  percent_from_price_ath: numNull,
});

const CoinPaprikaTickerSchema = z.object({
  quotes: z.object({
    USD: CoinPaprikaQuoteSchema,
    EUR: z.object({ price: num }).optional(),
  }),
});

const CoinPaprikaGlobalSchema = z.object({
  market_cap_usd: num,
  volume_24h_usd: num,
  bitcoin_dominance_percentage: num,
  market_cap_change_24h: num,
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

interface MarketSummaryResult {
  summary: MarketSummary;
  provider: string;
}

interface GlobalSummaryResult {
  summary: GlobalSummary;
  provider: string;
}

const TTL = { ttlMs: 60_000, staleMs: 30 * 60_000 };

function krakenTickerRow(result: Record<string, unknown>, currency: 'USD' | 'EUR') {
  const key = Object.keys(result).find((name) => name.includes(currency));
  if (!key) throw new Error(`Kraken no devolvió el par XBT${currency}.`);
  const row = KrakenTickerRowSchema.parse(result[key]);
  const price = Number(row.c[0]);
  const volumeBtc = Number(row.v[1]);
  const open = Number(row.o);
  if (![price, volumeBtc, open].every(Number.isFinite)) {
    throw new Error(`Kraken devolvió datos inválidos para XBT${currency}.`);
  }
  return { price, volumeBtc, open };
}

async function getKrakenMarketSummary(): Promise<MarketSummary> {
  const [tickerRaw, global, history] = await Promise.all([
    fetchJson<unknown>('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XBTEUR', {
      provider: 'kraken',
      timeoutMs: 12_000,
    }),
    getGlobal(),
    getPriceHistory('365'),
  ]);
  const ticker = KrakenSchema.parse(tickerRaw);
  if (ticker.error.length > 0) throw new Error(ticker.error.join(', '));
  const usd = krakenTickerRow(ticker.result, 'USD');
  const eur = krakenTickerRow(ticker.result, 'EUR');
  const athPoint = history.data.reduce((highest, point) =>
    point.price > highest.price ? point : highest,
  );
  const marketCapUsd = Math.round(
    global.data.marketCapUsd * (global.data.btcDominance / 100),
  );

  return {
    priceUsd: usd.price,
    priceEur: eur.price,
    change1h: null,
    change24h: Number((((usd.price - usd.open) / usd.open) * 100).toFixed(2)),
    change7d: null,
    change30d: null,
    change1y: null,
    marketCapUsd,
    volume24hUsd: usd.volumeBtc * usd.price,
    ath: athPoint.price,
    athDate: new Date(athPoint.t).toISOString(),
    fromAthPct: Number((((usd.price - athPoint.price) / athPoint.price) * 100).toFixed(2)),
  };
}

export async function getMarketSummary(): Promise<ProviderResult<MarketSummary>> {
  const r = await swr<MarketSummaryResult>('market:coin:v2', TTL, async () => {
    try {
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
      return { summary, provider: 'coingecko' };
    } catch {
      try {
        // La cotización USD por defecto es gratuita. Pedir varias monedas puede
        // devolver 402 en algunos entornos; por eso no añadimos `quotes=...`.
        const raw = await fetchJson<unknown>(`${PAPRIKA_BASE}/tickers/btc-bitcoin`, {
          provider: 'coinpaprika',
          timeoutMs: 9000,
        });
        const quotes = CoinPaprikaTickerSchema.parse(raw).quotes;
        const usd = quotes.USD;
        return {
          summary: {
            priceUsd: usd.price,
            priceEur: quotes.EUR?.price ?? null,
            change1h: usd.percent_change_1h ?? null,
            change24h: usd.percent_change_24h ?? null,
            change7d: usd.percent_change_7d ?? null,
            change30d: usd.percent_change_30d ?? null,
            change1y: usd.percent_change_1y ?? null,
            marketCapUsd: usd.market_cap,
            volume24hUsd: usd.volume_24h,
            ath: usd.ath_price ?? usd.price,
            athDate: usd.ath_date ?? null,
            fromAthPct: usd.percent_from_price_ath ?? 0,
          },
          provider: 'coinpaprika',
        };
      } catch {
        return { summary: await getKrakenMarketSummary(), provider: 'kraken' };
      }
    }
  });
  return {
    data: r.value.summary,
    meta: metaFromCache(r.value.provider, r.status, r.storedAt),
  };
}

export async function getGlobal(): Promise<ProviderResult<GlobalSummary>> {
  const r = await swr<GlobalSummaryResult>('market:global:v2', TTL, async () => {
    try {
      const raw = await fetchJson<unknown>(url('/global'), {
        provider: 'coingecko',
        timeoutMs: 9000,
      });
      const d = GlobalSchema.parse(raw).data;
      return {
        summary: {
          marketCapUsd: d.total_market_cap.usd,
          volume24hUsd: d.total_volume.usd,
          btcDominance: Number(d.market_cap_percentage.btc.toFixed(1)),
          marketCapChange24h: Number(d.market_cap_change_percentage_24h_usd.toFixed(2)),
        },
        provider: 'coingecko',
      };
    } catch {
      const raw = await fetchJson<unknown>(`${PAPRIKA_BASE}/global`, {
        provider: 'coinpaprika',
        timeoutMs: 9000,
      });
      const d = CoinPaprikaGlobalSchema.parse(raw);
      return {
        summary: {
          marketCapUsd: d.market_cap_usd,
          volume24hUsd: d.volume_24h_usd,
          btcDominance: Number(d.bitcoin_dominance_percentage.toFixed(1)),
          marketCapChange24h: Number(d.market_cap_change_24h.toFixed(2)),
        },
        provider: 'coinpaprika:global',
      };
    }
  });
  return {
    data: r.value.summary,
    meta: metaFromCache(r.value.provider, r.status, r.storedAt),
  };
}

// --- Indicadores técnicos derivados del histórico ----------------------------

/**
 * Los indicadores viven en `@/lib/indicators` (matemática pura y compartida con
 * los tests). Aquí solo se alimenta esa función con la serie de cierres.
 */
export type BtcIndicators = Technicals;

/**
 * Indicadores técnicos a partir del histórico de 365 días de CoinGecko.
 *
 * Es el RESPALDO de `getTechnicals()` (Coin Metrics), que sí llega a los 1.400
 * cierres necesarios para la media de 200 semanas. Con solo un año de datos esa
 * media y el rendimiento a 1 año salen `null`, nunca inventados.
 */
export async function getIndicators(): Promise<ProviderResult<BtcIndicators>> {
  const r = await swr('cg:indicators:v2', { ttlMs: 60 * 60_000, staleMs: 24 * 60 * 60_000 }, async () => {
    const hist = await getPriceHistory('365');
    const closes = hist.data.map((p) => p.price);
    if (closes.length < 30) throw new Error('histórico insuficiente para indicadores');
    return computeTechnicals(closes);
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
  const cacheVersion = safeDays === 'max' ? 'v3' : 'v2';
  const r = await swr<PriceHistoryResult>(`price:chart:${cacheVersion}:${safeVs}:${safeDays}`, { ttlMs, staleMs: 24 * 60 * 60_000 }, async () => {
    if (safeDays === 'max') {
      try {
        // La API oficial de gráficos de Blockchain.com permite solicitar toda
        // la serie diaria sin el límite de 720 velas de Kraken.
        const [chartRaw, tickerRaw] = await Promise.all([
          fetchJson<unknown>(
            'https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false',
            { provider: 'blockchain.com', timeoutMs: 15_000 },
          ),
          fetchJson<unknown>('https://blockchain.info/ticker', {
            provider: 'blockchain.com:ticker',
            timeoutMs: 10_000,
          }),
        ]);
        const chart = BlockchainPriceChartSchema.parse(chartRaw);
        const ticker = BlockchainTickerSchema.parse(tickerRaw);
        const usdNow = ticker.USD?.last;
        const quoteNow = safeVs === 'eur' ? ticker.EUR?.last : usdNow;
        if (!usdNow || !quoteNow) throw new Error('Blockchain.com no devolvió el tipo de cambio solicitado.');
        const factor = quoteNow / usdNow;
        const byTimestamp = new Map<number, PricePoint>();
        for (const row of chart.values) {
          const point = { t: row.x * 1000, price: row.y * factor };
          if (Number.isFinite(point.t) && Number.isFinite(point.price) && point.price > 0) {
            byTimestamp.set(point.t, point);
          }
        }
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        byTimestamp.set(today.getTime(), { t: today.getTime(), price: quoteNow });
        const points = [...byTimestamp.values()].sort((a, b) => a.t - b.t);
        if (points.length < 1_000 || points[0]!.t > Date.UTC(2012, 0, 1)) {
          throw new Error('Blockchain.com devolvió un histórico incompleto.');
        }
        return { points, provider: 'blockchain.com:market-price' };
      } catch {
        // Continúa con el siguiente proveedor completo.
      }

      try {
        // Kraken limita su OHLC a unas 720 velas. CryptoCompare permite pedir
        // todos los cierres diarios y por eso es el proveedor principal de MAX.
        const quote = safeVs.toUpperCase();
        const raw = CryptoCompareHistorySchema.parse(
          await fetchJson<unknown>(
            `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=${quote}&allData=true&extraParams=CiclosBTC`,
            { provider: 'cryptocompare', timeoutMs: 15_000 },
          ),
        );
        if (raw.Response === 'Error') throw new Error(raw.Message ?? 'CryptoCompare no disponible.');
        const byTimestamp = new Map<number, PricePoint>();
        for (const row of raw.Data.Data) {
          const point = { t: row.time * 1000, price: row.close };
          if (Number.isFinite(point.t) && Number.isFinite(point.price) && point.price > 0) {
            byTimestamp.set(point.t, point);
          }
        }
        const points = [...byTimestamp.values()].sort((a, b) => a.t - b.t);
        if (points.length < 1_000) throw new Error('CryptoCompare devolvió un histórico incompleto.');
        return { points, provider: 'cryptocompare:histoday' };
      } catch {
        // CoinGecko queda como segundo proveedor y se valida a continuación.
      }
    }

    try {
      const raw = await fetchJson<unknown>(
        url(`/coins/bitcoin/market_chart?vs_currency=${safeVs}&days=${safeDays}`),
        { provider: 'coingecko', timeoutMs: 12_000 },
      );
      const prices = ChartSchema.parse(raw).prices;
      if (safeDays === 'max') {
        const firstTimestamp = prices[0]?.[0] ?? Number.POSITIVE_INFINITY;
        if (prices.length < 1_000 || firstTimestamp > Date.UTC(2014, 0, 1)) {
          throw new Error('CoinGecko devolvió un histórico MAX incompleto.');
        }
      }
      return {
        points: prices.map(([t, price]) => ({ t, price })),
        provider: 'coingecko:chart',
      };
    } catch {
      // Último recurso para no dejar el gráfico vacío si fallan los proveedores
      // históricos completos. Kraken limita el número de velas.
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
