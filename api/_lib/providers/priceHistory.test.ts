import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheClear } from '../cache';
import { getPriceHistory } from './coingecko';

afterEach(() => {
  cacheClear();
  vi.unstubAllGlobals();
});

describe('price history MAX', () => {
  it('uses the complete CryptoCompare daily history and preserves its endpoints', async () => {
    const rows = Array.from({ length: 1_500 }, (_, index) => ({
      time: 1_280_000_000 + index * 86_400,
      close: 0.1 + index,
    }));
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const requestUrl = String(input);
      if (requestUrl.includes('min-api.cryptocompare.com')) {
        return Response.json({ Response: 'Success', Data: { Data: rows } });
      }
      throw new Error(`Unexpected URL: ${requestUrl}`);
    }));

    const result = await getPriceHistory('max', 'eur');

    expect(result.meta.provider).toBe('cryptocompare:histoday');
    expect(result.data).toHaveLength(1_500);
    expect(result.data[0]).toEqual({ t: rows[0]!.time * 1000, price: rows[0]!.close });
    const lastRow = rows[rows.length - 1]!;
    expect(result.data[result.data.length - 1]).toEqual({ t: lastRow.time * 1000, price: lastRow.close });
  });
});
