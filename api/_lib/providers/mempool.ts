import { z } from 'zod';
import { fetchJson, fetchText } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

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

// --- Congestión: tamaño de la mempool ---------------------------------------
// Frecuencia real de cada bloque, y TTL acorde:
//   mempool y comisiones ....... ~1 min   → 60 s
//   último bloque .............. ~10 min  → 60 s
//   hashrate y dificultad ...... horas    → 30 min

const MempoolSchema = z.object({
  count: z.number(),
  vsize: z.number(),
  total_fee: z.number(),
});

export interface MempoolState {
  /** Transacciones pendientes de confirmar. */
  pendingTx: number;
  /** Peso total pendiente, en MB virtuales. */
  vsizeMb: number;
  /** Comisiones acumuladas en la mempool, en BTC. */
  totalFeeBtc: number;
  /** Bloques que harían falta para vaciarla (~1 MvB por bloque). */
  blocksToClear: number;
}

export async function getMempoolState(): Promise<ProviderResult<MempoolState>> {
  const r = await swr('mempool:state', { ttlMs: 60_000, staleMs: 30 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>('https://mempool.space/api/mempool', {
      provider: 'mempool.space:mempool',
      timeoutMs: 8000,
    });
    const m = MempoolSchema.parse(raw);
    const vsizeMb = m.vsize / 1e6;
    return {
      pendingTx: m.count,
      vsizeMb: Number(vsizeMb.toFixed(2)),
      totalFeeBtc: Number((m.total_fee / 1e8).toFixed(4)),
      blocksToClear: Math.ceil(vsizeMb),
    } satisfies MempoolState;
  });
  return { data: r.value, meta: metaFromCache('mempool.space:mempool', r.status, r.storedAt) };
}

// --- Hashrate, dificultad y próximo reajuste --------------------------------

const HashrateSchema = z.object({
  currentHashrate: z.number(),
  currentDifficulty: z.number(),
});

const AdjustmentSchema = z.object({
  progressPercent: z.number(),
  difficultyChange: z.number(),
  remainingBlocks: z.number(),
  estimatedRetargetDate: z.number(),
  /** Tiempo medio real entre bloques del periodo actual, en ms. */
  timeAvg: z.number(),
});

export interface NetworkStrength {
  /** Hashrate actual en EH/s. */
  hashrateEhs: number;
  /** Dificultad actual en T (billones). */
  difficultyT: number;
  /** % del periodo de reajuste ya minado. */
  retargetProgressPct: number;
  /** Cambio de dificultad estimado en el próximo reajuste (%). */
  nextAdjustmentPct: number;
  blocksToRetarget: number;
  /** Fecha estimada del reajuste (ISO UTC). */
  retargetDate: string;
  /** Tiempo medio real entre bloques, en minutos. */
  avgBlockMinutes: number;
}

export async function getNetworkStrength(): Promise<ProviderResult<NetworkStrength>> {
  const r = await swr('mempool:strength', { ttlMs: 30 * 60_000, staleMs: 12 * 60 * 60_000 }, async () => {
    const [hashRaw, adjRaw] = await Promise.all([
      fetchJson<unknown>('https://mempool.space/api/v1/mining/hashrate/3d', {
        provider: 'mempool.space:hashrate',
        timeoutMs: 10_000,
      }),
      fetchJson<unknown>('https://mempool.space/api/v1/difficulty-adjustment', {
        provider: 'mempool.space:difficulty',
        timeoutMs: 8000,
      }),
    ]);
    const h = HashrateSchema.parse(hashRaw);
    const a = AdjustmentSchema.parse(adjRaw);
    return {
      hashrateEhs: Number((h.currentHashrate / 1e18).toFixed(1)),
      difficultyT: Number((h.currentDifficulty / 1e12).toFixed(1)),
      retargetProgressPct: Number(a.progressPercent.toFixed(1)),
      nextAdjustmentPct: Number(a.difficultyChange.toFixed(2)),
      blocksToRetarget: a.remainingBlocks,
      retargetDate: new Date(a.estimatedRetargetDate).toISOString(),
      avgBlockMinutes: Number((a.timeAvg / 60_000).toFixed(1)),
    } satisfies NetworkStrength;
  });
  return { data: r.value, meta: metaFromCache('mempool.space:hashrate', r.status, r.storedAt) };
}

// --- Último bloque minado ---------------------------------------------------

const BlockSchema = z.object({
  height: z.number(),
  timestamp: z.number(),
  tx_count: z.number(),
  size: z.number(),
});

export interface LatestBlock {
  height: number;
  /** ISO UTC del momento en que se minó. */
  minedAt: string;
  txCount: number;
  sizeMb: number;
}

export async function getLatestBlock(): Promise<ProviderResult<LatestBlock>> {
  const r = await swr('mempool:block', { ttlMs: 60_000, staleMs: 60 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>('https://mempool.space/api/v1/blocks', {
      provider: 'mempool.space:blocks',
      timeoutMs: 8000,
    });
    const blocks = z.array(BlockSchema).min(1).parse(raw);
    const b = blocks[0]!;
    return {
      height: b.height,
      minedAt: new Date(b.timestamp * 1000).toISOString(),
      txCount: b.tx_count,
      sizeMb: Number((b.size / 1e6).toFixed(2)),
    } satisfies LatestBlock;
  });
  return {
    data: r.value,
    meta: metaFromCache('mempool.space:blocks', r.status, r.storedAt, {
      observedAt: r.value.minedAt,
    }),
  };
}
