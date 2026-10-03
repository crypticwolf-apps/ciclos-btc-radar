import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, errorMessage, nowUtc, settle } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { historyConfigured, readHistory } from './_lib/scoreHistory.js';
import { getPhaseHistory } from './_lib/providers/phaseHistory.js';

// =============================================================================
// /api/historial → la evolución:
//   · `days`: el Score de Oportunidad y la fase de cada día guardado (Redis);
//   · `fases`: la fase de cada día desde 2018, reconstruida con datos reales.
// Cada parte degrada por separado.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const configured = historyConfigured();
    const [days, fases] = await Promise.all([
      configured ? readHistory() : Promise.resolve([]),
      settle('fase:historico', getPhaseHistory()),
    ]);
    sendOk(
      res,
      { configured, days, fases: fases.data },
      [
        {
          provider: 'historial',
          status: configured ? 'live' : 'unavailable',
          fetchedAt: nowUtc(),
          ...(configured ? {} : { note: 'Sin Redis (Upstash) configurado: no se guarda el score diario.' }),
        },
        fases.meta,
      ],
      30 * 60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
