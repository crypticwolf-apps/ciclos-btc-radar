// =============================================================================
// Rate limiting por IP con ventana fija, en memoria. Protege las cuotas de los
// proveedores externos frente a abusos del cliente. (Upstash = mejora opcional
// para límite compartido entre instancias serverless.)
// =============================================================================

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(ip: string, limit = 60, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return { ok: bucket.count <= limit, remaining, resetAt: bucket.resetAt };
}
