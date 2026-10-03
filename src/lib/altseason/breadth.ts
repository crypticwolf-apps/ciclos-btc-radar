import type { AltseasonMetrics } from './score.js';
import { PERIODS } from './config.js';

// =============================================================================
// Métricas de amplitud del Altseason a partir de las filas del ranking.
//
// Las usa el servidor en el cálculo completo (cada 30 min) y el navegador al
// rehacerlas con los precios en vivo, así que las dos cifras salen de la misma
// fórmula. Imports relativos con .js: lo ejecuta Node en las funciones.
// =============================================================================

export interface BreadthRow {
  change7d: number | null;
  change30d: number | null;
  change60d: number | null;
  change90d: number | null;
  fromHigh90d: number | null;
  aboveSma20: boolean | null;
  aboveSma50: boolean | null;
  aboveSma200: boolean | null;
  beatsBtc: boolean;
}

export interface BtcReturns {
  r90: number | null;
  r60: number | null;
  r30: number | null;
}

export type BreadthMetrics = Pick<
  AltseasonMetrics,
  | 'outperform90Pct'
  | 'outperform60Pct'
  | 'outperform30Pct'
  | 'outperformCount'
  | 'analyzedCount'
  | 'btcReturn90'
  | 'aboveSma20Pct'
  | 'aboveSma50Pct'
  | 'aboveSma200Pct'
  | 'positive7dPct'
  | 'positive30dPct'
  | 'positive90dPct'
  | 'near90dHighCount'
  | 'drawdown20PlusCount'
  | 'top5Concentration'
  | 'avgDrawdownFromHigh'
>;

/** Variación en % entre el último valor de una serie y el de hace `days`. */
export function pctChange(series: number[], days: number): number | null {
  if (series.length <= days) return null;
  const past = series[series.length - 1 - days]!;
  const now = series[series.length - 1]!;
  return past > 0 ? ((now - past) / past) * 100 : null;
}

export function breadthMetrics(rows: BreadthRow[], btc: BtcReturns): BreadthMetrics {
  const analyzed = rows.length;
  const pctOf = (n: number) => (analyzed > 0 ? Number(((n / analyzed) * 100).toFixed(1)) : null);
  const beating = (pick: (r: BreadthRow) => number | null, btcRef: number | null) => {
    if (btcRef == null) return null;
    let n = 0;
    let t = 0;
    for (const r of rows) {
      const v = pick(r);
      if (v == null) continue;
      t++;
      if (v > btcRef) n++;
    }
    return t > 0 ? Number(((n / t) * 100).toFixed(1)) : null;
  };

  const gains = rows.map((r) => Math.max(0, r.change90d ?? 0)).sort((a, b) => b - a);
  const totalGain = gains.reduce((a, b) => a + b, 0);
  const top5 = gains.slice(0, 5).reduce((a, b) => a + b, 0);
  const drawdowns = rows.map((r) => r.fromHigh90d).filter((v): v is number => v != null);

  return {
    outperform90Pct: beating((r) => r.change90d, btc.r90),
    outperform60Pct: beating((r) => r.change60d, btc.r60),
    outperform30Pct: beating((r) => r.change30d, btc.r30),
    outperformCount: rows.filter((r) => r.beatsBtc).length,
    analyzedCount: analyzed,
    btcReturn90: btc.r90 == null ? null : Number(btc.r90.toFixed(2)),
    aboveSma20Pct: pctOf(rows.filter((r) => r.aboveSma20).length),
    aboveSma50Pct: pctOf(rows.filter((r) => r.aboveSma50).length),
    aboveSma200Pct: pctOf(rows.filter((r) => r.aboveSma200).length),
    positive7dPct: pctOf(rows.filter((r) => (r.change7d ?? 0) > 0).length),
    positive30dPct: pctOf(rows.filter((r) => (r.change30d ?? 0) > 0).length),
    positive90dPct: pctOf(rows.filter((r) => (r.change90d ?? 0) > 0).length),
    near90dHighCount: rows.filter((r) => (r.fromHigh90d ?? -100) > -5).length,
    drawdown20PlusCount: rows.filter((r) => (r.fromHigh90d ?? 0) < -20).length,
    top5Concentration: totalGain > 0 ? Number((top5 / totalGain).toFixed(3)) : null,
    avgDrawdownFromHigh: drawdowns.length
      ? Number((drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length).toFixed(1))
      : null,
  };
}

/** ETH/BTC y sus variaciones a 1, 7, 30 y 90 días, desde la serie de cierres (el último es el de ahora). */
export function ethBtcMetrics(
  closes: number[],
): Pick<AltseasonMetrics, 'ethBtc' | 'ethBtcChange24h' | 'ethBtcChange7d' | 'ethBtcChange30d' | 'ethBtcChange90d'> {
  const now = closes.length ? closes[closes.length - 1]! : null;
  return {
    ethBtc: now == null ? null : Number(now.toFixed(6)),
    ethBtcChange24h: pctChange(closes, 1),
    ethBtcChange7d: pctChange(closes, 7),
    ethBtcChange30d: pctChange(closes, PERIODS.short),
    ethBtcChange90d: pctChange(closes, PERIODS.main),
  };
}
