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

// --- Episodios históricos de pánico ------------------------------------------

export interface FearGreedExtreme {
  /** Mes y año del episodio: «mar 2020». */
  label: string;
  value: number;
  date: string; // ISO UTC
  /** `true` si es la lectura de hoy. */
  current: boolean;
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Los mínimos históricos del índice, para poder situar el miedo de hoy frente a
 * los grandes pánicos. Antes esta comparativa era una lista escrita a mano
 * («Mt. Gox 2014: 9») pese a que el índice no existe antes de 2018.
 *
 * Se pide el histórico completo (limit=0, unos 3.000 días desde febrero de
 * 2018) y se seleccionan los mínimos separados al menos `gapDays`, para no
 * contar tres veces la misma semana de pánico.
 */
export async function getFearGreedExtremes(
  count = 3,
  gapDays = 120,
): Promise<ProviderResult<FearGreedExtreme[]>> {
  const r = await swr('fng:extremos', { ttlMs: 12 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>('https://api.alternative.me/fng/?limit=0', {
      provider: 'alternative.me:historico',
      timeoutMs: 15_000,
    });
    const data = Schema.parse(raw).data;
    if (data.length < 100) throw new Error('histórico de Fear & Greed insuficiente');

    const points = data
      .map((d) => ({ value: Number(d.value), t: Number(d.timestamp) * 1000 }))
      .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);

    const today = points[points.length - 1]!;
    const gapMs = gapDays * 86_400_000;
    const picked: typeof points = [];
    // Mínimos primero; se descarta el que caiga demasiado cerca de uno ya elegido.
    for (const p of [...points].sort((a, b) => a.value - b.value)) {
      if (picked.length >= count) break;
      if (today.t - p.t < gapMs) continue; // el episodio actual va aparte
      if (picked.some((q) => Math.abs(q.t - p.t) < gapMs)) continue;
      picked.push(p);
    }

    const label = (t: number) => {
      const d = new Date(t);
      return `${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    };

    return [...picked, today]
      .sort((a, b) => a.t - b.t)
      .map((p) => ({
        label: p === today ? 'Actual' : label(p.t),
        value: p.value,
        date: new Date(p.t).toISOString(),
        current: p === today,
      }));
  });

  return { data: r.value, meta: metaFromCache('alternative.me:historico', r.status, r.storedAt) };
}
