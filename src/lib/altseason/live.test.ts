import { describe, it, expect } from 'vitest';
import { btcChange90Live, liveRow } from './live';
import type { AltcoinRow } from '@/types/altseason';

const fila: AltcoinRow = {
  symbol: 'SOL', name: 'Solana', priceUsd: 100, marketCapUsd: 50_000_000_000, volumeUsd: 1e9,
  change7d: 5, change30d: 10, change60d: 12, change90d: 25, vsBtc90d: 15, fromHigh90d: -20,
  aboveSma20: true, aboveSma50: true, aboveSma200: false, volatility30d: 60, beatsBtc: true,
  ref: { price: 100, close7: 95, close30: 90, close90: 80, high90: 125, sma20: 98, sma50: 92, sma200: 110 },
};

describe('ranking en vivo', () => {
  const btc90 = btcChange90Live(66_000, 60_000); // +10%

  it('rehace precio, capitalización y variaciones con el precio vivo', () => {
    const r = liveRow(fila, 120, btc90);
    expect(r.priceUsd).toBe(120);
    expect(r.marketCapUsd).toBe(60_000_000_000);
    expect(r.change7d).toBeCloseTo(26.32, 2);
    expect(r.change30d).toBeCloseTo(33.33, 2);
    expect(r.change90d).toBe(50);
    expect(r.vsBtc90d).toBe(40);
    expect(r.beatsBtc).toBe(true);
  });

  it('las medias y el máximo se comparan con el precio de ahora', () => {
    const arriba = liveRow(fila, 130, btc90);
    expect(arriba.aboveSma200).toBe(true);
    // Un precio por encima del máximo de 90 días ES el nuevo máximo.
    expect(arriba.fromHigh90d).toBe(0);

    const abajo = liveRow(fila, 85, btc90);
    expect(abajo.aboveSma20).toBe(false);
    expect(abajo.aboveSma50).toBe(false);
    expect(abajo.change90d).toBeCloseTo(6.25, 2);
    expect(abajo.beatsBtc).toBe(false);
  });

  it('sin precio vivo o sin referencias deja la fila como estaba', () => {
    expect(liveRow(fila, undefined, btc90)).toBe(fila);
    const { ref: _ref, ...sinRef } = fila;
    expect(liveRow(sinRef, 120, btc90)).toEqual(sinRef);
  });

  it('sin BTC vivo no inventa el «vs BTC»', () => {
    const r = liveRow(fila, 120, btcChange90Live(undefined, 60_000));
    expect(r.change90d).toBe(50);
    expect(r.vsBtc90d).toBe(15);
  });
});
