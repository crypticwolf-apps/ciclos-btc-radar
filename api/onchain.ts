import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond';
import { rateLimited } from './_lib/guard';
import { getOnchainBasics } from './_lib/providers/blockchain';
import { getHalvingProgress, getRecommendedFees } from './_lib/providers/mempool';

// =============================================================================
// /api/onchain → métricas on-chain básicas + progreso del halving + comisiones.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const [basics, halving, fees] = await Promise.all([
      settle('blockchain.com', getOnchainBasics()),
      settle('mempool.space', getHalvingProgress()),
      settle('mempool.space:fees', getRecommendedFees()),
    ]);

    sendOk(
      res,
      { basics: basics.data, halving: halving.data, fees: fees.data },
      [basics.meta, halving.meta, fees.meta],
      15 * 60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
