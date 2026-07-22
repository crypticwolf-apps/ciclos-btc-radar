import { z } from 'zod';
import { fetchJson } from '../http';
import { swr } from '../cache';
import { metaFromCache, type ProviderResult } from '../respond';

// =============================================================================
// Proveedor: Blockchain.com Charts API (gratis, sin clave). Métricas on-chain
// básicas. Suavizado y "último valor" de cada serie + variación en la ventana.
// =============================================================================

const ChartSchema = z.object({
  values: z.array(z.object({ x: z.number(), y: z.number() })),
});

export interface OnchainMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  changePct: number | null;
  observedAt: string; // ISO UTC del último punto
}

export interface OnchainBasics {
  /** Métricas que el proveedor devolvió correctamente (las que fallen se omiten). */
  metrics: OnchainMetric[];
}

interface ChartDef {
  id: string;
  chart: string;
  label: string;
  unit: string;
  /** Transforma el valor crudo a la unidad mostrada. */
  scale?: (y: number) => number;
}

const DEFS: ChartDef[] = [
  { id: 'hashrate', chart: 'hash-rate', label: 'Hashrate', unit: 'EH/s', scale: (y) => y / 1e6 },
  { id: 'difficulty', chart: 'difficulty', label: 'Dificultad', unit: 'T', scale: (y) => y / 1e12 },
  { id: 'txPerDay', chart: 'n-transactions', label: 'Transacciones/día', unit: 'tx' },
  { id: 'activeAddresses', chart: 'n-unique-addresses', label: 'Direcciones activas', unit: 'dir.' },
  { id: 'mempoolBytes', chart: 'mempool-size', label: 'Mempool', unit: 'MB', scale: (y) => y / 1e6 },
  { id: 'supply', chart: 'total-bitcoins', label: 'Supply circulante', unit: 'BTC' },
];

async function fetchMetric(def: ChartDef): Promise<OnchainMetric> {
  const raw = await fetchJson<unknown>(
    `https://api.blockchain.info/charts/${def.chart}?timespan=30days&rollingAverage=7days&format=json&cors=true`,
    { provider: `blockchain.com:${def.chart}`, timeoutMs: 9000 },
  );
  const values = ChartSchema.parse(raw).values;
  if (values.length === 0) throw new Error(`serie ${def.chart} vacía`);
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const scale = def.scale ?? ((y: number) => y);
  const value = scale(last.y);
  const base = scale(first.y);
  return {
    id: def.id,
    label: def.label,
    value,
    unit: def.unit,
    changePct: base ? Number((((value - base) / base) * 100).toFixed(1)) : null,
    observedAt: new Date(last.x * 1000).toISOString(),
  };
}

export async function getOnchainBasics(): Promise<ProviderResult<OnchainBasics>> {
  // Cache 15 min (frecuencia razonable para datos on-chain diarios).
  const r = await swr('onchain:basics', { ttlMs: 15 * 60_000, staleMs: 6 * 60 * 60_000 }, async () => {
    // allSettled: si una serie concreta falla, el resto del bloque sigue vivo.
    const settled = await Promise.allSettled(DEFS.map(fetchMetric));
    const metrics = settled
      .filter((s): s is PromiseFulfilledResult<OnchainMetric> => s.status === 'fulfilled')
      .map((s) => s.value);
    if (metrics.length === 0) throw new Error('Blockchain.com no devolvió ninguna métrica');
    return { metrics } satisfies OnchainBasics;
  });
  return { data: r.value, meta: metaFromCache('blockchain.com', r.status, r.storedAt) };
}
