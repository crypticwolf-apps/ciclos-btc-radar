// =============================================================================
// Indicadores técnicos: matemática PURA sobre series de cierres diarios.
// -----------------------------------------------------------------------------
// Este módulo no toca red, DOM ni almacenamiento, así que lo comparten el
// backend (que lo ejecuta una vez sobre el histórico completo y cachea el
// resultado) y los tests. El cliente NO recalcula las series largas en cada
// tick de precio: solo recalcula las distancias contra el precio vivo, que son
// operaciones O(1).
// =============================================================================

/** Media móvil simple de los últimos `period` valores. `null` si no hay datos. */
export function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i]!;
  return sum / period;
}

/** RSI clásico de Wilder. Devuelve 0-100. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}

/**
 * Volatilidad realizada ANUALIZADA (%) a partir de la desviación típica de los
 * rendimientos logarítmicos diarios de la ventana indicada.
 */
export function realizedVolatility(closes: number[], window = 30): number | null {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1));
  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1]!;
    const cur = slice[i]!;
    if (prev <= 0 || cur <= 0) continue;
    logReturns.push(Math.log(cur / prev));
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return Number((Math.sqrt(variance) * Math.sqrt(365) * 100).toFixed(1));
}

/** Rendimiento porcentual frente al cierre de hace `days` días. */
export function returnOver(closes: number[], days: number): number | null {
  if (closes.length <= days) return null;
  const past = closes[closes.length - 1 - days]!;
  const now = closes[closes.length - 1]!;
  if (past <= 0) return null;
  return Number((((now - past) / past) * 100).toFixed(1));
}

/** Distancia porcentual del precio a una referencia (media, ATH…). */
export function distancePct(price: number, reference: number | null): number | null {
  if (reference == null || reference <= 0 || !Number.isFinite(price)) return null;
  return Number((((price - reference) / reference) * 100).toFixed(1));
}

export type MaCross = 'golden' | 'death' | 'ninguno';

/**
 * Cruce entre la media de 50 y la de 200 días.
 *   'golden' → la de 50 está por encima (estructura alcista)
 *   'death'  → la de 50 está por debajo (estructura bajista)
 */
export function maCross(sma50: number | null, sma200: number | null): MaCross {
  if (sma50 == null || sma200 == null) return 'ninguno';
  return sma50 > sma200 ? 'golden' : 'death';
}

/** Posición del precio dentro de un rango, 0 = mínimo, 100 = máximo. */
export function positionInRange(price: number, min: number, max: number): number | null {
  if (!Number.isFinite(price) || max <= min) return null;
  const pct = ((price - min) / (max - min)) * 100;
  return Number(Math.max(0, Math.min(100, pct)).toFixed(1));
}

export type TrendLabel = 'alcista' | 'bajista' | 'lateral';

/** Tendencia según la distancia del precio a su media de 30 días (umbral ±3%). */
export function trendFrom(closes: number[]): TrendLabel {
  const avg = sma(closes, 30);
  if (avg == null) return 'lateral';
  const last = closes[closes.length - 1]!;
  const diff = (last - avg) / avg;
  if (diff > 0.03) return 'alcista';
  if (diff < -0.03) return 'bajista';
  return 'lateral';
}

// --- Halving ----------------------------------------------------------------

export const HALVING_INTERVAL_BLOCKS = 210_000;

/**
 * Halvings ya ocurridos. Altura de bloque, momento exacto en que se minó ese
 * bloque (UTC) y recompensa resultante: son hechos verificables en la propia
 * cadena, no estimaciones, por eso viven como constantes.
 *
 * Los PRECIOS asociados a cada halving NO se guardan aquí: se derivan de la
 * serie histórica real (ver `getHalvingHistory` en el proveedor de Coin
 * Metrics), para que sean auditables y no queden nunca desfasados.
 */
export interface HalvingFact {
  year: string;
  /** Momento exacto en que se minó el bloque del halving (ISO UTC). */
  at: string;
  block: number;
  /** Recompensa por bloque A PARTIR de ese halving. */
  reward: string;
}

export const HALVING_FACTS: readonly HalvingFact[] = [
  { year: '2012', at: '2012-11-28T15:24:38Z', block: 210_000, reward: '25 BTC' },
  { year: '2016', at: '2016-07-09T16:46:13Z', block: 420_000, reward: '12,5 BTC' },
  { year: '2020', at: '2020-05-11T19:23:43Z', block: 630_000, reward: '6,25 BTC' },
  { year: '2024', at: '2024-04-20T00:09:27Z', block: 840_000, reward: '3,125 BTC' },
] as const;

/** Fechas reales (UTC) de los halvings ya ocurridos. */
export const HALVING_DATES = HALVING_FACTS.map((h) => h.at);

/** Meses tras el halving en los que históricamente se ha buscado el pico. */
export const HALVING_PEAK_WINDOW_MONTHS = 18;

export interface HalvingTiming {
  daysSinceLast: number;
  lastHalvingDate: string;
  /** Progreso 0-1 dentro del ciclo de 4 años, por tiempo transcurrido. */
  cycleProgress: number;
}

/** Días desde el último halving y progreso temporal del ciclo. */
export function halvingTiming(nowMs: number = Date.now()): HalvingTiming {
  const past = HALVING_DATES.filter((d) => Date.parse(d) <= nowMs);
  const lastHalvingDate = past[past.length - 1] ?? HALVING_DATES[HALVING_DATES.length - 1];
  const elapsedMs = nowMs - Date.parse(lastHalvingDate);
  // Un ciclo nominal son 210.000 bloques × 10 min ≈ 1458 días.
  const cycleMs = HALVING_INTERVAL_BLOCKS * 10 * 60_000;
  return {
    daysSinceLast: Math.max(0, Math.round(elapsedMs / 86_400_000)),
    lastHalvingDate,
    cycleProgress: Number(Math.max(0, Math.min(1, elapsedMs / cycleMs)).toFixed(4)),
  };
}

// --- Paquete completo de técnicos -------------------------------------------

export interface Technicals {
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  /** Media de 200 SEMANAS (1400 cierres diarios): suelo histórico del ciclo. */
  sma200w: number | null;
  cross: MaCross;
  volatility30d: number | null;
  return7d: number | null;
  return30d: number | null;
  return90d: number | null;
  return365d: number | null;
  trend: TrendLabel;
  /** Mínimo y máximo del ciclo actual (desde el último halving). */
  cycleLow: number | null;
  cycleHigh: number | null;
  minYear: number | null;
  maxYear: number | null;
  /** Nº de cierres diarios usados en el cálculo. */
  samples: number;
}

/**
 * Calcula todos los indicadores de una serie de cierres diarios ordenada de
 * más antiguo a más reciente. Pensado para ejecutarse UNA vez por refresco del
 * histórico (no en cada tick de precio).
 */
export function computeTechnicals(
  closes: number[],
  opts: { cycleStartIndex?: number } = {},
): Technicals {
  const cycleSlice =
    opts.cycleStartIndex != null && opts.cycleStartIndex < closes.length
      ? closes.slice(opts.cycleStartIndex)
      : [];
  const yearSlice = closes.slice(-365);

  return {
    rsi14: rsi(closes),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    sma200w: sma(closes, 1400),
    cross: maCross(sma(closes, 50), sma(closes, 200)),
    volatility30d: realizedVolatility(closes, 30),
    return7d: returnOver(closes, 7),
    return30d: returnOver(closes, 30),
    return90d: returnOver(closes, 90),
    return365d: returnOver(closes, 365),
    trend: trendFrom(closes),
    cycleLow: cycleSlice.length > 0 ? Math.min(...cycleSlice) : null,
    cycleHigh: cycleSlice.length > 0 ? Math.max(...cycleSlice) : null,
    minYear: yearSlice.length > 0 ? Math.min(...yearSlice) : null,
    maxYear: yearSlice.length > 0 ? Math.max(...yearSlice) : null,
    samples: closes.length,
  };
}
