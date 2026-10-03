import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Proveedor: PRECIO AL CONTADO de todas las criptomonedas, en una sola llamada.
//
// Alimenta el ranking de altcoins en vivo. Cada exchange publica de una vez el
// último precio de todos sus pares, así que una petición cubre el ranking
// entero: no hace falta una por moneda. Cadena Binance → OKX → Bybit, igual
// que el resto de datos de exchange, porque Binance bloquea a los centros de
// datos con facilidad.
//
// Solo pares contra USDT, que es la referencia en dólares de los tres. Cache
// de 5 s: el precio cambia sin parar, pero pedirlo más a menudo no cambiaría
// lo que enseña el ranking y multiplicaría las llamadas.
// =============================================================================

export interface SpotPrices {
  /** Base («ETH») → último precio en USDT. */
  prices: Record<string, number>;
  /** Exchange que respondió. */
  source: string;
}

/** Tope de monedas por petición: el ranking pide unas cien. */
export const MAX_SYMBOLS = 150;

function fromPairs(rows: { pair: string; price: unknown }[], quote = 'USDT'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { pair, price } of rows) {
    if (!pair.endsWith(quote)) continue;
    const base = pair.slice(0, -quote.length).replace(/[-_/]$/, '');
    const n = Number(price);
    if (base && Number.isFinite(n) && n > 0) out[base] = n;
  }
  if (Object.keys(out).length < 50) throw new Error('lista de precios incompleta');
  return out;
}

async function fromBinance(): Promise<Record<string, number>> {
  const raw = await fetchJson<{ symbol: string; price: string }[]>(
    'https://api.binance.com/api/v3/ticker/price',
    { provider: 'binance:precios', timeoutMs: 6000 },
  );
  if (!Array.isArray(raw)) throw new Error('Binance no devolvió una lista');
  return fromPairs(raw.map((r) => ({ pair: r.symbol, price: r.price })));
}

async function fromOkx(): Promise<Record<string, number>> {
  const raw = await fetchJson<{ data?: { instId: string; last: string }[] }>(
    'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
    { provider: 'okx:precios', timeoutMs: 6000 },
  );
  // OKX escribe los pares con guion: «ETH-USDT».
  return fromPairs((raw.data ?? []).map((r) => ({ pair: r.instId.replace('-', ''), price: r.last })));
}

async function fromBybit(): Promise<Record<string, number>> {
  const raw = await fetchJson<{ result?: { list?: { symbol: string; lastPrice: string }[] } }>(
    'https://api.bybit.com/v5/market/tickers?category=spot',
    { provider: 'bybit:precios', timeoutMs: 6000 },
  );
  return fromPairs((raw.result?.list ?? []).map((r) => ({ pair: r.symbol, price: r.lastPrice })));
}

export async function getSpotPrices(): Promise<ProviderResult<SpotPrices>> {
  const r = await swr<SpotPrices>('precios:spot:v1', { ttlMs: 5_000, staleMs: 5 * 60_000 }, async () => {
    const errors: string[] = [];
    for (const [source, load] of [
      ['binance', fromBinance],
      ['okx', fromOkx],
      ['bybit', fromBybit],
    ] as const) {
      try {
        return { prices: await load(), source };
      } catch (err) {
        errors.push(`${source}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(`Ningún exchange devolvió precios (${errors.join(' · ')})`);
  });
  return { data: r.value, meta: metaFromCache(`precios:${r.value.source}`, r.status, r.storedAt) };
}

/** Valida y normaliza la lista de símbolos que pide el navegador. */
export function parseSymbols(raw: string | null): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const s of raw.split(',')) {
    const sym = s.trim().toUpperCase();
    if (/^[A-Z0-9]{1,15}$/.test(sym)) out.add(sym);
    if (out.size >= MAX_SYMBOLS) break;
  }
  return [...out];
}
