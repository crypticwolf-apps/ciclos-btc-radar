import type { OpportunityScore } from '@/lib/score/opportunityScore';
import type { BtcIndicators } from './market';
import type { StablecoinLiquidity } from './onchain';
import type { DerivativesData } from './dashboard';

// =============================================================================
// Tipos centrales del dashboard. Toda la capa de servicios y los componentes
// visuales comparten estas formas de datos, de modo que conectar una API real
// solo implica devolver objetos con esta estructura.
// =============================================================================

/**
 * De dónde vienen los datos que se están viendo. Ya no existe un modo de
 * ejemplo: o hay dato real, o el panel enseña el estado de error.
 */
export type DataSource = 'live' | 'stale';

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

/**
 * Snapshot del precio y métricas derivadas de Bitcoin.
 *
 * Todo lo que depende del máximo histórico es opcional: si ningún proveedor lo
 * publica y tampoco se puede sacar de la serie diaria, se enseña «—». Antes se
 * rellenaba con el precio de hoy, y entonces el panel afirmaba que Bitcoin
 * estaba en máximos y que llevaba 0 días ahí.
 */
export interface BitcoinSnapshot {
  precio: number;
  cambio24h: number | null; // porcentaje
  ath: number | null;
  athFecha: string | null; // ISO
  drawdownDesdeAth: number | null; // porcentaje negativo
  diasDesdeAth: number | null;
  recuperacionNecesaria: number | null; // % para volver al ATH
  actualizado: string; // ISO
}

/**
 * Indicadores de mercado (momentum y sentimiento).
 *
 * Todos pueden faltar: si su proveedor no responde llegan a `null` y la
 * interfaz lo dice. Antes se rellenaban con constantes de ejemplo, así que un
 * fallo de API se veía como un dato más.
 */
export interface MarketIndicators {
  rsi: number | null; // 0-100 (14d)
  fearGreed: number | null; // 0-100
  fearGreedLabel: string | null;
  tendencia: 'alcista' | 'bajista' | 'lateral' | null;
  actualizado: string;
}

/**
 * Un halving de Bitcoin. La altura de bloque, la fecha y la recompensa son
 * hechos de la cadena; los precios se derivan de la serie diaria real.
 */
export interface HalvingData {
  year: string;
  fecha: string; // ISO del momento en que se minó el bloque
  block: string;
  reward: string;
  /** Suelo del ciclo: fondo del mercado bajista PREVIO al halving. */
  sueloCiclo: number | null;
  sueloFecha: string | null;
  /** Precio el día del halving. `null` si la serie no llega hasta ahí. */
  priceAtHalving: number | null;
  /** Techo del ciclo: máximo en los 18 meses POSTERIORES al halving. */
  picoCiclo: number | null;
  picoFecha: string | null;
  /** Revalorización del suelo del ciclo hasta su techo, en %. */
  sueloAPicoPct: number | null;
  /** `true` si el techo aún puede subir: la ventana no se ha cerrado. */
  cicloAbierto: boolean;
}

export interface HalvingCycleInfo {
  /** `null` si el histórico de halvings no ha llegado. */
  ultimoHalving: HalvingData | null;
  diasDesdeUltimoHalving: number | null;
  proximoHalvingEstimado: string | null; // ISO
  diasHastaProximoHalving: number | null;
  bloquesRestantes: number | null;
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

/** Comparativa de un ciclo completo, derivada de la serie diaria real. */

export interface FearGreedEvent {
  event: string;
  value: number;
  highlight?: boolean;
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

/** Punto del gráfico macro, en la unidad que declara la serie. */
export interface MacroChartPoint {
  period: string;
  value: number;
  current?: boolean;
}

/** Serie macro dibujable, con su línea de referencia. */
export interface MacroChart {
  label: string;
  unit: string;
  points: MacroChartPoint[];
  /** Valor de la línea de referencia (0 en variaciones interanuales). */
  reference: number;
  referenceLabel: string;
  /** Fecha real de la última observación (YYYY-MM-DD). */
  observedAt: string;
}

export interface MacroSnapshot {
  /** Serie del gráfico. `null` si FRED no está configurado o no respondió. */
  chart: MacroChart | null;
  indicadores: MacroIndicator[];
  /** `true` si el tablero macro se nutre de datos reales (FRED). */
  indicadoresLive: boolean;
  actualizado: string;
}

// El score vive en `@/lib/score/opportunityScore`: se calcula por bloques con
// pesos y redistribución, y se reexporta aquí para no cambiar los imports.
export type {
  OpportunityScore,
  ScoreBlock,
  ScoreInput,
  BlockId,
  Confidence,
} from '@/lib/score/opportunityScore';

/** Estructura agregada que consume la UI. */
export interface MarketData {
  /** Tipo directo EUR por USD calculado con los dos precios del proveedor. */
  usdToEur: number | null;
  /** Indicadores técnicos completos (medias, volatilidad, rendimientos). */
  technicals: BtcIndicators | null;
  /** Valoración del ciclo on-chain (MVRV, NUPL, Puell). Dato diario. */
  /** Liquidez en stablecoins (DefiLlama). Dato diario. */
  liquidity: StablecoinLiquidity | null;
  /** Perpetuos de BTC (funding, interés abierto, posicionamiento). */
  derivatives: DerivativesData | null;
  bitcoin: BitcoinSnapshot;
  indicators: MarketIndicators;
  halvingInfo: HalvingCycleInfo;
  halvings: HalvingData[];
  cyclePrices: CyclePricePoint[];
  cycleComparison: CycleComparison[];
  drawdowns: DrawdownEvent[];
  yearlyLows: YearlyLow[];
  whaleTimeline: WhaleTimelinePoint[];
  rsiBottoms: RsiBottom[];
  fearGreedHistory: FearGreedEvent[];
  macro: MacroSnapshot;
  fase: CyclePhase;
  opportunity: OpportunityScore;
  source: DataSource;
  lastUpdated: string; // ISO
}

export type Theme = 'dark' | 'light';
export type TimeRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ciclo' | 'historico';
export type PrimaryView = 'inicio' | 'ciclos' | 'oportunidad' | 'analisis' | 'ajustes';

/** Subapartados DENTRO de la pestaña Ciclos. Altseason vive aquí, no en Análisis. */
export type CyclesSubview = 'bitcoin' | 'altseason' | 'comparativa';

