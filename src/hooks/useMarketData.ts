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
  /**
   * Se están enseñando datos guardados (del último uso o de una petición que
   * ya no se ha podido renovar): desde cuándo y si es por falta de conexión.
   */
  guardado: { desde: Date; sinConexion: boolean } | null;
  refresh: () => void;
}

/** A partir de cuánto un dato del panel se considera «guardado», no recién pedido. */
const GUARDADO_MS = 3 * 60_000;

export function useMarketData(): UseMarketDataResult {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => fetchEnvelope<DashboardResponse>('/api/dashboard', signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const data = useMemo<MarketData | null>(() => {
    const payload = dashboard.data?.data;
    if (!payload) return null;
    // Devuelve null si falta el precio: sin él no se arma un panel creíble.
    const built = buildMarketData(payload, dashboard.data?.meta.sources ?? []);
    // Datos guardados (del último uso, o sin poder renovarlos): las etiquetas
    // dicen «En caché», no «Actualizado», aunque el servidor los diera por buenos.
    const viejo = dashboard.isError || Date.now() - dashboard.dataUpdatedAt > GUARDADO_MS;
    if (!built || !viejo) return built;
    const reserva = <T extends { reserva: boolean } | null>(f: T): T => (f ? { ...f, reserva: true } : f);
    return {
      ...built,
      frescura: {
        mercado: reserva(built.frescura.mercado),
        derivados: reserva(built.frescura.derivados),
        macro: reserva(built.frescura.macro),
      },
      whaleFlow: reserva(built.whaleFlow),
    };
  }, [dashboard.data, dashboard.dataUpdatedAt, dashboard.isError]);

  const queryError =
    dashboard.error instanceof Error ? dashboard.error.message : dashboard.isError
      ? 'No se pudieron cargar los datos del mercado.'
      : dashboard.data && !data
        ? 'Ningún proveedor de precio ha respondido. No se muestran cifras hasta que vuelva alguno.'
        : null;

  return {
    data,
    loading: dashboard.isLoading,
    refreshing: dashboard.isFetching && !dashboard.isLoading,
    error: data ? null : queryError,
    lastUpdated: dashboard.dataUpdatedAt ? new Date(dashboard.dataUpdatedAt) : null,
    guardado:
      data && dashboard.dataUpdatedAt
        ? dashboard.isError
          ? // Había datos y la renovación ha fallado: sin conexión o servidor caído.
            { desde: new Date(dashboard.dataUpdatedAt), sinConexion: true }
          : Date.now() - dashboard.dataUpdatedAt > GUARDADO_MS
            ? { desde: new Date(dashboard.dataUpdatedAt), sinConexion: false }
            : null
        : null,
    refresh: () => {
      void dashboard.refetch();
    },
  };
}
