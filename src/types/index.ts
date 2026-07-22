import type { BtcIndicators } from './market';
import type {
  CycleOnchain,
  LatestBlock,
  MempoolState,
  NetworkStrength,
  StablecoinLiquidity,
} from './onchain';

// =============================================================================
// Tipos centrales del dashboard. Toda la capa de servicios y los componentes
// visuales comparten estas formas de datos, de modo que conectar una API real
// solo implica devolver objetos con esta estructura.
// =============================================================================

export type DataSource = 'live' | 'mock' | 'stale';

/** Fase aproximada del ciclo de mercado de Bitcoin. */
export type CyclePhaseId =
  | 'acumulacion'
  | 'expansion-temprana'
  | 'expansion-avanzada'
  | 'euforia'
  | 'correccion'
  | 'capitulacion'
  | 'recuperacion';

export interface CyclePhase {
  id: CyclePhaseId;
  nombre: string;
  /** Color base (hex) usado en badges y acentos. */
  color: string;
  emoji: string;
  descripcion: string;
  senales: string[];
  riesgos: string[];
  oportunidades: string[];
  comparacionHistorica: string;
}

/** Snapshot del precio y métricas derivadas de Bitcoin. */
export interface BitcoinSnapshot {
  precio: number;
  cambio24h: number; // porcentaje
  ath: number;
  athFecha: string; // ISO
  drawdownDesdeAth: number; // porcentaje negativo
  diasDesdeAth: number;
  recuperacionNecesaria: number; // % para volver al ATH
  minimoAnual: number;
  maximoAnual: number;
  actualizado: string; // ISO
}

/** Métricas globales del mercado cripto (CoinGecko /global). */
export interface GlobalStats {
  marketCap: number; // USD
  volume24h: number; // USD
  btcDominance: number; // %
  marketCapChange24h: number; // %
  actualizado: string;
}

/** Indicadores de mercado (momentum y sentimiento). */
export interface MarketIndicators {
  rsi: number; // 0-100 (14d)
  fearGreed: number; // 0-100
  fearGreedLabel: string;
  tendencia: 'alcista' | 'bajista' | 'lateral';
  actualizado: string;
}

/** Datos de halvings de Bitcoin. */
export interface HalvingData {
  year: string;
  fecha: string; // ISO de la fecha del halving
  block: string;
  reward: string;
  priceAtHalving: number;
  priceAfter18m: number | null;
}

export interface HalvingCycleInfo {
  ultimoHalving: HalvingData;
  diasDesdeUltimoHalving: number;
  proximoHalvingEstimado: string; // ISO
  diasHastaProximoHalving: number;
  bloquesRestantes: number;
}

/** Comparativa de un ciclo completo (suelo → pico). */
export interface CycleComparison {
  cycle: string;
  min: number;
  max: number;
  growth: number; // %
  color: string;
  current?: boolean;
}

export interface CyclePricePoint {
  year: string;
  price: number;
  cycle: number;
  phase: string;
  isPeak?: boolean;
  isBottom?: boolean;
  isCurrent?: boolean;
}

export interface DrawdownEvent {
  period: string;
  drawdown: number; // % negativo
  recovery: number | null; // % rally posterior
  current?: boolean;
}

export interface YearlyLow {
  year: string;
  low: number;
}

export interface SmartMoneyEvent {
  event: string;
  whales: number;
  retail: number;
  priceChange: number;
  current?: boolean;
}

export interface WhaleTimelinePoint {
  period: string;
  whaleBalance: number;
  retailBalance: number;
  price: number;
  current?: boolean;
}

export interface RsiBottom {
  event: string;
  rsi: number;
  return1Y: number | null;
  current?: boolean;
}

export interface FearGreedEvent {
  event: string;
  value: number;
  highlight?: boolean;
}

/** Datos de flujos de ETFs spot de Bitcoin. */
export interface EtfFlowPoint {
  month: string;
  cumulative: number; // miles de millones acumulados
  monthly: number;
  correction?: boolean;
  recovery?: boolean;
}

export interface EtfSummary {
  inflowsTotales: number; // B
  aumTotal: number; // B
  correccionReciente: number; // B (negativo)
  inflowsRecientes: number; // B
  flujos: EtfFlowPoint[];
}

/** Indicador macro genérico (ISM, liquidez, tipos, etc.). */
export interface MacroIndicator {
  id: string;
  nombre: string;
  valor: string;
  estado: 'positivo' | 'negativo' | 'neutral';
  descripcion: string;
  icono: string;
}

export interface IsmPoint {
  period: string;
  value: number;
  current?: boolean;
}

export interface MacroSnapshot {
  ism: IsmPoint[];
  ismActual: number;
  indicadores: MacroIndicator[];
  /** `true` si el tablero macro se nutre de datos reales (FRED). */
  indicadoresLive: boolean;
  actualizado: string;
}

/** Señal individual usada en el score de oportunidad. */
export interface MarketSignal {
  id: string;
  label: string;
  detalle: string;
  tipo: 'positivo' | 'negativo' | 'neutral';
  peso: number; // contribución al score
  categoria: 'precio' | 'momentum' | 'sentimiento' | 'institucional' | 'macro' | 'ciclo';
}

export interface OpportunityScore {
  score: number; // 0-100
  etiqueta: string;
  resumen: string;
  senales: MarketSignal[];
}

/** Estructura agregada que consume la UI. */
export interface MarketData {
  /** Tipo directo EUR por USD calculado con los dos precios del proveedor. */
  usdToEur: number | null;
  /** Indicadores técnicos completos (medias, volatilidad, rendimientos). */
  technicals: BtcIndicators | null;
  /** Valoración del ciclo on-chain (MVRV, NUPL, Puell). Dato diario. */
  cycleOnchain: CycleOnchain | null;
  /** Liquidez en stablecoins (DefiLlama). Dato diario. */
  liquidity: StablecoinLiquidity | null;
  /** Estado de la red Bitcoin (congestión, seguridad, último bloque). */
  network: {
    mempool: MempoolState | null;
    strength: NetworkStrength | null;
    latestBlock: LatestBlock | null;
  };
  bitcoin: BitcoinSnapshot;
  global: GlobalStats;
  indicators: MarketIndicators;
  halvingInfo: HalvingCycleInfo;
  halvings: HalvingData[];
  cyclePrices: CyclePricePoint[];
  cycleComparison: CycleComparison[];
  drawdowns: DrawdownEvent[];
  yearlyLows: YearlyLow[];
  smartMoney: SmartMoneyEvent[];
  whaleTimeline: WhaleTimelinePoint[];
  rsiBottoms: RsiBottom[];
  fearGreedHistory: FearGreedEvent[];
  etf: EtfSummary;
  macro: MacroSnapshot;
  fase: CyclePhase;
  opportunity: OpportunityScore;
  source: DataSource;
  lastUpdated: string; // ISO
}

export type Theme = 'dark' | 'light';
export type TimeRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ciclo' | 'historico';
export type PrimaryView = 'inicio' | 'ciclos' | 'oportunidad' | 'analisis' | 'ajustes';

