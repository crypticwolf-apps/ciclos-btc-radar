import { swr } from '../cache.js';
import { getDailyCloses, type DailyClose } from './coinmetrics.js';
import { getPriceHistory } from './coingecko.js';

// =============================================================================
// La serie diaria de BTC desde 2010, cacheada UNA vez y compartida.
//
// De ella salen el histórico de halvings y todas las series históricas de la
// aplicación (suelos anuales, caídas, ciclos, suelos de RSI). Antes cada bloque
// se traía la suya, o peor, era una constante escrita a mano; ahora hay una
// sola lectura, un solo respaldo y un solo sitio donde mirar si algo cuadra mal.
//
// Cadena: Coin Metrics → serie MAX del proveedor de precio (Blockchain.com →
// CryptoCompare → CoinGecko → Kraken), que ya tiene su propio respaldo interno.
// =============================================================================

export interface DailySeries {
  /** Cierres diarios en orden ascendente, uno por jornada. */
  points: DailyClose[];
  /** Proveedor que sirvió la serie. */
  source: string;
}

/** Desde 2010-07: hace falta el techo de 2011 para situar el suelo de 2012. */
const START = '2010-07-01';

/**
 * Un cierre por día (el último de cada jornada). Coin Metrics ya entrega un
 * punto diario; los proveedores de respaldo pueden dar varios, y dos puntos del
 * mismo día falsearían los extremos.
 */
async function fromPriceHistory(): Promise<DailyClose[]> {
  const history = await getPriceHistory('max');
  const byDay = new Map<string, DailyClose>();
  for (const point of history.data) {
    if (!Number.isFinite(point.t) || !(point.price > 0)) continue;
    const day = new Date(point.t).toISOString().slice(0, 10);
    byDay.set(day, { t: Date.parse(`${day}T00:00:00.000Z`), day, price: point.price });
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}

export async function getDailySeries(): Promise<DailySeries> {
  const r = await swr(
    'series:daily:v1',
    { ttlMs: 12 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 },
    async () => {
      const errors: string[] = [];
      const attempts = [
        { source: 'coinmetrics:serie', run: () => getDailyCloses(START) },
        { source: 'precio-max:serie', run: fromPriceHistory },
      ];
      for (const attempt of attempts) {
        try {
          const points = await attempt.run();
          if (points.length < 500) throw new Error(`solo ${points.length} cierres`);
          return { points, source: attempt.source } satisfies DailySeries;
        } catch (err) {
          errors.push(`${attempt.source}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      throw new Error(`Sin serie diaria de BTC (${errors.join(' · ')})`);
    },
  );
  return r.value;
}
