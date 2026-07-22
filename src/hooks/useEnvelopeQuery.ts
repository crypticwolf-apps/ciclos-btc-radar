import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchEnvelope } from '@/lib/data/client';
import type { Envelope } from '@/types/api';

// =============================================================================
// Hook base: ejecuta una query de TanStack Query contra una ruta /api y
// devuelve el Envelope completo (data + meta de frescura). Los hooks de cada
// dominio se construyen encima de este.
// =============================================================================

export interface EnvelopeQueryOptions {
  /** ms que el dato se considera fresco antes de revalidar. */
  staleTimeMs: number;
  /** ms para refetch automático en segundo plano. */
  refetchIntervalMs?: number;
}

export function useEnvelopeQuery<T>(
  key: readonly unknown[],
  path: string,
  opts: EnvelopeQueryOptions,
): UseQueryResult<Envelope<T>, Error> {
  return useQuery<Envelope<T>, Error>({
    queryKey: key,
    queryFn: ({ signal }) => fetchEnvelope<T>(path, signal),
    staleTime: opts.staleTimeMs,
    refetchInterval: opts.refetchIntervalMs,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
