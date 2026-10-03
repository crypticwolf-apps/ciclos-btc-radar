import { describe, expect, it } from 'vitest';
import { buildCategories, CATEGORIES } from './categories.js';

const row = (id: string, symbol: string, mcap: number, d1: number) => ({
  id, symbol, name: symbol, current_price: 10, market_cap: mcap, ath_change_percentage: -40,
  price_change_percentage_24h_in_currency: d1, price_change_percentage_7d_in_currency: d1 * 2,
  price_change_percentage_30d_in_currency: null, price_change_percentage_1y_in_currency: d1 * 10,
});

const rows = [
  row('bitcoin', 'btc', 1e12, 1),
  row('ethereum', 'eth', 4e11, 2),
  row('solana', 'sol', 8e10, 3),
  row('tether', 'usdt', 1e11, 0),
  row('dogecoin', 'doge', 3e10, -1),
  row('pepe', 'pepe', 5e9, 5),
];

describe('categorías en el servidor', () => {
  it('usa la lista de CoinGecko, quita BTC y stablecoins, y ordena por capitalización', () => {
    const { categorias, btc } = buildCategories(
      rows,
      { 'layer-1': ['bitcoin', 'solana', 'tether', 'ethereum'] },
      new Map([['SOL', 30]]),
      12,
    );
    const l1 = categorias.find((c) => c.id === 'layer-1')!;
    expect(l1.lista).toBe('coingecko');
    expect(l1.miembros.map((m) => m.symbol)).toEqual(['ETH', 'SOL']);
    expect(l1.miembros[1]!.cambios).toEqual({ d1: 3, d7: 6, d30: null, d90: 30, y1: 30 });
    expect(l1.miembros[0]!.cambios.d90).toBeNull();
    expect(btc?.cambios.d90).toBe(12);
  });

  it('sin lista de CoinGecko usa la de respaldo por símbolo', () => {
    const { categorias } = buildCategories(rows, {}, new Map(), null);
    const memes = categorias.find((c) => c.id === 'meme-token')!;
    expect(memes.lista).toBe('respaldo');
    expect(memes.miembros.map((m) => m.symbol)).toEqual(['DOGE', 'PEPE']);
    expect(categorias).toHaveLength(CATEGORIES.length);
  });
});
