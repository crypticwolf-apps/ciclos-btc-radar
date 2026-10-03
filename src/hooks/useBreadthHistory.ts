import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { BreadthHistory } from '@/types/altseason';

/**
 * Amplitud del mercado de altcoins desde 2017 y las altseasons anteriores.
 * Es un dato diario: el servidor lo rehace cada 12 h.
 */
export function useBreadthHistory(enabled = true) {
  return useEnvelopeQuery<BreadthHistory>(['amplitud'], '/api/historial?serie=amplitud', {
    staleTimeMs: 6 * 60 * 60_000,
    enabled,
  });
}
