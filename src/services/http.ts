// Helpers de red: fetch con timeout, caché de respaldo y soporte opcional de
// API key de CoinGecko. Centraliza el manejo de errores para que cada servicio
// degrade con elegancia (último dato real → mock) en lugar de romperse.

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 8000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new ApiError(`Respuesta ${res.status} de ${url}`, res.status);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Devuelve `true` si la app debe intentar llamadas a APIs reales. */
export const LIVE_DATA_ENABLED = import.meta.env.VITE_LIVE_DATA === 'true';

/**
 * API key (demo) opcional de CoinGecko. Sube el límite de peticiones y reduce
 * los errores 429/CORS. Consíguela gratis en https://www.coingecko.com/api.
 * Añádela en `.env` como VITE_COINGECKO_KEY=tu_clave.
 */
const COINGECKO_KEY = import.meta.env.VITE_COINGECKO_KEY;

/** Añade la API key de CoinGecko a una URL si está configurada. */
export function withCgKey(url: string): string {
  if (!COINGECKO_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}x_cg_demo_api_key=${COINGECKO_KEY}`;
}

// --- Caché de respaldo en sessionStorage ------------------------------------
// Idea (stale-while-error): si una petición falla (p. ej. rate-limit puntual),
// seguimos mostrando el último dato REAL conocido en vez de saltar al mock.
// Solo se cae al mock si nunca hubo un dato real en esta sesión.

interface Cached<T> {
  value: T;
  at: number;
}

const CACHE_PREFIX = 'ciclos-btc-cache:';

function readCache<T>(key: string): Cached<T> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, at: Date.now() }));
  } catch {
    /* almacenamiento no disponible */
  }
}

export interface LiveResult<T> {
  value: T;
  /** `true` si es un dato real (fresco o de caché reciente). */
  live: boolean;
  /** `true` si proviene de la caché porque la última petición falló. */
  fromCache?: boolean;
}

/**
 * Ejecuta `fetcher`; si tiene éxito cachea y devuelve el dato fresco. Si falla,
 * devuelve el último dato real cacheado (marcado como `fromCache`) y, si no hay,
 * cae al `mock`.
 */
export async function liveOrCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  mock: T,
): Promise<LiveResult<T>> {
  try {
    const value = await fetcher();
    writeCache(key, value);
    return { value, live: true };
  } catch (err) {
    const cached = readCache<T>(key);
    if (cached) {
      console.warn(`[${key}] petición fallida; usando último dato real cacheado.`, err);
      return { value: cached.value, live: true, fromCache: true };
    }
    console.warn(`[${key}] petición fallida y sin caché; usando mock.`, err);
    return { value: mock, live: false };
  }
}
