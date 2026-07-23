import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import { getMarketSummary, getGlobal } from './_lib/providers/coingecko.js';
import { getTechnicalIndicators, getFxRate } from './_lib/providers/technicals.js';
import { getFearGreed } from './_lib/providers/alternativeme.js';
import { getCycleOnchain, getHalvingHistory } from './_lib/providers/coinmetrics.js';
import { getOnchainFlow } from './_lib/providers/onchainFlow.js';
import { getStablecoinLiquidity } from './_lib/providers/defillama.js';
import { getDerivatives } from './_lib/providers/binance.js';
import {
  getHalvingProgress,
  getMempoolState,
  getNetworkStrength,
  getLatestBlock,
} from './_lib/providers/mempool.js';
import { getMacro } from './_lib/providers/fred.js';

// =============================================================================
// /api/dashboard → UNA sola llamada con todo lo que necesitan la pantalla de
// inicio y el Score de Oportunidad. Cada bloque degrada por separado: si una
// fuente falla, su campo llega a null con meta 'unavailable' y el resto sigue.
//
// El coste hacia los proveedores NO crece con el número de visitantes: cada uno
// tiene su propio TTL en la cache del servidor (ver _lib/providers).
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const [
      summary,
      global,
      indicators,
      fx,
      sentiment,
      cycle,
      halvings,
      flow,
      liquidity,
      derivatives,
      halving,
      mempool,
      strength,
      block,
      macro,
    ] = await Promise.all([
      settle('coingecko', getMarketSummary()),
      settle('coingecko:global', getGlobal()),
      settle('coinmetrics:technicals', getTechnicalIndicators()),
      settle('fx:derivado', getFxRate()),
      settle('alternative.me', getFearGreed()),
      settle('coinmetrics', getCycleOnchain()),
      settle('coinmetrics:halvings', getHalvingHistory()),
      settle('blockchain.com:flow', getOnchainFlow()),
      settle('defillama', getStablecoinLiquidity()),
      settle('binance:futures', getDerivatives()),
      settle('mempool.space', getHalvingProgress()),
      settle('mempool.space:mempool', getMempoolState()),
      settle('mempool.space:hashrate', getNetworkStrength()),
      settle('mempool.space:blocks', getLatestBlock()),
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
          fx: fx.data,
        },
        onchain: {
          halving: halving.data,
          cycle: cycle.data,
          halvings: halvings.data,
          flow: flow.data,
        },
        network: {
          mempool: mempool.data,
          strength: strength.data,
          latestBlock: block.data,
        },
        liquidity: liquidity.data,
        derivatives: derivatives.data,
        macro: macro.data,
      },
      [
        summary.meta,
        global.meta,
        indicators.meta,
        fx.meta,
        sentiment.meta,
        cycle.meta,
        halvings.meta,
        flow.meta,
        liquidity.meta,
        derivatives.meta,
        halving.meta,
        mempool.meta,
        strength.meta,
        block.meta,
        macro.meta,
      ],
      60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
