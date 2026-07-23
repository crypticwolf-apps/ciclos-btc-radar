import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Proveedor: DERIVADOS de Bitcoin (perpetuos), con cadena de respaldo.
//
// Alimenta el bloque "derivados" del Score de Oportunidad (12% de su peso).
//
// Igual que las velas: Binance responde HTTP 451 a las peticiones que salen de
// los centros de datos, así que el backend no puede depender solo de él. Se
// prueba Binance, luego OKX y por último Bybit, y se usa el primero que
// responda de verdad.
//
// Cobertura por proveedor (lo que no llega queda a null, nunca inventado):
//   Binance → todo
//   OKX     → todo salvo el precio índice
//   Bybit   → todo en una sola llamada salvo long/short, taker y la variación
//             del interés abierto
// =============================================================================

export interface DerivativesData {
  /** Funding vigente en tanto por uno (0.0001 = 0,01% por periodo). */
  fundingRate: number | null;
  nextFundingAt: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  openInterestBtc: number | null;
  openInterestUsd: number | null;
  /** Variación del interés abierto en 24 h (%). */
  openInterestChange24hPct: number | null;
  longShortRatio: number | null;
  longAccountPct: number | null;
  takerBuySellRatio: number | null;
  /** Proveedor que sirvió los datos, para poder atribuirlo. */
  source: string;
}

const EMPTY: Omit<DerivativesData, 'source'> = {
  fundingRate: null,
  nextFundingAt: null,
  markPrice: null,
  indexPrice: null,
  openInterestBtc: null,
  openInterestUsd: null,
  openInterestChange24hPct: null,
  longShortRatio: null,
  longAccountPct: null,
  takerBuySellRatio: null,
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round = (v: number | null, d: number): number | null =>
  v == null ? null : Number(v.toFixed(d));

// --- Binance ----------------------------------------------------------------

async function fromBinance(): Promise<DerivativesData> {
  const F = 'https://fapi.binance.com';
  const get = <T>(path: string) =>
    fetchJson<T>(`${F}${path}`, { provider: 'binance:derivs', timeoutMs: 9000, retries: 0 });

  const [premium, oi, oiHist, longShort, taker] = await Promise.allSettled([
    get<{ markPrice: string; indexPrice: string; lastFundingRate: string; nextFundingTime: number }>(
      '/fapi/v1/premiumIndex?symbol=BTCUSDT',
    ),
    get<{ openInterest: string }>('/fapi/v1/openInterest?symbol=BTCUSDT'),
    get<{ sumOpenInterest: string; sumOpenInterestValue: string }[]>(
      '/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=25',
    ),
    get<{ longAccount: string; longShortRatio: string }[]>(
      '/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1',
    ),
    get<{ buySellRatio: string }[]>('/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1'),
  ]);

  // Sin funding ni interés abierto el bloque no aporta nada: mejor probar el
  // siguiente proveedor que servir medio dato.
  if (premium.status === 'rejected' && oi.status === 'rejected') {
    throw new Error('Binance Futures no respondió');
  }

  const p = premium.status === 'fulfilled' ? premium.value : null;
  const openInterestBtc = oi.status === 'fulfilled' ? num(oi.value.openInterest) : null;

  let change24h: number | null = null;
  let oiUsd: number | null = null;
  if (oiHist.status === 'fulfilled' && oiHist.value.length > 1) {
    const rows = oiHist.value;
    const oldest = num(rows[0]!.sumOpenInterest) ?? 0;
    const newest = num(rows[rows.length - 1]!.sumOpenInterest) ?? 0;
    if (oldest > 0) change24h = ((newest - oldest) / oldest) * 100;
    const value = num(rows[rows.length - 1]!.sumOpenInterestValue) ?? 0;
    if (value > 0 && newest > 0 && openInterestBtc != null) {
      oiUsd = Math.round((value / newest) * openInterestBtc);
    }
  }

  const ls = longShort.status === 'fulfilled' ? longShort.value[0] : undefined;
  const tk = taker.status === 'fulfilled' ? taker.value[0] : undefined;

  return {
    fundingRate: p ? num(p.lastFundingRate) : null,
    nextFundingAt: p ? p.nextFundingTime : null,
    markPrice: p ? num(p.markPrice) : null,
    indexPrice: p ? num(p.indexPrice) : null,
    openInterestBtc: round(openInterestBtc, 1),
    openInterestUsd: oiUsd,
    openInterestChange24hPct: round(change24h, 2),
    longShortRatio: ls ? round(num(ls.longShortRatio), 3) : null,
    longAccountPct: ls ? round((num(ls.longAccount) ?? 0) * 100, 1) : null,
    takerBuySellRatio: tk ? round(num(tk.buySellRatio), 3) : null,
    source: 'binance',
  };
}

// --- OKX --------------------------------------------------------------------

interface OkxList<T> {
  code: string;
  data: T[];
}

async function fromOkx(): Promise<DerivativesData> {
  const O = 'https://www.okx.com/api/v5';
  const get = <T>(path: string) =>
    fetchJson<OkxList<T>>(`${O}${path}`, { provider: 'okx:derivs', timeoutMs: 9000, retries: 0 });

  const [funding, oi, oiHist, lsr, taker] = await Promise.allSettled([
    get<{ fundingRate: string; nextFundingTime: string }>(
      '/public/funding-rate?instId=BTC-USDT-SWAP',
    ),
    get<{ oiCcy: string; oiUsd: string }>('/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP'),
    get<string[]>('/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1H'),
    get<string[]>('/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=1H'),
    get<string[]>('/rubik/stat/taker-volume?ccy=BTC&instType=SPOT&period=1H'),
  ]);

  const ok = <T>(r: PromiseSettledResult<OkxList<T>>): T[] | null =>
    r.status === 'fulfilled' && r.value.code === '0' ? r.value.data : null;

  const f = ok(funding)?.[0];
  const o = ok(oi)?.[0];
  if (!f && !o) throw new Error('OKX no devolvió datos de derivados');

  // Las series de OKX vienen de más reciente a más antigua.
  const oiRows = ok(oiHist);
  let change24h: number | null = null;
  if (oiRows && oiRows.length > 24) {
    const now = num(oiRows[0]![1]) ?? 0;
    const ago = num(oiRows[24]![1]) ?? 0;
    if (ago > 0) change24h = ((now - ago) / ago) * 100;
  }

  const lsrRows = ok(lsr);
  const ratio = lsrRows && lsrRows.length > 0 ? num(lsrRows[0]![1]) : null;

  // taker-volume: [ts, volumen vendedor, volumen comprador]
  const takerRows = ok(taker);
  let buySell: number | null = null;
  if (takerRows && takerRows.length > 0) {
    const sell = num(takerRows[0]![1]) ?? 0;
    const buy = num(takerRows[0]![2]) ?? 0;
    if (sell > 0) buySell = buy / sell;
  }

  return {
    fundingRate: f ? num(f.fundingRate) : null,
    nextFundingAt: f ? num(f.nextFundingTime) : null,
    // OKX no expone el precio de marca en este endpoint público: queda null.
    markPrice: null,
    indexPrice: null,
    openInterestBtc: o ? round(num(o.oiCcy), 1) : null,
    openInterestUsd: o ? Math.round(num(o.oiUsd) ?? 0) : null,
    openInterestChange24hPct: round(change24h, 2),
    longShortRatio: round(ratio, 3),
    // El ratio de OKX es largos/cortos por cuenta: se convierte a % de largos.
    longAccountPct: ratio != null && ratio > 0 ? round((ratio / (1 + ratio)) * 100, 1) : null,
    takerBuySellRatio: round(buySell, 3),
    source: 'okx',
  };
}

// --- Bybit ------------------------------------------------------------------

async function fromBybit(): Promise<DerivativesData> {
  const raw = await fetchJson<{
    retCode: number;
    result: {
      list: {
        markPrice: string;
        indexPrice: string;
        fundingRate: string;
        nextFundingTime: string;
        openInterest: string;
        openInterestValue: string;
      }[];
    };
  }>('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT', {
    provider: 'bybit:derivs',
    timeoutMs: 9000,
    retries: 0,
  });

  if (raw.retCode !== 0 || !raw.result.list[0]) throw new Error('Bybit no devolvió derivados');
  const t = raw.result.list[0];

  return {
    ...EMPTY,
    fundingRate: num(t.fundingRate),
    nextFundingAt: num(t.nextFundingTime),
    markPrice: num(t.markPrice),
    indexPrice: num(t.indexPrice),
    openInterestBtc: round(num(t.openInterest), 1),
    openInterestUsd: Math.round(num(t.openInterestValue) ?? 0),
    source: 'bybit',
  };
}

// --- Cadena -----------------------------------------------------------------

const CHAIN: readonly (() => Promise<DerivativesData>)[] = [fromBinance, fromOkx, fromBybit];

export async function getDerivatives(): Promise<ProviderResult<DerivativesData>> {
  const r = await swr('derivs:v2', { ttlMs: 60_000, staleMs: 30 * 60_000 }, async () => {
    const errors: string[] = [];
    for (const attempt of CHAIN) {
      try {
        return await attempt();
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    throw new Error(`Ningún proveedor de derivados respondió (${errors.join(' · ')})`);
  });

  return {
    data: r.value,
    meta: metaFromCache(`derivados:${r.value.source}`, r.status, r.storedAt),
  };
}
