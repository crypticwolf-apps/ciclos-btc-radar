import type {
  CycleComparison,
  CyclePricePoint,
  DrawdownEvent,
  FearGreedEvent,
  MacroChart,
  MarketData,
  RsiBottom,
  YearlyLow,
  MacroIndicator,
  MacroSnapshot,
  BitcoinSnapshot,
  MarketIndicators,
  HalvingCycleInfo,
  HalvingData,
  DataSource,
  WhaleTimelinePoint,
} from '@/types';
import type { DashboardResponse } from '@/types/dashboard';
import type { MacroSeries } from '@/types/macro';
import { getHalvingCycleInfo, detectPhase } from '@/services/cycleDetector';
import { computeOpportunityScore, type ScoreSources } from '@/lib/score/opportunityScore';
import { formatNumberEs } from '@/lib/format';

// =============================================================================
// Mapea la respuesta del backend (/api/dashboard) al shape `MarketData` que
// consumen las secciones.
//
// TODO lo numérico viene del backend, incluidas las series históricas: suelos
// anuales, caídas, ciclos y suelos de RSI se derivan de la serie diaria real
// (`/_lib/providers/history.ts`), no de constantes. Lo único que queda escrito
// en el repositorio son hechos de la cadena que no cambian —altura, fecha y
// recompensa de cada halving— y el texto de contexto de la divergencia on-chain.
//
// Si una fuente falta, su bloque llega vacío y se declara; nunca se rellena con
// un número inventado.
// =============================================================================

/** Paleta estable de los ciclos, del más antiguo al actual. */
const CYCLE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];

const ICON_BY_ID: Record<string, string> = {
  fedfunds: 'Percent',
  inflacion: 'TrendingUp',
  desempleo: 'Gauge',
  treasury10y: 'Percent',
  spread: 'TrendingUp',
  dolar: 'DollarSign',
  liquidez: 'Droplets',
  sp500: 'TrendingUp',
  vix: 'Gauge',
};

function macroEstado(s: MacroSeries): MacroIndicator['estado'] {
  switch (s.id) {
    case 'inflacion':
      return s.value < 3 ? 'positivo' : s.value < 4 ? 'neutral' : 'negativo';
    case 'liquidez':
      return s.value >= 0 ? 'positivo' : 'negativo';
    case 'fedfunds':
      return s.change == null ? 'neutral' : s.change < 0 ? 'positivo' : s.change > 0 ? 'negativo' : 'neutral';
    case 'dolar':
      return s.change == null ? 'neutral' : s.change < -0.5 ? 'positivo' : s.change > 0.5 ? 'negativo' : 'neutral';
    case 'vix':
      return s.value < 20 ? 'positivo' : s.value > 30 ? 'negativo' : 'neutral';
    case 'spread':
      return s.value < 0 ? 'negativo' : 'positivo';
    case 'sp500':
      return s.change != null && s.change >= 0 ? 'positivo' : 'negativo';
    default:
      return 'neutral';
  }
}

function macroValor(s: MacroSeries): string {
  if (s.unit === '% interanual') return `${formatNumberEs(s.value, 1)}% ia`;
  if (s.unit === '%') return `${formatNumberEs(s.value, 2)}%`;
  if (s.unit === 'pp') return `${formatNumberEs(s.value, 2)} pp`;
  return formatNumberEs(s.value, s.value >= 1000 ? 0 : 2);
}

function buildMacro(macro: DashboardResponse['macro']): MacroSnapshot {
  const series = macro?.series ?? [];
  if (series.length === 0) {
    // Sin FRED configurado o caído: no hay tablero. No se rellena con un
    // cuadro de ejemplo, que era lo que se hacía antes.
    return { chart: null, indicadores: [], indicadoresLive: false, actualizado: new Date().toISOString() };
  }

  const indicadores: MacroIndicator[] = series.map((s) => ({
    id: s.id,
    nombre: s.label,
    valor: macroValor(s),
    estado: macroEstado(s),
    descripcion: s.definicion,
    icono: ICON_BY_ID[s.id] ?? 'Gauge',
  }));

  // El gráfico usa la serie que trae histórico (liquidez M2 interanual): es la
  // que mejor describe el ciclo de liquidez que mueve a los activos de riesgo.
  const withHistory = series.find((s) => s.history && s.history.length > 1);
  const chart: MacroChart | null = withHistory?.history
    ? {
        label: withHistory.label,
        unit: withHistory.unit,
        points: withHistory.history.map((h, i, all) => ({
          period: h.period,
          value: h.value,
          current: i === all.length - 1,
        })),
        reference: 0,
        referenceLabel: '0% · liquidez plana',
        observedAt: withHistory.observedAt,
      }
    : null;

  return { chart, indicadores, indicadoresLive: true, actualizado: new Date().toISOString() };
}

function buildBitcoin(d: DashboardResponse): { bitcoin: BitcoinSnapshot; live: boolean } | null {
  const s = d.market.summary;
  // El precio es el requisito mínimo: sin él no hay panel que construir y la
  // interfaz enseña el estado de error, en vez de un panel con cifras de ejemplo.
  if (!s) return null;
  // Sin fecha del máximo no hay días que contar. Poner «hoy» hacía que la
  // tarjeta dijera «0 días desde el ATH», que es una afirmación, no un hueco.
  const athFecha = s.athDate;
  const diasDesdeAth =
    athFecha == null
      ? null
      : Math.max(0, Math.round((Date.now() - new Date(athFecha).getTime()) / 86_400_000));
  return {
    live: true,
    bitcoin: {
      precio: Math.round(s.priceUsd),
      cambio24h: s.change24h == null ? null : Number(s.change24h.toFixed(2)),
      ath: s.ath == null ? null : Math.round(s.ath),
      athFecha,
      // Nunca positiva: si el precio supera el ATH que publica el proveedor, la
      // caída es 0, no una «caída» al alza.
      drawdownDesdeAth: s.fromAthPct == null ? null : Math.min(0, Number(s.fromAthPct.toFixed(1))),
      diasDesdeAth,
      recuperacionNecesaria:
        s.ath == null ? null : Math.max(0, Math.round(((s.ath - s.priceUsd) / s.priceUsd) * 100)),
      actualizado: new Date().toISOString(),
    },
  };
}

function buildIndicators(d: DashboardResponse): MarketIndicators {
  const ind = d.market.indicators;
  const fng = d.market.sentiment;
  return {
    rsi: ind?.rsi14 ?? null,
    fearGreed: fng?.value ?? null,
    fearGreedLabel: fng?.classification ?? null,
    tendencia: ind?.trend ?? null,
    actualizado: new Date().toISOString(),
  };
}

/**
 * Histórico de halvings con precios derivados de la serie diaria real.
 * Si Coin Metrics no responde se usa la tabla de respaldo, que solo contiene
 * hechos de la cadena y precios de referencia ya conocidos.
 */
function buildHalvings(d: DashboardResponse): HalvingData[] {
  const records = d.onchain.halvings;
  if (!records || records.length === 0) return [];

  return records.map((r) => ({
    year: r.year,
    fecha: r.at,
    block: formatNumberEs(r.block),
    reward: r.reward,
    sueloCiclo: r.cycleLow,
    sueloFecha: r.cycleLowDate,
    priceAtHalving: r.priceAtHalving,
    picoCiclo: r.cyclePeak,
    picoFecha: r.cyclePeakDate,
    sueloAPicoPct: r.lowToPeakPct,
    cicloAbierto: r.cycleOpen,
  }));
}

/** Reloj del halving derivado de la ALTURA DE BLOQUE REAL (mempool.space). */
function buildHalvingInfo(d: DashboardResponse, halvings: HalvingData[]): HalvingCycleInfo {
  const h = d.onchain.halving;
  const base = getHalvingCycleInfo(halvings); // ultimoHalving (hecho de la cadena)
  if (!h) return base;
  return {
    ...base,
    proximoHalvingEstimado: h.estimatedDate,
    diasHastaProximoHalving: h.estimatedDaysRemaining,
    bloquesRestantes: h.blocksRemaining,
  };
}

/**
 * Divergencia on-chain (ballenas/retail): serie REAL de Blockchain.com servida
 * por `/api/dashboard`. Si la fuente falla no hay serie, y la tarjeta lo dice;
 * no se dibuja una divergencia de ejemplo.
 */
function buildWhaleTimeline(d: DashboardResponse): WhaleTimelinePoint[] {
  const flow = d.onchain.flow;
  if (!flow || flow.timeline.length === 0) return [];
  return flow.timeline.map((p) => ({
    period: p.period,
    whaleBalance: p.whaleIndex,
    retailBalance: p.retailIndex,
    price: p.priceK,
    current: p.current,
  }));
}

export function buildMarketData(d: DashboardResponse): MarketData | null {
  const base = buildBitcoin(d);
  if (!base) return null;
  const { bitcoin, live } = base;
  const indicators = buildIndicators(d);
  const halvings = buildHalvings(d);
  const halvingInfo = buildHalvingInfo(d, halvings);
  const macro = buildMacro(d.macro);
  const whaleTimeline = buildWhaleTimeline(d);

  const fase = detectPhase({ bitcoin, indicators });

  // El score se alimenta SOLO de medidas vivas del backend; las series
  // históricas describen el pasado y no entran en la nota de hoy.
  const tech = d.market.indicators;
  const cycle = d.onchain.cycle;
  const derivs = d.derivatives;
  const net = d.network;

  const scoreSources: ScoreSources = {
    drawdownFromAthPct: d.market.summary?.fromAthPct ?? null,
    price: d.market.summary?.priceUsd ?? null,
    mvrv: cycle?.mvrv ?? null,
    nupl: cycle?.nupl ?? null,
    puell: cycle?.puell ?? null,
    cycleLow: tech?.cycleLow ?? null,
    cycleHigh: tech?.cycleHigh ?? null,
    daysSinceHalving: halvingInfo.diasDesdeUltimoHalving,

    rsi14: tech?.rsi14 ?? null,
    sma50: tech?.sma50 ?? null,
    sma200: tech?.sma200 ?? null,
    sma200w: tech?.sma200w ?? null,
    cross: tech?.cross ?? 'ninguno',
    return30d: tech?.return30d ?? null,
    return90d: tech?.return90d ?? null,

    fearGreed: d.market.sentiment?.value ?? null,
    fearGreedLabel: d.market.sentiment?.classification ?? null,

    fundingRate: derivs?.fundingRate ?? null,
    openInterestChange24hPct: derivs?.openInterestChange24hPct ?? null,
    longShortRatio: derivs?.longShortRatio ?? null,

    stablecoinChange30dPct: d.liquidity?.change30dPct ?? null,
    stablecoinTrend: d.liquidity?.trend ?? null,

    hashrateEhs: net?.strength?.hashrateEhs ?? null,
    nextDifficultyAdjustmentPct: net?.strength?.nextAdjustmentPct ?? null,
    mempoolBlocksToClear: net?.mempool?.blocksToClear ?? null,

    volatility30d: tech?.volatility30d ?? null,

    observedAt: {
      ciclo: cycle?.observedAt ?? null,
      sentimiento: d.market.sentiment?.updatedAt ?? null,
      liquidez: d.liquidity?.observedAt ?? null,
      red: net?.latestBlock?.minedAt ?? null,
    },
  };

  const opportunity = computeOpportunityScore(scoreSources);

  // Series históricas: todas derivadas por el backend de la serie diaria real.
  const h = d.history;
  const cyclePrices: CyclePricePoint[] = (h?.cyclePoints ?? []).map((p, i, all) => {
    // El número de ciclo avanza con cada suelo confirmado.
    const cycle = all.slice(0, i + 1).filter((x) => x.kind === 'suelo').length + 1;
    return {
      year: p.label,
      price: p.price,
      cycle,
      phase: p.kind === 'pico' ? 'máximo' : p.kind === 'suelo' ? 'mínimo' : 'actual',
      isPeak: p.kind === 'pico',
      isBottom: p.kind === 'suelo',
      isCurrent: p.kind === 'actual',
    };
  });

  const cycleComparison: CycleComparison[] = (h?.cycles ?? []).map((c, i) => ({
    cycle: c.label,
    min: c.low,
    max: c.high,
    growth: c.growthPct,
    color: CYCLE_COLORS[i % CYCLE_COLORS.length]!,
    current: c.open,
  }));

  const drawdowns: DrawdownEvent[] = (h?.drawdowns ?? []).map((x) => ({
    period: x.period,
    drawdown: x.drawdownPct,
    recovery: x.recoveryPct,
    current: x.current,
  }));

  const yearlyLows: YearlyLow[] = (h?.yearlyLows ?? []).map((y) => ({ year: y.year, low: y.low }));

  const rsiBottoms: RsiBottom[] = (h?.rsiBottoms ?? []).map((r) => ({
    event: r.current ? 'Actual' : r.label,
    rsi: r.rsi,
    return1Y: r.return1yPct,
    current: r.current,
  }));

  const fearGreedHistory: FearGreedEvent[] = (d.market.sentimentExtremes ?? []).map((e) => ({
    event: e.label,
    value: e.value,
    highlight: e.current,
  }));

  const source: DataSource = live ? 'live' : 'stale';

  return {
    // La tasa preferente es la que calcula el backend; si no llegó, se deriva
    // aquí de los dos precios del mismo snapshot (nunca de proveedores mezclados).
    usdToEur:
      d.market.fx?.eurPerUsd ??
      (d.market.summary?.priceEur && d.market.summary.priceUsd > 0
        ? d.market.summary.priceEur / d.market.summary.priceUsd
        : null),
    technicals: d.market.indicators,
    liquidity: d.liquidity,
    derivatives: d.derivatives,
    bitcoin,
    indicators,
    halvingInfo,
    halvings,
    cyclePrices,
    cycleComparison,
    drawdowns,
    yearlyLows,
    whaleTimeline,
    rsiBottoms,
    fearGreedHistory,
    macro,
    fase,
    opportunity,
    source,
    lastUpdated: new Date().toISOString(),
  };
}
