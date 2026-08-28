import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { AltseasonResponse } from '@/types/altseason';

/**
 * Datos de Altseason (/api/altseason).
 *
 * La piden el marcador de la pantalla de inicio (al acercarse a pantalla, no en
 * la carga inicial) y el apartado Ciclos → Altseason.
 * TanStack Query mantiene el resultado en cache 30 min, así que cambiar entre
 * Ciclo BTC, Altseason y Comparativa no dispara peticiones nuevas, y el
 * backend cachea otros 30 min de cara a los proveedores externos.
 */
export function useAltseason(enabled = true) {
  return useEnvelopeQuery<AltseasonResponse>(['altseason'], '/api/altseason', {
    staleTimeMs: 30 * 60_000,
    // El servidor recalcula cada 30 min; sin esto la pestaña abierta se quedaba
    // con el marcador de cuando se cargó.
    refetchIntervalMs: 30 * 60_000,
    enabled,
  });
}
