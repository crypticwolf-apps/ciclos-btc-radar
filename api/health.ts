import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  preflight,
  sendOk,
  sendError,
  errorMessage,
  nowUtc,
  type SourceMeta,
  type ProviderResult,
} from './_lib/respond';
import { rateLimited } from './_lib/guard';
import { getMarketSummary, getGlobal } from './_lib/providers/coingecko';
import { getFearGreed } from './_lib/providers/alternativeme';
import { getOnchainBasics } from './_lib/providers/blockchain';
import { getHalvingProgress } from './_lib/providers/mempool';
import { getMacro, macroConfigured } from './_lib/providers/fred';

// =============================================================================
// /api/health → "Estado de fuentes": prueba cada proveedor y reporta estado,
// última respuesta válida y latencia. Alimenta el panel de diagnóstico.
// =============================================================================

interface ProbeResult {
  provider: string;
  label: string;
  status: SourceMeta['status'];
  fetchedAt: string | null;
  latencyMs: number;
  note?: string;
}

async function probe(
  label: string,
  provider: string,
  fn: () => Promise<ProviderResult<unknown>>,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const r = await fn();
    return {
      provider,
      label,
      status: r.meta.status,
      fetchedAt: r.meta.fetchedAt,
      latencyMs: Date.now() - start,
      note: r.meta.note,
    };
  } catch (err) {
    return {
      provider,
      label,
      status: 'unavailable',
      fetchedAt: null,
      latencyMs: Date.now() - start,
      note: errorMessage(err),
    };
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res, 30)) return;

  try {
    const probes = await Promise.all([
      probe('Precio BTC (CoinGecko)', 'coingecko', getMarketSummary),
      probe('Mercado global (CoinGecko)', 'coingecko:global', getGlobal),
      probe('Fear & Greed (alternative.me)', 'alternative.me', getFearGreed),
      probe('On-chain (Blockchain.com)', 'blockchain.com', getOnchainBasics),
      probe('Altura/halving (mempool.space)', 'mempool.space', getHalvingProgress),
      probe('Macro (FRED)', 'fred', getMacro),
    ]);

    const summary = {
      checkedAt: nowUtc(),
      macroConfigured: macroConfigured(),
      healthy: probes.filter((p) => p.status === 'live' || p.status === 'cached').length,
      total: probes.length,
      providers: probes,
    };
    sendOk(res, summary, [], 30);
  } catch (err) {
    sendError(res, 500, errorMessage(err));
  }
}
