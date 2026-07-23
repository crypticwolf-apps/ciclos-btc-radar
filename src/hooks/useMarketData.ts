import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MarketData } from '@/types';
import type { DashboardResponse } from '@/types/dashboard';
import { fetchEnvelope } from '@/lib/data/client';
import { buildMarketData } from '@/lib/data/buildMarketData';

// =============================================================================
// HOOK: useMarketData
// -----------------------------------------------------------------------------
// Fuente ÚNICA de datos para la UI. Consume el backend /api/dashboard (precio,
// global, indicadores, sentimiento, on-chain, halving, macro y divergencia
// ballenas/retail) vía TanStack Query y lo mapea al shape MarketData.
//
// TODOS los datos vivos vienen del backend: ningún componente llama a APIs
// externas. Antes la señal smart money se pedía aparte desde el navegador y
// dependía de un flag de build, lo que la dejaba en modo simulado en producción.
// =============================================================================

export interface UseMarketDataResult {
  data: MarketData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useMarketData(): UseMarketDataResult {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => fetchEnvelope<DashboardResponse>('/api/dashboard', signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const data = useMemo<MarketData | null>(() => {
    if (!dashboard.data?.data) return null;
    return buildMarketData(dashboard.data.data);
  }, [dashboard.data]);

  const queryError =
    dashboard.error instanceof Error ? dashboard.error.message : dashboard.isError
      ? 'No se pudieron cargar los datos del mercado.'
      : null;

  return {
    data,
    loading: dashboard.isLoading,
    refreshing: dashboard.isFetching && !dashboard.isLoading,
    error: data ? null : queryError,
    lastUpdated: dashboard.dataUpdatedAt ? new Date(dashboard.dataUpdatedAt) : null,
    refresh: () => {
      void dashboard.refetch();
    },
  };
}
