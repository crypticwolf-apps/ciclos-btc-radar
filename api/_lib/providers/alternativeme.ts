import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Proveedor: Crypto Fear & Greed Index (alternative.me, gratis, con CORS).
// =============================================================================

const Schema = z.object({
  data: z.array(
    z.object({
      value: z.string(),
      value_classification: z.string(),
      timestamp: z.string(),
    }),
  ),
});

const LABELS_ES: Record<string, string> = {
  'Extreme Fear': 'Miedo extremo',
  Fear: 'Miedo',
  Neutral: 'Neutral',
  Greed: 'Codicia',
  'Extreme Greed': 'Codicia extrema',
};

export interface FearGreedPoint {
  value: number;
  date: string; // ISO UTC
}

export interface FearGreed {
  value: number;
  classification: string;
  changeVsYesterday: number | null;
  updatedAt: string; // ISO UTC del dato
  history: FearGreedPoint[];
}

export async function getFearGreed(): Promise<ProviderResult<FearGreed>> {
  // Cache 30 min (frecuencia real del índice).
  const r = await swr('fng', { ttlMs: 30 * 60_000, staleMs: 6 * 60 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>('https://api.alternative.me/fng/?limit=30', {
      provider: 'alternative.me',
      timeoutMs: 8000,
    });
    const data = Schema.parse(raw).data;
    if (data.length === 0) throw new Error('Fear & Greed vacío');
    const toPoint = (d: { value: string; timestamp: string }): FearGreedPoint => ({
      value: Number(d.value),
      date: new Date(Number(d.timestamp) * 1000).toISOString(),
    });
    const today = data[0]!;
    const yesterday = data[1];
    const fg: FearGreed = {
      value: Number(today.value),
      classification: LABELS_ES[today.value_classification] ?? today.value_classification,
      changeVsYesterday: yesterday ? Number(today.value) - Number(yesterday.value) : null,
      updatedAt: new Date(Number(today.timestamp) * 1000).toISOString(),
      history: data.map(toPoint).reverse(),
    };
    return fg;
  });
  return {
    data: r.value,
    meta: metaFromCache('alternative.me', r.status, r.storedAt, { observedAt: r.value.updatedAt }),
  };
}
