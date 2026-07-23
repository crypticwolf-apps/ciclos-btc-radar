import type { IncomingMessage, ServerResponse } from 'node:http';
import { getClientIp, sendError } from './respond.js';
import { rateLimit } from './rateLimit.js';

/** Aplica rate limiting por IP. Devuelve true si la request fue bloqueada. */
export function rateLimited(
  req: IncomingMessage,
  res: ServerResponse,
  limit = 60,
): boolean {
  const { ok, resetAt } = rateLimit(getClientIp(req), limit);
  if (!ok) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
    sendError(res, 429, 'Demasiadas peticiones. Inténtalo en un minuto.');
    return true;
  }
  return false;
}
