import type { IncomingMessage, ServerResponse } from 'node:http';

// =============================================================================
// Envelope normalizado + helpers de respuesta para todas las rutas /api.
// -----------------------------------------------------------------------------
// Toda ruta devuelve la MISMA forma para que el front sepa siempre el estado y
// la frescura del dato. Las horas internas van en UTC (ISO 8601).
// =============================================================================

/** Estado de frescura de un dato (regla 3 del encargo). */
export type DataStatus = 'live' | 'cached' | 'stale' | 'unavailable' | 'locked';

/** Metadatos de una fuente concreta dentro de una respuesta. */
export interface SourceMeta {
  /** Identificador del proveedor, p. ej. "coingecko", "fred:FEDFUNDS". */
  provider: string;
  status: DataStatus;
  /** ISO UTC del dato servido (cuándo se obtuvo de la fuente). null si no hay. */
  fetchedAt: string | null;
  /** Fecha REAL de observación del dato (para series macro mensuales, etc.). */
  observedAt?: string | null;
  latencyMs?: number;
  /** Texto humano para "Dato no disponible" o por qué está bloqueado. */
  note?: string;
}

export interface Envelope<T> {
  ok: boolean;
  data: T | null;
  meta: {
    /** ISO UTC en que el servidor generó la respuesta. */
    generatedAt: string;
    sources: SourceMeta[];
  };
  error?: string;
}

export function nowUtc(): string {
  return new Date().toISOString();
}

/** Resultado normalizado de un proveedor: dato + metadatos de frescura. */
export interface ProviderResult<T> {
  data: T;
  meta: SourceMeta;
}

/** Construye SourceMeta a partir del estado/edad de cache de un proveedor. */
export function metaFromCache(
  provider: string,
  status: DataStatus,
  storedAt: number,
  extra: Partial<SourceMeta> = {},
): SourceMeta {
  return {
    provider,
    status,
    fetchedAt: storedAt ? new Date(storedAt).toISOString() : null,
    ...extra,
  };
}

/** Meta para una fuente no disponible (fallo total, sin dato previo). */
export function metaUnavailable(provider: string, note: string): SourceMeta {
  return { provider, status: 'unavailable', fetchedAt: null, note };
}

/** Meta para una métrica bloqueada por falta de clave de proveedor premium. */
export function metaLocked(provider: string, note: string): SourceMeta {
  return { provider, status: 'locked', fetchedAt: null, note };
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Resuelve la promesa de un proveedor sin romper la respuesta: si falla,
 * devuelve data=null y meta 'unavailable'. Así una fuente caída no tumba al
 * resto del dashboard (regla 2 del encargo).
 */
export async function settle<T>(
  provider: string,
  p: Promise<ProviderResult<T>>,
): Promise<{ data: T | null; meta: SourceMeta }> {
  try {
    const r = await p;
    return { data: r.data, meta: r.meta };
  } catch (err) {
    return { data: null, meta: metaUnavailable(provider, errorMessage(err)) };
  }
}

/** Node res mínimo (compatible con Vercel y el middleware de Vite). */
type NodeRes = ServerResponse | (Pick<ServerResponse, 'statusCode' | 'setHeader' | 'end'>);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function applyCors(res: NodeRes): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

export function sendJson(res: NodeRes, status: number, body: unknown, cacheSeconds?: number): void {
  applyCors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cacheSeconds && cacheSeconds > 0) {
    res.setHeader(
      'Cache-Control',
      `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}`,
    );
  }
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

export function sendOk<T>(
  res: NodeRes,
  data: T,
  sources: SourceMeta[],
  cacheSeconds?: number,
): void {
  const envelope: Envelope<T> = {
    ok: true,
    data,
    meta: { generatedAt: nowUtc(), sources },
  };
  sendJson(res, 200, envelope, cacheSeconds);
}

export function sendError(
  res: NodeRes,
  status: number,
  error: string,
  sources: SourceMeta[] = [],
): void {
  const envelope: Envelope<null> = {
    ok: false,
    data: null,
    meta: { generatedAt: nowUtc(), sources },
    error,
  };
  sendJson(res, status, envelope);
}

/** Extrae la IP del cliente respetando proxies (x-forwarded-for). */
export function getClientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!;
  return req.socket?.remoteAddress ?? 'unknown';
}

/** Parsea la query de una request Node. */
export function parseQuery(req: IncomingMessage): URLSearchParams {
  const url = new URL(req.url ?? '', 'http://localhost');
  return url.searchParams;
}

// --- Guardas de ruta reutilizables ------------------------------------------
// Importadas de forma perezosa para no crear ciclos al cargar respond.

/** Aplica CORS y responde a OPTIONS. Devuelve true si ya terminó la request. */
export function preflight(req: IncomingMessage, res: NodeRes): boolean {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  if (req.method && req.method !== 'GET') {
    sendError(res, 405, 'Método no permitido. Usa GET.');
    return true;
  }
  return false;
}
