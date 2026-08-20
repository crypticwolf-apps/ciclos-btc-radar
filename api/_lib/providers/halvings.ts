import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import { getDailyCloses, type DailyClose } from './coinmetrics.js';
import { getPriceHistory } from './coingecko.js';
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
// Cadena:
//   1º Coin Metrics  → serie diaria completa en una sola petición.
//   2º Serie MAX del proveedor de precio (Blockchain.com → CryptoCompare →
//      CoinGecko → Kraken, ver `getPriceHistory`), que ya tiene su propio
//      respaldo interno.
//
// El cálculo es el mismo en ambos casos: solo cambia de dónde salen los cierres.
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
export function deriveHalvings(series: DailyClose[]): HalvingRecord[] {
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

  return HALVING_FACTS.map((fact, i): HalvingRecord => {
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
    };
  });
}

/**
 * Serie MAX del proveedor de precio, reducida a un cierre por día (el último
 * de cada jornada). Coin Metrics ya entrega un punto diario; los proveedores de
 * respaldo pueden dar varios, y dos puntos del mismo día falsearían los
 * extremos.
 */
async function seriesFromPriceHistory(): Promise<DailyClose[]> {
  const history = await getPriceHistory('max');
  const byDay = new Map<string, DailyClose>();
  for (const point of history.data) {
    if (!Number.isFinite(point.t) || !(point.price > 0)) continue;
    const day = new Date(point.t).toISOString().slice(0, 10);
    byDay.set(day, { t: Date.parse(`${day}T00:00:00.000Z`), day, price: point.price });
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}

export async function getHalvingHistory(): Promise<ProviderResult<HalvingRecord[]>> {
  const r = await swr(
    'halvings:v3',
    { ttlMs: 12 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 },
    async () => {
      const errors: string[] = [];
      // Desde 2010: hace falta el techo de 2011 para situar el suelo del ciclo
      // de 2012.
      const attempts: { source: string; run: () => Promise<DailyClose[]> }[] = [
        { source: 'coinmetrics:halvings', run: () => getDailyCloses('2010-07-01') },
        { source: 'precio-max:halvings', run: seriesFromPriceHistory },
      ];
      for (const attempt of attempts) {
        try {
          return { records: deriveHalvings(await attempt.run()), source: attempt.source };
        } catch (err) {
          errors.push(`${attempt.source}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      throw new Error(`Sin serie diaria para los halvings (${errors.join(' · ')})`);
    },
  );

  return { data: r.value.records, meta: metaFromCache(r.value.source, r.status, r.storedAt) };
}
