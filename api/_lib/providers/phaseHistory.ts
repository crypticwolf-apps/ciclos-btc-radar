import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import { getDailySeries } from './dailySeries.js';
import { getFearGreedHistory } from './alternativeme.js';
import { rsiSeries, trendFrom } from '../../../src/lib/indicators.js';
import { PHASE_CODE, phaseRule } from '../../../src/lib/cycle/phaseRule.js';

// =============================================================================
// La fase del ciclo de Bitcoin, día a día, desde febrero de 2018.
//
// Con las MISMAS reglas que la fase de hoy (src/lib/cycle/phaseRule.ts) y sus
// mismos datos, reconstruidos para cada día con lo que se sabía ese día:
//   · caída desde el máximo: frente al cierre más alto hasta esa fecha;
//   · tendencia: precio frente a su media de 30 días (±3%), como la de hoy;
//   · RSI de 14 días sobre cierres diarios;
//   · Fear & Greed de ese día (alternative.me; empieza en febrero de 2018, y
//     por eso empieza aquí la reconstrucción).
// La única diferencia con la fase en directo: el máximo histórico de hoy es el
// del proveedor de precio, que puede ser intradía; aquí es el mejor CIERRE.
//
// Se manda compacto: una letra por día y el cierre de cada día.
// =============================================================================

export interface PhaseHistory {
  /** Primer día (YYYY-MM-DD); los siguientes van seguidos, uno por día. */
  desde: string;
  /** Una letra por día (ver PHASE_CODE). */
  fases: string;
  /** Cierre de BTC de cada día, en dólares. */
  precios: number[];
  source: string;
}

const DAY = 86_400_000;
const round = (v: number) => Number(v.toPrecision(5));

export function derivePhaseHistory(
  closes: { t: number; price: number }[],
  fng: { t: number; value: number }[],
): Omit<PhaseHistory, 'source'> {
  if (closes.length < 60 || fng.length === 0) throw new Error('faltan datos para reconstruir la fase');

  // Un cierre por día natural, sin huecos: un día sin dato repite el anterior.
  const dayMs = (t: number) => Math.floor(t / DAY) * DAY;
  const byDay = new Map(closes.map((c) => [dayMs(c.t), c.price]));
  const first = dayMs(closes[0]!.t);
  const last = dayMs(closes[closes.length - 1]!.t);
  const days: number[] = [];
  const prices: number[] = [];
  for (let t = first, p = closes[0]!.price; t <= last; t += DAY) {
    p = byDay.get(t) ?? p;
    days.push(t);
    prices.push(p);
  }

  const fgByDay = new Map(fng.map((f) => [dayMs(f.t), f.value]));
  const start = Math.max(dayMs(fng[0]!.t), first + 30 * DAY);
  const rsi = rsiSeries(prices, 14);

  let ath = 0;
  let fases = '';
  const out: number[] = [];
  for (let i = 0; i < days.length; i++) {
    const price = prices[i]!;
    ath = Math.max(ath, price);
    if (days[i]! < start) continue;
    // Si a alternative.me le falta un día, vale el del día anterior.
    const fg = fgByDay.get(days[i]!) ?? fgByDay.get(days[i]! - DAY) ?? null;
    const { id } = phaseRule({
      dd: Math.min(0, Number((((price - ath) / ath) * 100).toFixed(1))),
      tendencia: trendFrom(prices.slice(Math.max(0, i - 29), i + 1)),
      rsi: rsi[i] ?? null,
      fearGreed: fg,
    });
    fases += PHASE_CODE[id];
    out.push(round(price));
  }
  if (fases.length === 0) throw new Error('sin días que reconstruir');
  return { desde: new Date(start).toISOString().slice(0, 10), fases, precios: out };
}

export async function getPhaseHistory(): Promise<ProviderResult<PhaseHistory>> {
  // 6 h: un punto al día; el último se rehace con el cierre más reciente.
  const r = await swr('fase:historico:v1', { ttlMs: 6 * 60 * 60_000, staleMs: 7 * DAY }, async () => {
    const [series, fng] = await Promise.all([getDailySeries(), getFearGreedHistory()]);
    return { ...derivePhaseHistory(series.points, fng.data), source: series.source };
  });
  return { data: r.value, meta: metaFromCache('fase:historico', r.status, r.storedAt) };
}
