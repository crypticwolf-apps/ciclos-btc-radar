import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, errorMessage } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { getOrderBookPressure } from './_lib/providers/orderbook.js';

// =============================================================================
// /api/orderbook → presión compradora/vendedora del libro de BTC al contado.
//
// Solo se pide con la tarjeta «Presión del mercado» a la vista. Antes el
// navegador hablaba directamente con Binance y la tarjeta desaparecía para
// quien lo tuviera bloqueado; aquí hay cadena de respaldo (Binance → OKX →
// Bybit) y ni CORS ni extensiones que se interpongan.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const book = await getOrderBookPressure();
    // 5 s en el borde: el libro cambia sin parar, pero mostrar el mismo dato
    // durante cinco segundos no cambia lo que la tarjeta cuenta.
    sendOk(res, book.data, [book.meta], 5);
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
