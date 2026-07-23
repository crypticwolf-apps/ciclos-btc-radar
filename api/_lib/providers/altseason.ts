import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import { readEnv } from '../runtimeEnv.js';
import { getStablecoinLiquidity } from './defillama.js';
import {
  DATA_REQUIREMENTS,
  MOVING_AVERAGES,
  PERIODS,
  isExcludedSymbol,
} from '../../../src/lib/altseason/config.js';
import {
  calculateAltseasonScore,
  type AltseasonMetrics,
  type AltseasonResult,
} from '../../../src/lib/altseason/score.js';

// =============================================================================
// Proveedor: ALTSEASON (todo gratis, sin clave, sin scraping).
//
// Dos fuentes, cada una para lo que hace bien:
//
//   CoinGecko /coins/markets → universo, capitalización y volumen reales.
//       Da variaciones de 24h/7d/30d, pero NO de 90 días, que es justo el
//       periodo principal que necesita el análisis.
//
//   Binance /api/v3/klines  → velas diarias por par USDT. De aquí salen los
//       rendimientos a 30/60/90 días, las medias móviles de 20/50/200, la
//       distancia al máximo de 90 días y la volatilidad. Son ~50 peticiones
//       muy ligeras (weight 2 cada una) que Binance admite sin problema, y van
//       cacheadas 30 min en el servidor.
//
// La dominancia histórica no la publica ninguna API gratuita, así que su
// variación se DERIVA de las capitalizaciones actuales y sus variaciones
// (mcap hace 30 d = mcap / (1 + var30d)). Es aritmética sobre datos reales, no
// una estimación inventada, y se documenta como derivada.
// =============================================================================

const CG = 'https://api.coingecko.com/api/v3';
const BINANCE = 'https://api.binance.com/api/v3';

const MarketSchema = z.array(
  z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    current_price: z.number().nullable(),
    market_cap: z.number().nullable(),
    total_volume: z.number().nullable(),
    price_change_percentage_24h_in_currency: z.number().nullable().optional(),
    price_change_percentage_7d_in_currency: z.number().nullable().optional(),
    price_change_percentage_30d_in_currency: z.number().nullable().optional(),
  }),
);

const ExchangeInfoSchema = z.object({
  symbols: z.array(
    z.object({ baseAsset: z.string(), quoteAsset: z.string(), status: z.string() }),
  ),
});

const PaprikaSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    symbol: z.string(),
    quotes: z.object({
      USD: z.object({
        price: z.number().nullable(),
        market_cap: z.number().nullable(),
        volume_24h: z.number().nullable(),
        percent_change_24h: z.number().nullable().optional(),
        percent_change_7d: z.number().nullable().optional(),
        percent_change_30d: z.number().nullable().optional(),
      }),
    }),
  }),
);

/** Forma normalizada del universo, venga de donde venga. */
type UniverseRow = z.infer<typeof MarketSchema>[number];

/**
 * Universo de mercado con respaldo. CoinGecko es la fuente principal; si
 * responde 429 (su límite gratuito es fácil de alcanzar) se usa CoinPaprika.
 *
 * Aviso importante sobre el respaldo: CoinPaprika devuelve `percent_change_30d`
 * a 0 para todos los activos, así que ese campo NO se usa cuando viene de ahí.
 * Sin él la dominancia a 30 días queda como no disponible y el score
 * redistribuye su peso, en lugar de calcularse con un dato falso.
 */
async function fetchUniverse(): Promise<{ rows: UniverseRow[]; source: string; has30d: boolean }> {
  try {
    const raw = await fetchJson<unknown>(
      cgUrl(
        '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1' +
          '&price_change_percentage=24h,7d,30d',
      ),
      { provider: 'coingecko:markets', timeoutMs: 15_000 },
    );
    const rows = MarketSchema.parse(raw);
    const has30d = rows.some((c) => (c.price_change_percentage_30d_in_currency ?? 0) !== 0);
    return { rows, source: 'coingecko', has30d };
  } catch {
    const raw = await fetchJson<unknown>(
      'https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=150',
      { provider: 'coinpaprika:tickers', timeoutMs: 15_000 },
    );
    const parsed = PaprikaSchema.parse(raw);
    const has30d = parsed.some((c) => (c.quotes.USD.percent_change_30d ?? 0) !== 0);
    const rows: UniverseRow[] = parsed.map((c) => ({
      // CoinPaprika usa ids tipo "btc-bitcoin": se normaliza a los que usa el resto del código.
      id: c.symbol.toUpperCase() === 'BTC' ? 'bitcoin' : c.symbol.toUpperCase() === 'ETH' ? 'ethereum' : c.id,
      symbol: c.symbol,
      name: c.name,
      current_price: c.quotes.USD.price,
      market_cap: c.quotes.USD.market_cap,
      total_volume: c.quotes.USD.volume_24h,
      price_change_percentage_24h_in_currency: c.quotes.USD.percent_change_24h ?? null,
      price_change_percentage_7d_in_currency: c.quotes.USD.percent_change_7d ?? null,
      price_change_percentage_30d_in_currency: has30d ? c.quotes.USD.percent_change_30d ?? null : null,
    }));
    return { rows, source: 'coinpaprika', has30d };
  }
}

function cgUrl(path: string): string {
  const u = new URL(CG + path);
  const key = readEnv('COINGECKO_API_KEY');
  if (key) u.searchParams.set('x_cg_demo_api_key', key);
  return u.toString();
}

/** Cierres diarios de un par de Binance. `pair` es el símbolo COMPLETO. */
async function closesPair(pair: string, limit: number): Promise<number[]> {
  const raw = await fetchJson<unknown[]>(
    `${BINANCE}/klines?symbol=${pair}&interval=1d&limit=${limit}`,
    { provider: `binance:${pair}`, timeoutMs: 12_000, retries: 1 },
  );
  return raw
    .map((row) => (Array.isArray(row) ? Number(row[4]) : Number.NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Cierres diarios de un activo contra USDT. */
const closes = (symbol: string, limit: number): Promise<number[]> =>
  closesPair(`${symbol}USDT`, limit);

const pctChange = (series: number[], days: number): number | null => {
  if (series.length <= days) return null;
  const past = series[series.length - 1 - days]!;
  const now = series[series.length - 1]!;
  return past > 0 ? ((now - past) / past) * 100 : null;
};

const sma = (series: number[], period: number): number | null => {
  if (series.length < period) return null;
  return series.slice(-period).reduce((a, b) => a + b, 0) / period;
};

/** Volatilidad anualizada (%) de los rendimientos diarios. */
function volatility(series: number[], window = 30): number | null {
  if (series.length < window + 1) return null;
  const slice = series.slice(-(window + 1));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1]! > 0 && slice[i]! > 0) rets.push(Math.log(slice[i]! / slice[i - 1]!));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(varr) * Math.sqrt(365) * 100;
}

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
  /** Rendimiento a 90 d menos el de BTC, en pp. */
  vsBtc90d: number | null;
  /** Distancia al máximo de los últimos 90 días, en % (negativa). */
  fromHigh90d: number | null;
  aboveSma20: boolean | null;
  aboveSma50: boolean | null;
  aboveSma200: boolean | null;
  volatility30d: number | null;
  beatsBtc: boolean;
}

export interface AltseasonData {
  result: AltseasonResult;
  metrics: AltseasonMetrics;
  ranking: AltcoinRow[];
  /** Serie histórica del % de altcoins que superan a BTC a 90 días. */
  breadthHistory: { t: number; outperformPct: number }[];
  universeSize: number;
  excludedCount: number;
  observedAt: string;
}

/** Serie histórica de amplitud: para cada día, % de alts que baten a BTC a 90 d. */
function buildBreadthHistory(
  altSeries: number[][],
  btcSeries: number[],
  days: number,
): { t: number; outperformPct: number }[] {
  const out: { t: number; outperformPct: number }[] = [];
  const now = Date.now();
  const day = 86_400_000;

  for (let back = days - 1; back >= 0; back--) {
    // Índice del "hoy" simulado y del punto 90 días antes.
    const endBtc = btcSeries.length - 1 - back;
    const startBtc = endBtc - PERIODS.main;
    if (startBtc < 0) continue;
    const btcRet = (btcSeries[endBtc]! - btcSeries[startBtc]!) / btcSeries[startBtc]!;

    let beats = 0;
    let total = 0;
    for (const s of altSeries) {
      const end = s.length - 1 - back;
      const start = end - PERIODS.main;
      if (start < 0 || s[start]! <= 0) continue;
      total++;
      if ((s[end]! - s[start]!) / s[start]! > btcRet) beats++;
    }
    if (total >= DATA_REQUIREMENTS.minAssets) {
      out.push({
        t: now - back * day,
        outperformPct: Number(((beats / total) * 100).toFixed(1)),
      });
    }
  }
  return out;
}

export async function getAltseason(): Promise<ProviderResult<AltseasonData>> {
  // Datos de mercado: 30 min es suficiente y protege la cuota de CoinGecko.
  const r = await swr('altseason:v1', { ttlMs: 30 * 60_000, staleMs: 6 * 60 * 60_000 }, async () => {
    // 1) Universo y capitalización (con respaldo) + pares disponibles.
    const [universe, exchangeRaw] = await Promise.all([
      fetchUniverse(),
      fetchJson<unknown>(`${BINANCE}/exchangeInfo?permissions=SPOT`, {
        provider: 'binance:exchangeInfo',
        timeoutMs: 15_000,
      }),
    ]);

    const markets = universe.rows;
    const tradable = new Set(
      ExchangeInfoSchema.parse(exchangeRaw)
        .symbols.filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map((s) => s.baseAsset),
    );

    const btcRow = markets.find((c) => c.id === 'bitcoin');
    if (!btcRow) throw new Error('CoinGecko no devolvió Bitcoin en el listado');

    // 2) Filtrado del universo: fuera stablecoins, envueltos, duplicados y
    //    cualquier activo sin par al contado con el que calcular su histórico.
    let excluded = 0;
    const eligible: typeof markets = [];
    for (const c of markets) {
      if (c.id === 'bitcoin') continue;
      if (!c.market_cap || !c.current_price) {
        excluded++;
        continue;
      }
      if (isExcludedSymbol(c.symbol, c.name) || !tradable.has(c.symbol.toUpperCase())) {
        excluded++;
        continue;
      }
      eligible.push(c);
      if (eligible.length >= DATA_REQUIREMENTS.targetAssets) break;
    }

    // 3) Velas diarias: BTC, ETH/BTC y cada altcoin elegible, en paralelo.
    const need = Math.max(...MOVING_AVERAGES, PERIODS.main + 1) + 40;
    const [btcCloses, ethBtcCloses, altResults] = await Promise.all([
      closes('BTC', need),
      // ETH/BTC es un par directo, no contra USDT: mide la rotación hacia
      // Ethereum sin el ruido del dólar.
      closesPair('ETHBTC', need).catch(() => [] as number[]),
      Promise.allSettled(eligible.map((c) => closes(c.symbol.toUpperCase(), need))),
    ]);

    if (btcCloses.length < PERIODS.main + 1) {
      throw new Error('Binance no devolvió histórico suficiente de BTC');
    }

    const btc90 = pctChange(btcCloses, PERIODS.main);
    const btc60 = pctChange(btcCloses, PERIODS.mid);
    const btc30 = pctChange(btcCloses, PERIODS.short);

    // 4) Métricas por altcoin.
    const rows: AltcoinRow[] = [];
    const validSeries: number[][] = [];

    eligible.forEach((c, i) => {
      const res = altResults[i];
      if (!res || res.status !== 'fulfilled') return;
      const series = res.value;
      if (series.length < PERIODS.main + 1) return;

      const c90 = pctChange(series, PERIODS.main);
      const price = series[series.length - 1]!;
      const high90 = Math.max(...series.slice(-(PERIODS.main + 1)));
      const s20 = sma(series, 20);
      const s50 = sma(series, 50);
      const s200 = sma(series, 200);

      validSeries.push(series);
      rows.push({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        priceUsd: c.current_price ?? price,
        marketCapUsd: c.market_cap ?? 0,
        volumeUsd: c.total_volume ?? 0,
        change7d: c.price_change_percentage_7d_in_currency ?? pctChange(series, 7),
        change30d: c.price_change_percentage_30d_in_currency ?? pctChange(series, PERIODS.short),
        change60d: pctChange(series, PERIODS.mid),
        change90d: c90,
        vsBtc90d: c90 != null && btc90 != null ? Number((c90 - btc90).toFixed(2)) : null,
        fromHigh90d: high90 > 0 ? Number((((price - high90) / high90) * 100).toFixed(1)) : null,
        aboveSma20: s20 == null ? null : price > s20,
        aboveSma50: s50 == null ? null : price > s50,
        aboveSma200: s200 == null ? null : price > s200,
        volatility30d: volatility(series),
        beatsBtc: c90 != null && btc90 != null ? c90 > btc90 : false,
      });
    });

    const analyzed = rows.length;
    const pctOf = (n: number) => (analyzed > 0 ? Number(((n / analyzed) * 100).toFixed(1)) : null);
    const countBeating = (days: number, btcRef: number | null) => {
      if (btcRef == null) return null;
      let n = 0;
      let t = 0;
      for (const r2 of rows) {
        const v = days === PERIODS.main ? r2.change90d : days === PERIODS.mid ? r2.change60d : r2.change30d;
        if (v == null) continue;
        t++;
        if (v > btcRef) n++;
      }
      return t > 0 ? Number(((n / t) * 100).toFixed(1)) : null;
    };

    // 5) Capitalización y dominancia, derivadas de datos reales.
    const totalMcap = markets.reduce((a, c) => a + (c.market_cap ?? 0), 0);
    const btcMcap = btcRow.market_cap ?? 0;
    const ethMcap = markets.find((c) => c.id === 'ethereum')?.market_cap ?? 0;

    /** Capitalización de hace N días, deshaciendo la variación porcentual. */
    const mcapAgo = (c: (typeof markets)[number], pct: number | null | undefined) => {
      const mc = c.market_cap ?? 0;
      if (pct == null || pct <= -100) return mc;
      return mc / (1 + pct / 100);
    };
    const totalAgo = (pick: (c: (typeof markets)[number]) => number | null | undefined) =>
      markets.reduce((a, c) => a + mcapAgo(c, pick(c)), 0);

    const dominanceNow = totalMcap > 0 ? (btcMcap / totalMcap) * 100 : null;
    const domAgo = (pick: (c: (typeof markets)[number]) => number | null | undefined) => {
      const tot = totalAgo(pick);
      const b = mcapAgo(btcRow, pick(btcRow));
      return tot > 0 ? (b / tot) * 100 : null;
    };
    const dom24 = domAgo((c) => c.price_change_percentage_24h_in_currency);
    const dom7 = domAgo((c) => c.price_change_percentage_7d_in_currency);
    const dom30 = domAgo((c) => c.price_change_percentage_30d_in_currency);

    const exBtcNow = totalMcap - btcMcap;
    const exBtcAgo30 = totalAgo((c) => c.price_change_percentage_30d_in_currency) -
      mcapAgo(btcRow, btcRow.price_change_percentage_30d_in_currency);
    const exBtcAgo7 = totalAgo((c) => c.price_change_percentage_7d_in_currency) -
      mcapAgo(btcRow, btcRow.price_change_percentage_7d_in_currency);
    const exBtcChange30 = exBtcAgo30 > 0 ? ((exBtcNow - exBtcAgo30) / exBtcAgo30) * 100 : null;
    const exBtcChange7 = exBtcAgo7 > 0 ? ((exBtcNow - exBtcAgo7) / exBtcAgo7) * 100 : null;
    const btcChange30 = btcRow.price_change_percentage_30d_in_currency ?? null;

    // 6) Volumen: BTC frente al resto del universo elegible.
    const btcVol = btcRow.total_volume ?? 0;
    const altVol = rows.reduce((a, r2) => a + r2.volumeUsd, 0);
    const volShare = btcVol + altVol > 0 ? (altVol / (btcVol + altVol)) * 100 : null;

    // 7) Riesgo: volatilidad media y concentración del rendimiento.
    const vols = rows.map((r2) => r2.volatility30d).filter((v): v is number => v != null);
    const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
    const gains = rows.map((r2) => Math.max(0, r2.change90d ?? 0)).sort((a, b) => b - a);
    const totalGain = gains.reduce((a, b) => a + b, 0);
    const top5 = gains.slice(0, 5).reduce((a, b) => a + b, 0);
    const concentration = totalGain > 0 ? Number((top5 / totalGain).toFixed(3)) : null;
    const drawdowns = rows.map((r2) => r2.fromHigh90d).filter((v): v is number => v != null);

    // 8) Liquidez en stablecoins: se reutiliza el proveedor existente.
    let stable30: number | null = null;
    let stable7: number | null = null;
    try {
      const liq = await getStablecoinLiquidity();
      stable30 = liq.data.change30dPct;
      stable7 = liq.data.change7dPct;
    } catch {
      /* la liquidez es el componente de menor peso: se marca ausente */
    }

    const ethBtcNow = ethBtcCloses.length ? ethBtcCloses[ethBtcCloses.length - 1]! : null;

    const metrics: AltseasonMetrics = {
      outperform90Pct: countBeating(PERIODS.main, btc90),
      outperform60Pct: countBeating(PERIODS.mid, btc60),
      outperform30Pct: countBeating(PERIODS.short, btc30),
      outperformCount: rows.filter((r2) => r2.beatsBtc).length,
      analyzedCount: analyzed,
      btcReturn90: btc90 == null ? null : Number(btc90.toFixed(2)),

      btcDominance: dominanceNow == null ? null : Number(dominanceNow.toFixed(2)),
      dominanceChange24h:
        dominanceNow != null && dom24 != null ? Number((dominanceNow - dom24).toFixed(3)) : null,
      dominanceChange7d:
        dominanceNow != null && dom7 != null ? Number((dominanceNow - dom7).toFixed(3)) : null,
      // Sin un 30d fiable en la fuente, este dato NO se calcula: el score
      // redistribuye su peso en vez de usar una variación falsa.
      dominanceChange30d:
        universe.has30d && dominanceNow != null && dom30 != null
          ? Number((dominanceNow - dom30).toFixed(3))
          : null,

      aboveSma20Pct: pctOf(rows.filter((r2) => r2.aboveSma20).length),
      aboveSma50Pct: pctOf(rows.filter((r2) => r2.aboveSma50).length),
      aboveSma200Pct: pctOf(rows.filter((r2) => r2.aboveSma200).length),
      positive7dPct: pctOf(rows.filter((r2) => (r2.change7d ?? 0) > 0).length),
      positive30dPct: pctOf(rows.filter((r2) => (r2.change30d ?? 0) > 0).length),
      positive90dPct: pctOf(rows.filter((r2) => (r2.change90d ?? 0) > 0).length),
      near90dHighCount: rows.filter((r2) => (r2.fromHigh90d ?? -100) > -5).length,
      drawdown20PlusCount: rows.filter((r2) => (r2.fromHigh90d ?? 0) < -20).length,

      ethBtc: ethBtcNow == null ? null : Number(ethBtcNow.toFixed(6)),
      ethBtcChange24h: pctChange(ethBtcCloses, 1),
      ethBtcChange7d: pctChange(ethBtcCloses, 7),
      ethBtcChange30d: pctChange(ethBtcCloses, PERIODS.short),
      ethBtcChange90d: pctChange(ethBtcCloses, PERIODS.main),

      totalMarketCap: Math.round(totalMcap),
      marketCapExBtc: Math.round(exBtcNow),
      marketCapExBtcEth: Math.round(exBtcNow - ethMcap),
      exBtcVsBtc30d:
        universe.has30d && exBtcChange30 != null && btcChange30 != null
          ? Number((exBtcChange30 - btcChange30).toFixed(2))
          : null,
      exBtcChange7d: exBtcChange7 == null ? null : Number(exBtcChange7.toFixed(2)),
      exBtcChange30d:
        universe.has30d && exBtcChange30 != null ? Number(exBtcChange30.toFixed(2)) : null,

      altVolumeSharePct: volShare == null ? null : Number(volShare.toFixed(1)),
      btcVolumeUsd: Math.round(btcVol),
      altVolumeUsd: Math.round(altVol),

      avgAltVolatility: avgVol == null ? null : Number(avgVol.toFixed(1)),
      btcVolatility: volatility(btcCloses),
      top5Concentration: concentration,
      avgDrawdownFromHigh: drawdowns.length
        ? Number((drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length).toFixed(1))
        : null,

      stablecoinChange30d: stable30,
      stablecoinChange7d: stable7,

      dataAgeHours: 0,
      fromCache: false,
    };

    const result = calculateAltseasonScore(metrics);

    return {
      result,
      metrics,
      ranking: rows.sort((a, b) => b.marketCapUsd - a.marketCapUsd),
      breadthHistory: buildBreadthHistory(validSeries, btcCloses, 120),
      universeSize: eligible.length,
      excludedCount: excluded,
      observedAt: new Date().toISOString(),
    } satisfies AltseasonData;
  });

  // Si el dato viene de cache o stale, se refleja en la confianza declarada.
  const fromCache = r.status !== 'live';
  const ageHours = (Date.now() - r.storedAt) / 3_600_000;
  const data: AltseasonData = fromCache
    ? {
        ...r.value,
        result: calculateAltseasonScore({
          ...r.value.metrics,
          fromCache: true,
          dataAgeHours: ageHours,
        }),
      }
    : r.value;

  return {
    data,
    meta: metaFromCache('altseason', r.status, r.storedAt, { observedAt: data.observedAt }),
  };
}
