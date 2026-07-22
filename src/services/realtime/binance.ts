import { socketHub, type SocketStatus } from './socketHub';

// =============================================================================
// Streams públicos de Binance (sin clave, sin registro).
//
// Se usan DOS conexiones como máximo, y ninguna por componente:
//
//   1. Spot (siempre que la app está abierta y visible)
//      wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@bookTicker
//      → precio, variación 24 h, máximo/mínimo 24 h, volumen, mejor compra y
//        venta, spread y hora de la última operación.
//
//   2. Futuros — SOLO liquidaciones (y solo mientras se están mirando)
//      wss://fstream.binance.com/ws/btcusdt@forceOrder
//      → cada liquidación forzada, en el momento en que ocurre.
//
// Son hosts distintos, así que no pueden multiplexarse en un solo socket. La de
// futuros se conecta y se cierra sola por recuento de suscriptores, de modo que
// en la pantalla de inicio solo hay UNA conexión abierta.
//
// Por qué las liquidaciones van por socket y el RESTO de derivados no:
//   · Una liquidación es un EVENTO puntual; si no se escucha en directo, se
//     pierde. No hay endpoint REST público que las liste.
//   · Mark price, funding, open interest y ratios son ESTADO, no eventos: se
//     leen igual de bien por REST cada 30-60 s (ver `binanceRest.ts`) y así se
//     evita depender de un stream que en algunas redes se queda mudo.
//
// El silencio en este canal es NORMAL (mercado tranquilo = ninguna liquidación),
// por eso se suscribe con `watchSilence: false`: no debe forzar reconexiones.
// =============================================================================

const SPOT_URL =
  'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@bookTicker';
const FUTURES_URL = 'wss://fstream.binance.com/ws/btcusdt@forceOrder';

/** Envoltorio del stream combinado de Binance: { stream, data }. */
interface CombinedFrame {
  stream?: unknown;
  data?: unknown;
}

function frameOf(payload: unknown): { stream: string; data: Record<string, unknown> } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { stream, data } = payload as CombinedFrame;
  if (typeof stream !== 'string' || typeof data !== 'object' || data === null) return null;
  return { stream, data: data as Record<string, unknown> };
}

/** Lee un campo numérico que Binance envía como cadena. */
function n(source: Record<string, unknown>, key: string): number | null {
  const raw = source[key];
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// --- Spot: precio y libro ----------------------------------------------------

export interface LiveTicker {
  priceUsd: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  /** Volumen de 24 h en USDT. */
  quoteVolume24h: number;
  /** Momento de la última operación (epoch ms). */
  tradeAt: number;
}

export interface LiveBook {
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  /** Diferencia entre compra y venta, en USD. */
  spread: number;
  /** Spread como porcentaje del precio medio. */
  spreadPct: number;
  at: number;
}

export interface SpotSnapshot {
  ticker: LiveTicker | null;
  book: LiveBook | null;
  status: SocketStatus;
}

export type SpotListener = (snapshot: Partial<SpotSnapshot>) => void;

/**
 * Suscribe al stream spot. Devuelve la baja.
 * Emite parcialmente: solo el trozo que ha cambiado en cada trama.
 */
export function subscribeSpot(listener: SpotListener): () => void {
  return socketHub.subscribe(
    SPOT_URL,
    (payload) => {
      const frame = frameOf(payload);
      if (!frame) return;

      if (frame.stream.endsWith('@ticker')) {
        const d = frame.data;
        const priceUsd = n(d, 'c');
        const changePct24h = n(d, 'P');
        const high24h = n(d, 'h');
        const low24h = n(d, 'l');
        const quoteVolume24h = n(d, 'q');
        if (priceUsd == null || priceUsd <= 0) return;
        listener({
          ticker: {
            priceUsd,
            changePct24h: changePct24h ?? 0,
            high24h: high24h ?? priceUsd,
            low24h: low24h ?? priceUsd,
            quoteVolume24h: quoteVolume24h ?? 0,
            tradeAt: n(d, 'C') ?? Date.now(),
          },
        });
        return;
      }

      if (frame.stream.endsWith('@bookTicker')) {
        const d = frame.data;
        const bidPrice = n(d, 'b');
        const askPrice = n(d, 'a');
        const bidQty = n(d, 'B');
        const askQty = n(d, 'A');
        if (bidPrice == null || askPrice == null || bidPrice <= 0 || askPrice <= 0) return;
        const mid = (bidPrice + askPrice) / 2;
        const spread = askPrice - bidPrice;
        listener({
          book: {
            bidPrice,
            bidQty: bidQty ?? 0,
            askPrice,
            askQty: askQty ?? 0,
            spread,
            spreadPct: mid > 0 ? (spread / mid) * 100 : 0,
            at: Date.now(),
          },
        });
      }
    },
    (status) => listener({ status }),
  );
}

// --- Futuros: liquidaciones --------------------------------------------------

export interface Liquidation {
  id: string;
  /** 'SELL' liquida posiciones LARGAS; 'BUY' liquida CORTAS. */
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  /** Valor aproximado en USD. */
  valueUsd: number;
  at: number;
}

export interface FuturesSnapshot {
  liquidation: Liquidation | null;
  status: SocketStatus;
}

export type FuturesListener = (snapshot: Partial<FuturesSnapshot>) => void;

/**
 * Suscribe al stream de liquidaciones. Solo debe usarse desde vistas que las
 * muestren: al desmontarse la última, la conexión se cierra sola.
 *
 * Endpoint simple (`/ws/`), no combinado: la trama llega en la raíz del mensaje.
 */
export function subscribeFutures(listener: FuturesListener): () => void {
  return socketHub.subscribe(
    FUTURES_URL,
    (payload) => {
      if (typeof payload !== 'object' || payload === null) return;
      // La orden de liquidación viene anidada en `o`.
      const order = (payload as Record<string, unknown>).o;
      if (typeof order !== 'object' || order === null) return;
      const o = order as Record<string, unknown>;
      const price = n(o, 'ap') ?? n(o, 'p');
      const quantity = n(o, 'z') ?? n(o, 'q');
      const side = o.S === 'BUY' ? 'BUY' : 'SELL';
      if (price == null || quantity == null || price <= 0 || quantity <= 0) return;
      const at = n(o, 'T') ?? Date.now();
      listener({
        liquidation: {
          id: `${at}-${price}-${quantity}`,
          side,
          price,
          quantity,
          valueUsd: price * quantity,
          at,
        },
      });
    },
    (status) => listener({ status }),
    // El silencio es normal aquí: no debe disparar el vigilante de reconexión.
    { watchSilence: false },
  );
}

export const REALTIME_URLS = { spot: SPOT_URL, futures: FUTURES_URL } as const;
