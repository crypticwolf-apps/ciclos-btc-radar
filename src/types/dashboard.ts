import type {
  MarketSummary,
  GlobalSummary,
  BtcIndicators,
  FearGreed,
  FearGreedExtreme,
  FxRate,
} from './market';
import type { HistoryData } from './history';
import type {
  CycleOnchain,
  HalvingProgress,
  HalvingRecord,
  OnchainFlow,
  LatestBlock,
  MempoolState,
  NetworkStrength,
  StablecoinLiquidity,
} from './onchain';
import type { MacroData } from './macro';

// Respuesta agregada de /api/dashboard (una sola llamada para toda la UI).
export interface DashboardResponse {
  market: {
    summary: MarketSummary | null;
    global: GlobalSummary | null;
    indicators: BtcIndicators | null;
    sentiment: FearGreed | null;
    /** Mínimos históricos del índice de miedo, para comparar el de hoy. */
    sentimentExtremes: FearGreedExtreme[] | null;
    fx: FxRate | null;
  };
  onchain: {
    halving: HalvingProgress | null;
    cycle: CycleOnchain | null;
    halvings: HalvingRecord[] | null;
    flow: OnchainFlow | null;
  };
  network: {
    mempool: MempoolState | null;
    strength: NetworkStrength | null;
    latestBlock: LatestBlock | null;
  };
  liquidity: StablecoinLiquidity | null;
  derivatives: DerivativesData | null;
  macro: MacroData | null;
  /** Series históricas derivadas de la serie diaria real de precio. */
  history: HistoryData | null;
}

/**
 * Foto del mercado de futuros perpetuos, usada por el Score de Oportunidad.
 * El proveedor se resuelve por cadena de respaldo (Binance, OKX o Bybit), por
 * eso viaja `source`: cada uno cubre un subconjunto distinto de campos.
 */
export interface DerivativesData {
  fundingRate: number | null;
  nextFundingAt: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  openInterestBtc: number | null;
  openInterestUsd: number | null;
  openInterestChange24hPct: number | null;
  longShortRatio: number | null;
  longAccountPct: number | null;
  takerBuySellRatio: number | null;
  source: string;
}
