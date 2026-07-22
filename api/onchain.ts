import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond';
import { rateLimited } from './_lib/guard';
import { getCycleOnchain, getOnchainActivity } from './_lib/providers/coinmetrics';
import { getStablecoinLiquidity } from './_lib/providers/defillama';
import { getHalvingProgress } from './_lib/providers/mempool';

// =============================================================================
// /api/onchain → métricas on-chain de CICLO (MVRV, NUPL, Puell, realized cap) y
// de ACTIVIDAD (hashrate, tx/día, direcciones, supply), más la liquidez en
// stablecoins y el progreso del halving.
//
// Todo son datos DIARIOS: cache HTTP de 15 min y TTL de 6 h por proveedor.
// Nunca se etiquetan como "en vivo".
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const [cycle, activity, liquidity, halving] = await Promise.all([
      settle('coinmetrics', getCycleOnchain()),
      settle('coinmetrics:activity', getOnchainActivity()),
      settle('defillama', getStablecoinLiquidity()),
      settle('mempool.space', getHalvingProgress()),
    ]);

    sendOk(
      res,
      {
        cycle: cycle.data,
        activity: activity.data,
        liquidity: liquidity.data,
        halving: halving.data,
      },
      [cycle.meta, activity.meta, liquidity.meta, halving.meta],
      15 * 60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
