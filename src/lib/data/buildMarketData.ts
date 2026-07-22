import type {
  MarketData,
  MacroIndicator,
  MacroSnapshot,
  BitcoinSnapshot,
  GlobalStats,
  MarketIndicators,
  HalvingCycleInfo,
  HalvingData,
  DataSource,
  SmartMoneyEvent,
  WhaleTimelinePoint,
} from '@/types';
import type { DashboardResponse } from '@/types/dashboard';
import type { MacroSeries } from '@/types/macro';
import {
  MOCK_BITCOIN,
  MOCK_INDICATORS,
  MOCK_HALVINGS,
  MOCK_CYCLE_PRICES,
  MOCK_CYCLE_COMPARISON,
  MOCK_DRAWDOWNS,
  MOCK_YEARLY_LOWS,
  MOCK_RSI_BOTTOMS,
  MOCK_FEAR_GREED_HISTORY,
  MOCK_ETF_FLOWS,
  MOCK_ETF_SUMMARY,
  MOCK_ISM,
  MOCK_MACRO_INDICATORS,
} from '@/data/mockData';
import { getHalvingCycleInfo, detectPhase } from '@/services/cycleDetector';
import { computeOpportunityScore, type ScoreSources } from '@/lib/score/opportunityScore';
import { formatNumberEs } from '@/lib/format';

// =============================================================================
// Mapea la respuesta del backend (/api/dashboard) + la señal smart money al
// shape MarketData que consumen las secciones. Las SERIES HISTÓRICAS (halvings,
// caídas, comparativas de ciclo, etc.) son hechos verificados estáticos; las
// métricas VIVAS provienen del backend. Si una fuente viva falta, se degrada de
// forma honesta (source != 'live') en lugar de inventar valores.
// =============================================================================

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
  const ismActual = MOCK_ISM[MOCK_ISM.length - 1]?.value ?? 50;
  const series = macro?.series ?? [];
  if (series.length === 0) {
    // Sin FRED configurado o caído: tablero de referencia (no en vivo).
    return {
      ism: MOCK_ISM,
      ismActual,
      indicadores: MOCK_MACRO_INDICATORS,
      indicadoresLive: false,
      actualizado: new Date().toISOString(),
    };
  }
  const indicadores: MacroIndicator[] = series.map((s) => ({
    id: s.id,
    nombre: s.label,
    valor: macroValor(s),
    estado: macroEstado(s),
    descripcion: s.definicion,
    icono: ICON_BY_ID[s.id] ?? 'Gauge',
  }));
  return {
    ism: MOCK_ISM,
    ismActual,
    indicadores,
    indicadoresLive: true,
    actualizado: new Date().toISOString(),
  };
}

function buildBitcoin(d: DashboardResponse): { bitcoin: BitcoinSnapshot; live: boolean } {
  const s = d.market.summary;
  const ind = d.market.indicators;
  if (!s) {
    return { bitcoin: { ...MOCK_BITCOIN, actualizado: new Date().toISOString() }, live: false };
  }
  const athFecha = s.athDate ?? MOCK_BITCOIN.athFecha;
  const diasDesdeAth = Math.max(
    0,
    Math.round((Date.now() - new Date(athFecha).getTime()) / 86_400_000),
  );
  return {
    live: true,
    bitcoin: {
      precio: Math.round(s.priceUsd),
      cambio24h: Number((s.change24h ?? 0).toFixed(2)),
      ath: Math.round(s.ath),
      athFecha,
      drawdownDesdeAth: Number(s.fromAthPct.toFixed(1)),
      diasDesdeAth,
      recuperacionNecesaria: Math.round(((s.ath - s.priceUsd) / s.priceUsd) * 100),
      minimoAnual: ind?.minYear ?? Math.round(Math.min(s.priceUsd, s.ath)),
      maximoAnual: ind?.maxYear ?? Math.round(s.ath),
      actualizado: new Date().toISOString(),
    },
  };
}

function buildGlobal(d: DashboardResponse): GlobalStats {
  const g = d.market.global;
  if (!g) {
    return {
      marketCap: 0,
      volume24h: 0,
      btcDominance: 0,
      marketCapChange24h: 0,
      actualizado: new Date().toISOString(),
    };
  }
  return {
    marketCap: g.marketCapUsd,
    volume24h: g.volume24hUsd,
    btcDominance: g.btcDominance,
    marketCapChange24h: g.marketCapChange24h,
    actualizado: new Date().toISOString(),
  };
}

function buildIndicators(d: DashboardResponse): MarketIndicators {
  const ind = d.market.indicators;
  const fng = d.market.sentiment;
  return {
    rsi: ind?.rsi14 ?? MOCK_INDICATORS.rsi,
    fearGreed: fng?.value ?? MOCK_INDICATORS.fearGreed,
    fearGreedLabel: fng?.classification ?? MOCK_INDICATORS.fearGreedLabel,
    tendencia: ind?.trend ?? MOCK_INDICATORS.tendencia,
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
  if (!records || records.length === 0) return MOCK_HALVINGS;

  return records.map((r) => ({
    year: r.year,
    fecha: r.at,
    block: formatNumberEs(r.block),
    reward: r.reward,
    sueloCiclo: r.cycleLow,
    sueloFecha: r.cycleLowDate,
    priceAtHalving: r.priceAtHalving ?? 0,
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

export interface SmartMoneyBundle {
  smartMoney: SmartMoneyEvent[];
  whaleTimeline: WhaleTimelinePoint[];
}

export function buildMarketData(d: DashboardResponse, sm: SmartMoneyBundle): MarketData {
  const { bitcoin, live } = buildBitcoin(d);
  const global = buildGlobal(d);
  const indicators = buildIndicators(d);
  const halvings = buildHalvings(d);
  const halvingInfo = buildHalvingInfo(d, halvings);
  const macro = buildMacro(d.macro);
  const etf = { ...MOCK_ETF_SUMMARY, flujos: MOCK_ETF_FLOWS };

  const fase = detectPhase({ bitcoin, indicators, halvingInfo, etf });

  // El score se alimenta SOLO de datos reales del backend. Las series estáticas
  // (ETF, ISM) no entran: son material de contexto histórico, no medidas vivas.
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

  // Sincronizamos el punto "Actual" de las series históricas con el dato vivo.
  const cyclePrices = MOCK_CYCLE_PRICES.map((p) =>
    p.isCurrent ? { ...p, price: Math.round(bitcoin.precio) } : p,
  );
  const drawdowns = MOCK_DRAWDOWNS.map((x) =>
    x.current ? { ...x, drawdown: Math.round(bitcoin.drawdownDesdeAth) } : x,
  );
  const rsiBottoms = MOCK_RSI_BOTTOMS.map((r) =>
    r.current ? { ...r, rsi: indicators.rsi } : r,
  );
  const fearGreedHistory = MOCK_FEAR_GREED_HISTORY.map((f) =>
    f.highlight ? { ...f, value: indicators.fearGreed } : f,
  );

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
    cycleOnchain: d.onchain.cycle,
    liquidity: d.liquidity,
    network: d.network,
    bitcoin,
    global,
    indicators,
    halvingInfo,
    halvings,
    cyclePrices,
    cycleComparison: MOCK_CYCLE_COMPARISON,
    drawdowns,
    yearlyLows: MOCK_YEARLY_LOWS,
    smartMoney: sm.smartMoney,
    whaleTimeline: sm.whaleTimeline,
    rsiBottoms,
    fearGreedHistory,
    etf,
    macro,
    fase,
    opportunity,
    source,
    lastUpdated: new Date().toISOString(),
  };
}
