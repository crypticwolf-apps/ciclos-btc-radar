import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { DailySnapshot } from '@/lib/score/snapshot';

export interface ScoreHistoryResponse {
  /** `false` si el servidor no tiene dónde guardar el histórico (sin Upstash). */
  configured: boolean;
  days: DailySnapshot[];
}

/** Score de Oportunidad y fase de cada día guardado (/api/historial). Un punto al día. */
export function useScoreHistory() {
  return useEnvelopeQuery<ScoreHistoryResponse>(['historial'], '/api/historial', {
    staleTimeMs: 30 * 60_000,
    refetchIntervalMs: 60 * 60_000,
  });
}
