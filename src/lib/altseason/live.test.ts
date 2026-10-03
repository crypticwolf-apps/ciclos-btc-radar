import { describe, it, expect } from 'vitest';
import { btcChange90Live, liveAltseason, liveRow } from './live';
import type { AltcoinRow, AltseasonResponse } from '@/types/altseason';

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
    const arriba = liveRow({ ...fila, ref: { ...fila.ref!, high90: 115 } }, 120, btc90);
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

describe('precio en vivo de otra moneda', () => {
  it('ignora un precio que no cuadra con el de la moneda (mismo símbolo, otro token)', () => {
    const row: AltcoinRow = {
      symbol: 'TON', name: 'Toncoin', priceUsd: 3, marketCapUsd: 7e9, volumeUsd: 1e8,
      change7d: 1, change30d: 2, change60d: 3, change90d: 4, vsBtc90d: 0, fromHigh90d: -10,
      aboveSma20: true, aboveSma50: true, aboveSma200: false, volatility30d: 50, beatsBtc: true,
      ref: { price: 3, close7: 2.9, close30: 2.8, close90: 2.7, high90: 3.5, sma20: 2.9, sma50: 2.8, sma200: 3.2 },
    };
    expect(liveRow(row, 0.012, 5)).toBe(row);
    expect(liveRow(row, 3.1, 5).priceUsd).toBe(3.1);
  });
});

describe('Altseason completo en vivo', () => {
  const base = {
    result: {} as AltseasonResponse['result'],
    metrics: {
      outperform90Pct: 0, outperform60Pct: 10, outperform30Pct: 10, outperformCount: 0, analyzedCount: 1,
      btcReturn90: 10, btcDominance: 58, dominanceChange24h: 0, dominanceChange7d: 0, dominanceChange30d: -1,
      aboveSma20Pct: 0, aboveSma50Pct: 0, aboveSma200Pct: 0, positive7dPct: 0, positive30dPct: 0,
      positive90dPct: 0, near90dHighCount: 0, drawdown20PlusCount: 0, ethBtc: 0.03, ethBtcChange24h: 0,
      ethBtcChange7d: 0, ethBtcChange30d: 0, ethBtcChange90d: 0, totalMarketCap: 1, marketCapExBtc: 1,
      marketCapExBtcEth: 1, exBtcVsBtc30d: 0, exBtcChange7d: 0, exBtcChange30d: 0, altVolumeSharePct: 50,
      btcVolumeUsd: 1, altVolumeUsd: 1, avgAltVolatility: 50, btcVolatility: 40, top5Concentration: null,
      avgDrawdownFromHigh: null, stablecoinChange30d: 1, stablecoinChange7d: 0, dataAgeHours: 0, fromCache: false,
    },
    ranking: [{ ...fila, change90d: 5, beatsBtc: false, aboveSma50: false }],
    breadthHistory: [],
    btcRef: { close30: 62_000, close60: 61_000, close90: 60_000 },
    ethBtcRef: { close1: 0.03, close7: 0.03, close30: 0.025, close90: 0.02 },
    universeSize: 1,
    excludedCount: 0,
    observedAt: new Date().toISOString(),
  } as unknown as AltseasonResponse;

  it('sin precio de BTC no toca nada', () => {
    expect(liveAltseason(base, { SOL: 120 })).toBe(base);
  });

  it('rehace amplitud, ETH/BTC y el score con los precios en vivo', () => {
    const r = liveAltseason(base, { BTC: 66_000, SOL: 115, ETH: 1_980 });
    // SOL +43,75% a 90 d frente a BTC +10%: ahora la supera.
    expect(r.ranking[0]!.beatsBtc).toBe(true);
    expect(r.metrics.outperform90Pct).toBe(100);
    expect(r.metrics.aboveSma50Pct).toBe(100);
    expect(r.metrics.ethBtc).toBe(0.03);
    expect(r.metrics.ethBtcChange30d).toBeCloseTo(20, 5);
    // Lo que no va en vivo se conserva.
    expect(r.metrics.btcDominance).toBe(58);
    // El score se recalcula (aquí sin nota: una sola moneda no llega al mínimo).
    expect(r.result).not.toBe(base.result);
    expect(r.result.componentsTotal).toBeGreaterThan(0);
  });
});
