import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import { getDailySeries } from './dailySeries.js';
import type { DailyClose } from './coinmetrics.js';
import { rsiSeries } from '../../../src/lib/indicators.js';

// =============================================================================
// Series HISTÓRICAS derivadas de la serie diaria real.
//
// Antes eran constantes escritas a mano en el front (`mockData.ts`): suelos
// anuales redondeados, caídas aproximadas, comparativa de ciclos y suelos de
// RSI con rendimientos «de memoria». Se pintaban igual que los datos vivos, así
// que no había forma de distinguir un hecho de una estimación de sobremesa.
//
// Aquí se calculan todas desde los mismos cierres diarios, con reglas
// explícitas, y viajan con la fecha del último cierre usado. Lo que no se puede
// calcular queda a null.
//
// Ciclos: se delimitan por los TECHOS de la serie, no por fechas fijas. Un
// techo es el máximo entre dos suelos y un suelo el mínimo entre dos techos;
// para que un movimiento cuente como cambio de ciclo tiene que superar el
// umbral de swing, que descarta el ruido de un mercado que cae un 20% cada
// pocos meses sin cambiar de fase.
// =============================================================================

/** Caída mínima desde un techo para considerar que el ciclo ha terminado. */
const SWING_DROP = 0.5; // −50%
/** Subida mínima desde un suelo para considerar que hay un ciclo nuevo. */
const SWING_RISE = 3; // ×4 (+300%)

export interface CyclePhasePoint {
  /** Etiqueta legible: «2013 Pico», «2015 Suelo», «Actual». */
  label: string;
  price: number;
  /** Fecha del cierre (ISO UTC). */
  at: string;
  kind: 'pico' | 'suelo' | 'actual';
}

export interface CycleRange {
  label: string;
  low: number;
  lowAt: string;
  high: number;
  highAt: string;
  /** Revalorización suelo → techo, en %. */
  growthPct: number;
  /** `true` si el ciclo sigue abierto: el techo todavía puede subir. */
  open: boolean;
}

export interface DrawdownRecord {
  /** Periodo del desplome: «2021-22». */
  period: string;
  /** Caída techo → suelo, en % (negativo). */
  drawdownPct: number;
  /** Rally suelo → techo siguiente, en %. `null` si aún no ha ocurrido. */
  recoveryPct: number | null;
  current: boolean;
}

export interface YearlyLowRecord {
  year: string;
  low: number;
}

export interface RsiBottomRecord {
  /** Mes y año del suelo de RSI: «mar 2020». */
  label: string;
  rsi: number;
  /** Rendimiento del precio en el año siguiente, en %. `null` si no ha pasado. */
  return1yPct: number | null;
  current: boolean;
}

export interface HistoryData {
  cyclePoints: CyclePhasePoint[];
  cycles: CycleRange[];
  drawdowns: DrawdownRecord[];
  yearlyLows: YearlyLowRecord[];
  rsiBottoms: RsiBottomRecord[];
  /** Último cierre de la serie con que se calculó todo (ISO UTC). */
  observedAt: string;
  source: string;
}

const pct = (from: number, to: number): number => Math.round((to / from - 1) * 100);
const year = (day: string): string => day.slice(0, 4);
const iso = (day: string): string => `${day}T00:00:00.000Z`;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthYear = (day: string): string => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${year(day)}`;

interface Swing {
  index: number;
  point: DailyClose;
  kind: 'pico' | 'suelo';
}

/**
 * Techos y suelos alternos de la serie (zigzag por umbral). Recorre los cierres
 * manteniendo el extremo provisional y lo confirma cuando el precio se aleja lo
 * suficiente en sentido contrario.
 */
export function detectSwings(series: DailyClose[]): Swing[] {
  if (series.length === 0) return [];

  const swings: Swing[] = [];
  let looking: 'pico' | 'suelo' = 'pico';
  let extremeIndex = 0;

  for (let i = 1; i < series.length; i++) {
    const price = series[i]!.price;
    const extreme = series[extremeIndex]!.price;

    if (looking === 'pico') {
      if (price > extreme) {
        extremeIndex = i;
      } else if (price <= extreme * (1 - SWING_DROP)) {
        swings.push({ index: extremeIndex, point: series[extremeIndex]!, kind: 'pico' });
        looking = 'suelo';
        extremeIndex = i;
      }
    } else {
      if (price < extreme) {
        extremeIndex = i;
      } else if (price >= extreme * (1 + SWING_RISE)) {
        swings.push({ index: extremeIndex, point: series[extremeIndex]!, kind: 'suelo' });
        looking = 'pico';
        extremeIndex = i;
      }
    }
  }

  // El extremo en curso todavía no está confirmado, pero es el que da la caída
  // actual o el techo vigente: se añade marcado por su tipo.
  swings.push({ index: extremeIndex, point: series[extremeIndex]!, kind: looking });
  return swings;
}

/** Suelo de cada año natural, de los últimos `years` años. */
function yearlyLows(series: DailyClose[], years = 10): YearlyLowRecord[] {
  const byYear = new Map<string, number>();
  for (const p of series) {
    const y = year(p.day);
    const current = byYear.get(y);
    if (current == null || p.price < current) byYear.set(y, p.price);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-years)
    .map(([y, low]) => ({ year: y, low: Number(low.toFixed(low < 100 ? 2 : 0)) }));
}

/** Caída de cada techo al suelo siguiente, y el rally posterior si lo hubo. */
function drawdowns(swings: Swing[], last: DailyClose): DrawdownRecord[] {
  const out: DrawdownRecord[] = [];
  for (let i = 0; i < swings.length; i++) {
    const peak = swings[i]!;
    if (peak.kind !== 'pico') continue;
    const low = swings[i + 1];
    const nextPeak = swings[i + 2];

    if (!low) {
      // Techo sin suelo posterior: o es el máximo vigente, o estamos cayendo
      // desde él sin haber alcanzado todavía el umbral que cierra el ciclo.
      if (last.price < peak.point.price) {
        out.push({
          period: 'Actual',
          drawdownPct: pct(peak.point.price, last.price),
          recoveryPct: null,
          current: true,
        });
      }
      continue;
    }

    const current = i + 1 === swings.length - 1;
    const from = year(peak.point.day);
    const to = year(low.point.day);
    out.push({
      period: current ? 'Actual' : from === to ? from : `${from}-${to.slice(2)}`,
      drawdownPct: pct(peak.point.price, low.point.price),
      recoveryPct: nextPeak ? pct(low.point.price, nextPeak.point.price) : null,
      current,
    });
  }
  return out;
}

/** Ciclos suelo → techo, uno por cada pareja confirmada. */
function cycles(swings: Swing[]): CycleRange[] {
  const out: CycleRange[] = [];
  for (let i = 0; i < swings.length; i++) {
    const low = swings[i]!;
    if (low.kind !== 'suelo') continue;
    const high = swings[i + 1];
    if (!high) continue;
    const open = i + 1 === swings.length - 1;
    out.push({
      label: `${year(low.point.day)}-${year(high.point.day).slice(2)}`,
      low: Number(low.point.price.toFixed(low.point.price < 100 ? 2 : 0)),
      lowAt: iso(low.point.day),
      high: Number(high.point.price.toFixed(high.point.price < 100 ? 2 : 0)),
      highAt: iso(high.point.day),
      growthPct: pct(low.point.price, high.point.price),
      open,
    });
  }
  return out;
}

/** Los mismos extremos, en forma de recorrido para el gráfico de ciclos. */
function cyclePoints(swings: Swing[], last: DailyClose): CyclePhasePoint[] {
  const points: CyclePhasePoint[] = swings.map((s) => ({
    label: `${year(s.point.day)} ${s.kind === 'pico' ? 'Pico' : 'Suelo'}`,
    price: Number(s.point.price.toFixed(s.point.price < 100 ? 2 : 0)),
    at: iso(s.point.day),
    kind: s.kind,
  }));
  // El último cierre solo se añade si no es ya el extremo en curso.
  if (points[points.length - 1]?.at !== iso(last.day)) {
    points.push({
      label: 'Actual',
      price: Number(last.price.toFixed(0)),
      at: iso(last.day),
      kind: 'actual',
    });
  } else {
    points[points.length - 1]!.label = 'Actual';
    points[points.length - 1]!.kind = 'actual';
  }
  return points;
}

/**
 * Suelos de momentum: mínimos del RSI por debajo del umbral, separados entre sí
 * al menos medio año para no contar tres veces la misma capitulación, con el
 * rendimiento del año siguiente medido sobre la serie.
 */
function rsiBottoms(series: DailyClose[], threshold = 30, gapDays = 180): RsiBottomRecord[] {
  const closes = series.map((p) => p.price);
  const values = rsiSeries(closes, 14);

  const candidates: { index: number; rsi: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || v > threshold) continue;
    const last = candidates[candidates.length - 1];
    if (last && series[i]!.t - series[last.index]!.t < gapDays * 86_400_000) {
      // Dentro de la misma ventana: nos quedamos con el mínimo.
      if (v < last.rsi) candidates[candidates.length - 1] = { index: i, rsi: v };
      continue;
    }
    candidates.push({ index: i, rsi: v });
  }

  const lastT = series[series.length - 1]!.t;
  return candidates.map(({ index, rsi }) => {
    const at = series[index]!;
    const targetT = at.t + 365 * 86_400_000;
    const future = targetT <= lastT ? series.find((p) => p.t >= targetT) : undefined;
    return {
      label: monthYear(at.day),
      rsi,
      return1yPct: future ? pct(at.price, future.price) : null,
      current: lastT - at.t < gapDays * 86_400_000,
    };
  });
}

export function deriveHistory(series: DailyClose[], source: string): HistoryData {
  const swings = detectSwings(series);
  const last = series[series.length - 1]!;
  return {
    cyclePoints: cyclePoints(swings, last),
    cycles: cycles(swings),
    drawdowns: drawdowns(swings, last),
    yearlyLows: yearlyLows(series),
    rsiBottoms: rsiBottoms(series),
    observedAt: iso(last.day),
    source,
  };
}

export async function getHistory(): Promise<ProviderResult<HistoryData>> {
  const r = await swr('history:v1', { ttlMs: 12 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 }, async () => {
    const series = await getDailySeries();
    return deriveHistory(series.points, series.source);
  });
  return {
    data: r.value,
    meta: metaFromCache(`historico:${r.value.source}`, r.status, r.storedAt, {
      observedAt: r.value.observedAt,
    }),
  };
}
