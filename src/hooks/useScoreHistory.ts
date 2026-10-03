import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { DailySnapshot } from '@/lib/score/snapshot';

/** Fase de cada día desde 2018, compacta: una letra y un cierre por día. */
export interface PhaseHistory {
  /** Primer día (YYYY-MM-DD); los siguientes van seguidos. */
  desde: string;
  /** Una letra por día (PHASE_CODE en lib/cycle/phaseRule). */
  fases: string;
  /** Cierre de BTC de cada día, en dólares. */
  precios: number[];
  source: string;
}

export interface ScoreHistoryResponse {
  /** `false` si el servidor no tiene dónde guardar el score diario (sin Upstash). */
  configured: boolean;
  days: DailySnapshot[];
  /** Ausente en respuestas anteriores o si falla la reconstrucción. */
  fases?: PhaseHistory | null;
}

/** Evolución de la fase (desde 2018) y del Score de Oportunidad (/api/historial). */
export function useScoreHistory() {
  return useEnvelopeQuery<ScoreHistoryResponse>(['historial'], '/api/historial', {
    staleTimeMs: 30 * 60_000,
    refetchIntervalMs: 60 * 60_000,
  });
}
