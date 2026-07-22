import { z } from 'zod';
import { fetchJson, fetchText } from '../http';
import { swr } from '../cache';
import { metaFromCache, type ProviderResult } from '../respond';

// =============================================================================
// Proveedor: mempool.space (gratis, sin clave). Altura de bloque en tiempo real
// (para el progreso del halving) y comisiones recomendadas.
// =============================================================================

const HALVING_INTERVAL = 210_000;
const MINUTES_PER_BLOCK = 10;

export interface HalvingProgress {
  blockHeight: number;
  lastHalvingBlock: number;
  nextHalvingBlock: number;
  blocksRemaining: number;
  /** 0..1 del intervalo actual ya minado. */
  progress: number;
  estimatedDaysRemaining: number;
  /** Fecha estimada del próximo halving (ISO UTC). */
  estimatedDate: string;
}

/** Cálculo puro del progreso del halving a partir de la altura de bloque. */
export function computeHalving(blockHeight: number, nowMs: number = Date.now()): HalvingProgress {
  const lastHalvingBlock = Math.floor(blockHeight / HALVING_INTERVAL) * HALVING_INTERVAL;
  const nextHalvingBlock = lastHalvingBlock + HALVING_INTERVAL;
  const blocksRemaining = nextHalvingBlock - blockHeight;
  const minedInInterval = blockHeight - lastHalvingBlock;
  const progress = minedInInterval / HALVING_INTERVAL;
  const minutesRemaining = blocksRemaining * MINUTES_PER_BLOCK;
  return {
    blockHeight,
    lastHalvingBlock,
    nextHalvingBlock,
    blocksRemaining,
    progress: Number(progress.toFixed(4)),
    estimatedDaysRemaining: Math.round(minutesRemaining / 60 / 24),
    estimatedDate: new Date(nowMs + minutesRemaining * 60_000).toISOString(),
  };
}

const FeesSchema = z.object({
  fastestFee: z.number(),
  halfHourFee: z.number(),
  hourFee: z.number(),
  economyFee: z.number(),
  minimumFee: z.number(),
});

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export async function getHalvingProgress(): Promise<ProviderResult<HalvingProgress>> {
  const r = await swr('mempool:height', { ttlMs: 5 * 60_000, staleMs: 60 * 60_000 }, async () => {
    const text = await fetchText('https://mempool.space/api/blocks/tip/height', {
      provider: 'mempool.space',
      timeoutMs: 8000,
    });
    const blockHeight = Number(text.trim());
    if (!Number.isFinite(blockHeight) || blockHeight <= 0) {
      throw new Error('altura de bloque inválida');
    }
    return computeHalving(blockHeight);
  });
  return { data: r.value, meta: metaFromCache('mempool.space', r.status, r.storedAt) };
}

export async function getRecommendedFees(): Promise<ProviderResult<RecommendedFees>> {
  const r = await swr('mempool:fees', { ttlMs: 5 * 60_000, staleMs: 60 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>('https://mempool.space/api/v1/fees/recommended', {
      provider: 'mempool.space',
      timeoutMs: 8000,
    });
    return FeesSchema.parse(raw);
  });
  return { data: r.value, meta: metaFromCache('mempool.space:fees', r.status, r.storedAt) };
}
