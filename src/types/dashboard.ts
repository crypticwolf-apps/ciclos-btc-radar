import type { MarketSummary, GlobalSummary, BtcIndicators, FearGreed, FxRate } from './market';
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
}

/** Foto del mercado de futuros (Binance), usada por el Score de Oportunidad. */
export interface DerivativesData {
  fundingRate: number | null;
  nextFundingAt: number | null;
  markPrice: number | null;
  openInterestBtc: number | null;
  openInterestUsd: number | null;
  openInterestChange24hPct: number | null;
  longShortRatio: number | null;
  longAccountPct: number | null;
  takerBuySellRatio: number | null;
}
