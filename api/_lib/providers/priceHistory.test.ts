import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheClear } from '../cache';
import { getPriceHistory } from './coingecko';

afterEach(() => {
  cacheClear();
  vi.unstubAllGlobals();
});

describe('price history MAX', () => {
  it('uses the complete Blockchain.com history and preserves its endpoints', async () => {
    const rows = Array.from({ length: 1_500 }, (_, index) => ({
      x: 1_280_000_000 + index * 86_400,
      y: 0.1 + index,
    }));
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const requestUrl = String(input);
      if (requestUrl.includes('/charts/market-price')) return Response.json({ values: rows });
      if (requestUrl.endsWith('/ticker')) return Response.json({ USD: { last: 60_000 }, EUR: { last: 54_000 } });
      throw new Error(`Unexpected URL: ${requestUrl}`);
    }));

    const result = await getPriceHistory('max', 'eur');

    expect(result.meta.provider).toBe('blockchain.com:market-price');
    expect(result.data.length).toBeGreaterThanOrEqual(1_500);
    expect(result.data[0]).toEqual({ t: rows[0]!.x * 1000, price: rows[0]!.y * 0.9 });
    expect(result.data[result.data.length - 1]!.price).toBe(54_000);
  });
});
