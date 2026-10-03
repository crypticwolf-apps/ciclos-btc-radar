import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchJson = vi.fn();
vi.mock('../http.js', () => ({ fetchJson: (...args: unknown[]) => fetchJson(...args) }));
vi.mock('../cache.js', () => ({
  swr: async (_k: string, _t: unknown, load: () => Promise<unknown>) => ({ value: await load(), status: 'live', storedAt: Date.now() }),
}));

const { getSpotPrices, parseSymbols } = await import('./spotPrices.js');

/** Lista de pares con suficientes monedas para no parecer incompleta. */
const muchos = (fmt: (base: string) => string) =>
  Array.from({ length: 60 }, (_, i) => ({ base: `C${i}`, pair: fmt(`C${i}`) }));

beforeEach(() => fetchJson.mockReset());

describe('precios al contado', () => {
  it('lee los pares USDT de Binance y descarta el resto', async () => {
    fetchJson.mockResolvedValueOnce([
      { symbol: 'ETHUSDT', price: '2500.5' },
      { symbol: 'ETHBTC', price: '0.04' },
      { symbol: 'SOLUSDT', price: '150' },
      ...muchos((b) => `${b}USDT`).map((m) => ({ symbol: m.pair, price: '1' })),
    ]);
    const { data } = await getSpotPrices();
    expect(data.source).toBe('binance');
    expect(data.prices.ETH).toBe(2500.5);
    expect(data.prices.SOL).toBe(150);
    expect(data.prices.ETHBTC).toBeUndefined();
  });

  it('pasa a OKX, que escribe los pares con guion', async () => {
    fetchJson.mockRejectedValueOnce(new Error('451')).mockResolvedValueOnce({
      data: [{ instId: 'ETH-USDT', last: '2400' }, ...muchos((b) => `${b}-USDT`).map((m) => ({ instId: m.pair, last: '1' }))],
    });
    const { data } = await getSpotPrices();
    expect(data.source).toBe('okx');
    expect(data.prices.ETH).toBe(2400);
  });

  it('una lista casi vacía no se da por buena: se prueba el siguiente', async () => {
    fetchJson
      .mockResolvedValueOnce([{ symbol: 'ETHUSDT', price: '2500' }])
      .mockRejectedValueOnce(new Error('caído'))
      .mockResolvedValueOnce({ result: { list: [{ symbol: 'ETHUSDT', lastPrice: '2450' }, ...muchos((b) => `${b}USDT`).map((m) => ({ symbol: m.pair, lastPrice: '1' }))] } });
    const { data } = await getSpotPrices();
    expect(data.source).toBe('bybit');
    expect(data.prices.ETH).toBe(2450);
  });
});

describe('lista de símbolos', () => {
  it('normaliza, quita duplicados y rechaza lo que no es un símbolo', () => {
    expect(parseSymbols('eth, SOL,eth,../x,<b>,PEPE')).toEqual(['ETH', 'SOL', 'PEPE']);
    expect(parseSymbols(null)).toEqual([]);
  });
});
