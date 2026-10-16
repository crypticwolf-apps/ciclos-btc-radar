import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage, type ProviderResult } from './_lib/respond.js';
import { LateError, withDeadline } from './_lib/deadline.js';
import { rateLimited } from './_lib/guard.js';
import { getMarketSummary, getGlobal } from './_lib/providers/coingecko.js';
import { getTechnicalIndicators, getFxRate } from './_lib/providers/technicals.js';
import { getFearGreed, getFearGreedExtremes } from './_lib/providers/alternativeme.js';
import { getCycleOnchain } from './_lib/providers/coinmetrics.js';
import { getHalvingHistory } from './_lib/providers/halvings.js';
import { getHistory } from './_lib/providers/history.js';
import { getOnchainFlow } from './_lib/providers/onchainFlow.js';
import { getStablecoinLiquidity } from './_lib/providers/defillama.js';
import { getDerivatives } from './_lib/providers/derivatives.js';
import {
  getHalvingProgress,
  getMempoolState,
  getNetworkStrength,
  getLatestBlock,
} from './_lib/providers/mempool.js';
import { getMacro } from './_lib/providers/fred.js';
import { recordSnapshot } from './_lib/scoreHistory.js';
import { checkMarketAlerts } from './_lib/alerts.js';
import type { DashboardResponse } from '../src/types/dashboard.js';

// =============================================================================
// /api/dashboard → UNA sola llamada con todo lo que necesitan la pantalla de
// inicio y el Score de Oportunidad. Cada bloque degrada por separado: si una
// fuente falla, su campo llega a null con meta 'unavailable' y el resto sigue.
//
// El coste hacia los proveedores NO crece con el número de visitantes: cada uno
// tiene su propio TTL en la cache del servidor (ver _lib/providers).
// =============================================================================

/**
 * Lo máximo que se espera a cada fuente cuando no hay ningún dato guardado. Con
 * dato anterior ni se llega aquí: la caché lo sirve si la recarga tarda (ver
 * _lib/cache). El precio no tiene tope: sin él no hay panel que enseñar.
 */
const DEADLINE_MS = 6_000;
/** Caché del CDN para una respuesta a la que le faltan fuentes que aún cargan. */
const PARTIAL_CACHE_S = 5;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  // Fuentes que no han llegado a tiempo y siguen cargando por detrás.
  const pending: string[] = [];
  const tope = <T>(provider: string, p: Promise<ProviderResult<T>>) =>
    settle(
      provider,
      withDeadline(p, DEADLINE_MS, provider).catch((err: unknown) => {
        if (err instanceof LateError) pending.push(provider);
        throw err;
      }),
    );

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
      history,
      fngExtremes,
    ] = await Promise.all([
      settle('coingecko', getMarketSummary()),
      tope('coingecko:global', getGlobal()),
      tope('coinmetrics:technicals', getTechnicalIndicators()),
      settle('fx:derivado', getFxRate()),
      tope('alternative.me', getFearGreed()),
      tope('coinmetrics', getCycleOnchain()),
      tope('halvings', getHalvingHistory()),
      tope('blockchain.com:flow', getOnchainFlow()),
      tope('defillama', getStablecoinLiquidity()),
      tope('binance:futures', getDerivatives()),
      tope('mempool.space', getHalvingProgress()),
      tope('mempool.space:mempool', getMempoolState()),
      tope('mempool.space:hashrate', getNetworkStrength()),
      tope('mempool.space:blocks', getLatestBlock()),
      tope('fred', getMacro()),
      tope('historico', getHistory()),
      tope('alternative.me:historico', getFearGreedExtremes()),
    ]);

    const payload = {
      market: {
        summary: summary.data,
        global: global.data,
        indicators: indicators.data,
        sentiment: sentiment.data,
        sentimentExtremes: fngExtremes.data,
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
      history: history.data,
      // Solo si falta algo: la app vuelve a pedir el panel en unos segundos.
      ...(pending.length > 0 ? { pending } : {}),
    };

    // Foto del día para el histórico del score (como mucho una vez por hora).
    // Y aviso a los móviles suscritos si ha cambiado la fase o el miedo.
    // En paralelo: son independientes y cada una espera a Redis. Con fuentes
    // aún cargando, ninguna de las dos: un score o una fase calculados a medias
    // ni se guardan ni avisan de nada.
    if (pending.length === 0) {
      await Promise.all([
        recordSnapshot(payload as unknown as DashboardResponse),
        checkMarketAlerts(payload as unknown as DashboardResponse),
      ]);
    }

    sendOk(
      res,
      payload,
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
        history.meta,
        fngExtremes.meta,
      ],
      pending.length > 0 ? PARTIAL_CACHE_S : 60,
    );
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
