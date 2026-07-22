import type { MarketSummary, GlobalSummary, BtcIndicators, FearGreed, FxRate } from './market';
import type {
  CycleOnchain,
  HalvingProgress,
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
  };
  network: {
    mempool: MempoolState | null;
    strength: NetworkStrength | null;
    latestBlock: LatestBlock | null;
  };
  liquidity: StablecoinLiquidity | null;
  macro: MacroData | null;
}
