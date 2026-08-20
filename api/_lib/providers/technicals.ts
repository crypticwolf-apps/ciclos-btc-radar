import { computeTechnicals, halvingTiming, type Technicals } from '../../../src/lib/indicators.js';
import type { ProviderResult } from '../respond.js';
import { getTechnicals as getFromCoinMetrics } from './coinmetrics.js';
import { getIndicators as getFromCoinGecko, getMarketSummary, getPriceHistory } from './coingecko.js';

// =============================================================================
// Proveedor COMPUESTO de indicadores técnicos, con degradación explícita.
//
//   1º Coin Metrics  → ~5.800 cierres diarios desde 2010 en una sola petición.
//   2º Serie MAX del proveedor de precio (Blockchain.com → CryptoCompare →
//      CoinGecko → Kraken): también llega a 2010, así que MANTIENE la media de
//      200 semanas aunque Coin Metrics no responda. Este eslabón es el que
//      evita que un solo proveedor caído deje los indicadores de ciclo largo
//      sin dato.
//   3º CoinGecko 365 d → último recurso. Mantiene RSI, medias de 50/200 d,
//      volatilidad y rendimientos hasta 90 d; la media de 200 semanas y el
//      rendimiento a 1 año quedan en `null` (nunca inventados).
//
// El campo `meta.provider` dice cuál de los tres respondió, para que la interfaz
// pueda avisar de que está en modo degradado.
// =============================================================================

/** Índice del primer cierre del ciclo actual: el del último halving. */
function cycleStart(times: number[]): number | undefined {
  const halvingMs = Date.parse(halvingTiming().lastHalvingDate);
  const index = times.findIndex((t) => t >= halvingMs);
  return index >= 0 ? index : undefined;
}

/**
 * Indicadores sobre la serie diaria COMPLETA del proveedor de precio. Se queda
 * con un cierre por día (el último): los proveedores de respaldo pueden
 * devolver varios puntos por jornada y eso desplazaría las medias móviles.
 */
async function fromFullPriceSeries(): Promise<ProviderResult<Technicals>> {
  const history = await getPriceHistory('max');
  const byDay = new Map<string, number>();
  for (const point of history.data) {
    if (!Number.isFinite(point.t) || !(point.price > 0)) continue;
    byDay.set(new Date(point.t).toISOString().slice(0, 10), point.price);
  }
  const days = [...byDay.keys()].sort();
  if (days.length < 400) throw new Error('serie de precio insuficiente para los indicadores');

  const closes = days.map((day) => byDay.get(day)!);
  const times = days.map((day) => Date.parse(`${day}T00:00:00.000Z`));

  return {
    data: computeTechnicals(closes, { cycleStartIndex: cycleStart(times) }),
    meta: {
      ...history.meta,
      note: 'Coin Metrics no respondió: indicadores calculados sobre la serie diaria del proveedor de precio.',
    },
  };
}

export async function getTechnicalIndicators(): Promise<ProviderResult<Technicals>> {
  try {
    return await getFromCoinMetrics();
  } catch {
    /* sigue la cadena */
  }

  try {
    return await fromFullPriceSeries();
  } catch {
    const fallback = await getFromCoinGecko();
    return {
      data: fallback.data,
      meta: {
        ...fallback.meta,
        note: 'Sin serie histórica completa: histórico limitado a 365 días, sin media de 200 semanas.',
      },
    };
  }
}

// --- Tipo de cambio EUR/USD --------------------------------------------------

export interface FxRate {
  /** Euros por dólar. */
  eurPerUsd: number;
  source: string;
  observedAt: string;
}

/**
 * Tasa EUR/USD SIN peticiones adicionales: el proveedor de mercado ya devuelve
 * el precio de BTC en USD y en EUR, y su cociente es el tipo de cambio
 * implícito del mismo instante. Es más consistente que mezclar un proveedor de
 * divisas distinto, y hereda su cache.
 */
export async function getFxRate(): Promise<ProviderResult<FxRate>> {
  const summary = await getMarketSummary();
  const { priceUsd, priceEur } = summary.data;
  if (
    priceEur == null ||
    !Number.isFinite(priceEur) ||
    !Number.isFinite(priceUsd) ||
    priceUsd <= 0 ||
    priceEur <= 0
  ) {
    throw new Error('El proveedor de mercado no devolvió el precio de BTC en EUR');
  }
  return {
    data: {
      eurPerUsd: Number((priceEur / priceUsd).toFixed(5)),
      source: 'cociente BTC/EUR entre BTC/USD del proveedor de mercado',
      observedAt: summary.meta.fetchedAt ?? new Date().toISOString(),
    },
    meta: { ...summary.meta, provider: 'fx:derivado' },
  };
}
