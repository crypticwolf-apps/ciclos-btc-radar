import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheClear } from '../cache.js';
import { getGlobal, getMarketSummary } from './coingecko.js';

afterEach(() => {
  cacheClear();
  vi.unstubAllGlobals();
});

describe('CoinGecko fallbacks', () => {
  it('uses CoinPaprika for the Bitcoin summary when CoinGecko rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const requestUrl = String(input);
        if (requestUrl.includes('api.coingecko.com')) {
          return new Response('forbidden', { status: 403 });
        }
        if (requestUrl.includes('/tickers/btc-bitcoin')) {
          return Response.json({
            quotes: {
              USD: {
                price: 65_000,
                volume_24h: 25_000_000_000,
                market_cap: 1_300_000_000_000,
                percent_change_1h: 0.4,
                percent_change_24h: -1.2,
                percent_change_7d: 2.5,
                percent_change_30d: 4.1,
                percent_change_1y: 51,
                ath_price: 126_000,
                ath_date: '2025-10-06T19:00:40Z',
                percent_from_price_ath: -48.4,
              },
              EUR: { price: 57_000 },
            },
          });
        }
        throw new Error(`Unexpected URL: ${requestUrl}`);
      }),
    );

    const result = await getMarketSummary();

    expect(result.data.priceUsd).toBe(65_000);
    expect(result.data.priceEur).toBe(57_000);
    expect(result.data.marketCapUsd).toBe(1_300_000_000_000);
    expect(result.meta.provider).toBe('coinpaprika');
  });

  it('uses CoinPaprika for global metrics when CoinGecko rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const requestUrl = String(input);
        if (requestUrl.includes('api.coingecko.com')) {
          return new Response('forbidden', { status: 403 });
        }
        if (requestUrl.endsWith('/global')) {
          return Response.json({
            market_cap_usd: 2_350_000_000_000,
            volume_24h_usd: 380_000_000_000,
            bitcoin_dominance_percentage: 56.24,
            market_cap_change_24h: -0.74,
          });
        }
        throw new Error(`Unexpected URL: ${requestUrl}`);
      }),
    );

    const result = await getGlobal();

    expect(result.data.btcDominance).toBe(56.2);
    expect(result.data.marketCapChange24h).toBe(-0.74);
    expect(result.meta.provider).toBe('coinpaprika:global');
  });

  it('uses Kraken when both CoinGecko and the CoinPaprika ticker are unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const requestUrl = String(input);
        if (requestUrl.includes('api.coingecko.com')) {
          return new Response('forbidden', { status: 403 });
        }
        if (requestUrl.includes('/tickers/btc-bitcoin')) {
          return new Response('payment required', { status: 402 });
        }
        if (requestUrl.endsWith('/global')) {
          return Response.json({
            market_cap_usd: 2_350_000_000_000,
            volume_24h_usd: 380_000_000_000,
            bitcoin_dominance_percentage: 56,
            market_cap_change_24h: -0.7,
          });
        }
        if (requestUrl.includes('/Ticker')) {
          return Response.json({
            error: [],
            result: {
              XXBTZUSD: { c: ['65000'], v: ['500', '1000'], o: '64000' },
              XXBTZEUR: { c: ['57000'], v: ['400', '800'], o: '56500' },
            },
          });
        }
        if (requestUrl.includes('/OHLC')) {
          return Response.json({
            error: [],
            result: {
              XXBTZUSD: [
                [1_750_000_000, '60000', '61000', '59000', '60000'],
                [1_760_000_000, '90000', '100000', '88000', '95000'],
              ],
              last: 1_760_000_000,
            },
          });
        }
        throw new Error(`Unexpected URL: ${requestUrl}`);
      }),
    );

    const result = await getMarketSummary();

    expect(result.data.priceUsd).toBe(65_000);
    expect(result.data.priceEur).toBe(57_000);
    expect(result.data.ath).toBe(95_000);
    expect(result.data.marketCapUsd).toBe(1_316_000_000_000);
    expect(result.meta.provider).toBe('kraken');
  });
});
