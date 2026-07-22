import type { SmartMoneyEvent, WhaleTimelinePoint } from '@/types';
import { MOCK_SMART_MONEY, MOCK_WHALE_TIMELINE } from '@/data/mockData';
import { fetchJson, liveOrCache, LIVE_DATA_ENABLED } from './http';

// =============================================================================
// SERVICIO: Señal "smart money" on-chain (real, gratis, sin API key)
// -----------------------------------------------------------------------------
// Fuente: Blockchain.com Charts API (con CORS vía &cors=true).
// El balance literal de ballenas vs retail solo lo venden APIs de pago
// (Glassnode, Santiment, CryptoQuant) que además necesitan backend + clave.
// En su lugar usamos dos series on-chain REALES como PROXY honesto:
//
//   - estimated-transaction-volume-usd  → valor en USD liquidado on-chain.
//       Lo dominan las transferencias grandes (instituciones/ballenas). Suavizado
//       con media móvil de 30 días para reflejar la TENDENCIA, no el ruido diario.
//   - n-unique-addresses                → nº de direcciones activas al día.
//       Mide la amplitud de participación del retail (media móvil de 14 días).
//
// Ambas se indexan a base 100 al inicio de la ventana, igual que el diseño
// original, y se refrescan con la app. NO es el balance exacto de ballenas: es
// un proxy de actividad que sí se mueve con el mercado.
// =============================================================================

const TIMESPAN_WEEKS = 14; // ventana amplia: deja margen para la media móvil
const POINTS = 6; // nº de puntos en la línea de divergencia (como el mock)
const STEP_DAYS = 7; // un punto por semana

interface ChartResp {
  values: { x: number; y: number }[];
}

const chartUrl = (id: string, rollingAverage: string) =>
  `https://api.blockchain.info/charts/${id}` +
  `?timespan=${TIMESPAN_WEEKS}weeks&rollingAverage=${rollingAverage}&format=json&cors=true`;

/** Toma `count` muestras del final del array, espaciadas `step` posiciones. */
function tailSamples<T>(arr: T[], count: number, step: number): T[] {
  const out: T[] = [];
  for (let i = arr.length - 1; i >= 0 && out.length < count; i -= step) out.unshift(arr[i]);
  return out;
}

/** Indexa una serie a base 100 en su primer valor. */
function indexTo100(values: number[]): number[] {
  const base = values[0] || 1;
  return values.map((v) => Math.round((v / base) * 100));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface SmartMoneyResult {
  smartMoney: SmartMoneyEvent[];
  whaleTimeline: WhaleTimelinePoint[];
  live: boolean;
}

interface Payload {
  smartMoney: SmartMoneyEvent[];
  whaleTimeline: WhaleTimelinePoint[];
}

function buildPayload(volSamples: number[], addrSamples: number[], priceSamples: number[]): Payload {
  const n = priceSamples.length;
  const whaleIdx = indexTo100(volSamples);
  const retailIdx = indexTo100(addrSamples);

  const whaleTimeline: WhaleTimelinePoint[] = priceSamples.map((p, i) => ({
    period: i === n - 1 ? 'Actual' : `-${n - 1 - i} sem`,
    whaleBalance: whaleIdx[i],
    retailBalance: retailIdx[i],
    price: Math.round(p / 100) / 10, // USD → miles de $ ($k) con 1 decimal
    current: i === n - 1,
  }));

  // Barra "actual" del gráfico de eventos: variación real en la ventana on-chain.
  const whaleChg = whaleIdx[n - 1] - whaleIdx[0];
  const retailChg = retailIdx[n - 1] - retailIdx[0];
  const priceChg = Math.round(((priceSamples[n - 1] - priceSamples[0]) / priceSamples[0]) * 100);

  const current: SmartMoneyEvent = {
    event: `Reciente (${n} sem, on-chain)`,
    whales: clamp(whaleChg, -80, 120),
    retail: clamp(retailChg, -80, 120),
    priceChange: clamp(priceChg, -80, 120),
    current: true,
  };

  // Eventos históricos = contexto educativo (no hay dato free de ballenas de
  // 2020/2022); la última barra sí es real y se refresca.
  const history = MOCK_SMART_MONEY.filter((e) => !e.current);
  return { smartMoney: [...history, current], whaleTimeline };
}

/**
 * Devuelve la señal smart money. Si el modo en vivo está activo, la construye
 * con datos on-chain reales; si falla o está desactivado, cae al mock.
 * @param closes Cierres diarios reales del último año (CoinGecko) para el precio.
 */
export async function getSmartMoneySignals(closes: number[] | null): Promise<SmartMoneyResult> {
  const mock: Payload = { smartMoney: MOCK_SMART_MONEY, whaleTimeline: MOCK_WHALE_TIMELINE };

  if (!LIVE_DATA_ENABLED) {
    return { ...mock, live: false };
  }

  const { value, live } = await liveOrCache<Payload>(
    'smart-money',
    async () => {
      const [vol, addr] = await Promise.all([
        fetchJson<ChartResp>(chartUrl('estimated-transaction-volume-usd', '30days')),
        fetchJson<ChartResp>(chartUrl('n-unique-addresses', '14days')),
      ]);
      if (!vol.values?.length || !addr.values?.length) {
        throw new Error('series on-chain vacías');
      }

      const volSamples = tailSamples(vol.values, POINTS, STEP_DAYS).map((v) => v.y);
      const addrSamples = tailSamples(addr.values, POINTS, STEP_DAYS).map((v) => v.y);

      // Precio alineado con la misma cadencia semanal. Si no hay closes reales,
      // usamos el precio del mock (en $k → USD) para no romper la serie.
      const priceSamples =
        closes && closes.length >= POINTS * STEP_DAYS
          ? tailSamples(closes, POINTS, STEP_DAYS)
          : MOCK_WHALE_TIMELINE.map((p) => p.price * 1000);

      // Alineamos longitudes por si alguna serie trae menos puntos.
      const len = Math.min(volSamples.length, addrSamples.length, priceSamples.length);
      return buildPayload(
        volSamples.slice(-len),
        addrSamples.slice(-len),
        priceSamples.slice(-len),
      );
    },
    mock,
  );

  return { ...value, live };
}
