import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheClear } from './cache.js';
import { readHistory, recordSnapshot, resetHistoryThrottle } from './scoreHistory.js';
import type { DashboardResponse } from '../../src/types/dashboard.js';

const dashboard = {
  market: {
    summary: { priceUsd: 60_000, fromAthPct: -45 },
    indicators: { rsi14: 40, trend: 'bajista', sma200: 70_000, volatility30d: 50, return30d: -5, return90d: -20, cross: 'death' },
    sentiment: { value: 20, classification: 'Miedo extremo' },
  },
  onchain: { halvings: [{ at: '2024-04-20T00:00:00.000Z', halvingEstimated: false }], cycle: { mvrv: 1.2 } },
  network: { strength: { nextAdjustmentPct: 1 }, mempool: null, latestBlock: null },
  liquidity: { change30dPct: 1 },
  derivatives: { fundingRate: 0.0001 },
  macro: null,
} as unknown as DashboardResponse;

describe('histórico del score', () => {
  let hash: Map<string, string>;

  beforeEach(() => {
    cacheClear();
    resetHistoryThrottle();
    hash = new Map();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 't';
    vi.stubGlobal('fetch', async (_u: string, init: { body: string }) => {
      const [cmd, , field, value] = JSON.parse(init.body) as string[];
      let result: unknown = null;
      if (cmd === 'HSET') hash.set(field!, value!), (result = 1);
      if (cmd === 'HGETALL') result = [...hash].flat();
      return new Response(JSON.stringify({ result }));
    });
  });
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.unstubAllGlobals();
  });

  it('guarda la foto del día con score y fase, y la devuelve ordenada', async () => {
    const t = Date.parse('2026-10-03T12:00:00Z');
    hash.set('2026-10-01', JSON.stringify({ day: '2026-10-01', score: 40, fase: 'acumulacion' }));
    const snap = await recordSnapshot(dashboard, t);
    expect(snap).toMatchObject({ day: '2026-10-03', fase: 'correccion', precio: 60_000 });
    expect(snap!.score).toBeGreaterThan(50);
    const days = await readHistory();
    expect(days.map((d) => d.day)).toEqual(['2026-10-01', '2026-10-03']);
  });

  it('no escribe más de una vez por hora', async () => {
    const t = Date.parse('2026-10-03T12:00:00Z');
    expect(await recordSnapshot(dashboard, t)).not.toBeNull();
    expect(await recordSnapshot(dashboard, t + 10 * 60_000)).toBeNull();
    expect(await recordSnapshot(dashboard, t + 61 * 60_000)).not.toBeNull();
  });

  it('sin Redis no guarda nada', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    expect(await recordSnapshot(dashboard)).toBeNull();
    expect(hash.size).toBe(0);
  });

  it('sin precio no hay foto', async () => {
    const sin = { ...dashboard, market: { ...dashboard.market, summary: null } } as DashboardResponse;
    expect(await recordSnapshot(sin)).toBeNull();
  });
});
