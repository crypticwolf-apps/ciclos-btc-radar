import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, metaLocked, type ProviderResult } from '../respond.js';
import { readEnv } from '../runtimeEnv.js';

// =============================================================================
// Proveedor: FRED (Federal Reserve Economic Data, Fed de San Luis). Requiere
// FRED_API_KEY en el servidor. Sin clave → bloque bloqueado; nunca se inventa.
//
// CRITERIO DE SELECCIÓN. Cada indicador está aquí porque ayuda a leer la
// liquidez, el ciclo económico, la política monetaria o el apetito por riesgo,
// que es lo que mueve a Bitcoin y, detrás, a las altcoins. Lo que no cumple
// eso no entra, aunque esté disponible: menos cifras, pero que cuenten algo.
//
// FRESCURA. Cada serie se pide y se cachea POR SEPARADO, con un tiempo de vida
// acorde a su frecuencia REAL de publicación:
//   diaria  → se revisa cada hora       (FRED la actualiza una vez por día hábil)
//   semanal → se revisa cada 3 horas    (sale un día fijo de la semana)
//   mensual → se revisa cada 6 horas    (sale un día concreto del mes)
// Antes todas compartían una caché de 6 h: un dato diario podía ir seis horas
// tarde, y si una sola serie fallaba se perdía para todo ese tiempo. Pedir un
// dato mensual cada minuto no lo haría más fresco; revisarlo cada pocas horas
// garantiza que el nuevo aparece el mismo día en que se publica.
//
// Si FRED no responde, cada serie sigue enseñando su último dato bueno durante
// una semana —con su fecha real de observación, así que nunca parece más
// reciente de lo que es— y las que no se pueden obtener se declaran en
// `missing` en vez de desaparecer sin aviso.
// =============================================================================

const ObsSchema = z.object({
  observations: z.array(z.object({ date: z.string(), value: z.string() })),
});
const SeriesInfoSchema = z.object({
  seriess: z.array(z.object({ units: z.string() })).min(1),
});

/** Observación ya numérica, en orden ASCENDENTE de fecha. */
interface Obs {
  date: string;
  value: number;
}

export type MacroFrequency = 'diaria' | 'semanal' | 'mensual';
export type MacroGroup = 'liquidez' | 'politica' | 'crecimiento' | 'condiciones';
/** Cómo se escribe el valor: lo decide la interfaz con este código. */
export type MacroFormat = 'pct' | 'pp' | 'indice' | 'difusion' | 'usd-bn';
export type MacroTrend = 'sube' | 'baja' | 'estable';

/** Un punto de la serie para el gráfico, ya en la unidad que se muestra. */
export interface MacroHistoryPoint {
  /** Etiqueta del eje: «ene 24». */
  period: string;
  value: number;
  /** Fecha real de la observación (YYYY-MM-DD). */
  at: string;
}

export interface MacroSeries {
  id: string;
  /** Serie o series de FRED de las que sale («WALCL−WTREGEN−RRPONTSYD»). */
  fredId: string;
  label: string;
  group: MacroGroup;
  format: MacroFormat;
  /** Unidad legible («% interanual», «índice»…). */
  unit: string;
  /** Último dato publicado. */
  value: number;
  /** Fecha REAL de esa observación (YYYY-MM-DD), no la de la consulta. */
  observedAt: string;
  /** Dato con el que se compara: el publicado antes, o el de hace un mes. */
  previous: number | null;
  previousAt: string | null;
  /** value − previous, en la unidad del indicador. */
  change: number | null;
  changeLabel: string;
  /** Dirección de fondo, sobre una ventana más larga que la comparación. */
  trend: MacroTrend | null;
  /**
   * Dato del inicio de la ventana de la tendencia. Con él se mide CUÁNTO ha
   * cambiado, no solo hacia dónde (lo usa el Score de Oportunidad).
   */
  trendFrom: { value: number; at: string } | null;
  /** Últimos valores, del más antiguo al más reciente, para la minigráfica. */
  spark: number[];
  frequency: MacroFrequency;
  /** Cuándo se publica, en palabras («mensual · 1.er viernes»). */
  cadence: string;
  /** Cuándo lo obtuvo este servidor de FRED (ISO). */
  fetchedAt: string;
  definicion: string;
  /** Serie larga para el gráfico. Solo la traen las que se dibujan. */
  history?: MacroHistoryPoint[];
}

export interface MacroMissing {
  id: string;
  label: string;
  reason: string;
}

export interface MacroData {
  series: MacroSeries[];
  /** Indicadores que no se han podido obtener ahora mismo, y por qué. */
  missing: MacroMissing[];
}

const FRED = 'https://api.stlouisfed.org/fred';
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY = 86_400_000;

/** Cada cuánto se vuelve a pedir una serie según su frecuencia real. */
const TTL: Record<MacroFrequency, number> = {
  diaria: 60 * 60_000,
  semanal: 3 * 60 * 60_000,
  mensual: 6 * 60 * 60_000,
};
/** Durante cuánto se sigue enseñando el último dato bueno si FRED cae. */
const STALE_MS = 7 * DAY;

/** «2024-03-01» → «mar 24». */
export function periodLabel(date: string): string {
  const [y, m] = date.split('-');
  return `${MONTHS_ES[Number(m) - 1]} ${y!.slice(2)}`;
}

const round = (v: number, d = 2) => Number(v.toFixed(d));
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Última observación con fecha igual o anterior a `ms`. */
function atOrBefore(points: Obs[], ms: number): Obs | null {
  let found: Obs | null = null;
  for (const p of points) {
    if (toMs(p.date) > ms) break;
    found = p;
  }
  return found;
}

/**
 * Variación interanual mes a mes. Busca el mes de hace un año POR FECHA y no
 * por posición: si a FRED le faltara un mes, contar doce puestos hacia atrás
 * compararía con el mes equivocado.
 */
export function yoy(points: Obs[]): Obs[] {
  const out: Obs[] = [];
  for (const p of points) {
    const [y, m] = p.date.split('-');
    const target = `${Number(y) - 1}-${m}`;
    const base = points.find((q) => q.date.startsWith(target));
    if (base && base.value !== 0) {
      out.push({ date: p.date, value: round(((p.value - base.value) / base.value) * 100) });
    }
  }
  return out;
}

/** Escala a miles de millones (lo que FRED llama «Billions») según su unidad. */
export function scaleToBillions(units: string): number {
  const u = units.toLowerCase();
  if (u.startsWith('millions of')) return 1 / 1000;
  if (u.startsWith('billions of')) return 1;
  if (u.startsWith('trillions of')) return 1000;
  throw new Error(`unidad no reconocida: «${units}»`);
}

/**
 * Liquidez neta de la Fed = balance (WALCL) − cuenta del Tesoro (WTREGEN) −
 * repos inversos (RRPONTSYD), en miles de millones de dólares.
 *
 * Se calcula en cada fecha semanal del balance, con el TGA y el RRP de esa
 * misma fecha o la más próxima anterior (máximo una semana de distancia). Las
 * unidades NO se dan por supuestas: se leen de FRED, porque un error de escala
 * (millones frente a miles de millones) daría una cifra con aspecto creíble y
 * completamente falsa.
 */
export function netLiquidity(walcl: Obs[], tga: Obs[], rrp: Obs[]): Obs[] {
  const out: Obs[] = [];
  for (const w of walcl) {
    const ms = toMs(w.date);
    const t = atOrBefore(tga, ms);
    const r = atOrBefore(rrp, ms);
    if (!t || !r) continue;
    if (ms - toMs(t.date) > 7 * DAY || ms - toMs(r.date) > 7 * DAY) continue;
    out.push({ date: w.date, value: round(w.value - t.value - r.value, 1) });
  }
  const last = out[out.length - 1];
  // Desde 2008 la cifra ha vivido entre ~1 y ~7 billones. Fuera de un margen
  // amplio alrededor, algo se ha leído mal: mejor no publicarla.
  if (!last || last.value < 500 || last.value > 15_000) {
    throw new Error(`liquidez neta fuera de rango (${last?.value ?? 'sin dato'})`);
  }
  return out;
}

// --- Definiciones -------------------------------------------------------------

interface SeriesDef {
  id: string;
  label: string;
  group: MacroGroup;
  format: MacroFormat;
  unit: string;
  frequency: MacroFrequency;
  cadence: string;
  definicion: string;
  /** Series de FRED que necesita y cuántas observaciones de cada una. */
  inputs: { fredId: string; limit: number; frequency: MacroFrequency; units?: boolean }[];
  /** Convierte las entradas (ascendentes) en la serie que se enseña. */
  build: (inputs: Obs[][], scales: number[]) => Obs[];
  /**
   * Con qué se compara el último dato. Sin valor: con la observación
   * publicada justo antes. Con días: con la de hace ese tiempo (para series
   * diarias, donde el día anterior no dice nada a escala de ciclo).
   */
  compareDays?: number;
  compareLabel: string;
  /** Ventana de la tendencia de fondo y variación mínima para no ser «estable». */
  trendDays: number;
  trendEpsilon: number;
  /** Cuánto pasado cabe en la minigráfica. */
  sparkDays: number;
  /** Serie larga para el gráfico de liquidez. */
  history?: number;
}

const level = (inputs: Obs[][]) => inputs[0]!;

export const DEFS: SeriesDef[] = [
  // --- Liquidez --------------------------------------------------------------
  {
    id: 'liquidez',
    label: 'Masa monetaria M2',
    group: 'liquidez',
    format: 'pct',
    unit: '% interanual',
    frequency: 'mensual',
    cadence: 'Mensual · la Fed lo publica hacia el 4.º martes del mes siguiente',
    definicion:
      'Agregado monetario M2 de EE. UU., en variación interanual. Cuando crece, hay más dinero buscando activos; históricamente ha acompañado a las fases alcistas de Bitcoin.',
    inputs: [{ fredId: 'M2SL', limit: 40, frequency: 'mensual' }],
    build: (i) => yoy(level(i)),
    compareLabel: 'vs mes anterior',
    trendDays: 92,
    trendEpsilon: 0.3,
    sparkDays: 366,
    history: 24,
  },
  {
    id: 'liquidez-fed',
    label: 'Liquidez neta de la Fed',
    group: 'liquidez',
    format: 'usd-bn',
    unit: 'miles de millones $',
    frequency: 'semanal',
    cadence: 'Semanal · cada jueves, con el balance del miércoles',
    definicion:
      'Balance de la Reserva Federal menos la cuenta del Tesoro (TGA) y los repos inversos (RRP): el dinero de la Fed que de verdad circula por el sistema financiero. Es la medida de liquidez que más se ha movido con Bitcoin en los últimos ciclos.',
    inputs: [
      { fredId: 'WALCL', limit: 32, frequency: 'semanal', units: true },
      { fredId: 'WTREGEN', limit: 32, frequency: 'semanal', units: true },
      { fredId: 'RRPONTSYD', limit: 160, frequency: 'diaria', units: true },
    ],
    build: (i, s) =>
      netLiquidity(
        i[0]!.map((p) => ({ ...p, value: p.value * s[0]! })),
        i[1]!.map((p) => ({ ...p, value: p.value * s[1]! })),
        i[2]!.map((p) => ({ ...p, value: p.value * s[2]! })),
      ),
    compareLabel: 'vs semana anterior',
    trendDays: 56,
    trendEpsilon: 50,
    sparkDays: 182,
  },

  // --- Política monetaria y tipos --------------------------------------------
  {
    id: 'fedfunds',
    label: 'Tipo de la Fed',
    group: 'politica',
    format: 'pct',
    unit: '%',
    frequency: 'diaria',
    cadence: 'Diaria · tipo efectivo del día anterior',
    definicion:
      'Tipo efectivo de los fondos federales, dato DIARIO. Antes se usaba la media mensual, que llegaba con hasta seis semanas de retraso tras una bajada o subida de tipos.',
    inputs: [{ fredId: 'DFF', limit: 120, frequency: 'diaria' }],
    build: level,
    compareDays: 30,
    compareLabel: 'vs hace 1 mes',
    trendDays: 120,
    trendEpsilon: 0.1,
    sparkDays: 120,
  },
  {
    id: 'inflacion',
    label: 'Inflación (IPC)',
    group: 'politica',
    format: 'pct',
    unit: '% interanual',
    frequency: 'mensual',
    cadence: 'Mensual · hacia mediados del mes siguiente',
    definicion:
      'Índice de precios al consumo de EE. UU., variación interanual. Marca cuánto margen tiene la Fed para bajar tipos.',
    inputs: [{ fredId: 'CPIAUCSL', limit: 28, frequency: 'mensual' }],
    build: (i) => yoy(level(i)),
    compareLabel: 'vs mes anterior',
    trendDays: 92,
    trendEpsilon: 0.15,
    sparkDays: 366,
  },
  {
    id: 'tipo-real',
    label: 'Tipo real 10 años',
    group: 'politica',
    format: 'pct',
    unit: '%',
    frequency: 'diaria',
    cadence: 'Diaria · días hábiles',
    definicion:
      'Rentabilidad del bono a 10 años protegido contra la inflación (TIPS). Es lo que rinde un activo seguro después de inflación: cuando sube, un activo sin rendimiento como Bitcoin compite peor.',
    inputs: [{ fredId: 'DFII10', limit: 100, frequency: 'diaria' }],
    build: level,
    compareDays: 30,
    compareLabel: 'vs hace 1 mes',
    trendDays: 90,
    trendEpsilon: 0.1,
    sparkDays: 90,
  },
  {
    id: 'spread',
    label: 'Curva 10A – 2A',
    group: 'politica',
    format: 'pp',
    unit: 'puntos',
    frequency: 'diaria',
    cadence: 'Diaria · días hábiles',
    definicion:
      'Diferencia entre el bono a 10 años y el de 2 años. Negativa (invertida) ha precedido a las recesiones; su vuelta a positivo suele llegar cuando la Fed ya está bajando tipos.',
    inputs: [{ fredId: 'T10Y2Y', limit: 100, frequency: 'diaria' }],
    build: level,
    compareDays: 30,
    compareLabel: 'vs hace 1 mes',
    trendDays: 90,
    trendEpsilon: 0.1,
    sparkDays: 90,
  },

  // --- Crecimiento y actividad -----------------------------------------------
  {
    id: 'actividad',
    label: 'Actividad (CFNAI)',
    group: 'crecimiento',
    format: 'difusion',
    unit: 'índice, media 3 meses',
    frequency: 'mensual',
    cadence: 'Mensual · hacia final del mes siguiente',
    definicion:
      'Índice de actividad nacional de la Fed de Chicago: resume 85 indicadores de producción, empleo, consumo y ventas. 0 = crecimiento en su media histórica; por debajo de −0,7 tras una expansión ha anticipado recesiones. Es la mejor alternativa oficial y gratuita a los PMI.',
    inputs: [{ fredId: 'CFNAIMA3', limit: 16, frequency: 'mensual' }],
    build: level,
    compareLabel: 'vs mes anterior',
    trendDays: 92,
    trendEpsilon: 0.1,
    sparkDays: 366,
  },
  {
    id: 'manufactura',
    label: 'Manufactura (Filadelfia)',
    group: 'crecimiento',
    format: 'difusion',
    unit: 'índice de difusión',
    frequency: 'mensual',
    cadence: 'Mensual · 3.er jueves del mismo mes',
    definicion:
      'Encuesta manufacturera de la Fed de Filadelfia: % de empresas que mejoran menos % que empeoran. Funciona como un PMI (por encima de 0 = expansión) y se publica antes que el ISM, al que suele anticipar.',
    inputs: [{ fredId: 'GACDFSA066MSFRBPHI', limit: 16, frequency: 'mensual' }],
    build: level,
    compareLabel: 'vs mes anterior',
    trendDays: 92,
    trendEpsilon: 3,
    sparkDays: 366,
  },
  {
    id: 'desempleo',
    label: 'Desempleo',
    group: 'crecimiento',
    format: 'pct',
    unit: '%',
    frequency: 'mensual',
    cadence: 'Mensual · primer viernes del mes siguiente',
    definicion:
      'Tasa de paro de EE. UU. Una subida rápida desde mínimos ha marcado históricamente el inicio de las recesiones, y suele forzar a la Fed a bajar tipos.',
    inputs: [{ fredId: 'UNRATE', limit: 16, frequency: 'mensual' }],
    build: level,
    compareLabel: 'vs mes anterior',
    trendDays: 92,
    trendEpsilon: 0.15,
    sparkDays: 366,
  },

  // --- Condiciones financieras y riesgo --------------------------------------
  {
    id: 'condiciones',
    label: 'Condiciones (NFCI)',
    group: 'condiciones',
    format: 'difusion',
    unit: 'índice',
    frequency: 'semanal',
    cadence: 'Semanal · cada miércoles',
    definicion:
      'Índice de condiciones financieras de la Fed de Chicago (crédito, apalancamiento, riesgo y liquidez de mercado). Por debajo de 0 son más laxas que la media: el entorno en el que mejor ha funcionado el riesgo.',
    inputs: [{ fredId: 'NFCI', limit: 32, frequency: 'semanal' }],
    build: level,
    compareLabel: 'vs semana anterior',
    trendDays: 56,
    trendEpsilon: 0.03,
    sparkDays: 182,
  },
  {
    id: 'high-yield',
    label: 'Spread high yield',
    group: 'condiciones',
    format: 'pct',
    unit: '% sobre el Tesoro',
    frequency: 'diaria',
    cadence: 'Diaria · días hábiles',
    definicion:
      'Prima que pagan las empresas con peor calificación sobre la deuda pública. Es el termómetro del apetito por riesgo en crédito: cuando se ensancha, el mercado huye del riesgo, y Bitcoin y sobre todo las altcoins lo notan.',
    inputs: [{ fredId: 'BAMLH0A0HYM2', limit: 100, frequency: 'diaria' }],
    build: level,
    compareDays: 30,
    compareLabel: 'vs hace 1 mes',
    trendDays: 90,
    trendEpsilon: 0.2,
    sparkDays: 90,
  },
  {
    id: 'vix',
    label: 'VIX',
    group: 'condiciones',
    format: 'indice',
    unit: 'índice',
    frequency: 'diaria',
    cadence: 'Diaria · días hábiles',
    definicion:
      'Volatilidad implícita del S&P 500. Por encima de 30 indica miedo en los mercados tradicionales, que suele contagiarse a las cripto.',
    inputs: [{ fredId: 'VIXCLS', limit: 100, frequency: 'diaria' }],
    build: level,
    compareDays: 30,
    compareLabel: 'vs hace 1 mes',
    trendDays: 90,
    trendEpsilon: 1.5,
    sparkDays: 90,
  },
  {
    id: 'dolar',
    label: 'Dólar amplio',
    group: 'condiciones',
    format: 'indice',
    unit: 'índice',
    frequency: 'diaria',
    cadence: 'Diaria · la Fed la publica cada lunes',
    definicion:
      'Dólar frente a una cesta amplia de divisas, ponderada por comercio. Un dólar fuerte endurece la liquidez global; uno débil la suaviza.',
    inputs: [{ fredId: 'DTWEXBGS', limit: 100, frequency: 'diaria' }],
    build: level,
    compareDays: 30,
    compareLabel: 'vs hace 1 mes',
    trendDays: 90,
    trendEpsilon: 1,
    sparkDays: 90,
  },
];

// --- Descarga -----------------------------------------------------------------

/** Observaciones de una serie, ascendentes, cacheadas según su frecuencia. */
async function observations(
  fredId: string,
  limit: number,
  frequency: MacroFrequency,
): Promise<{ points: Obs[]; storedAt: number; status: string }> {
  const r = await swr(
    `fred:obs:${fredId}:${limit}`,
    { ttlMs: TTL[frequency], staleMs: STALE_MS },
    async () => {
      const url =
        `${FRED}/series/observations?series_id=${fredId}` +
        `&api_key=${readEnv('FRED_API_KEY')}&file_type=json&sort_order=desc&limit=${limit}`;
      const raw = await fetchJson<unknown>(url, { provider: `fred:${fredId}`, timeoutMs: 9000 });
      const points = ObsSchema.parse(raw)
        .observations.map((o) => ({ date: o.date, value: o.value === '.' ? NaN : Number(o.value) }))
        .filter((o) => Number.isFinite(o.value))
        .reverse();
      if (points.length === 0) throw new Error(`serie ${fredId} vacía`);
      return points;
    },
  );
  return { points: r.value, storedAt: r.storedAt, status: r.status };
}

/** Factor a miles de millones, leído de los metadatos de la serie. */
async function unitScale(fredId: string): Promise<number> {
  const r = await swr(`fred:units:${fredId}`, { ttlMs: 7 * DAY, staleMs: 30 * DAY }, async () => {
    const raw = await fetchJson<unknown>(
      `${FRED}/series?series_id=${fredId}&api_key=${readEnv('FRED_API_KEY')}&file_type=json`,
      { provider: `fred:${fredId}:unidades`, timeoutMs: 9000 },
    );
    return scaleToBillions(SeriesInfoSchema.parse(raw).seriess[0]!.units);
  });
  return r.value;
}

/**
 * Convierte una serie ya construida en el indicador que se enseña: último
 * dato, con qué se compara, tendencia y minigráfica.
 */
export function summarize(
  def: SeriesDef,
  points: Obs[],
  fetchedAt: string,
): MacroSeries {
  const last = points[points.length - 1];
  if (!last || !Number.isFinite(last.value)) {
    throw new Error(`${def.id}: sin valor calculable (faltan observaciones)`);
  }
  const lastMs = toMs(last.date);

  const prev =
    def.compareDays == null
      ? (points[points.length - 2] ?? null)
      : atOrBefore(points, lastMs - def.compareDays * DAY);
  const trendBase = atOrBefore(points, lastMs - def.trendDays * DAY);
  const trendDelta = trendBase ? last.value - trendBase.value : null;

  const spark = points.filter((p) => toMs(p.date) >= lastMs - def.sparkDays * DAY).map((p) => p.value);
  // Una minigráfica no necesita más de ~30 puntos; las diarias traen 60+.
  const step = Math.max(1, Math.ceil(spark.length / 30));
  const sparkThin = spark.filter((_, i) => i % step === 0 || i === spark.length - 1);

  return {
    id: def.id,
    fredId: def.inputs.map((i) => i.fredId).join('−'),
    label: def.label,
    group: def.group,
    format: def.format,
    unit: def.unit,
    value: round(last.value),
    observedAt: last.date,
    previous: prev && prev !== last ? round(prev.value) : null,
    previousAt: prev && prev !== last ? prev.date : null,
    change: prev && prev !== last ? round(last.value - prev.value) : null,
    changeLabel: def.compareLabel,
    trend:
      trendDelta == null
        ? null
        : Math.abs(trendDelta) < def.trendEpsilon
          ? 'estable'
          : trendDelta > 0
            ? 'sube'
            : 'baja',
    trendFrom: trendBase ? { value: round(trendBase.value), at: trendBase.date } : null,
    spark: sparkThin.map((v) => round(v)),
    frequency: def.frequency,
    cadence: def.cadence,
    fetchedAt,
    definicion: def.definicion,
    history: def.history
      ? points.slice(-def.history).map((p) => ({ period: periodLabel(p.date), value: p.value, at: p.date }))
      : undefined,
  };
}

async function buildSeries(def: SeriesDef): Promise<{ series: MacroSeries; status: string }> {
  const fetched = await Promise.all(
    def.inputs.map((input) => observations(input.fredId, input.limit, input.frequency)),
  );
  const scales = await Promise.all(
    def.inputs.map((input) => (input.units ? unitScale(input.fredId) : Promise.resolve(1))),
  );
  // La consulta más antigua de las entradas es la que manda: así un dato que
  // viene de caché nunca se presenta como recién pedido.
  const storedAt = Math.min(...fetched.map((f) => f.storedAt));
  const status = fetched.some((f) => f.status === 'stale')
    ? 'stale'
    : fetched.every((f) => f.status === 'cached')
      ? 'cached'
      : 'live';
  const series = summarize(
    def,
    def.build(
      fetched.map((f) => f.points),
      scales,
    ),
    new Date(storedAt).toISOString(),
  );
  return { series, status };
}

export function macroConfigured(): boolean {
  return Boolean(readEnv('FRED_API_KEY'));
}

export async function getMacro(): Promise<ProviderResult<MacroData>> {
  if (!readEnv('FRED_API_KEY')) {
    return {
      data: { series: [], missing: [] },
      meta: metaLocked('fred', 'Configura FRED_API_KEY en el servidor para el bloque macro.'),
    };
  }

  const results = await Promise.allSettled(DEFS.map(buildSeries));
  const series: MacroSeries[] = [];
  const statuses: string[] = [];
  const missing: MacroMissing[] = [];
  results.forEach((r, i) => {
    const def = DEFS[i]!;
    if (r.status === 'fulfilled') {
      series.push(r.value.series);
      statuses.push(r.value.status);
    } else {
      missing.push({
        id: def.id,
        label: def.label,
        reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  if (series.length === 0) throw new Error(`FRED no devolvió ninguna serie (${missing.map((m) => m.reason).join(' · ')})`);

  // El bloque se declara con la consulta MÁS ANTIGUA de las que lo forman.
  const oldest = Math.min(...series.map((s) => Date.parse(s.fetchedAt)));
  return {
    data: { series, missing },
    meta: metaFromCache(
      'fred',
      statuses.includes('stale') ? 'stale' : statuses.every((st) => st === 'cached') ? 'cached' : 'live',
      oldest,
      {
        note:
          missing.length > 0
            ? `Sin dato ahora mismo: ${missing.map((m) => m.label).join(', ')}.`
            : undefined,
      },
    ),
  };
}
