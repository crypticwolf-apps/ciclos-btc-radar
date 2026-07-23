import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, parseQuery, settle, errorMessage } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { getMarketSummary, getGlobal, getPriceHistory, getIndicators } from './_lib/providers/coingecko.js';
import { getFearGreed } from './_lib/providers/alternativeme.js';

// =============================================================================
// /api/market
//   (por defecto)           → resumen de precio + global + sentimiento.
//   ?series=history&days=30 → histórico de precios para gráficos.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  const q = parseQuery(req);
  try {
    if (q.get('series') === 'history') {
      const days = q.get('days') ?? '30';
      const vs = q.get('vs') ?? 'usd';
      const h = await settle('coingecko:chart', getPriceHistory(days, vs));
      sendOk(res, { days, currency: vs, points: h.data ?? [] }, [h.meta], 300);
      return;
    }

    const [summary, global, indicators, sentiment] = await Promise.all([
      settle('coingecko', getMarketSummary()),
      settle('coingecko:global', getGlobal()),
      settle('coingecko:indicators', getIndicators()),
      settle('alternative.me', getFearGreed()),
    ]);

    sendOk(
      res,
      {
        summary: summary.data,
        global: global.data,
        indicators: indicators.data,
        sentiment: sentiment.data,
      },
      [summary.meta, global.meta, indicators.meta, sentiment.meta],
      60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
