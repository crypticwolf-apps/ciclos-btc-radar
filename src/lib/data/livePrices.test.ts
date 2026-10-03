import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetLivePrices, subscribeLivePrices, type LivePricesState } from './livePrices';

describe('sondeo compartido de precios', () => {
  let urls: string[];
  beforeEach(() => {
    resetLivePrices();
    urls = [];
    vi.useFakeTimers();
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const s = new URL(url, 'http://x').searchParams.get('s')!.split(',');
      return new Response(
        JSON.stringify({
          ok: true,
          data: { prices: Object.fromEntries(s.map((k) => [k, 1])), source: 'okx' },
          meta: { sources: [{ fetchedAt: new Date().toISOString() }] },
        }),
      );
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dos fichas a la vez = una sola petición con todas sus monedas', async () => {
    const a: LivePricesState[] = [];
    const b: LivePricesState[] = [];
    subscribeLivePrices(['BTC', 'SOL'], 'okx', (s) => a.push(s));
    subscribeLivePrices(['BTC', 'TAO'], 'okx', (s) => b.push(s));
    await vi.advanceTimersByTimeAsync(100);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(encodeURIComponent('BTC,SOL,TAO'));
    expect(urls[0]).toContain('ex=okx');
    expect(a[a.length - 1]!.data!.prices).toEqual({ BTC: 1, SOL: 1, TAO: 1 });
    expect(b[b.length - 1]!.data!.prices.TAO).toBe(1);

    // Y sigue cada 5 s, una sola petición por turno.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(urls).toHaveLength(2);
  });

  it('al darse de baja todas, deja de pedir', async () => {
    const baja = subscribeLivePrices(['BTC'], undefined, () => {});
    await vi.advanceTimersByTimeAsync(100);
    baja();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(urls).toHaveLength(1);
  });
});
