import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import { getPriceHistory } from './coingecko.js';
import { getDailyMetrics } from './coinmetrics.js';

// =============================================================================
// Proveedor: divergencia on-chain "smart money" (real, gratis, sin clave).
//
// El balance LITERAL de ballenas frente a minoristas solo lo venden APIs de
// pago (Glassnode, Santiment…). Aquí se usa un PROXY honesto con dos series
// públicas de Blockchain.com, y se dice que es un proxy:
//
//   estimated-transaction-volume-usd  → valor movido on-chain, dominado por las
//       transferencias grandes (instituciones/ballenas). Media móvil de 30 d.
//   n-unique-addresses                → nº de direcciones activas al día, proxy
//       de la amplitud de participación del retail. Media móvil de 14 d.
//
// Antes esto se pedía DESDE EL NAVEGADOR con un flag de build (VITE_LIVE_DATA);
// al no estar ese flag en producción, la sección caía a datos simulados. Ahora
// se calcula en el servidor, con cache, igual que el resto de bloques.
//
// RESPALDO: las mismas dos series las publica Coin Metrics (TxTfrValAdjUSD y
// AdrActCnt). Allí llegan en crudo, así que la media móvil —que Blockchain.com
// aplica en el servidor— se calcula aquí para que ambas vías suavicen igual.
// =============================================================================

const WEEKS = 14; // ventana amplia: deja margen para las medias móviles
const POINTS = 6; // puntos de la línea de divergencia
const STEP_DAYS = 7; // un punto por semana

const ChartSchema = z.object({
  values: z.array(z.object({ x: z.number(), y: z.number() })),
});

const VOLUME_AVG_DAYS = 30; // suavizado del volumen movido
const ADDRESS_AVG_DAYS = 14; // suavizado de las direcciones activas

const chartUrl = (id: string, rollingAverage: string) =>
  `https://api.blockchain.info/charts/${id}` +
  `?timespan=${WEEKS}weeks&rollingAverage=${rollingAverage}&format=json&cors=true`;

/** Las dos series del proxy, ya suavizadas y en orden ascendente. */
interface FlowInputs {
  /** Valor movido on-chain, en USD. */
  volume: { x: number; y: number }[];
  /** Direcciones activas por día. */
  addresses: { x: number; y: number }[];
}

/** Media móvil simple; los primeros puntos usan la ventana disponible. */
function rollingMean(points: { x: number; y: number }[], window: number): { x: number; y: number }[] {
  return points.map((point, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = points.slice(from, i + 1);
    const sum = slice.reduce((acc, p) => acc + p.y, 0);
    return { x: point.x, y: sum / slice.length };
  });
}

async function fromBlockchainCom(): Promise<FlowInputs> {
  const [volRaw, addrRaw] = await Promise.all([
    fetchJson<unknown>(chartUrl('estimated-transaction-volume-usd', `${VOLUME_AVG_DAYS}days`), {
      provider: 'blockchain.com:volume',
      timeoutMs: 12_000,
    }),
    fetchJson<unknown>(chartUrl('n-unique-addresses', `${ADDRESS_AVG_DAYS}days`), {
      provider: 'blockchain.com:addresses',
      timeoutMs: 12_000,
    }),
  ]);
  return {
    volume: ChartSchema.parse(volRaw).values,
    addresses: ChartSchema.parse(addrRaw).values,
  };
}

async function fromCoinMetrics(): Promise<FlowInputs> {
  // Se piden días de más para que la media móvil de 30 d arranque completa.
  const startMs = Date.now() - (WEEKS * 7 + VOLUME_AVG_DAYS) * 86_400_000;
  const series = await getDailyMetrics(
    ['TxTfrValAdjUSD', 'AdrActCnt'],
    new Date(startMs).toISOString().slice(0, 10),
  );
  const toChart = (points: { t: number; y: number }[]) =>
    points.map((p) => ({ x: Math.round(p.t / 1000), y: p.y }));
  return {
    volume: rollingMean(toChart(series.TxTfrValAdjUSD!), VOLUME_AVG_DAYS),
    addresses: rollingMean(toChart(series.AdrActCnt!), ADDRESS_AVG_DAYS),
  };
}

/** Toma `count` muestras del final del array, espaciadas `step` posiciones. */
function tailSamples<T>(arr: T[], count: number, step: number): T[] {
  const out: T[] = [];
  for (let i = arr.length - 1; i >= 0 && out.length < count; i -= step) out.unshift(arr[i]!);
  return out;
}

/** Indexa una serie a base 100 en su primer valor. */
function indexTo100(values: number[]): number[] {
  const base = values[0] || 1;
  return values.map((v) => Math.round((v / base) * 100));
}

export interface WhaleFlowPoint {
  period: string;
  /** Volumen on-chain indexado a base 100 (proxy de actividad de ballenas). */
  whaleIndex: number;
  /** Direcciones activas indexadas a base 100 (proxy de amplitud del retail). */
  retailIndex: number;
  /** Precio en miles de dólares en ese punto. */
  priceK: number;
  current: boolean;
}

export interface OnchainFlow {
  timeline: WhaleFlowPoint[];
  /** Variación del índice de ballenas en la ventana (puntos base 100). */
  recentWhaleChange: number;
  recentRetailChange: number;
  /** Variación del precio en la ventana, en %. */
  recentPriceChange: number;
  weeks: number;
  observedAt: string;
  /** Proveedor que sirvió las series, para poder atribuirlo. */
  source: string;
}

export async function getOnchainFlow(): Promise<ProviderResult<OnchainFlow>> {
  // Datos diarios: TTL de 6 h y ventana stale amplia por si Blockchain.com cae.
  const r = await swr('onchain:flow', { ttlMs: 6 * 60 * 60_000, staleMs: 48 * 60 * 60_000 }, async () => {
    const errors: string[] = [];
    let inputs: FlowInputs | null = null;
    let source = 'blockchain.com:flow';
    for (const attempt of [
      { source: 'blockchain.com:flow', run: fromBlockchainCom },
      { source: 'coinmetrics:flow', run: fromCoinMetrics },
    ]) {
      try {
        inputs = await attempt.run();
        source = attempt.source;
        break;
      } catch (err) {
        errors.push(`${attempt.source}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!inputs) throw new Error(`Sin series on-chain (${errors.join(' · ')})`);

    const vol = inputs.volume;
    const addr = inputs.addresses;
    if (vol.length === 0 || addr.length === 0) throw new Error('series on-chain vacías');

    const volSamples = tailSamples(vol, POINTS, STEP_DAYS).map((v) => v.y);
    const addrSamples = tailSamples(addr, POINTS, STEP_DAYS).map((v) => v.y);

    // Precio alineado con la misma cadencia semanal. Si el histórico falla, el
    // gráfico se queda sin precio pero la divergencia (lo importante) se mantiene.
    let priceSamples: number[] = [];
    try {
      const hist = await getPriceHistory('365');
      const closes = hist.data.map((p) => p.price);
      if (closes.length >= POINTS * STEP_DAYS) {
        priceSamples = tailSamples(closes, POINTS, STEP_DAYS);
      }
    } catch {
      /* sin precio: se rellena con 0 y el gráfico oculta esa serie */
    }

    const len = Math.min(
      volSamples.length,
      addrSamples.length,
      priceSamples.length || volSamples.length,
    );
    const whaleIdx = indexTo100(volSamples.slice(-len));
    const retailIdx = indexTo100(addrSamples.slice(-len));
    const prices = priceSamples.length ? priceSamples.slice(-len) : new Array(len).fill(0);

    const timeline: WhaleFlowPoint[] = prices.map((p, i) => ({
      period: i === len - 1 ? 'Actual' : `-${len - 1 - i} sem`,
      whaleIndex: whaleIdx[i]!,
      retailIndex: retailIdx[i]!,
      priceK: p > 0 ? Number((p / 1000).toFixed(1)) : 0,
      current: i === len - 1,
    }));

    const firstPrice = prices[0] || 0;
    const lastPrice = prices[len - 1] || 0;

    return {
      timeline,
      recentWhaleChange: whaleIdx[len - 1]! - whaleIdx[0]!,
      recentRetailChange: retailIdx[len - 1]! - retailIdx[0]!,
      recentPriceChange:
        firstPrice > 0 ? Math.round(((lastPrice - firstPrice) / firstPrice) * 100) : 0,
      weeks: len,
      observedAt: new Date((vol[vol.length - 1]!.x) * 1000).toISOString(),
      source,
    } satisfies OnchainFlow;
  });

  return {
    data: r.value,
    meta: metaFromCache(r.value.source, r.status, r.storedAt, {
      observedAt: r.value.observedAt,
    }),
  };
}
