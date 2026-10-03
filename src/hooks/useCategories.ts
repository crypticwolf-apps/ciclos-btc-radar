import { useEnvelopeQuery } from './useEnvelopeQuery';
import type { CategoriesData } from '@/types/categories';

/**
 * Rendimiento por categorías de altcoins (/api/altseason?vista=categorias).
 * El servidor lo renueva cada 10 min; el «en vivo» lo pone el precio al contado.
 */
export function useCategories() {
  return useEnvelopeQuery<CategoriesData>(['categorias'], '/api/altseason?vista=categorias', {
    staleTimeMs: 5 * 60_000,
    refetchIntervalMs: 10 * 60_000,
  });
}
