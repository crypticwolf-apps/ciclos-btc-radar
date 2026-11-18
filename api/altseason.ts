import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage, parseQuery } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { getAltseason } from './_lib/providers/altseason.js';
import { getCategories } from './_lib/providers/categories.js';
import { checkAltseasonAlert } from './_lib/alerts.js';
import { waitUntil } from './_lib/waitUntil.js';

// =============================================================================
// /api/altseason → análisis completo de rotación hacia altcoins.
// /api/altseason?vista=categorias → rendimiento por categorías (L1, IA, memes…).
//
// Solo se pide al abrir Ciclos → Altseason, no en la carga inicial de la app.
// Cache de 30 min en el servidor y otros 15 min en la respuesta HTTP: el coste
// hacia CoinGecko y Binance no crece con el número de visitantes.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    // ?vista=categorias → qué categorías de altcoins van en cabeza (ficha aparte).
    if (parseQuery(req).get('vista') === 'categorias') {
      const { data, meta } = await getCategories();
      sendOk(res, data, [meta], 60);
      return;
    }

    const altseason = await settle('altseason', getAltseason());
    sendOk(res, altseason.data, [altseason.meta], 15 * 60);
    // Aviso a los móviles suscritos si el score ha cambiado de tramo. Después
    // de responder: avisar a todos puede tardar y la respuesta no lo espera.
    const aviso = checkAltseasonAlert(altseason.data?.result.score ?? null);
    waitUntil(aviso);
    await aviso.catch(() => undefined);
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
