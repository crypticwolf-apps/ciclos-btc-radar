import { useBitcoinMarketData } from './useBitcoinMarketData';
import type { SourceMeta } from '@/types/api';
import type { FearGreed } from '@/types/market';

// =============================================================================
// Fear & Greed: reutiliza la query de mercado (el backend cachea el índice 30
// min por su cuenta), evitando una petición extra. Expone el sentimiento y su
// meta de frescura ya extraídos.
// =============================================================================

export function useFearGreed() {
  const query = useBitcoinMarketData();
  const sentiment: FearGreed | null = query.data?.data?.sentiment ?? null;
  const meta: SourceMeta | null =
    query.data?.meta.sources.find((s) => s.provider === 'alternative.me') ?? null;
  return { ...query, sentiment, meta };
}
