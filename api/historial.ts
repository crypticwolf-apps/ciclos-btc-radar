import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, errorMessage, nowUtc, settle, parseQuery } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { historyConfigured, readHistory } from './_lib/scoreHistory.js';
import { getPhaseHistory } from './_lib/providers/phaseHistory.js';
import { getBreadthHistory } from './_lib/providers/altseasonHistory.js';

// =============================================================================
// /api/historial → la evolución:
//   · `days`: el Score de Oportunidad y la fase de cada día guardado (Redis);
//   · `fases`: la fase de cada día desde 2018, reconstruida con datos reales.
// Cada parte degrada por separado.
//
// /api/historial?serie=amplitud → la amplitud del mercado de altcoins desde
// 2017 y las altseasons anteriores. Va aparte porque solo la pide el gráfico
// de Altseason al elegir un rango largo.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    if (parseQuery(req).get('serie') === 'amplitud') {
      const { data, meta } = await getBreadthHistory();
      sendOk(res, data, [meta], 6 * 60 * 60);
      return;
    }

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
