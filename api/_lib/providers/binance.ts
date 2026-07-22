import { z } from 'zod';
import { fetchJson } from '../http';
import { swr } from '../cache';
import { metaFromCache, type ProviderResult } from '../respond';

// =============================================================================
// Proveedor: Binance Futures (público, sin clave).
//
// El navegador ya consulta estos endpoints para la tarjeta en vivo; aquí se
// piden TAMBIÉN desde el servidor porque el Score de Oportunidad necesita el
// bloque de derivados y debe calcularse en un único sitio. Con cache de 60 s
// el coste no crece con el número de visitantes.
// =============================================================================

const FUTURES = 'https://fapi.binance.com';

const PremiumSchema = z.object({
  markPrice: z.string(),
  lastFundingRate: z.string(),
  nextFundingTime: z.number(),
});

const OpenInterestSchema = z.object({ openInterest: z.string() });

const OiHistSchema = z.array(
  z.object({ sumOpenInterest: z.string(), sumOpenInterestValue: z.string() }),
);

const LongShortSchema = z.array(
  z.object({ longAccount: z.string(), longShortRatio: z.string() }),
);

const TakerSchema = z.array(z.object({ buySellRatio: z.string() }));

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface DerivativesData {
  /** Funding vigente en tanto por uno (0.0001 = 0,01% cada 8 h). */
  fundingRate: number | null;
  nextFundingAt: number | null;
  markPrice: number | null;
  openInterestBtc: number | null;
  openInterestUsd: number | null;
  /** Variación del interés abierto en 24 h (%). */
  openInterestChange24hPct: number | null;
  longShortRatio: number | null;
  longAccountPct: number | null;
  takerBuySellRatio: number | null;
}

/**
 * Foto del mercado de futuros. Cada endpoint se pide por separado con
 * `allSettled`: si Binance limita alguno de los de estadísticas, el resto
 * llega igual y el campo que falte queda a `null`.
 */
export async function getDerivatives(): Promise<ProviderResult<DerivativesData>> {
  const r = await swr('binance:derivs', { ttlMs: 60_000, staleMs: 30 * 60_000 }, async () => {
    const get = <T>(path: string) =>
      fetchJson<T>(`${FUTURES}${path}`, { provider: 'binance', timeoutMs: 9000 });

    const [premium, oi, oiHist, longShort, taker] = await Promise.allSettled([
      get<unknown>('/fapi/v1/premiumIndex?symbol=BTCUSDT'),
      get<unknown>('/fapi/v1/openInterest?symbol=BTCUSDT'),
      get<unknown>('/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=25'),
      get<unknown>('/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1'),
      get<unknown>('/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1'),
    ]);

    // Sin funding ni interés abierto el bloque no aporta nada: mejor fallar y
    // que el score redistribuya el peso que servir medio dato.
    if (premium.status === 'rejected' && oi.status === 'rejected') {
      throw new Error('Binance Futures no respondió');
    }

    const p = premium.status === 'fulfilled' ? PremiumSchema.safeParse(premium.value) : null;
    const o = oi.status === 'fulfilled' ? OpenInterestSchema.safeParse(oi.value) : null;
    const h = oiHist.status === 'fulfilled' ? OiHistSchema.safeParse(oiHist.value) : null;
    const ls = longShort.status === 'fulfilled' ? LongShortSchema.safeParse(longShort.value) : null;
    const tk = taker.status === 'fulfilled' ? TakerSchema.safeParse(taker.value) : null;

    const openInterestBtc = o?.success ? toNum(o.data.openInterest) : null;

    let openInterestChange24hPct: number | null = null;
    let openInterestUsd: number | null = null;
    if (h?.success && h.data.length > 1) {
      const rows = h.data;
      const oldest = toNum(rows[0]!.sumOpenInterest);
      const newest = toNum(rows[rows.length - 1]!.sumOpenInterest);
      if (oldest > 0) {
        openInterestChange24hPct = Number((((newest - oldest) / oldest) * 100).toFixed(2));
      }
      const value = toNum(rows[rows.length - 1]!.sumOpenInterestValue);
      if (value > 0 && newest > 0 && openInterestBtc != null) {
        openInterestUsd = Math.round((value / newest) * openInterestBtc);
      }
    }

    const lsRow = ls?.success ? ls.data[0] : undefined;
    const tkRow = tk?.success ? tk.data[0] : undefined;

    return {
      fundingRate: p?.success ? toNum(p.data.lastFundingRate) : null,
      nextFundingAt: p?.success ? p.data.nextFundingTime : null,
      markPrice: p?.success ? toNum(p.data.markPrice) : null,
      openInterestBtc: openInterestBtc != null ? Number(openInterestBtc.toFixed(1)) : null,
      openInterestUsd,
      openInterestChange24hPct,
      longShortRatio: lsRow ? Number(toNum(lsRow.longShortRatio).toFixed(3)) : null,
      longAccountPct: lsRow ? Number((toNum(lsRow.longAccount) * 100).toFixed(1)) : null,
      takerBuySellRatio: tkRow ? Number(toNum(tkRow.buySellRatio).toFixed(3)) : null,
    } satisfies DerivativesData;
  });

  return { data: r.value, meta: metaFromCache('binance:futures', r.status, r.storedAt) };
}
