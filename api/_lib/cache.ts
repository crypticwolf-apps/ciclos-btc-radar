import { readEnv } from './runtimeEnv.js';

// =============================================================================
// Cache stale-while-revalidate en dos niveles.
// -----------------------------------------------------------------------------
//   1. MEMORIA de la instancia: inmediata, pero cada copia del servidor tiene
//      la suya y se pierde en cada arranque en frío.
//   2. COMPARTIDA (Redis de Upstash por su API REST), OPCIONAL: la ven todas
//      las instancias. Así el primero que entra tras un rato sin uso no espera
//      a todas las fuentes, y FRED o CoinGecko no se consultan una vez por
//      instancia. Se activa sola si existen las variables
//        UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//      (o KV_REST_API_URL + KV_REST_API_TOKEN, los nombres que pone la
//      integración de Upstash en Vercel). Sin ellas, todo funciona solo con
//      memoria, como antes.
//
// La compartida solo guarda datos con TTL de 5 min o más: los de segundos
// (precios, libro de órdenes) gastarían miles de comandos al día sin ahorrar
// nada, porque ya los amortigua la caché del CDN. Y nunca puede romper una
// respuesta: si Redis tarda o falla, se sigue sin él y se deja de intentar un
// minuto.
//
// Estados devueltos:
//   - 'live'   → se llamó al proveedor y respondió ahora.
//   - 'cached' → servido de cache fresca (dentro del TTL), sin llamar fuera.
//   - 'stale'  → el proveedor falló pero teníamos un dato anterior válido.
// `storedAt` es siempre el momento en que se obtuvo del proveedor, venga de
// donde venga: un dato de la compartida nunca parece más reciente de lo que es.
// =============================================================================

interface Entry<T> {
  value: T;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
}

const store = new Map<string, Entry<unknown>>();
/** Cargas en curso: diez peticiones a la vez esperan a UNA llamada al proveedor. */
const inflight = new Map<string, Promise<CacheResult<unknown>>>();

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

// --- Nivel compartido ---------------------------------------------------------

/** TTL mínimo para guardar en la compartida. */
export const SHARED_MIN_TTL_MS = 5 * 60_000;
const SHARED_TIMEOUT_MS = 1_200;
const SHARED_PREFIX = 'ciclos:swr:';
/** Tras un fallo de Redis, cuánto se deja de intentar. */
const SHARED_COOLDOWN_MS = 60_000;
let sharedDownUntil = 0;

interface SharedConfig {
  url: string;
  token: string;
}

export function sharedCacheConfig(): SharedConfig | null {
  const url = readEnv('UPSTASH_REDIS_REST_URL') ?? readEnv('KV_REST_API_URL');
  const token = readEnv('UPSTASH_REDIS_REST_TOKEN') ?? readEnv('KV_REST_API_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

/** Un comando de Redis por la API REST de Upstash. `null` si no hay o falla. */
export async function redis(command: (string | number)[]): Promise<unknown> {
  const cfg = sharedCacheConfig();
  if (!cfg || Date.now() < sharedDownUntil) return null;
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command.map(String)),
      signal: AbortSignal.timeout(SHARED_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(body.error);
    return body.result ?? null;
  } catch {
    sharedDownUntil = Date.now() + SHARED_COOLDOWN_MS;
    return null;
  }
}

async function sharedGet<T>(key: string): Promise<Entry<T> | null> {
  const raw = await redis(['GET', SHARED_PREFIX + key]);
  if (typeof raw !== 'string') return null;
  try {
    const e = JSON.parse(raw) as Entry<T>;
    return Number.isFinite(e.storedAt) && Number.isFinite(e.staleUntil) ? e : null;
  } catch {
    return null;
  }
}

async function sharedSet<T>(key: string, entry: Entry<T>): Promise<void> {
  const px = Math.max(1, entry.staleUntil - Date.now());
  await redis(['SET', SHARED_PREFIX + key, JSON.stringify(entry), 'PX', px]);
}

// --- swr ----------------------------------------------------------------------

async function load<T>(key: string, opts: SwrOptions, loader: () => Promise<T>): Promise<CacheResult<T>> {
  let fallback = store.get(key) as Entry<T> | undefined;

  const shared = opts.ttlMs >= SHARED_MIN_TTL_MS && sharedCacheConfig() != null;
  if (shared) {
    const remote = await sharedGet<T>(key);
    if (remote && Date.now() < remote.freshUntil) {
      store.set(key, remote);
      return { value: remote.value, status: 'cached', storedAt: remote.storedAt };
    }
    // Caducado pero aún servible: si el proveedor falla, vale como respaldo.
    if (remote && (!fallback || remote.storedAt > fallback.storedAt)) fallback = remote;
  }

  const now = Date.now();
  try {
    const value = await loader();
    const entry: Entry<T> = {
      value,
      storedAt: now,
      freshUntil: now + opts.ttlMs,
      staleUntil: now + opts.ttlMs + opts.staleMs,
    };
    store.set(key, entry);
    if (shared) await sharedSet(key, entry);
    return { value, status: 'live', storedAt: now };
  } catch (err) {
    if (fallback && Date.now() < fallback.staleUntil) {
      return { value: fallback.value, status: 'stale', storedAt: fallback.storedAt };
    }
    throw err;
  }
}

export async function swr<T>(
  key: string,
  opts: SwrOptions,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> {
  const entry = store.get(key) as Entry<T> | undefined;
  if (entry && Date.now() < entry.freshUntil) {
    return { value: entry.value, status: 'cached', storedAt: entry.storedAt };
  }

  const pending = inflight.get(key) as Promise<CacheResult<T>> | undefined;
  if (pending) return pending;
  const p = load(key, opts, loader).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Borra una clave (para tests o invalidación manual). */
export function cacheClear(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
  sharedDownUntil = 0;
}
