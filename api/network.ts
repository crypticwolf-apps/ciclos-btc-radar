import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import {
  getHalvingProgress,
  getRecommendedFees,
  getMempoolState,
  getNetworkStrength,
  getLatestBlock,
} from './_lib/providers/mempool.js';

// =============================================================================
// /api/network → estado detallado de la red Bitcoin (mempool.space).
// Solo se pide al abrir la tarjeta "Red Bitcoin", no en la carga inicial.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const [fees, mempool, strength, block, halving] = await Promise.all([
      settle('mempool.space:fees', getRecommendedFees()),
      settle('mempool.space:mempool', getMempoolState()),
      settle('mempool.space:hashrate', getNetworkStrength()),
      settle('mempool.space:blocks', getLatestBlock()),
      settle('mempool.space', getHalvingProgress()),
    ]);

    sendOk(
      res,
      {
        fees: fees.data,
        mempool: mempool.data,
        strength: strength.data,
        latestBlock: block.data,
        halving: halving.data,
      },
      [fees.meta, mempool.meta, strength.meta, block.meta, halving.meta],
      60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
