import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { OnchainResponse } from '@/types/onchain';

// Métricas on-chain + halving + comisiones. Refetch cada 15 min.
export function useOnchainMetrics() {
  return useEnvelopeQuery<OnchainResponse>(['onchain'], '/api/onchain', {
    staleTimeMs: 15 * 60_000,
    refetchIntervalMs: 15 * 60_000,
  });
}
