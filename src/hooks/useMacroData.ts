import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { MacroResponse } from '@/types/macro';

// Bloque macro (FRED). Refetch cada 6h (FRED publica con baja frecuencia).
export function useMacroData() {
  return useEnvelopeQuery<MacroResponse>(['macro'], '/api/macro', {
    staleTimeMs: 6 * 60 * 60_000,
    refetchIntervalMs: 6 * 60 * 60_000,
  });
}
