import type {
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
  Frescura,
} from '@/types';
import type { DashboardResponse } from '@/types/dashboard';
import type { SourceMeta } from '@/types/api';
import type { MacroSeries } from '@/types/macro';
import { getHalvingCycleInfo, detectPhase } from '@/services/cycleDetector';
import { computeOpportunityScore } from '@/lib/score/opportunityScore';
import { scoreSourcesFrom } from '@/lib/score/sources';
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


// --- Macro ---------------------------------------------------------------------

/**
 * Lectura de cada indicador para el contexto que importa aquí: ¿favorece o
 * perjudica a los activos de riesgo? Usa el valor Y su tendencia, porque para
 * Bitcoin pesa más hacia dónde va la liquidez que su nivel exacto.
 */
export function macroEstado(s: MacroSeries): MacroIndicator['estado'] {
  const t = s.trend;
  switch (s.id) {
    case 'liquidez':
      return s.value < 0 ? 'negativo' : t === 'baja' ? 'neutral' : 'positivo';
    case 'liquidez-fed':
      return t === 'sube' ? 'positivo' : t === 'baja' ? 'negativo' : 'neutral';
    case 'fedfunds':
      return (s.change ?? 0) < -0.05 || t === 'baja'
        ? 'positivo'
        : (s.change ?? 0) > 0.05 || t === 'sube'
          ? 'negativo'
          : 'neutral';
    case 'inflacion':
      return s.value < 3 ? 'positivo' : s.value < 4 ? 'neutral' : 'negativo';
    case 'tipo-real':
    case 'dolar':
    case 'desempleo':
      // Que suban perjudica: tipo real más alto, dólar más fuerte, más paro.
      return t === 'baja' ? 'positivo' : t === 'sube' ? 'negativo' : 'neutral';
    case 'spread':
      return s.value < 0 ? 'negativo' : 'positivo';
    case 'actividad':
      return s.value > 0 ? 'positivo' : s.value < -0.7 ? 'negativo' : 'neutral';
    case 'manufactura':
      return s.value > 5 ? 'positivo' : s.value < -5 ? 'negativo' : 'neutral';
    case 'condiciones':
      return s.value < 0 ? 'positivo' : 'negativo';
    case 'high-yield':
      return t === 'sube' || s.value > 6 ? 'negativo' : s.value < 4 ? 'positivo' : 'neutral';
    case 'vix':
      return s.value < 20 ? 'positivo' : s.value > 30 ? 'negativo' : 'neutral';
    default:
      return 'neutral';
  }
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

/** Valor en su unidad: lo decide el formato que declara el backend. */
export function macroValor(format: MacroSeries['format'], v: number): string {
  switch (format) {
    case 'pct':
      return `${formatNumberEs(v, 2)}%`;
    case 'pp':
      return `${sign(v)}${formatNumberEs(Math.abs(v), 2)} pp`;
    case 'difusion':
      return `${sign(v)}${formatNumberEs(Math.abs(v), 2)}`;
    case 'usd-bn':
      // En miles de millones, la escala del resto de la app («mil M»); la
      // unidad viaja aparte para que la cifra quepa en una línea.
      return formatNumberEs(v, 0);
    default:
      return formatNumberEs(v, v >= 100 ? 1 : 2);
  }
}

/** Variación con signo, en la unidad que corresponde a cada formato. */
function macroCambio(format: MacroSeries['format'], v: number): string {
  const abs = Math.abs(v);
  switch (format) {
    case 'pct':
    case 'pp':
      return `${sign(v)}${formatNumberEs(abs, 2)} pp`;
    case 'usd-bn':
      return `${sign(v)}${formatNumberEs(abs, 0)} mil M$`;
    default:
      return `${sign(v)}${formatNumberEs(abs, 2)}`;
  }
}

function buildMacro(macro: DashboardResponse['macro']): MacroSnapshot {
  const series = macro?.series ?? [];
  const faltan = (macro?.missing ?? []).map((m) => ({ id: m.id, nombre: m.label }));
  if (series.length === 0) {
    // Sin FRED configurado o caído: no hay tablero. No se rellena con un
    // cuadro de ejemplo, que era lo que se hacía antes.
    return { chart: null, indicadores: [], indicadoresLive: false, faltan, actualizado: new Date().toISOString() };
  }

  // `?? …` en los campos nuevos: durante un despliegue la caché del CDN puede
  // servir unos minutos la respuesta con el formato anterior, sin grupo ni
  // minigráfica. Mejor una ficha menos completa que una pantalla rota.
  const indicadores: MacroIndicator[] = series.map((s) => ({
    id: s.id,
    nombre: s.label,
    grupo: s.group ?? 'condiciones',
    valor: macroValor(s.format, s.value),
    valorUnidad: s.format === 'usd-bn' ? 'mil M$' : null,
    unidad: s.unit ?? '',
    estado: macroEstado(s),
    anterior:
      s.previous == null
        ? null
        : `${macroValor(s.format, s.previous)}${s.format === 'usd-bn' ? ' mil M$' : ''}`,
    anteriorFecha: s.previousAt ?? null,
    cambio: s.change == null ? null : macroCambio(s.format, s.change),
    cambioSigno: s.change == null || s.change === 0 ? 0 : s.change > 0 ? 1 : -1,
    cambioLabel: s.changeLabel ?? '',
    tendencia: s.trend ?? null,
    spark: s.spark ?? [],
    fecha: s.observedAt,
    frecuencia: s.frequency,
    cadencia: s.cadence ?? '',
    consultado: s.fetchedAt ?? new Date().toISOString(),
    descripcion: s.definicion,
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

  // La consulta más antigua manda: el bloque nunca parece más reciente que su
  // dato más viejo.
  const consultas = series.map((s) => Date.parse(s.fetchedAt)).filter(Number.isFinite);
  const actualizado = new Date(consultas.length ? Math.min(...consultas) : Date.now()).toISOString();
  return { chart, indicadores, indicadoresLive: true, faltan, actualizado };
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
    // `?? false`: un backend anterior no manda estos campos.
    actual: r.current ?? false,
    halvingEstimado: r.halvingEstimated ?? false,
    mismoPunto: r.sameDay
      ? {
          dias: r.sameDay.days,
          fecha: r.sameDay.date,
          precio: r.sameDay.price,
          desdeHalvingPct: r.sameDay.fromHalvingPct,
          desdeTechoPct: r.sameDay.fromPeakPct,
        }
      : null,
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

/** Frescura de la primera fuente cuyo proveedor cumpla `match`. */
function frescuraDe(sources: SourceMeta[], match: (provider: string) => boolean): Frescura | null {
  const meta = sources.find((m) => match(m.provider));
  if (!meta || meta.status === 'unavailable' || meta.status === 'locked') return null;
  return { at: meta.fetchedAt, reserva: meta.status === 'stale' };
}

const PROVEEDORES_PRECIO = ['coingecko', 'coinpaprika', 'kraken'];

export function buildMarketData(d: DashboardResponse, sources: SourceMeta[] = []): MarketData | null {
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
  const opportunity = computeOpportunityScore(scoreSourcesFrom(d));

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
    drawdowns,
    yearlyLows,
    whaleTimeline,
    whaleFlow: d.onchain.flow
      ? {
          observedAt: d.onchain.flow.observedAt,
          source: d.onchain.flow.source ?? 'blockchain.com:flow',
          reserva: frescuraDe(sources, (p) => p.endsWith(':flow'))?.reserva ?? false,
        }
      : null,
    rsiBottoms,
    fearGreedHistory,
    macro,
    fase,
    opportunity,
    source,
    frescura: {
      mercado: frescuraDe(sources, (p) => PROVEEDORES_PRECIO.includes(p)),
      derivados: frescuraDe(sources, (p) => p.startsWith('derivados')),
      macro: frescuraDe(sources, (p) => p === 'fred'),
    },
    lastUpdated: new Date().toISOString(),
  };
}
