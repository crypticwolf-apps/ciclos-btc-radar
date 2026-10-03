import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, errorMessage, nowUtc } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { historyConfigured, readHistory } from './_lib/scoreHistory.js';

// =============================================================================
// /api/historial → el Score de Oportunidad y la fase de cada día guardado.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const configured = historyConfigured();
    const days = configured ? await readHistory() : [];
    sendOk(
      res,
      { configured, days },
      [
        {
          provider: 'historial',
          status: configured ? 'live' : 'unavailable',
          fetchedAt: nowUtc(),
          ...(configured ? {} : { note: 'Sin Redis (Upstash) configurado: no se guarda histórico.' }),
        },
      ],
      30 * 60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
