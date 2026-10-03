import type { IncomingMessage, ServerResponse } from 'node:http';
import { getClientIp, sendError } from './respond.js';
import { DEFAULT_LIMIT, rateLimit } from './rateLimit.js';

/** Ruta sin query: «/api/precios?s=ETH» → «/api/precios». */
function route(req: IncomingMessage): string {
  return (req.url ?? '').split('?')[0] || '/';
}

/** Aplica rate limiting por IP y ruta. Devuelve true si la request fue bloqueada. */
export function rateLimited(
  req: IncomingMessage,
  res: ServerResponse,
  limit = DEFAULT_LIMIT,
): boolean {
  const { ok, resetAt } = rateLimit(`${getClientIp(req)}|${route(req)}`, limit);
  if (!ok) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
    sendError(res, 429, 'Demasiadas peticiones. Inténtalo en un minuto.');
    return true;
  }
  return false;
}
