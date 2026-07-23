import type { Technicals } from '../../../src/lib/indicators.js';
import type { ProviderResult } from '../respond.js';
import { getTechnicals as getFromCoinMetrics } from './coinmetrics.js';
import { getIndicators as getFromCoinGecko, getMarketSummary } from './coingecko.js';

// =============================================================================
// Proveedor COMPUESTO de indicadores técnicos, con degradación explícita.
//
//   1º Coin Metrics  → ~5.800 cierres diarios desde 2010 en una sola petición.
//                      Es el único gratuito y sin clave que llega a los 1.400
//                      cierres que exige la media de 200 SEMANAS.
//   2º CoinGecko     → 365 días. Mantiene RSI, medias de 50/200 d, volatilidad
//                      y rendimientos hasta 90 d; la media de 200 semanas y el
//                      rendimiento a 1 año quedan en `null` (nunca inventados).
//
// El campo `meta.provider` dice cuál de los dos respondió, para que la interfaz
// pueda avisar de que está en modo degradado.
// =============================================================================

export async function getTechnicalIndicators(): Promise<ProviderResult<Technicals>> {
  try {
    return await getFromCoinMetrics();
  } catch {
    const fallback = await getFromCoinGecko();
    return {
      data: fallback.data,
      meta: {
        ...fallback.meta,
        note: 'Coin Metrics no respondió: histórico limitado a 365 días, sin media de 200 semanas.',
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
