import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { MarketResponse, PriceHistory, ChartRange, Currency } from '@/types/market';

// Precio + global + sentimiento. Refetch cada 60s (cache de servidor 60s).
export function useBitcoinMarketData() {
  return useEnvelopeQuery<MarketResponse>(['market'], '/api/market', {
    staleTimeMs: 60_000,
    refetchIntervalMs: 60_000,
  });
}

// Histórico de precios para los gráficos, por rango temporal y moneda.
export function usePriceHistory(range: ChartRange, currency: Currency = 'usd') {
  const version = range === 'max' ? '&historyVersion=2' : '';
  return useEnvelopeQuery<PriceHistory>(
    ['market', 'history', range, currency],
    `/api/market?series=history&days=${range}&vs=${currency}${version}`,
    { staleTimeMs: range === '1' ? 60 * 60_000 : 6 * 60 * 60_000 },
  );
}
