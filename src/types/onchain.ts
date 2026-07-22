// Tipos del bloque on-chain (/api/onchain). Espejo de api/_lib/providers.

export interface OnchainMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  changePct: number | null;
  observedAt: string;
}

export interface OnchainBasics {
  metrics: OnchainMetric[];
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

export interface OnchainResponse {
  basics: OnchainBasics | null;
  halving: HalvingProgress | null;
  fees: RecommendedFees | null;
}
