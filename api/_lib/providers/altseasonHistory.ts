import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// La AMPLITUD del mercado de altcoins desde 2017: para cada día, qué porcentaje
// de una cesta fija de altcoins grandes superaba a Bitcoin en los 90 días
// anteriores. Es la misma medida que el componente principal del Altseason
// Score, pero con años de historia, para ver cuándo hubo altseason.
//
// Por qué una cesta fija y no «el top 100 de cada día»: el ranking histórico
// por capitalización solo lo dan APIs de pago. La cesta son altcoins grandes
// con años de precio diario en Coin Metrics (gratis). Cada día solo cuentan
// las que ya cotizaban con 90 días de historia, así que no se usa ninguna
// antes de existir. Sesgo que hay que decir: son las que siguen siendo
// grandes hoy, no las que lo eran entonces (las que desaparecieron no están).
//
// Altseason = el porcentaje, en media de 7 días, se mantiene en el 75% o más
// al menos dos semanas: el umbral clásico del Altcoin Season Index.
// =============================================================================

const BASE = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const DAY = 86_400_000;
const WINDOW = 90;
/** Desde marzo de 2017: la primera serie útil empieza 90 días después. */
const START = '2017-03-01';
/** Mínimo de altcoins con historia para dar el dato de un día. */
const MIN_ASSETS = 8;
export const ALTSEASON_LEVEL = 75;
const MIN_DAYS = 14;

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
  /** Máximo del porcentaje (media de 7 días) dentro del periodo. */
  maximo: number;
  /** `true` si sigue abierto hoy. */
  enCurso: boolean;
}

export interface BreadthHistory {
  /** Primer día (YYYY-MM-DD); los siguientes van seguidos, uno por día. */
  desde: string;
  /** % de la cesta que superaba a BTC a 90 días, un valor por día (entero). */
  pct: number[];
  /** Cuántas altcoins de la cesta entraban en el cálculo el primer y el último día. */
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
  const pct: number[] = [];
  const activos: number[] = [];

  for (let t = first + WINDOW * DAY; t <= last; t += DAY) {
    const b0 = btc.get(t - WINDOW * DAY);
    const b1 = btc.get(t);
    if (b0 == null || b1 == null) {
      if (desde != null) {
        // Hueco en BTC: se repite el día anterior para no romper la serie diaria.
        pct.push(pct[pct.length - 1]!);
        activos.push(activos[activos.length - 1]!);
      }
      continue;
    }
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
    if (n < MIN_ASSETS) {
      if (desde == null) continue;
      pct.push(pct[pct.length - 1]!);
      activos.push(n);
      continue;
    }
    if (desde == null) desde = t;
    pct.push(Math.round((beats / n) * 100));
    activos.push(n);
  }
  if (desde == null || pct.length === 0) throw new Error('sin días con suficientes altcoins');

  return {
    desde: iso(desde),
    pct,
    activos: { inicio: activos[0]!, fin: activos[activos.length - 1]! },
    periodos: detectAltseasons(desde, pct),
  };
}

/** Tramos con la media de 7 días en el 75% o más durante dos semanas o más. */
export function detectAltseasons(desde: number, pct: number[]): AltseasonPeriod[] {
  const media = pct.map((_, i) => {
    const slice = pct.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // 1) Tramos seguidos por encima del umbral.
  const tramos: [number, number][] = [];
  media.forEach((v, i) => {
    if (v < ALTSEASON_LEVEL) return;
    const last = tramos[tramos.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else tramos.push([i, i]);
  });
  // 2) Dos tramos separados por tres semanas o menos son la misma altseason.
  const unidos: [number, number][] = [];
  for (const t of tramos) {
    const last = unidos[unidos.length - 1];
    if (last && t[0] - last[1] <= 21) last[1] = t[1];
    else unidos.push([...t]);
  }
  // 3) Solo cuenta si dura al menos dos semanas.
  return unidos
    .filter(([a, b]) => b - a + 1 >= MIN_DAYS)
    .map(([a, b]) => ({
      desde: iso(desde + a * DAY),
      hasta: iso(desde + b * DAY),
      maximo: Math.round(Math.max(...media.slice(a, b + 1))),
      enCurso: b === media.length - 1,
    }));
}

async function fetchBasket(): Promise<Series> {
  const series: Series = new Map();
  let url: string | undefined =
    `${BASE}?assets=btc,${BASKET.join(',')}&metrics=PriceUSD&frequency=1d` +
    `&start_time=${START}&page_size=10000&ignore_forbidden_errors=true&ignore_unsupported_errors=true`;
  // Varias páginas: unas 3.000 filas por activo.
  for (let page = 0; url && page < 25; page++) {
    const raw: unknown = await fetchJson<unknown>(url, { provider: 'coinmetrics:altcoins', timeoutMs: 20_000 });
    const parsed = PageSchema.parse(raw);
    for (const row of parsed.data) {
      const price = Number(row.PriceUSD);
      if (!Number.isFinite(price) || !(price > 0)) continue;
      let s = series.get(row.asset);
      if (!s) series.set(row.asset, (s = new Map()));
      s.set(dayMs(Date.parse(row.time)), price);
    }
    url = parsed.next_page_url;
  }
  return series;
}

export async function getBreadthHistory(): Promise<ProviderResult<BreadthHistory>> {
  // Un dato al día: se rehace cada 12 h, y si Coin Metrics falla vale una semana.
  const r = await swr('amplitud:historico:v1', { ttlMs: 12 * 60 * 60_000, staleMs: 7 * DAY }, async () => ({
    ...deriveBreadthHistory(await fetchBasket()),
    source: 'coinmetrics',
  }));
  return { data: r.value, meta: metaFromCache('coinmetrics:altcoins', r.status, r.storedAt) };
}
