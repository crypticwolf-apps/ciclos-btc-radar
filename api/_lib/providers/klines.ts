import { fetchJson } from '../http.js';

// =============================================================================
// Velas diarias con CADENA DE RESPALDO entre exchanges.
//
// Por qué existe esto: Binance responde HTTP 451 ("no disponible por razones
// legales") a las peticiones que salen de los centros de datos de Vercel. Desde
// el NAVEGADOR sí funciona —va con la IP del usuario, y por eso los streams en
// vivo siguen usándolo—, pero el backend necesita otra vía.
//
// Se prueba un exchange tras otro con BTC y se usa el primero que responda, de
// modo que un bloqueo regional o una caída puntual no dejan la sección sin
// datos. Todos son endpoints públicos, gratuitos y sin clave.
// =============================================================================

export interface Exchange {
  name: string;
  /** Activos base con par contra USDT (o equivalente) disponibles al contado. */
  listUsdtBases(): Promise<Set<string>>;
  /** Cierres diarios de BASE/USDT, del más antiguo al más reciente. */
  closes(base: string, limit: number): Promise<number[]>;
  /** Cierres diarios de ETH/BTC, que mide la rotación sin el ruido del dólar. */
  ethBtcCloses(limit: number): Promise<number[]>;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
};

const cleanAscending = (values: number[]): number[] => values.filter((n) => Number.isFinite(n));

// --- Binance ----------------------------------------------------------------

const binance: Exchange = {
  name: 'binance',
  async listUsdtBases() {
    const raw = await fetchJson<{ symbols: { baseAsset: string; quoteAsset: string; status: string }[] }>(
      'https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT',
      { provider: 'binance:exchangeInfo', timeoutMs: 15_000, retries: 0 },
    );
    return new Set(
      raw.symbols
        .filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map((s) => s.baseAsset.toUpperCase()),
    );
  },
  async closes(base, limit) {
    const raw = await fetchJson<unknown[]>(
      `https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=1d&limit=${limit}`,
      { provider: `binance:${base}`, timeoutMs: 12_000, retries: 0 },
    );
    // Binance devuelve orden ascendente y el cierre en el índice 4.
    return cleanAscending(raw.map((r) => (Array.isArray(r) ? num(r[4]) : Number.NaN)));
  },
  async ethBtcCloses(limit) {
    const raw = await fetchJson<unknown[]>(
      `https://api.binance.com/api/v3/klines?symbol=ETHBTC&interval=1d&limit=${limit}`,
      { provider: 'binance:ETHBTC', timeoutMs: 12_000, retries: 0 },
    );
    return cleanAscending(raw.map((r) => (Array.isArray(r) ? num(r[4]) : Number.NaN)));
  },
};

// --- OKX --------------------------------------------------------------------

interface OkxResponse {
  code: string;
  data: string[][];
}

/** OKX y Bybit devuelven de más reciente a más antiguo: hay que invertir. */
function okxCloses(rows: string[][]): number[] {
  return cleanAscending(rows.map((r) => num(r[4])).reverse());
}

const okx: Exchange = {
  name: 'okx',
  async listUsdtBases() {
    const raw = await fetchJson<{ data: { baseCcy: string; quoteCcy: string; state: string }[] }>(
      'https://www.okx.com/api/v5/public/instruments?instType=SPOT',
      { provider: 'okx:instruments', timeoutMs: 15_000, retries: 0 },
    );
    return new Set(
      raw.data
        .filter((i) => i.quoteCcy === 'USDT' && i.state === 'live')
        .map((i) => i.baseCcy.toUpperCase()),
    );
  },
  async closes(base, limit) {
    const raw = await fetchJson<OkxResponse>(
      `https://www.okx.com/api/v5/market/candles?instId=${base}-USDT&bar=1D&limit=${Math.min(limit, 300)}`,
      { provider: `okx:${base}`, timeoutMs: 12_000, retries: 0 },
    );
    if (raw.code !== '0') throw new Error(`OKX devolvió code ${raw.code}`);
    return okxCloses(raw.data);
  },
  async ethBtcCloses(limit) {
    const raw = await fetchJson<OkxResponse>(
      `https://www.okx.com/api/v5/market/candles?instId=ETH-BTC&bar=1D&limit=${Math.min(limit, 300)}`,
      { provider: 'okx:ETH-BTC', timeoutMs: 12_000, retries: 0 },
    );
    if (raw.code !== '0') throw new Error(`OKX devolvió code ${raw.code}`);
    return okxCloses(raw.data);
  },
};

// --- Bybit ------------------------------------------------------------------

interface BybitResponse {
  retCode: number;
  result: { list: string[][] };
}

const bybit: Exchange = {
  name: 'bybit',
  async listUsdtBases() {
    const raw = await fetchJson<{
      retCode: number;
      result: { list: { baseCoin: string; quoteCoin: string; status: string }[] };
    }>('https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000', {
      provider: 'bybit:instruments',
      timeoutMs: 15_000,
      retries: 0,
    });
    if (raw.retCode !== 0) throw new Error(`Bybit devolvió retCode ${raw.retCode}`);
    return new Set(
      raw.result.list
        .filter((i) => i.quoteCoin === 'USDT' && i.status === 'Trading')
        .map((i) => i.baseCoin.toUpperCase()),
    );
  },
  async closes(base, limit) {
    const raw = await fetchJson<BybitResponse>(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${base}USDT&interval=D&limit=${Math.min(limit, 1000)}`,
      { provider: `bybit:${base}`, timeoutMs: 12_000, retries: 0 },
    );
    if (raw.retCode !== 0) throw new Error(`Bybit devolvió retCode ${raw.retCode}`);
    return cleanAscending(raw.result.list.map((r) => num(r[4])).reverse());
  },
  async ethBtcCloses(limit) {
    const raw = await fetchJson<BybitResponse>(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=ETHBTC&interval=D&limit=${Math.min(limit, 1000)}`,
      { provider: 'bybit:ETHBTC', timeoutMs: 12_000, retries: 0 },
    );
    if (raw.retCode !== 0) throw new Error(`Bybit devolvió retCode ${raw.retCode}`);
    return cleanAscending(raw.result.list.map((r) => num(r[4])).reverse());
  },
};

/** Orden de preferencia. Binance primero por cobertura, si es alcanzable. */
const EXCHANGES: readonly Exchange[] = [binance, okx, bybit];

/**
 * Devuelve el primer exchange que responde de verdad, comprobándolo con BTC.
 * Si ninguno responde, lanza: es preferible declarar el dato no disponible
 * que publicar un análisis a medias.
 */
export async function pickExchange(minCandles: number): Promise<Exchange> {
  const errors: string[] = [];
  for (const ex of EXCHANGES) {
    try {
      const probe = await ex.closes('BTC', Math.min(minCandles, 120));
      if (probe.length >= Math.min(minCandles, 100)) return ex;
      errors.push(`${ex.name}: solo ${probe.length} velas`);
    } catch (err) {
      errors.push(`${ex.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Ningún proveedor de velas respondió (${errors.join(' · ')})`);
}
