import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond';
import { rateLimited } from './_lib/guard';
import { getMarketSummary, getGlobal, getIndicators } from './_lib/providers/coingecko';
import { getFearGreed } from './_lib/providers/alternativeme';
import { getOnchainBasics } from './_lib/providers/blockchain';
import { getHalvingProgress, getRecommendedFees } from './_lib/providers/mempool';
import { getMacro } from './_lib/providers/fred';

// =============================================================================
// /api/dashboard → una sola llamada que agrega todos los bloques. Evita que el
// front haga 4 peticiones; cada bloque degrada por separado si su fuente falla.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const [summary, global, indicators, sentiment, basics, halving, fees, macro] = await Promise.all([
      settle('coingecko', getMarketSummary()),
      settle('coingecko:global', getGlobal()),
      settle('coingecko:indicators', getIndicators()),
      settle('alternative.me', getFearGreed()),
      settle('blockchain.com', getOnchainBasics()),
      settle('mempool.space', getHalvingProgress()),
      settle('mempool.space:fees', getRecommendedFees()),
      settle('fred', getMacro()),
    ]);

    sendOk(
      res,
      {
        market: {
          summary: summary.data,
          global: global.data,
          indicators: indicators.data,
          sentiment: sentiment.data,
        },
        onchain: { basics: basics.data, halving: halving.data, fees: fees.data },
        macro: macro.data,
      },
      [
        summary.meta, global.meta, indicators.meta, sentiment.meta,
        basics.meta, halving.meta, fees.meta, macro.meta,
      ],
      60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
