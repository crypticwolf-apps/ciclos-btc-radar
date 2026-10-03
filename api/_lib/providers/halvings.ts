import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import type { DailyClose } from './coinmetrics.js';
import { getDailySeries } from './dailySeries.js';
import { getHalvingProgress } from './mempool.js';
import { HALVING_FACTS, HALVING_PEAK_WINDOW_MONTHS } from '../../../src/lib/indicators.js';

// =============================================================================
// Histórico de ciclos de halving, derivado de la serie diaria REAL, con cadena
// de respaldo de proveedores.
//
// Antes vivía dentro del proveedor de Coin Metrics, que era su única fuente: si
// la API no respondía —y las APIs cripto bloquean a los centros de datos con
// más facilidad de la que parece— la tabla de halvings se quedaba vacía pese a
// que el dato que necesita, cierres diarios desde 2010, lo sirven varios sitios.
//
// La serie y su cadena de respaldo viven en `dailySeries.ts`, compartidas con
// el resto de series históricas. Aquí queda solo el cálculo.
// =============================================================================

export interface HalvingRecord {
  year: string;
  /** Momento exacto en que se minó el bloque del halving (ISO UTC). */
  at: string;
  block: number;
  reward: string;
  /** Suelo del ciclo: mínimo del mercado bajista PREVIO al halving. */
  cycleLow: number | null;
  cycleLowDate: string | null;
  /** Cierre del día del halving. */
  priceAtHalving: number | null;
  /** Techo del ciclo: máximo en los 18 meses POSTERIORES al halving. */
  cyclePeak: number | null;
  cyclePeakDate: string | null;
  /** Revalorización del suelo del ciclo hasta su techo, en %. */
  lowToPeakPct: number | null;
  /** `true` si la ventana del techo sigue abierta: el pico puede subir aún. */
  cycleOpen: boolean;
  /**
   * `true` en el ciclo que se está viviendo AHORA: el que empezó al cerrarse
   * el techo anterior y culminará en el próximo halving. Su suelo es
   * provisional (puede bajar todavía) y su halving, una estimación.
   */
  current: boolean;
  /** `true` si la fecha del halving es una estimación por altura de bloque. */
  halvingEstimated: boolean;
  /**
   * Cómo iba este ciclo a los MISMOS días de su halving que lleva el actual:
   * la comparación justa entre ciclos («a 900 días del halving, ¿dónde
   * estaba cada uno?»). En el ciclo vigente es el dato de hoy. `null` en el
   * ciclo cuyo halving aún no ha llegado.
   */
  sameDay: SameDayPoint | null;
}

export interface SameDayPoint {
  /** Días transcurridos desde el halving (los mismos para todos los ciclos). */
  days: number;
  date: string;
  price: number;
  /** Variación desde el precio del día del halving, en %. */
  fromHalvingPct: number | null;
  /** Distancia a su techo, en %, si el techo ya había ocurrido ese día. */
  fromPeakPct: number | null;
}

/** Bloques entre halvings y segundos objetivo por bloque. */
const BLOCKS_PER_HALVING = 210_000;
const TARGET_BLOCK_SECONDS = 600;

/** Recompensa por bloque tras el halving n.º `n` (1 = 2012): 50 / 2^n. */
function rewardAfter(n: number): string {
  return `${(50 / 2 ** n).toLocaleString('es-ES', { maximumFractionDigits: 8 })} BTC`;
}

/** Suma meses a una fecha ISO, ajustando el día si el mes es más corto. */
function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 0, 0, 0),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString();
}

/**
 * Ciclos de halving con suelo, precio en el halving, techo y revalorización,
 * todo calculado sobre la serie diaria que se le pase.
 *
 * Definiciones (las dos importan, porque una mal elegida contamina el dato):
 *
 *   TECHO del ciclo = máximo en los 18 meses POSTERIORES al halving.
 *     Acotar la ventana es imprescindible. Si se tomara «el máximo hasta el
 *     siguiente halving», el ciclo de 2020 se quedaría con el rally de marzo de
 *     2024 (73.081 $) en lugar de con su techo real de noviembre de 2021
 *     (67.542 $): el mercado ya había arrancado el ciclo siguiente.
 *
 *   SUELO del ciclo = mínimo entre el TECHO ANTERIOR y este halving.
 *     Es el fondo del mercado bajista que precede al halving. No sirve empezar
 *     a mirar desde el halving anterior: desde ahí el precio solo subió, así
 *     que el mínimo saldría siendo el propio precio del halving anterior.
 *
 * Los cuatro suelos que produce (2,11 $ en 2011, 175,64 $ en 2015, 3.185 $ en
 * 2018 y 15.758 $ en 2022) son los fondos históricos conocidos.
 */
export function deriveHalvings(
  series: DailyClose[],
  /** Fecha estimada del próximo halving (por altura de bloque), si se conoce. */
  nextHalvingAt: string | null = null,
): HalvingRecord[] {
  if (series.length < 500) throw new Error('serie de precio insuficiente para los halvings');

  const lastT = series[series.length - 1]!.t;
  const iso = (day: string) => `${day}T00:00:00.000Z`;

  /** Primer cierre disponible en o después de una fecha. */
  const priceOn = (at: number): number | null => series.find((p) => p.t >= at)?.price ?? null;

  /** Extremo (máximo o mínimo) de una ventana [from, to] de la serie. */
  const extreme = (from: number, to: number, kind: 'max' | 'min') => {
    let best: { day: string; price: number } | null = null;
    for (const point of series) {
      if (point.t < from || point.t > to) continue;
      if (!best || (kind === 'max' ? point.price > best.price : point.price < best.price)) {
        best = { day: point.day, price: point.price };
      }
    }
    return best;
  };

  // Paso 1: techo de cada ciclo, dentro de su ventana de 18 meses.
  // La serie se indexa por DÍA (marca 00:00Z) y el halving ocurre a media
  // tarde: hay que truncar a su día, o se descartaría el cierre de esa misma
  // jornada y se tomaría el del día siguiente.
  const peaks = HALVING_FACTS.map((fact) => {
    const halvingDay = Date.parse(iso(fact.at.slice(0, 10)));
    const windowEnd = Date.parse(addMonths(iso(fact.at.slice(0, 10)), HALVING_PEAK_WINDOW_MONTHS));
    return { halvingDay, windowEnd, peak: extreme(halvingDay, windowEnd, 'max') };
  });

  // Paso 2: suelo de cada ciclo, entre el techo anterior y el halving.
  // Para el primero no hay techo previo calculado: se usa el máximo anterior
  // al halving, que es el pico de 2011.
  let previousPeakT: number | null = null;

  const past = HALVING_FACTS.map((fact, i): HalvingRecord => {
    const { halvingDay, windowEnd, peak } = peaks[i]!;

    if (previousPeakT == null) {
      const before = extreme(series[0]!.t, halvingDay, 'max');
      previousPeakT = before ? Date.parse(iso(before.day)) : series[0]!.t;
    }

    const low = extreme(previousPeakT, halvingDay, 'min');
    const priceAtHalving = priceOn(halvingDay);
    if (peak) previousPeakT = Date.parse(iso(peak.day));

    return {
      year: fact.year,
      at: fact.at,
      block: fact.block,
      reward: fact.reward,
      cycleLow: low ? Number(low.price.toFixed(2)) : null,
      cycleLowDate: low ? iso(low.day) : null,
      priceAtHalving: priceAtHalving == null ? null : Number(priceAtHalving.toFixed(2)),
      cyclePeak: peak ? Number(peak.price.toFixed(2)) : null,
      cyclePeakDate: peak ? iso(peak.day) : null,
      lowToPeakPct:
        peak && low && low.price > 0 ? Math.round((peak.price / low.price - 1) * 100) : null,
      // Mientras la ventana no se cierre, el techo aún puede subir.
      cycleOpen: windowEnd > lastT,
      current: false,
      halvingEstimated: false,
      sameDay: null,
    };
  });

  // Paso 2b: mismo punto del ciclo. Se mide cada ciclo a los días que lleva
  // el último halving ocurrido; para ese último, el «mismo día» es hoy.
  const lastHalvingDay = Date.parse(iso(HALVING_FACTS[HALVING_FACTS.length - 1]!.at.slice(0, 10)));
  const days = Math.floor((lastT - lastHalvingDay) / 86_400_000);
  if (days >= 0) {
    past.forEach((record, i) => {
      const halvingDay = peaks[i]!.halvingDay;
      const target = halvingDay + days * 86_400_000;
      if (target > lastT) return;
      const point = series.find((p) => p.t >= target);
      if (!point) return;
      const peak = peaks[i]!.peak;
      const peakT = peak ? Date.parse(iso(peak.day)) : null;
      record.sameDay = {
        days,
        date: iso(point.day),
        price: Number(point.price.toFixed(2)),
        fromHalvingPct:
          record.priceAtHalving && record.priceAtHalving > 0
            ? Math.round((point.price / record.priceAtHalving - 1) * 100)
            : null,
        fromPeakPct:
          peak && peakT != null && peakT <= point.t
            ? Math.round((point.price / peak.price - 1) * 100)
            : null,
      };
    });
  }

  // Paso 3: el ciclo EN CURSO.
  //
  // Cuando el techo del último ciclo ya no puede subir (su ventana se cerró),
  // ese ciclo está terminado y el mercado vive ya el siguiente: el que va del
  // techo anterior al próximo halving. Se añade con lo que se sabe hoy y nada
  // más:
  //   · suelo PROVISIONAL = mínimo desde aquel techo hasta el último cierre,
  //     con la misma definición que los demás suelos (puede bajar todavía);
  //   · halving = fecha ESTIMADA por altura de bloque; su precio, por llegar;
  //   · techo, revalorización y sus fechas: por determinar (null).
  const last = past[past.length - 1];
  if (last && !last.cycleOpen && previousPeakT != null) {
    const low = extreme(previousPeakT, lastT, 'min');
    const lastFact = HALVING_FACTS[HALVING_FACTS.length - 1]!;
    const estimate =
      nextHalvingAt ??
      new Date(Date.parse(lastFact.at) + BLOCKS_PER_HALVING * TARGET_BLOCK_SECONDS * 1000).toISOString();
    past.push({
      year: estimate.slice(0, 4),
      at: estimate,
      block: lastFact.block + BLOCKS_PER_HALVING,
      reward: rewardAfter(HALVING_FACTS.length + 1),
      cycleLow: low ? Number(low.price.toFixed(2)) : null,
      cycleLowDate: low ? iso(low.day) : null,
      priceAtHalving: null,
      cyclePeak: null,
      cyclePeakDate: null,
      lowToPeakPct: null,
      cycleOpen: true,
      current: true,
      halvingEstimated: true,
      sameDay: null,
    });
  } else if (last) {
    // La ventana del techo sigue abierta: el ciclo vigente es este.
    last.current = true;
  }

  return past;
}

export async function getHalvingHistory(): Promise<ProviderResult<HalvingRecord[]>> {
  // 3 h: el suelo provisional del ciclo en curso puede moverse con cada cierre
  // diario, y la fecha estimada del halving, con cada bloque.
  const r = await swr(
    'halvings:v6',
    { ttlMs: 3 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 },
    async () => {
      const [series, progress] = await Promise.all([
        getDailySeries(),
        // Sin altura de bloque se estima con 10 min por bloque; la fila lo
        // marca igualmente como estimación.
        getHalvingProgress().catch(() => null),
      ]);
      return {
        records: deriveHalvings(series.points, progress?.data.estimatedDate ?? null),
        source: series.source,
      };
    },
  );

  return {
    data: r.value.records,
    meta: metaFromCache(`halvings:${r.value.source}`, r.status, r.storedAt),
  };
}
