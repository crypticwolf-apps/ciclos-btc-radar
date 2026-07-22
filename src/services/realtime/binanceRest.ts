// =============================================================================
// Endpoints REST públicos de Binance (sin clave) para los datos que NO existen
// como stream: profundidad del libro, open interest y ratios de posicionamiento.
//
// Frecuencias elegidas para no castigar el móvil ni los límites del proveedor:
//   libro de órdenes ....... 4 s   (basta para una barra de presión)
//   open interest .......... 60 s  (el valor se publica cada pocos segundos)
//   ratios long/short ...... 5 min (la API los publica cada 5 min como mínimo)
//
// Se descarga profundidad 20, no el libro entero: pesa ~1 KB por consulta.
// =============================================================================

const SPOT = 'https://api.binance.com/api/v3';
const FUTURES = 'https://fapi.binance.com';

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Binance respondió ${response.status}`);
  return (await response.json()) as T;
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// --- Presión del mercado (libro de órdenes) ---------------------------------

export interface MarketPressure {
  /** % del volumen del libro que está en el lado comprador (0-100). */
  buyPct: number;
  sellPct: number;
  /** Desequilibrio normalizado -1..1 (positivo = domina la compra). */
  imbalance: number;
  /** Volumen agregado a cada lado, en BTC. */
  bidVolume: number;
  askVolume: number;
  spread: number;
  spreadPct: number;
  at: number;
}

interface DepthResponse {
  bids: [string, string][];
  asks: [string, string][];
}

/**
 * Presión compradora/vendedora a partir de los 20 mejores niveles del libro.
 *
 * Es una foto del libro visible AHORA, no una predicción: mide qué lado tiene
 * más volumen apoyado cerca del precio.
 */
export async function fetchMarketPressure(signal: AbortSignal): Promise<MarketPressure> {
  const data = await getJson<DepthResponse>(`${SPOT}/depth?symbol=BTCUSDT&limit=20`, signal);
  if (!Array.isArray(data.bids) || !Array.isArray(data.asks) || data.bids.length === 0) {
    throw new Error('Binance devolvió un libro de órdenes vacío');
  }

  const sum = (rows: [string, string][]) => rows.reduce((acc, [, qty]) => acc + toNumber(qty), 0);
  const bidVolume = sum(data.bids);
  const askVolume = sum(data.asks);
  const total = bidVolume + askVolume;
  if (total <= 0) throw new Error('Volumen del libro no válido');

  const bestBid = toNumber(data.bids[0]![0]);
  const bestAsk = toNumber(data.asks[0]![0]);
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;

  return {
    buyPct: Number(((bidVolume / total) * 100).toFixed(1)),
    sellPct: Number(((askVolume / total) * 100).toFixed(1)),
    imbalance: Number(((bidVolume - askVolume) / total).toFixed(4)),
    bidVolume: Number(bidVolume.toFixed(3)),
    askVolume: Number(askVolume.toFixed(3)),
    spread: Number(spread.toFixed(2)),
    spreadPct: mid > 0 ? Number(((spread / mid) * 100).toFixed(4)) : 0,
    at: Date.now(),
  };
}

// --- Derivados: open interest y posicionamiento ------------------------------

export interface DerivativesSnapshot {
  /** Precio de marca del perpetuo (referencia para liquidaciones). */
  markPrice: number | null;
  /** Precio índice del subyacente. */
  indexPrice: number | null;
  /** Funding vigente en tanto por uno (0.0001 = 0,01% cada 8 h). */
  fundingRate: number | null;
  /** Momento del próximo pago de funding (epoch ms). */
  nextFundingAt: number | null;
  /** Contratos abiertos, en BTC. */
  openInterestBtc: number;
  /** Valor aproximado del open interest en USD. */
  openInterestUsd: number | null;
  /** Variación del open interest en 24 h (%). */
  openInterestChange24hPct: number | null;
  /** Cuentas largas frente a cortas (>1 = más cuentas largas). */
  longShortRatio: number | null;
  longAccountPct: number | null;
  /** Volumen agresor comprador frente a vendedor en la última hora. */
  takerBuySellRatio: number | null;
  at: number;
}

interface PremiumIndexResponse {
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}
interface OpenInterestResponse {
  openInterest: string;
}
interface OpenInterestHistRow {
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}
interface LongShortRow {
  longAccount: string;
  longShortRatio: string;
}
interface TakerRow {
  buySellRatio: string;
}

/**
 * Foto de derivados. Cada bloque se pide por separado y con `allSettled`: si
 * Binance limita uno de los endpoints de estadísticas, el resto sigue llegando
 * y el campo que falte queda a `null` en lugar de romper la tarjeta.
 */
export async function fetchDerivatives(signal: AbortSignal): Promise<DerivativesSnapshot> {
  const [premium, oiNow, oiHist, longShort, taker] = await Promise.allSettled([
    getJson<PremiumIndexResponse>(`${FUTURES}/fapi/v1/premiumIndex?symbol=BTCUSDT`, signal),
    getJson<OpenInterestResponse>(`${FUTURES}/fapi/v1/openInterest?symbol=BTCUSDT`, signal),
    getJson<OpenInterestHistRow[]>(
      `${FUTURES}/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=25`,
      signal,
    ),
    getJson<LongShortRow[]>(
      `${FUTURES}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1`,
      signal,
    ),
    getJson<TakerRow[]>(
      `${FUTURES}/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1`,
      signal,
    ),
  ]);

  if (oiNow.status === 'rejected') {
    throw oiNow.reason instanceof Error ? oiNow.reason : new Error('Open interest no disponible');
  }

  const openInterestBtc = toNumber(oiNow.value.openInterest);

  // Variación en 24 h a partir de la serie horaria (25 puntos = ~24 h).
  let openInterestChange24hPct: number | null = null;
  let openInterestUsd: number | null = null;
  if (oiHist.status === 'fulfilled' && oiHist.value.length > 1) {
    const rows = oiHist.value;
    const oldest = toNumber(rows[0]!.sumOpenInterest);
    const newest = toNumber(rows[rows.length - 1]!.sumOpenInterest);
    if (oldest > 0) {
      openInterestChange24hPct = Number((((newest - oldest) / oldest) * 100).toFixed(2));
    }
    const value = toNumber(rows[rows.length - 1]!.sumOpenInterestValue);
    const contracts = newest;
    // Escalamos el valor USD del último punto al open interest actual.
    if (value > 0 && contracts > 0) {
      openInterestUsd = Math.round((value / contracts) * openInterestBtc);
    }
  }

  const lsRow = longShort.status === 'fulfilled' ? longShort.value[0] : undefined;
  const takerRow = taker.status === 'fulfilled' ? taker.value[0] : undefined;
  const premiumRow = premium.status === 'fulfilled' ? premium.value : undefined;

  return {
    markPrice: premiumRow ? toNumber(premiumRow.markPrice) : null,
    indexPrice: premiumRow ? toNumber(premiumRow.indexPrice) : null,
    fundingRate: premiumRow ? toNumber(premiumRow.lastFundingRate) : null,
    nextFundingAt: premiumRow ? premiumRow.nextFundingTime : null,
    openInterestBtc: Number(openInterestBtc.toFixed(1)),
    openInterestUsd,
    openInterestChange24hPct,
    longShortRatio: lsRow ? Number(toNumber(lsRow.longShortRatio).toFixed(3)) : null,
    longAccountPct: lsRow ? Number((toNumber(lsRow.longAccount) * 100).toFixed(1)) : null,
    takerBuySellRatio: takerRow ? Number(toNumber(takerRow.buySellRatio).toFixed(3)) : null,
    at: Date.now(),
  };
}
