import type { DashboardResponse } from '../../types/dashboard.js';
import type { ScoreSources } from './opportunityScore.js';

// =============================================================================
// De la respuesta de /api/dashboard a las entradas del Score de Oportunidad.
//
// Lo usan la app y el servidor (que guarda el score de cada día para el
// histórico), así que los dos calculan exactamente lo mismo. Imports relativos
// con .js: lo ejecuta Node en las funciones serverless.
// =============================================================================

const DAY = 86_400_000;

function macroSerie(macro: DashboardResponse['macro'], id: string) {
  return macro?.series?.find((s) => s.id === id) ?? null;
}

/**
 * Liquidez macro: cuánto ha variado la liquidez neta de la Fed en su ventana
 * de tendencia y la M2 interanual. Sin el dato de partida (respuesta antigua o
 * serie caída) queda en `null` y el bloque usa lo que tenga.
 */
function liquidezMacro(
  macro: DashboardResponse['macro'],
): Pick<ScoreSources, 'fedLiquidityChangePct' | 'fedLiquidityWeeks' | 'm2YoyPct'> {
  const fed = macroSerie(macro, 'liquidez-fed');
  const m2 = macroSerie(macro, 'liquidez');
  const from = fed?.trendFrom;
  const fedPct = fed && from && from.value > 0 ? ((fed.value - from.value) / from.value) * 100 : null;
  const semanas = fed && from ? Math.round((Date.parse(fed.observedAt) - Date.parse(from.at)) / (7 * DAY)) : null;
  return { fedLiquidityChangePct: fedPct, fedLiquidityWeeks: semanas, m2YoyPct: m2?.value ?? null };
}

/** Días desde el último halving YA ocurrido (el del ciclo en curso va estimado). */
export function daysSinceLastHalving(d: DashboardResponse, now = Date.now()): number | null {
  const ocurridos = (d.onchain.halvings ?? []).filter((h) => !h.halvingEstimated);
  const last = ocurridos[ocurridos.length - 1];
  return last ? Math.round((now - Date.parse(last.at)) / DAY) : null;
}

export function scoreSourcesFrom(d: DashboardResponse): ScoreSources {
  const tech = d.market.indicators;
  const cycle = d.onchain.cycle;
  const derivs = d.derivatives;
  const net = d.network;

  return {
    drawdownFromAthPct: d.market.summary?.fromAthPct ?? null,
    price: d.market.summary?.priceUsd ?? null,
    mvrv: cycle?.mvrv ?? null,
    nupl: cycle?.nupl ?? null,
    puell: cycle?.puell ?? null,
    cycleLow: tech?.cycleLow ?? null,
    cycleHigh: tech?.cycleHigh ?? null,
    daysSinceHalving: daysSinceLastHalving(d),

    rsi14: tech?.rsi14 ?? null,
    sma50: tech?.sma50 ?? null,
    sma200: tech?.sma200 ?? null,
    sma200w: tech?.sma200w ?? null,
    cross: tech?.cross ?? 'ninguno',
    return30d: tech?.return30d ?? null,
    return90d: tech?.return90d ?? null,

    fearGreed: d.market.sentiment?.value ?? null,
    fearGreedLabel: d.market.sentiment?.classification ?? null,

    fundingRate: derivs?.fundingRate ?? null,
    openInterestChange24hPct: derivs?.openInterestChange24hPct ?? null,
    longShortRatio: derivs?.longShortRatio ?? null,

    stablecoinChange30dPct: d.liquidity?.change30dPct ?? null,
    stablecoinTrend: d.liquidity?.trend ?? null,
    ...liquidezMacro(d.macro),

    hashrateEhs: net?.strength?.hashrateEhs ?? null,
    nextDifficultyAdjustmentPct: net?.strength?.nextAdjustmentPct ?? null,
    mempoolBlocksToClear: net?.mempool?.blocksToClear ?? null,

    volatility30d: tech?.volatility30d ?? null,

    observedAt: {
      ciclo: cycle?.observedAt ?? null,
      sentimiento: d.market.sentiment?.updatedAt ?? null,
      liquidez: d.liquidity?.observedAt ?? macroSerie(d.macro, 'liquidez-fed')?.observedAt ?? null,
      red: net?.latestBlock?.minedAt ?? null,
    },
  };
}
