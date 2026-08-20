import { z } from 'zod';
import { fetchJson, fetchText } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Proveedor: estado de la red Bitcoin, con CADENA DE RESPALDO.
//
// mempool.space sigue siendo la fuente principal, pero era el único host de las
// CINCO lecturas de esta sección: altura de bloque (que alimenta el contador
// del halving en la pantalla de inicio), comisiones, mempool, hashrate y último
// bloque. Un bloqueo por región o un límite por IP —lo que ya hace Binance con
// los centros de datos, respondiendo 451— dejaba todo eso sin dato a la vez.
//
// Respaldo: Blockstream, que expone la API Esplora, el mismo software del que
// mempool.space es un fork. Sirve altura, bloques, mempool y comisiones con
// otra forma de respuesta, y aquí se normalizan a la misma.
//
// Lo que Esplora NO publica es el hashrate ni el reajuste de dificultad. Esos
// dos se derivan de la propia cadena (los `bits` del último bloque y la marca
// de tiempo del primero del periodo): es aritmética exacta del protocolo, no
// una estimación inventada, y el proveedor declarado lo dice.
// =============================================================================

const MEMPOOL = 'https://mempool.space/api';
const ESPLORA = 'https://blockstream.info/api';

const HALVING_INTERVAL = 210_000;
const MINUTES_PER_BLOCK = 10;
const RETARGET_INTERVAL = 2016;
const TARGET_BLOCK_SECONDS = 600;

/** Una lectura con su origen, para poder atribuir el dato que se sirve. */
interface Sourced<T> {
  value: T;
  source: string;
}

/**
 * Prueba las fuentes en orden y devuelve la primera que responda de verdad. Si
 * ninguna responde, lanza con el detalle de todas: es preferible declarar el
 * dato no disponible que enseñar un número inventado.
 */
async function firstAvailable<T>(
  attempts: readonly { source: string; run: () => Promise<T> }[],
): Promise<Sourced<T>> {
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      return { value: await attempt.run(), source: attempt.source };
    } catch (err) {
      errors.push(`${attempt.source}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Ninguna fuente de la red respondió (${errors.join(' · ')})`);
}

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

// --- Altura de la cadena -----------------------------------------------------
// El sufijo de la ruta es el mismo en mempool.space y en Esplora.

async function tipHeight(base: string, label: string): Promise<number> {
  const text = await fetchText(`${base}/blocks/tip/height`, { provider: label, timeoutMs: 8000 });
  const height = Number(text.trim());
  if (!Number.isFinite(height) || height <= 0) throw new Error('altura de bloque inválida');
  return height;
}

export async function getHalvingProgress(): Promise<ProviderResult<HalvingProgress>> {
  const r = await swr('net:height:v2', { ttlMs: 5 * 60_000, staleMs: 60 * 60_000 }, () =>
    firstAvailable([
      {
        source: 'mempool.space',
        run: async () => computeHalving(await tipHeight(MEMPOOL, 'mempool.space:height')),
      },
      {
        source: 'blockstream',
        run: async () => computeHalving(await tipHeight(ESPLORA, 'blockstream:height')),
      },
    ]),
  );
  return { data: r.value.value, meta: metaFromCache(r.value.source, r.status, r.storedAt) };
}

// --- Comisiones recomendadas -------------------------------------------------

const FeesSchema = z.object({
  fastestFee: z.number(),
  halfHourFee: z.number(),
  hourFee: z.number(),
  economyFee: z.number(),
  minimumFee: z.number(),
});

/** Esplora publica sat/vB por objetivo de confirmación en bloques. */
const FeeEstimatesSchema = z.record(z.string(), z.number());

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/**
 * Traduce las estimaciones por objetivo de Esplora a los cinco tramos que
 * publica mempool.space: siguiente bloque, media hora (3), una hora (6),
 * económica (144 ≈ un día) y mínima para relay (1008 ≈ una semana).
 */
function feesFromEstimates(estimates: Record<string, number>): RecommendedFees {
  const at = (target: number): number => {
    const value = estimates[String(target)];
    if (value == null || !Number.isFinite(value)) throw new Error(`sin estimación a ${target} bloques`);
    return Math.max(1, Math.ceil(value));
  };
  return {
    fastestFee: at(1),
    halfHourFee: at(3),
    hourFee: at(6),
    economyFee: at(144),
    minimumFee: at(1008),
  };
}

export async function getRecommendedFees(): Promise<ProviderResult<RecommendedFees>> {
  const r = await swr('net:fees:v2', { ttlMs: 5 * 60_000, staleMs: 60 * 60_000 }, () =>
    firstAvailable([
      {
        source: 'mempool.space:fees',
        run: async () =>
          FeesSchema.parse(
            await fetchJson<unknown>(`${MEMPOOL}/v1/fees/recommended`, {
              provider: 'mempool.space:fees',
              timeoutMs: 8000,
            }),
          ),
      },
      {
        source: 'blockstream:fees',
        run: async () =>
          feesFromEstimates(
            FeeEstimatesSchema.parse(
              await fetchJson<unknown>(`${ESPLORA}/fee-estimates`, {
                provider: 'blockstream:fees',
                timeoutMs: 8000,
              }),
            ),
          ),
      },
    ]),
  );
  return { data: r.value.value, meta: metaFromCache(r.value.source, r.status, r.storedAt) };
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

/** Misma forma de respuesta en mempool.space y en Esplora: un solo parser. */
async function mempoolFrom(base: string, label: string): Promise<MempoolState> {
  const raw = await fetchJson<unknown>(`${base}/mempool`, { provider: label, timeoutMs: 8000 });
  const m = MempoolSchema.parse(raw);
  const vsizeMb = m.vsize / 1e6;
  return {
    pendingTx: m.count,
    vsizeMb: Number(vsizeMb.toFixed(2)),
    totalFeeBtc: Number((m.total_fee / 1e8).toFixed(4)),
    blocksToClear: Math.ceil(vsizeMb),
  };
}

export async function getMempoolState(): Promise<ProviderResult<MempoolState>> {
  const r = await swr('net:mempool:v2', { ttlMs: 60_000, staleMs: 30 * 60_000 }, () =>
    firstAvailable([
      { source: 'mempool.space:mempool', run: () => mempoolFrom(MEMPOOL, 'mempool.space:mempool') },
      { source: 'blockstream:mempool', run: () => mempoolFrom(ESPLORA, 'blockstream:mempool') },
    ]),
  );
  return { data: r.value.value, meta: metaFromCache(r.value.source, r.status, r.storedAt) };
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

async function strengthFromMempool(): Promise<NetworkStrength> {
  const [hashRaw, adjRaw] = await Promise.all([
    fetchJson<unknown>(`${MEMPOOL}/v1/mining/hashrate/3d`, {
      provider: 'mempool.space:hashrate',
      timeoutMs: 10_000,
    }),
    fetchJson<unknown>(`${MEMPOOL}/v1/difficulty-adjustment`, {
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
  };
}

/**
 * Dificultad a partir del campo `bits` del encabezado (formato compacto del
 * objetivo). Se opera con logaritmos porque los objetivos son enteros de 256
 * bits y no caben en un `number`; el cociente sí cabe de sobra.
 */
export function difficultyFromBits(bits: number): number {
  const exponent = bits >>> 24;
  const mantissa = bits & 0x007f_ffff;
  if (exponent < 3 || mantissa <= 0) throw new Error(`bits fuera de rango: ${bits}`);
  const logTarget = Math.log(mantissa) + (exponent - 3) * Math.log(256);
  const logMaxTarget = Math.log(0xffff) + (0x1d - 3) * Math.log(256);
  return Math.exp(logMaxTarget - logTarget);
}

/**
 * Hashrate implícito en la dificultad: para resolver un bloque cada 10 minutos
 * con ese objetivo hacen falta `dificultad · 2^32 / 600` hashes por segundo. Es
 * la identidad del protocolo, no una medición: mempool.space publica en cambio
 * la media observada de 3 días, y por eso pueden diferir ligeramente.
 */
function hashrateFromDifficulty(difficulty: number): number {
  return (difficulty * 2 ** 32) / TARGET_BLOCK_SECONDS;
}

const EsploraBlockSchema = z.object({
  id: z.string(),
  height: z.number(),
  timestamp: z.number(),
  tx_count: z.number(),
  size: z.number(),
  bits: z.number().optional(),
  difficulty: z.number().optional(),
});

/**
 * Reajuste de dificultad derivado de la cadena: cuántos bloques lleva el
 * periodo actual y cuánto han tardado de verdad. Si van más rápido que un
 * bloque cada 10 minutos, la dificultad subirá en la misma proporción (el
 * protocolo limita el ajuste a ×4 / ÷4 por periodo).
 */
async function strengthFromEsplora(): Promise<NetworkStrength> {
  const blocks = z
    .array(EsploraBlockSchema)
    .min(1)
    .parse(
      await fetchJson<unknown>(`${ESPLORA}/blocks`, {
        provider: 'blockstream:blocks',
        timeoutMs: 10_000,
      }),
    );
  const tip = blocks[0]!;
  const difficulty = tip.difficulty ?? (tip.bits != null ? difficultyFromBits(tip.bits) : null);
  if (difficulty == null || !Number.isFinite(difficulty) || difficulty <= 0) {
    throw new Error('Esplora no devolvió la dificultad del último bloque');
  }

  const periodStart = Math.floor(tip.height / RETARGET_INTERVAL) * RETARGET_INTERVAL;
  const mined = tip.height - periodStart + 1;
  const remaining = RETARGET_INTERVAL - mined;

  const firstHash = (
    await fetchText(`${ESPLORA}/block-height/${periodStart}`, {
      provider: 'blockstream:block-height',
      timeoutMs: 8000,
    })
  ).trim();
  const first = EsploraBlockSchema.parse(
    await fetchJson<unknown>(`${ESPLORA}/block/${firstHash}`, {
      provider: 'blockstream:block',
      timeoutMs: 8000,
    }),
  );

  const intervals = Math.max(1, mined - 1);
  const elapsedSeconds = tip.timestamp - first.timestamp;
  if (elapsedSeconds <= 0) throw new Error('marcas de tiempo del periodo incoherentes');
  const avgBlockSeconds = elapsedSeconds / intervals;
  const expectedSeconds = intervals * TARGET_BLOCK_SECONDS;
  const change = (expectedSeconds / elapsedSeconds - 1) * 100;

  return {
    hashrateEhs: Number((hashrateFromDifficulty(difficulty) / 1e18).toFixed(1)),
    difficultyT: Number((difficulty / 1e12).toFixed(1)),
    retargetProgressPct: Number(((mined / RETARGET_INTERVAL) * 100).toFixed(1)),
    // El protocolo acota el reajuste al ±300 % / −75 %.
    nextAdjustmentPct: Number(Math.max(-75, Math.min(300, change)).toFixed(2)),
    blocksToRetarget: remaining,
    retargetDate: new Date(Date.now() + remaining * avgBlockSeconds * 1000).toISOString(),
    avgBlockMinutes: Number((avgBlockSeconds / 60).toFixed(1)),
  };
}

export async function getNetworkStrength(): Promise<ProviderResult<NetworkStrength>> {
  const r = await swr('net:strength:v2', { ttlMs: 30 * 60_000, staleMs: 12 * 60 * 60_000 }, () =>
    firstAvailable([
      { source: 'mempool.space:hashrate', run: strengthFromMempool },
      { source: 'blockstream:hashrate-derivado', run: strengthFromEsplora },
    ]),
  );
  return { data: r.value.value, meta: metaFromCache(r.value.source, r.status, r.storedAt) };
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

/** `/v1/blocks` en mempool.space y `/blocks` en Esplora: mismos campos base. */
async function latestBlockFrom(url: string, label: string): Promise<LatestBlock> {
  const raw = await fetchJson<unknown>(url, { provider: label, timeoutMs: 8000 });
  const blocks = z.array(BlockSchema).min(1).parse(raw);
  const b = blocks[0]!;
  return {
    height: b.height,
    minedAt: new Date(b.timestamp * 1000).toISOString(),
    txCount: b.tx_count,
    sizeMb: Number((b.size / 1e6).toFixed(2)),
  };
}

export async function getLatestBlock(): Promise<ProviderResult<LatestBlock>> {
  const r = await swr('net:block:v2', { ttlMs: 60_000, staleMs: 60 * 60_000 }, () =>
    firstAvailable([
      {
        source: 'mempool.space:blocks',
        run: () => latestBlockFrom(`${MEMPOOL}/v1/blocks`, 'mempool.space:blocks'),
      },
      {
        source: 'blockstream:blocks',
        run: () => latestBlockFrom(`${ESPLORA}/blocks`, 'blockstream:blocks'),
      },
    ]),
  );
  return {
    data: r.value.value,
    meta: metaFromCache(r.value.source, r.status, r.storedAt, {
      observedAt: r.value.value.minedAt,
    }),
  };
}
