import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Altcoins frente a Bitcoin desde 2017, para ver las altseasons anteriores.
//
// Dos series diarias con la misma cesta fija de altcoins grandes (Coin
// Metrics, gratis):
//
//   · ÍNDICE ALTCOINS/BTC: cuánto valen las altcoins de la cesta medidas en
//     bitcoins, encadenado día a día (base 100). Es la idea de OTHERS/BTC, pero
//     con todas pesando lo mismo, porque la capitalización histórica de cada
//     moneda solo la dan APIs de pago. Cada día cuentan las que cotizaban ese
//     día y el anterior, así que una moneda nueva entra sin dar un salto.
//   · AMPLITUD: qué porcentaje de la cesta superaba a BTC en los 90 días
//     previos (la medida del Altseason Score, con años de historia).
//
// ALTSEASON = un máximo de ciclo del índice: el valor más alto en un año antes
// y un año después, y al menos el doble que el mínimo del año anterior. La
// zona marcada son los días de ese año alrededor en que el índice estuvo a
// menos de un 25% del máximo. Antes se marcaba cualquier tramo con la amplitud
// en el 75% durante dos semanas, y con datos reales salían rebotes cortos por
// todas partes: casi todo el gráfico en verde.
//
// Sesgo que hay que decir: la cesta son las que siguen siendo grandes hoy; las
// que desaparecieron no están.
// =============================================================================

const BASE = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const DAY = 86_400_000;
const WINDOW = 90;
/** Desde marzo de 2017: la primera serie útil empieza 90 días después. */
const START = '2017-03-01';
/** Mínimo de altcoins con historia para dar el dato de un día. */
const MIN_ASSETS = 8;
/** Un máximo de ciclo tiene que doblar el mínimo del año anterior. */
export const PEAK_MULTIPLE = 2;
/** La zona de la altseason: a menos de un 25% del máximo. */
export const ZONE_FRACTION = 0.75;
const YEAR = 365;
/**
 * Tope del movimiento diario de una moneda frente a BTC que entra en el
 * índice: un dato erróneo (un precio mal publicado, un cambio de unidad) no
 * puede multiplicar el índice entero.
 */
const MAX_DAILY_LOG = 0.5;

/**
 * Altcoins grandes con años de historia. Si Coin Metrics no tiene alguna en el
 * plan gratuito se ignora sola (`ignore_*_errors`) y la cesta queda en las que sí.
 */
export const BASKET = [
  'eth', 'xrp', 'ltc', 'bch', 'ada', 'xlm', 'trx', 'eos', 'xmr', 'etc', 'dash', 'zec', 'neo',
  'xtz', 'link', 'doge', 'bnb', 'vet', 'dot', 'sol', 'avax', 'atom', 'algo', 'uni', 'fil',
  'hbar', 'near', 'aave', 'icp', 'ton',
];

export interface AltseasonPeriod {
  desde: string;
  hasta: string;
  /** Día del máximo del índice. */
  pico: string;
  /** Cuántas veces el mínimo del año anterior valía el índice en el máximo. */
  multiplo: number;
  /** `true` si la zona llega hasta hoy. */
  enCurso: boolean;
}

export interface BreadthHistory {
  /** Primer día (YYYY-MM-DD); los siguientes van seguidos, uno por día. */
  desde: string;
  /** Índice altcoins/BTC, base 100 el primer día. */
  indice: number[];
  /** % de la cesta que superaba a BTC a 90 días; `null` los primeros 90 días. */
  pct: (number | null)[];
  /** Cuántas altcoins de la cesta entraban en el índice el primer y el último día. */
  activos: { inicio: number; fin: number };
  periodos: AltseasonPeriod[];
  source: string;
}

const RowSchema = z.object({ asset: z.string(), time: z.string(), PriceUSD: z.union([z.string(), z.number()]).optional() });
const PageSchema = z.object({ data: z.array(RowSchema), next_page_url: z.string().optional() });

const dayMs = (t: number) => Math.floor(t / DAY) * DAY;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Precio de cada activo por día (epoch ms del día, 00:00Z). */
type Series = Map<string, Map<number, number>>;

export function deriveBreadthHistory(series: Series, now = Date.now()): Omit<BreadthHistory, 'source'> {
  const btc = series.get('btc');
  if (!btc || btc.size < WINDOW * 2) throw new Error('falta la serie de BTC');
  const alts = [...series.entries()].filter(([a]) => a !== 'btc').map(([, s]) => s);

  const first = Math.min(...btc.keys());
  const last = Math.min(Math.max(...btc.keys()), dayMs(now));
  let desde: number | null = null;
  const indice: number[] = [];
  const pct: (number | null)[] = [];
  const activos: number[] = [];
  let nivel = 100;

  for (let t = first + DAY; t <= last; t += DAY) {
    const b0 = btc.get(t - DAY);
    const b1 = btc.get(t);
    // Variación media del día de la cesta frente a BTC (en logaritmos, para
    // que subir un 50% y bajar un 33% se compensen como en el precio).
    let n = 0;
    let suma = 0;
    if (b0 != null && b1 != null) {
      for (const s of alts) {
        const a0 = s.get(t - DAY);
        const a1 = s.get(t);
        if (a0 == null || a1 == null || !(a0 > 0) || !(a1 > 0)) continue;
        const r = Math.log(a1 / a0) - Math.log(b1 / b0);
        suma += Math.max(-MAX_DAILY_LOG, Math.min(MAX_DAILY_LOG, r));
        n++;
      }
    }
    if (desde == null) {
      if (n < MIN_ASSETS) continue;
      desde = t;
    } else if (n >= MIN_ASSETS) {
      nivel *= Math.exp(suma / n);
    }
    // Con menos monedas que el mínimo (o un hueco en BTC) el índice no se mueve.
    indice.push(Number(nivel.toPrecision(5)));
    activos.push(n);
    pct.push(amplitud(btc, alts, t));
  }
  if (desde == null || indice.length < 2) throw new Error('sin días con suficientes altcoins');

  return {
    desde: iso(desde),
    indice,
    pct,
    activos: { inicio: activos[0]!, fin: activos[activos.length - 1]! },
    periodos: detectAltseasons(desde, indice),
  };
}

/** % de la cesta que superaba a BTC en los 90 días anteriores a `t`; `null` sin datos. */
function amplitud(btc: Map<number, number>, alts: Map<number, number>[], t: number): number | null {
  const b0 = btc.get(t - WINDOW * DAY);
  const b1 = btc.get(t);
  if (b0 == null || b1 == null) return null;
  const btcRet = b1 / b0 - 1;
  let n = 0;
  let beats = 0;
  for (const s of alts) {
    const a0 = s.get(t - WINDOW * DAY);
    const a1 = s.get(t);
    if (a0 == null || a1 == null || !(a0 > 0)) continue;
    n++;
    if (a1 / a0 - 1 > btcRet) beats++;
  }
  return n >= MIN_ASSETS ? Math.round((beats / n) * 100) : null;
}

/**
 * Altseasons = máximos de ciclo del índice altcoins/BTC: el valor más alto en
 * un año antes y un año después, y al menos el doble que el mínimo del año
 * anterior. La zona son los días de ese entorno con el índice a menos de un 25%
 * del máximo.
 */
export function detectAltseasons(desde: number, indice: number[]): AltseasonPeriod[] {
  const n = indice.length;
  const out: AltseasonPeriod[] = [];
  let ultimoPico = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = indice[i]!;
    const from = Math.max(0, i - YEAR);
    const to = Math.min(n - 1, i + YEAR);
    let max = -Infinity;
    for (let j = from; j <= to; j++) max = Math.max(max, indice[j]!);
    if (v < max || i - ultimoPico <= YEAR) continue;
    let minAntes = Infinity;
    for (let j = from; j <= i; j++) minAntes = Math.min(minAntes, indice[j]!);
    if (!(minAntes > 0) || v / minAntes < PEAK_MULTIPLE) continue;

    let a = i;
    let b = i;
    for (let j = from; j <= to; j++) {
      if (indice[j]! >= v * ZONE_FRACTION) {
        a = Math.min(a, j);
        b = Math.max(b, j);
      }
    }
    ultimoPico = i;
    out.push({
      desde: iso(desde + a * DAY),
      hasta: iso(desde + b * DAY),
      pico: iso(desde + i * DAY),
      multiplo: Number((v / minAntes).toFixed(1)),
      enCurso: b === n - 1,
    });
  }
  return out;
}

/** Añade las filas de una respuesta de Coin Metrics a las series. */
function addRows(series: Series, rows: z.infer<typeof RowSchema>[]): void {
  for (const row of rows) {
    const price = Number(row.PriceUSD);
    if (!Number.isFinite(price) || !(price > 0)) continue;
    let s = series.get(row.asset);
    if (!s) series.set(row.asset, (s = new Map()));
    s.set(dayMs(Date.parse(row.time)), price);
  }
}

const url = (assets: string, extra = '') =>
  `${BASE}?assets=${assets}&metrics=PriceUSD&frequency=1d&start_time=${START}&page_size=10000${extra}`;

/** Toda la cesta en una petición (paginada), saltándose las que no estén en el plan gratuito. */
async function fetchTogether(): Promise<Series> {
  const series: Series = new Map();
  let next: string | undefined = url(
    `btc,${BASKET.join(',')}`,
    '&ignore_forbidden_errors=true&ignore_unsupported_errors=true',
  );
  // Varias páginas: unas 3.000 filas por activo.
  for (let page = 0; next && page < 25; page++) {
    const raw: unknown = await fetchJson<unknown>(next, { provider: 'coinmetrics:altcoins', timeoutMs: 20_000 });
    const parsed = PageSchema.parse(raw);
    addRows(series, parsed.data);
    next = parsed.next_page_url;
  }
  return series;
}

/**
 * Respaldo: una petición por moneda, en serie y con pausa (el plan gratuito
 * admite unas 10 peticiones cada 6 s). La que falle se queda fuera de la cesta.
 */
async function fetchOneByOne(): Promise<Series> {
  const series: Series = new Map();
  for (const asset of ['btc', ...BASKET]) {
    try {
      const raw = await fetchJson<unknown>(url(asset), { provider: 'coinmetrics:altcoins', timeoutMs: 15_000 });
      addRows(series, PageSchema.parse(raw).data);
    } catch {
      if (asset === 'btc') throw new Error('Coin Metrics no devolvió la serie de BTC');
    }
    await new Promise((r) => setTimeout(r, 650));
  }
  return series;
}

async function fetchBasket(): Promise<Series> {
  try {
    const series = await fetchTogether();
    if (series.has('btc') && series.size > MIN_ASSETS) return series;
  } catch {
    /* se prueba moneda a moneda */
  }
  return fetchOneByOne();
}

export async function getBreadthHistory(): Promise<ProviderResult<BreadthHistory>> {
  // Un dato al día: se rehace cada 12 h, y si Coin Metrics falla vale una semana.
  const r = await swr('amplitud:historico:v2', { ttlMs: 12 * 60 * 60_000, staleMs: 7 * DAY }, async () => ({
    ...deriveBreadthHistory(await fetchBasket()),
    source: 'coinmetrics',
  }));
  return { data: r.value, meta: metaFromCache('coinmetrics:altcoins', r.status, r.storedAt) };
}
