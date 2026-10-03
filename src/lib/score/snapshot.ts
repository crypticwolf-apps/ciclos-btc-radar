import type { DashboardResponse } from '../../types/dashboard.js';
import type { CyclePhaseId } from '../../types/index.js';
import { computeOpportunityScore, type BlockId, type Confidence } from './opportunityScore.js';
import { scoreSourcesFrom } from './sources.js';
import { phaseRule } from '../cycle/phaseRule.js';

// =============================================================================
// Foto del día para el histórico: el Score de Oportunidad y la fase del ciclo,
// calculados con las MISMAS funciones que la app. La toma el servidor con cada
// /api/dashboard y guarda la última de cada día.
// =============================================================================

export interface DailySnapshot {
  /** Día UTC, YYYY-MM-DD. */
  day: string;
  /** Momento de la foto (ISO). */
  at: string;
  score: number;
  confianza: Confidence;
  cobertura: number;
  fase: CyclePhaseId;
  bloques: Partial<Record<BlockId, number | null>>;
  /** Precio de BTC en ese momento, para leer el score frente al precio. */
  precio: number | null;
}

export function snapshotFrom(d: DashboardResponse, now = new Date()): DailySnapshot {
  const op = computeOpportunityScore(scoreSourcesFrom(d));
  const s = d.market.summary;
  const { id } = phaseRule({
    dd: s?.fromAthPct == null ? null : Math.min(0, Number(s.fromAthPct.toFixed(1))),
    tendencia: d.market.indicators?.trend ?? null,
    rsi: d.market.indicators?.rsi14 ?? null,
    fearGreed: d.market.sentiment?.value ?? null,
  });
  return {
    day: now.toISOString().slice(0, 10),
    at: now.toISOString(),
    score: op.score,
    confianza: op.confianza,
    cobertura: op.cobertura,
    fase: id,
    bloques: Object.fromEntries(op.bloques.map((b) => [b.id, b.score])),
    precio: s?.priceUsd ?? null,
  };
}
