import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { AltseasonResponse } from '@/types/altseason';

/**
 * Datos de Altseason (/api/altseason).
 *
 * Se pide SOLO cuando se abre Ciclos → Altseason, no en la carga inicial.
 * TanStack Query mantiene el resultado en cache 30 min, así que cambiar entre
 * Ciclo BTC, Altseason y Comparativa no dispara peticiones nuevas, y el
 * backend cachea otros 30 min de cara a los proveedores externos.
 */
export function useAltseason(enabled = true) {
  return useEnvelopeQuery<AltseasonResponse>(['altseason'], '/api/altseason', {
    staleTimeMs: 30 * 60_000,
    enabled,
  });
}
