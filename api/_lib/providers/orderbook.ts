import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Proveedor: LIBRO DE ÓRDENES de BTC al contado, con cadena de respaldo.
//
// Alimenta la tarjeta «Presión del mercado». Antes lo pedía el NAVEGADOR
// directamente a Binance, y eso dejaba la tarjeta en «No disponible» para
// cualquiera con Binance bloqueado: por país, por la red de su empresa o por
// una extensión que corta los dominios de exchanges. Era el único bloque de la
// aplicación sin respaldo, mientras todos los demás pasan por el servidor con
// dos o tres proveedores detrás.
//
// Ahora se pide desde el servidor —donde no hay CORS ni extensiones— probando
// Binance, luego OKX y por último Bybit. Los tres publican los niveles de la
// misma forma: [precio, cantidad] ordenados de mejor a peor.
//
// El dato se cachea 5 segundos: es una foto del libro, y pedirlo en cada visita
// multiplicaría las llamadas sin que la barra se moviera de forma apreciable.
// =============================================================================

export interface OrderBookPressure {
  /** % del volumen del libro apoyado en el lado comprador (0-100). */
  buyPct: number;
  sellPct: number;
  /** Desequilibrio normalizado -1..1 (positivo = domina la compra). */
  imbalance: number;
  /** Volumen agregado a cada lado, en BTC. */
  bidVolume: number;
  askVolume: number;
  /** Diferencia entre la mejor venta y la mejor compra, en USD. */
  spread: number;
  spreadPct: number;
  /** Proveedor que sirvió el libro, para poder atribuirlo. */
  source: string;
}

/** Niveles [precio, cantidad] de mejor a peor, ya como números. */
type Levels = [number, number][];

const LEVELS = 20;

function parseLevels(rows: unknown, limit = LEVELS): Levels {
  if (!Array.isArray(rows)) return [];
  const out: Levels = [];
  for (const row of rows.slice(0, limit)) {
    if (!Array.isArray(row)) continue;
    const price = Number(row[0]);
    const qty = Number(row[1]);
    if (Number.isFinite(price) && Number.isFinite(qty) && price > 0 && qty > 0) {
      out.push([price, qty]);
    }
  }
  return out;
}

function measure(bids: Levels, asks: Levels, source: string): OrderBookPressure {
  if (bids.length === 0 || asks.length === 0) throw new Error('libro vacío');

  const sum = (rows: Levels) => rows.reduce((acc, [, qty]) => acc + qty, 0);
  const bidVolume = sum(bids);
  const askVolume = sum(asks);
  const total = bidVolume + askVolume;
  if (!(total > 0)) throw new Error('volumen del libro no válido');

  const bestBid = bids[0]![0];
  const bestAsk = asks[0]![0];
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  // Una venta por debajo de la mejor compra es un libro cruzado: o el proveedor
  // devolvió los lados al revés o el dato está roto. Se descarta y se prueba el
  // siguiente, en vez de enseñar un diferencial negativo.
  if (spread < 0) throw new Error('libro cruzado');

  return {
    buyPct: Number(((bidVolume / total) * 100).toFixed(1)),
    sellPct: Number(((askVolume / total) * 100).toFixed(1)),
    imbalance: Number(((bidVolume - askVolume) / total).toFixed(4)),
    bidVolume: Number(bidVolume.toFixed(3)),
    askVolume: Number(askVolume.toFixed(3)),
    spread: Number(spread.toFixed(2)),
    spreadPct: mid > 0 ? Number(((spread / mid) * 100).toFixed(4)) : 0,
    source,
  };
}

async function fromBinance(): Promise<OrderBookPressure> {
  const raw = await fetchJson<{ bids?: unknown; asks?: unknown }>(
    `https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=${LEVELS}`,
    { provider: 'binance:depth', timeoutMs: 6000 },
  );
  return measure(parseLevels(raw.bids), parseLevels(raw.asks), 'binance');
}

async function fromOkx(): Promise<OrderBookPressure> {
  const raw = await fetchJson<{ data?: { bids?: unknown; asks?: unknown }[] }>(
    `https://www.okx.com/api/v5/market/books?instId=BTC-USDT&sz=${LEVELS}`,
    { provider: 'okx:books', timeoutMs: 6000 },
  );
  const book = raw.data?.[0];
  if (!book) throw new Error('OKX no devolvió libro');
  return measure(parseLevels(book.bids), parseLevels(book.asks), 'okx');
}

async function fromBybit(): Promise<OrderBookPressure> {
  const raw = await fetchJson<{ result?: { b?: unknown; a?: unknown } }>(
    `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=BTCUSDT&limit=${LEVELS}`,
    { provider: 'bybit:orderbook', timeoutMs: 6000 },
  );
  const book = raw.result;
  if (!book) throw new Error('Bybit no devolvió libro');
  return measure(parseLevels(book.b), parseLevels(book.a), 'bybit');
}

export async function getOrderBookPressure(): Promise<ProviderResult<OrderBookPressure>> {
  const r = await swr<OrderBookPressure>(
    'orderbook:v1',
    { ttlMs: 5_000, staleMs: 5 * 60_000 },
    async () => {
      const errors: string[] = [];
      for (const attempt of [fromBinance, fromOkx, fromBybit]) {
        try {
          return await attempt();
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      throw new Error(`Ningún exchange devolvió el libro (${errors.join(' · ')})`);
    },
  );
  return { data: r.value, meta: metaFromCache(r.value.source, r.status, r.storedAt) };
}
