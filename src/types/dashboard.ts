import type { MarketSummary, GlobalSummary, BtcIndicators, FearGreed } from './market';
import type { OnchainBasics, HalvingProgress, RecommendedFees } from './onchain';
import type { MacroData } from './macro';

// Respuesta agregada de /api/dashboard (una sola llamada para toda la UI).
export interface DashboardResponse {
  market: {
    summary: MarketSummary | null;
    global: GlobalSummary | null;
    indicators: BtcIndicators | null;
    sentiment: FearGreed | null;
  };
  onchain: {
    basics: OnchainBasics | null;
    halving: HalvingProgress | null;
    fees: RecommendedFees | null;
  };
  macro: MacroData | null;
}
