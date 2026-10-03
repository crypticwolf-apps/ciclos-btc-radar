import { redis, sharedCacheConfig } from './cache.js';
import { snapshotFrom, type DailySnapshot } from '../../src/lib/score/snapshot.js';
import type { DashboardResponse } from '../../src/types/dashboard.js';

// =============================================================================
// Histórico diario del Score de Oportunidad y de la fase del ciclo.
//
// Se guarda en el Redis de la caché compartida (Upstash), un hash con un campo
// por día. Cada /api/dashboard calculado de verdad renueva la foto del día, como
// mucho una vez por hora y por instancia, así que el valor que queda de cada
// día es uno de su última hora con visitas. No hace falta ningún cron.
//
// Sin Redis configurado no se guarda nada y /api/historial lo dice: un
// histórico en memoria se perdería en cada arranque en frío y engañaría.
// =============================================================================

const KEY = 'ciclos:historial:v1';
const EVERY_MS = 60 * 60_000;
/** Mínimo de peso con datos para guardar la foto: con menos, no es comparable. */
const MIN_COBERTURA = 60;
const MAX_DAYS = 730;

let lastSavedAt = 0;

export function historyConfigured(): boolean {
  return sharedCacheConfig() != null;
}

/** Guarda la foto de hoy si toca. Nunca lanza: el histórico no puede tumbar el panel. */
export async function recordSnapshot(d: DashboardResponse, now = Date.now()): Promise<DailySnapshot | null> {
  if (!historyConfigured() || now - lastSavedAt < EVERY_MS) return null;
  if (!d.market.summary) return null;
  try {
    const snap = snapshotFrom(d, new Date(now));
    if (snap.cobertura < MIN_COBERTURA) return null;
    lastSavedAt = now;
    await redis(['HSET', KEY, snap.day, JSON.stringify(snap)]);
    return snap;
  } catch {
    return null;
  }
}

/** Días guardados, del más antiguo al más reciente. */
export async function readHistory(): Promise<DailySnapshot[]> {
  const raw = await redis(['HGETALL', KEY]);
  if (!Array.isArray(raw)) return [];
  const out: DailySnapshot[] = [];
  // HGETALL por REST devuelve [campo, valor, campo, valor…].
  for (let i = 1; i < raw.length; i += 2) {
    try {
      const s = JSON.parse(String(raw[i])) as DailySnapshot;
      if (typeof s.day === 'string' && Number.isFinite(s.score)) out.push(s);
    } catch {
      /* campo corrupto: se ignora */
    }
  }
  out.sort((a, b) => a.day.localeCompare(b.day));
  return out.slice(-MAX_DAYS);
}

/** Para tests. */
export function resetHistoryThrottle(): void {
  lastSavedAt = 0;
}
