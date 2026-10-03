import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';
import { readEnv } from '../runtimeEnv.js';
import { getAltseason } from './altseason.js';
import { isExcludedSymbol } from '../../../src/lib/altseason/config.js';

// =============================================================================
// Qué CATEGORÍAS de altcoins van en cabeza: L1, L2, IA, RWA, DeFi, DePIN,
// memes, gaming, privacidad y tokens de exchange.
//
//   · Quién está en cada categoría: las listas de CoinGecko, las 20 mayores
//     por capitalización (una petición por categoría, una vez al día). Si
//     CoinGecko no responde, una lista propia de respaldo con las conocidas.
//   · Cuánto se han movido: 24 h, 7 d, 30 d y 1 año de CoinGecko (top 250,
//     cada 10 min); 90 d de las velas del análisis Altseason; «máx» es la
//     distancia a su máximo histórico (ATH), porque el rendimiento desde que
//     salió cada moneda no lo publica ninguna API gratuita.
//
// El navegador lo rehace en vivo con el precio al contado (ver
// src/lib/altseason/categories.ts) y compara categorías por la MEDIANA de sus
// monedas: un único meme que se dispara no mueve la categoría entera.
// =============================================================================

const CG = 'https://api.coingecko.com/api/v3';
const MAX_MIEMBROS = 20;

interface CategoryDef {
  id: string;
  nombre: string;
  corto: string;
  /** Respaldo si CoinGecko no da la lista: las más conocidas de la categoría. */
  respaldo: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'layer-1', nombre: 'Layer 1', corto: 'L1', respaldo: ['ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'TRX', 'AVAX', 'TON', 'SUI', 'DOT', 'NEAR', 'APT', 'ATOM', 'ALGO', 'HBAR', 'ICP', 'SEI', 'KAS', 'XLM', 'LTC'] },
  { id: 'layer-2', nombre: 'Layer 2', corto: 'L2', respaldo: ['ARB', 'OP', 'MNT', 'IMX', 'STRK', 'POL', 'ZK', 'METIS', 'MANTA', 'SKL', 'LRC'] },
  { id: 'artificial-intelligence', nombre: 'Inteligencia artificial', corto: 'IA', respaldo: ['TAO', 'FET', 'RENDER', 'WLD', 'VIRTUAL', 'GRT', 'AKT', 'ARKM', 'IO', 'AIOZ'] },
  { id: 'real-world-assets-rwa', nombre: 'Activos reales (RWA)', corto: 'RWA', respaldo: ['ONDO', 'OM', 'PLUME', 'POLYX', 'CFG', 'SYRUP', 'TRU'] },
  { id: 'decentralized-finance-defi', nombre: 'DeFi', corto: 'DeFi', respaldo: ['UNI', 'AAVE', 'LINK', 'LDO', 'CRV', 'PENDLE', 'ENA', 'JUP', 'RAY', 'CAKE', 'COMP', 'SNX', 'DYDX', 'INJ', 'HYPE'] },
  { id: 'depin', nombre: 'DePIN', corto: 'DePIN', respaldo: ['FIL', 'RENDER', 'HNT', 'AR', 'THETA', 'IOTX', 'AKT', 'GRASS', 'JASMY', 'ANKR', 'STORJ'] },
  { id: 'meme-token', nombre: 'Memes', corto: 'Memes', respaldo: ['DOGE', 'SHIB', 'PEPE', 'BONK', 'WIF', 'FLOKI', 'TRUMP', 'BRETT', 'POPCAT', 'PENGU', 'FARTCOIN', 'SPX'] },
  { id: 'gaming', nombre: 'Gaming', corto: 'Gaming', respaldo: ['IMX', 'SAND', 'MANA', 'AXS', 'GALA', 'BEAM', 'RON', 'APE', 'ILV', 'ENJ'] },
  { id: 'privacy-coins', nombre: 'Privacidad', corto: 'Privacidad', respaldo: ['XMR', 'ZEC', 'DASH', 'ROSE', 'SCRT', 'DCR'] },
  { id: 'exchange-based-tokens', nombre: 'Tokens de exchange', corto: 'Exchange', respaldo: ['BNB', 'OKB', 'CRO', 'LEO', 'KCS', 'BGB', 'GT'] },
];

export type Periodo = 'd1' | 'd7' | 'd30' | 'd90' | 'y1';

export interface CategoryMember {
  symbol: string;
  name: string;
  /** Precio de CoinGecko con el que se midieron las variaciones (para el «en vivo»). */
  price: number;
  marketCap: number;
  /** Variación en % por periodo; `null` si no se tiene. */
  cambios: Record<Periodo, number | null>;
  /** % desde su máximo histórico (negativo). */
  ath: number | null;
}

export interface CategoryData {
  id: string;
  nombre: string;
  corto: string;
  /** De dónde sale la lista: CoinGecko o el respaldo propio. */
  lista: 'coingecko' | 'respaldo';
  miembros: CategoryMember[];
}

export interface CategoriesData {
  categorias: CategoryData[];
  /** BTC, como referencia. */
  btc: CategoryMember | null;
  /** Exchange de las velas del Altseason: los precios en vivo se piden al mismo. */
  exchange: string | null;
  observedAt: string;
}

const Market = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  current_price: z.number().nullable(),
  market_cap: z.number().nullable(),
  ath_change_percentage: z.number().nullable().optional(),
  price_change_percentage_24h_in_currency: z.number().nullable().optional(),
  price_change_percentage_7d_in_currency: z.number().nullable().optional(),
  price_change_percentage_30d_in_currency: z.number().nullable().optional(),
  price_change_percentage_1y_in_currency: z.number().nullable().optional(),
});
type MarketRow = z.infer<typeof Market>;

function cgUrl(path: string): string {
  const u = new URL(CG + path);
  const key = readEnv('COINGECKO_API_KEY');
  if (key) u.searchParams.set('x_cg_demo_api_key', key);
  return u.toString();
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** El resultado de `p`, o `fallback` si tarda más de `ms` o falla. */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<T>((r) => (timer = setTimeout(() => r(fallback), ms)));
  try {
    return await Promise.race([p.catch(() => fallback), limite]);
  } finally {
    clearTimeout(timer);
  }
}

/** Quién está en cada categoría (ids de CoinGecko). Una vez al día. */
async function getMembership(): Promise<Record<string, string[]>> {
  const r = await swr('categorias:miembros:v1', { ttlMs: 24 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 }, async () => {
    const out: Record<string, string[]> = {};
    // En serie y con pausa: el plan gratuito de CoinGecko corta las ráfagas.
    for (const c of CATEGORIES) {
      try {
        const raw = await fetchJson<unknown>(
          cgUrl(`/coins/markets?vs_currency=usd&category=${c.id}&order=market_cap_desc&per_page=40&page=1`),
          { provider: `coingecko:categoria:${c.id}`, timeoutMs: 12_000 },
        );
        const ids = z.array(z.object({ id: z.string() })).parse(raw).map((x) => x.id);
        if (ids.length > 0) out[c.id] = ids;
      } catch {
        /* esta categoría usará su lista de respaldo */
      }
      await pausa(1_200);
    }
    return out;
  });
  return r.value;
}

/** Las 250 mayores con sus variaciones. Cada 10 min. */
async function getMarket(): Promise<{ rows: MarketRow[]; storedAt: number; status: 'live' | 'cached' | 'stale' }> {
  const r = await swr('categorias:mercado:v1', { ttlMs: 10 * 60_000, staleMs: 6 * 60 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>(
      cgUrl(
        '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1' +
          '&price_change_percentage=24h,7d,30d,1y',
      ),
      { provider: 'coingecko:mercado', timeoutMs: 15_000 },
    );
    return z.array(Market).parse(raw);
  });
  return { rows: r.value, storedAt: r.storedAt, status: r.status };
}

const pct90 = (now: number | null, then: number | null | undefined) =>
  now != null && then != null && then > 0 ? Number((((now - then) / then) * 100).toFixed(2)) : null;

function member(row: MarketRow, d90: number | null): CategoryMember | null {
  if (!row.current_price || !(row.current_price > 0)) return null;
  return {
    symbol: row.symbol.toUpperCase(),
    name: row.name,
    price: row.current_price,
    marketCap: row.market_cap ?? 0,
    cambios: {
      d1: row.price_change_percentage_24h_in_currency ?? null,
      d7: row.price_change_percentage_7d_in_currency ?? null,
      d30: row.price_change_percentage_30d_in_currency ?? null,
      d90,
      y1: row.price_change_percentage_1y_in_currency ?? null,
    },
    ath: row.ath_change_percentage ?? null,
  };
}

/** Une listas, mercado y 90 d. Pura, para poder probarla. */
export function buildCategories(
  rows: MarketRow[],
  membership: Record<string, string[]>,
  d90BySymbol: Map<string, number | null>,
  btc90: number | null,
): Pick<CategoriesData, 'categorias' | 'btc'> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bySymbol = new Map<string, MarketRow>();
  // Por símbolo, la de mayor capitalización (hay símbolos repetidos).
  for (const r of rows) if (!bySymbol.has(r.symbol.toUpperCase())) bySymbol.set(r.symbol.toUpperCase(), r);

  const categorias = CATEGORIES.map((c): CategoryData => {
    const ids = membership[c.id];
    const lista: CategoryData['lista'] = ids ? 'coingecko' : 'respaldo';
    const candidatos = ids
      ? ids.map((id) => byId.get(id)).filter((r): r is MarketRow => r != null)
      : c.respaldo.map((s) => bySymbol.get(s)).filter((r): r is MarketRow => r != null);
    const miembros = candidatos
      .filter((r) => r.id !== 'bitcoin' && !isExcludedSymbol(r.symbol, r.name))
      .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
      .slice(0, MAX_MIEMBROS)
      .map((r) => member(r, d90BySymbol.get(r.symbol.toUpperCase()) ?? null))
      .filter((m): m is CategoryMember => m != null);
    return { id: c.id, nombre: c.nombre, corto: c.corto, lista, miembros };
  });

  const btcRow = byId.get('bitcoin');
  return { categorias, btc: btcRow ? member(btcRow, btc90) : null };
}

export async function getCategories(): Promise<ProviderResult<CategoriesData>> {
  // Las listas de CoinGecko (una petición por categoría, en serie) pueden
  // tardar 15-20 s la primera vez del día, y el análisis Altseason unos
  // segundos si está en frío. No se les espera más de lo razonable: se responde
  // con las listas de respaldo o sin los 90 días, y la carga sigue en curso
  // para la siguiente petición (la caché la comparte).
  const [market, membership, alt] = await Promise.all([
    getMarket(),
    withTimeout(getMembership(), 4_000, {} as Record<string, string[]>),
    withTimeout(getAltseason(), 6_000, null),
  ]);

  // 90 d: de las velas del Altseason (las 100 altcoins analizadas).
  const d90 = new Map<string, number | null>();
  for (const r of alt?.data.ranking ?? []) d90.set(r.symbol.toUpperCase(), r.change90d);
  const btcRow = market.rows.find((r) => r.id === 'bitcoin');
  const btc90 = pct90(btcRow?.current_price ?? null, alt?.data.btcRef?.close90);

  const built = buildCategories(market.rows, membership, d90, btc90);
  return {
    data: {
      ...built,
      exchange: alt?.data.exchange ?? null,
      observedAt: new Date(market.storedAt).toISOString(),
    },
    meta: metaFromCache('coingecko:categorias', market.status, market.storedAt),
  };
}
