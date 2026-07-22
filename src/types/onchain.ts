// Tipos del bloque on-chain y de red (/api/onchain, /api/network).
// Espejo de api/_lib/providers/{coinmetrics,defillama,mempool}.

export interface OnchainMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  changePct: number | null;
  observedAt: string;
}

export interface OnchainActivity {
  metrics: OnchainMetric[];
}

/** Métricas de valoración del ciclo (Coin Metrics, frecuencia diaria). */
export interface CycleOnchainPoint {
  t: number;
  mvrv: number;
  nupl: number;
}

export interface CycleOnchain {
  mvrv: number;
  nupl: number;
  realizedCapUsd: number;
  marketCapUsd: number;
  puell: number | null;
  observedAt: string;
  history: CycleOnchainPoint[];
}

/** Liquidez en stablecoins (DefiLlama, frecuencia diaria). */
export interface StablecoinAsset {
  symbol: string;
  name: string;
  circulatingUsd: number;
  change7dPct: number | null;
  change30dPct: number | null;
}

export interface StablecoinLiquidity {
  totalUsd: number;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  trend: 'expansion' | 'contraccion' | 'estable';
  top: StablecoinAsset[];
  observedAt: string;
}

/**
 * Un halving pasado, con los precios derivados de la serie diaria real.
 * `peakPrice` es el MÁXIMO de los 18 meses posteriores, no el precio a los
 * 18 meses: por eso viaja junto a `peakDate`.
 */
export interface HalvingRecord {
  year: string;
  at: string;
  block: number;
  reward: string;
  priceAtHalving: number | null;
  peakPrice: number | null;
  peakDate: string | null;
  returnPct: number | null;
  windowOpen: boolean;
}

export interface HalvingProgress {
  blockHeight: number;
  lastHalvingBlock: number;
  nextHalvingBlock: number;
  blocksRemaining: number;
  progress: number;
  estimatedDaysRemaining: number;
  estimatedDate: string;
}

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/** Congestión actual de la red. */
export interface MempoolState {
  pendingTx: number;
  vsizeMb: number;
  totalFeeBtc: number;
  blocksToClear: number;
}

/** Seguridad de la red y próximo reajuste de dificultad. */
export interface NetworkStrength {
  hashrateEhs: number;
  difficultyT: number;
  retargetProgressPct: number;
  nextAdjustmentPct: number;
  blocksToRetarget: number;
  retargetDate: string;
  avgBlockMinutes: number;
}

export interface LatestBlock {
  height: number;
  minedAt: string;
  txCount: number;
  sizeMb: number;
}

export interface OnchainResponse {
  cycle: CycleOnchain | null;
  activity: OnchainActivity | null;
  liquidity: StablecoinLiquidity | null;
  halving: HalvingProgress | null;
}

export interface NetworkResponse {
  fees: RecommendedFees | null;
  mempool: MempoolState | null;
  strength: NetworkStrength | null;
  latestBlock: LatestBlock | null;
  halving: HalvingProgress | null;
}
