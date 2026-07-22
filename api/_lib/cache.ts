// =============================================================================
// Cache en memoria con estrategia stale-while-revalidate.
// -----------------------------------------------------------------------------
// En serverless (Vercel) la memoria sobrevive entre invocaciones de una misma
// instancia "caliente"; en frío se reconstruye. Es suficiente para no agotar
// cuotas. Para cache compartida real, configura Upstash (mejora opcional).
//
// Estados devueltos:
//   - 'live'   → se llamó al proveedor y respondió ahora.
//   - 'cached' → servido de cache fresca (dentro del TTL), sin llamar fuera.
//   - 'stale'  → el proveedor falló pero teníamos un dato anterior válido.
// =============================================================================

interface Entry<T> {
  value: T;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
}

const store = new Map<string, Entry<unknown>>();

export type CacheStatus = 'live' | 'cached' | 'stale';

export interface CacheResult<T> {
  value: T;
  status: CacheStatus;
  /** Epoch ms en que se obtuvo el dato del proveedor. */
  storedAt: number;
}

export interface SwrOptions {
  /** ms que el dato se considera fresco (no se vuelve a pedir). */
  ttlMs: number;
  /** ms extra durante los que un dato caducado sirve como fallback si falla. */
  staleMs: number;
}

export async function swr<T>(
  key: string,
  opts: SwrOptions,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> {
  const now = Date.now();
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry && now < entry.freshUntil) {
    return { value: entry.value, status: 'cached', storedAt: entry.storedAt };
  }

  try {
    const value = await loader();
    store.set(key, {
      value,
      storedAt: now,
      freshUntil: now + opts.ttlMs,
      staleUntil: now + opts.ttlMs + opts.staleMs,
    });
    return { value, status: 'live', storedAt: now };
  } catch (err) {
    if (entry && now < entry.staleUntil) {
      return { value: entry.value, status: 'stale', storedAt: entry.storedAt };
    }
    throw err;
  }
}

/** Borra una clave (para tests o invalidación manual). */
export function cacheClear(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
