import { describe, expect, it } from 'vitest';
import { categorySymbols, liveMember, mediana, rankCategories } from './categories';
import type { CategoriesData, CategoryMember } from '@/types/categories';

const m = (symbol: string, d1: number, price = 10, ath = -50): CategoryMember => ({
  symbol, name: symbol, price, marketCap: 1, ath,
  cambios: { d1, d7: d1 * 2, d30: null, d90: d1 * 3, y1: null },
});

const data: CategoriesData = {
  categorias: [
    { id: 'l1', nombre: 'Layer 1', corto: 'L1', lista: 'coingecko', miembros: [m('ETH', 1), m('SOL', 2), m('ADA', 3)] },
    // Un meme disparado no hace que la categoría entera vaya en cabeza.
    { id: 'meme', nombre: 'Memes', corto: 'Memes', lista: 'coingecko', miembros: [m('DOGE', -2), m('PEPE', -1), m('WIF', 500)] },
    { id: 'rwa', nombre: 'RWA', corto: 'RWA', lista: 'respaldo', miembros: [m('ONDO', 9), m('OM', 9)] },
  ],
  btc: m('BTC', 1.5, 60_000, -10),
  exchange: 'okx',
  observedAt: '2026-10-03T00:00:00Z',
};

describe('categorías de altcoins', () => {
  it('ordena por mediana, no por la moneda que más sube', () => {
    const { filas, btc } = rankCategories(data, undefined, 'd1');
    expect(filas.map((f) => f.id)).toEqual(['l1', 'meme', 'rwa']);
    expect(filas[0]!.mediana).toBe(2);
    expect(filas[0]!.vsBtc).toBeCloseTo(0.5);
    expect(filas[1]!.mejor).toEqual({ symbol: 'WIF', valor: 500 });
    // Con menos de 3 monedas con dato no se da mediana: va al final.
    expect(filas[2]!.mediana).toBeNull();
    expect(btc).toBe(1.5);
  });

  it('en vivo, todas las variaciones se mueven con el precio de ahora', () => {
    const v = liveMember(m('SOL', 10, 100, -20), 110);
    expect(v.cambios.d1).toBeCloseTo(21); // 1,10 × 1,10 − 1
    expect(v.cambios.d90).toBeCloseTo(43); // 1,30 × 1,10 − 1
    expect(v.cambios.d30).toBeNull();
    expect(v.ath).toBeCloseTo(-12); // 0,80 × 1,10 − 1
    // Por encima del máximo histórico, la distancia es 0.
    expect(liveMember(m('SOL', 0, 100, -5), 120).ath).toBe(0);
    // Un precio de otra moneda con el mismo símbolo no se usa.
    expect(liveMember(m('TON', 1, 3), 0.01).price).toBe(3);
  });

  it('mediana y símbolos', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBeNull();
    expect(categorySymbols(data)).toContain('BTC');
    expect(categorySymbols(data)).toHaveLength(9);
  });
});
