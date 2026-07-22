import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { NetworkResponse } from '@/types/onchain';

/**
 * Estado de la red Bitcoin (/api/network).
 *
 * Refresco de 60 s, que es la frecuencia REAL a la que se mueven la mempool y
 * las comisiones. El hashrate viaja en la misma respuesta pero su TTL en el
 * servidor es de 30 min, así que consultar más a menudo no aportaría nada.
 */
export function useNetwork() {
  return useEnvelopeQuery<NetworkResponse>(['network'], '/api/network', {
    staleTimeMs: 60_000,
    refetchIntervalMs: 60_000,
  });
}
