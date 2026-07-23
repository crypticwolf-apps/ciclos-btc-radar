import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { getAltseason } from './_lib/providers/altseason.js';

// =============================================================================
// /api/altseason → análisis completo de rotación hacia altcoins.
//
// Solo se pide al abrir Ciclos → Altseason, no en la carga inicial de la app.
// Cache de 30 min en el servidor y otros 15 min en la respuesta HTTP: el coste
// hacia CoinGecko y Binance no crece con el número de visitantes.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const altseason = await settle('altseason', getAltseason());
    sendOk(res, altseason.data, [altseason.meta], 15 * 60);
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
