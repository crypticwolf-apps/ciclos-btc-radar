import type { CategoriesData, CategoryMember, Periodo } from '@/types/categories';
import { samePrice } from '@/lib/altseason/config';

// =============================================================================
// Categorías de altcoins en vivo: qué familia (L1, IA, memes…) va en cabeza.
//
// El servidor manda, por moneda, sus variaciones y el precio con el que se
// midieron. Con el precio al contado de ahora se rehacen todas a la vez: si una
// moneda ha subido un 2% desde entonces, su 24 h, 7 d, 30 d… suben con ella.
//
// Cada categoría se resume con la MEDIANA de sus monedas: un único meme que se
// dispara no mueve la categoría entera, y una categoría solo «predomina» si
// la mayoría de las suyas acompaña.
// =============================================================================

export type PeriodoVista = Periodo | 'ath';

/** Moneda rehecha con el precio de ahora; sin precio (o si no cuadra) queda igual. */
export function liveMember(m: CategoryMember, price: number | undefined): CategoryMember {
  if (price == null || !(price > 0) || !samePrice(price, m.price)) return m;
  const f = price / m.price;
  const mover = (v: number | null) => (v == null ? null : ((1 + v / 100) * f - 1) * 100);
  return {
    ...m,
    price,
    cambios: {
      d1: mover(m.cambios.d1),
      d7: mover(m.cambios.d7),
      d30: mover(m.cambios.d30),
      d90: mover(m.cambios.d90),
      y1: mover(m.cambios.y1),
    },
    // Por encima de su máximo, el máximo es el precio de ahora: 0%.
    ath: m.ath == null ? null : Math.min(0, mover(m.ath)!),
  };
}

const valor = (m: CategoryMember, p: PeriodoVista) => (p === 'ath' ? m.ath : m.cambios[p]);

export function mediana(v: number[]): number | null {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export interface CategoryRank {
  id: string;
  nombre: string;
  corto: string;
  lista: 'coingecko' | 'respaldo';
  /** Monedas con dato en este periodo / monedas de la categoría. */
  conDato: number;
  total: number;
  mediana: number | null;
  /** Mediana menos lo que hizo BTC en el mismo periodo, en puntos. */
  vsBtc: number | null;
  /** Cuántas de la categoría lo hacen mejor que BTC, en %. */
  batenBtc: number | null;
  mejor: { symbol: string; valor: number } | null;
}

/** Mínimo de monedas con dato para dar la mediana de una categoría. */
export const MIN_CON_DATO = 3;

export function rankCategories(
  data: CategoriesData,
  prices: Record<string, number> | undefined,
  periodo: PeriodoVista,
): { filas: CategoryRank[]; btc: number | null } {
  const btcM = data.btc ? liveMember(data.btc, prices?.BTC) : null;
  const btc = btcM ? valor(btcM, periodo) : null;

  const filas = data.categorias.map((c): CategoryRank => {
    const vivos = c.miembros.map((m) => liveMember(m, prices?.[m.symbol]));
    const conValor = vivos
      .map((m) => ({ symbol: m.symbol, v: valor(m, periodo) }))
      .filter((x): x is { symbol: string; v: number } => x.v != null && Number.isFinite(x.v));
    const med = conValor.length >= MIN_CON_DATO ? mediana(conValor.map((x) => x.v)) : null;
    const top = conValor.reduce<{ symbol: string; v: number } | null>((a, b) => (a == null || b.v > a.v ? b : a), null);
    return {
      id: c.id,
      nombre: c.nombre,
      corto: c.corto,
      lista: c.lista,
      conDato: conValor.length,
      total: c.miembros.length,
      mediana: med,
      vsBtc: med != null && btc != null ? med - btc : null,
      batenBtc:
        med != null && btc != null ? Math.round((conValor.filter((x) => x.v > btc).length / conValor.length) * 100) : null,
      mejor: top ? { symbol: top.symbol, valor: top.v } : null,
    };
  });

  // De más a menos; las que no tienen dato, al final.
  filas.sort((a, b) => (b.mediana ?? -Infinity) - (a.mediana ?? -Infinity));
  return { filas, btc };
}

/** Todos los símbolos que hay que pedir en vivo (BTC incluido). */
export function categorySymbols(data: CategoriesData): string[] {
  const s = new Set<string>(['BTC']);
  for (const c of data.categorias) for (const m of c.miembros) s.add(m.symbol);
  return [...s];
}
