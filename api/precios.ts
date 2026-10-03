import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, errorMessage, parseQuery } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { getSpotPrices, parseSymbols } from './_lib/providers/spotPrices.js';

// =============================================================================
// /api/precios?s=ETH,SOL,… → último precio al contado de esas monedas.
//
// Alimenta el ranking de altcoins en vivo. Una sola llamada al exchange cubre
// todas (Binance → OKX → Bybit) y aquí se devuelven solo las pedidas, para que
// la respuesta pese poco. Como la lista del ranking es la misma para todos, el
// CDN sirve la misma respuesta a todo el mundo durante 5 s.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  const symbols = parseSymbols(parseQuery(req).get('s'));
  if (symbols.length === 0) {
    sendError(res, 400, 'Falta la lista de monedas (?s=ETH,SOL,…).');
    return;
  }

  try {
    const { data, meta } = await getSpotPrices();
    const prices: Record<string, number> = {};
    for (const s of symbols) {
      const p = data.prices[s];
      if (p != null) prices[s] = p;
    }
    sendOk(res, { prices, source: data.source }, [meta], 5);
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
