// =============================================================================
// Rate limiting por IP y por ruta, con ventana fija, en memoria. Protege las
// cuotas de los proveedores externos frente a abusos, no frente a uso normal.
//
// Por qué 300 por minuto y por ruta:
//   · Muchas personas comparten IP pública: la misma wifi, la misma red móvil
//     (CGNAT), una oficina. Con 60 por minuto para TODO, tres móviles con
//     Análisis abierto (precios cada 5 s, libro de órdenes cada 8 s…) ya se
//     quedaban sin datos.
//   · Contar por ruta evita que un sondeo frecuente (precios) agote el cupo de
//     las cargas grandes (dashboard) y al revés.
//   · El grueso de las peticiones lo sirve la caché del CDN (s-maxage) sin
//     llegar a la función, así que este límite solo mide lo que sí llega.
// =============================================================================

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export const DEFAULT_LIMIT = 300;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/** Borra las ventanas ya vencidas para que el mapa no crezca sin fin. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) if (now >= bucket.resetAt) buckets.delete(key);
}

export function rateLimit(key: string, limit = DEFAULT_LIMIT, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return { ok: bucket.count <= limit, remaining, resetAt: bucket.resetAt };
}

/** Para tests. */
export function rateLimitReset(): void {
  buckets.clear();
}
