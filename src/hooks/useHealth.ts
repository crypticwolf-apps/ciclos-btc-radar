import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { HealthReport } from '@/types/api';

// Estado de fuentes. Refetch cada 60s.
export function useHealth() {
  return useEnvelopeQuery<HealthReport>(['health'], '/api/health', {
    staleTimeMs: 30_000,
    refetchIntervalMs: 60_000,
  });
}
