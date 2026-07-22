import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MarketData } from '@/types';
import type { DashboardResponse } from '@/types/dashboard';
import type { PriceHistory } from '@/types/market';
import { fetchEnvelope } from '@/lib/data/client';
import { buildMarketData, type SmartMoneyBundle } from '@/lib/data/buildMarketData';
import { getSmartMoneySignals } from '@/services/smartMoneyData';
import { MOCK_SMART_MONEY, MOCK_WHALE_TIMELINE } from '@/data/mockData';

// =============================================================================
// HOOK: useMarketData
// -----------------------------------------------------------------------------
// Fuente ÚNICA de datos para la UI clásica. Consume el backend /api/dashboard
// (precio, global, indicadores, sentimiento, on-chain/halving y macro) vía
// TanStack Query y lo mapea al shape MarketData. La señal smart money se calcula
// aparte (on-chain). Mantiene la interfaz que ya usa App.tsx.
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

  const smart = useQuery({
    queryKey: ['smartmoney'],
    queryFn: async ({ signal }): Promise<SmartMoneyBundle> => {
      // Cierres reales del último año (backend) para alinear el precio del gráfico.
      let closes: number[] | null = null;
      try {
        const hist = await fetchEnvelope<PriceHistory>(
          '/api/market?series=history&days=365',
          signal,
        );
        closes = hist.data?.points.map((p) => p.price) ?? null;
      } catch {
        /* sin closes → el proxy on-chain usa una alineación aproximada */
      }
      const r = await getSmartMoneySignals(closes);
      return { smartMoney: r.smartMoney, whaleTimeline: r.whaleTimeline };
    },
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
  });

  const data = useMemo<MarketData | null>(() => {
    if (!dashboard.data?.data) return null;
    const sm: SmartMoneyBundle = smart.data ?? {
      smartMoney: MOCK_SMART_MONEY,
      whaleTimeline: MOCK_WHALE_TIMELINE,
    };
    return buildMarketData(dashboard.data.data, sm);
  }, [dashboard.data, smart.data]);

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
      void smart.refetch();
    },
  };
}
