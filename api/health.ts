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
import { getTechnicalIndicators } from './_lib/providers/technicals';
import { getFearGreed } from './_lib/providers/alternativeme';
import { getCycleOnchain } from './_lib/providers/coinmetrics';
import { getStablecoinLiquidity } from './_lib/providers/defillama';
import { getHalvingProgress, getNetworkStrength } from './_lib/providers/mempool';
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
      provider: r.meta.provider,
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
      probe('Precio BTC', 'coingecko', getMarketSummary),
      probe('Mercado global', 'coingecko:global', getGlobal),
      probe('Técnicos (Coin Metrics)', 'coinmetrics:technicals', getTechnicalIndicators),
      probe('Fear & Greed (alternative.me)', 'alternative.me', getFearGreed),
      probe('Ciclo on-chain (Coin Metrics)', 'coinmetrics', getCycleOnchain),
      probe('Liquidez stablecoins (DefiLlama)', 'defillama', getStablecoinLiquidity),
      probe('Altura/halving (mempool.space)', 'mempool.space', getHalvingProgress),
      probe('Hashrate/dificultad (mempool.space)', 'mempool.space:hashrate', getNetworkStrength),
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
