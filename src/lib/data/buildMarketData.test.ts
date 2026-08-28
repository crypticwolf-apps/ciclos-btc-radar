import { describe, it, expect } from 'vitest';
import { buildMarketData } from './buildMarketData';
import type { DashboardResponse } from '@/types/dashboard';
import type { MarketSummary } from '@/types/market';

// =============================================================================
// La regla que fija este test: un dato que no se tiene se enseña como hueco,
// NUNCA relleno.
//
// El caso concreto ya ocurría en producción. Cuando el proveedor de precio no
// publicaba el máximo histórico:
//   · CoinPaprika daba «el precio de hoy es el máximo» y una caída del 0%, con
//     lo que el panel afirmaba que Bitcoin estaba en máximos;
//   · CoinGecko dejaba un NaN que, al pasar por JSON, llegaba al navegador como
//     `null` y tumbaba el panel entero al formatearlo;
//   · y sin fecha del máximo, la tarjeta contaba «0 días desde el ATH».
// =============================================================================

const RESUMEN: MarketSummary = {
  priceUsd: 60_000,
  priceEur: 55_000,
  change1h: 0.2,
  change24h: -1.5,
  change7d: 3,
  change30d: -8,
  change1y: 40,
  marketCapUsd: 1_200_000_000_000,
  volume24hUsd: 30_000_000_000,
  ath: 120_000,
  athDate: '2025-10-06T00:00:00.000Z',
  fromAthPct: -50,
};

function respuesta(summary: MarketSummary | null): DashboardResponse {
  return {
    market: {
      summary,
      global: null,
      indicators: null,
      sentiment: null,
      sentimentExtremes: null,
      fx: null,
    },
    onchain: { halving: null, cycle: null, halvings: null, flow: null },
    network: { mempool: null, strength: null, latestBlock: null },
    derivatives: null,
    liquidity: null,
    macro: null,
    history: null,
  } as unknown as DashboardResponse;
}

describe('buildMarketData', () => {
  it('sin precio no hay panel: se prefiere el estado de error a un panel de ejemplo', () => {
    expect(buildMarketData(respuesta(null))).toBeNull();
  });

  it('con el máximo histórico completo calcula caída, días y recuperación', () => {
    const data = buildMarketData(respuesta(RESUMEN))!;
    expect(data.bitcoin.ath).toBe(120_000);
    expect(data.bitcoin.drawdownDesdeAth).toBe(-50);
    // De 60.000 a 120.000 hace falta duplicar.
    expect(data.bitcoin.recuperacionNecesaria).toBe(100);
    expect(data.bitcoin.diasDesdeAth).toBeGreaterThan(0);
  });

  it('sin máximo histórico deja los huecos vacíos en vez de inventarlos', () => {
    const data = buildMarketData(
      respuesta({ ...RESUMEN, ath: null, athDate: null, fromAthPct: null }),
    )!;

    expect(data.bitcoin.ath).toBeNull();
    expect(data.bitcoin.athFecha).toBeNull();
    // Lo que NO puede pasar: que la caída sea 0 («estamos en máximos») o que
    // los días desde el máximo sean 0 («el máximo fue hoy»).
    expect(data.bitcoin.drawdownDesdeAth).toBeNull();
    expect(data.bitcoin.diasDesdeAth).toBeNull();
    expect(data.bitcoin.recuperacionNecesaria).toBeNull();
    // Y el precio, que sí se tiene, sigue estando.
    expect(data.bitcoin.precio).toBe(60_000);
  });

  it('la caída nunca es positiva aunque el precio supere el máximo del proveedor', () => {
    const data = buildMarketData(respuesta({ ...RESUMEN, fromAthPct: 4 }))!;
    expect(data.bitcoin.drawdownDesdeAth).toBe(0);
  });

  it('sin variación de 24 h no la da por cero', () => {
    const data = buildMarketData(respuesta({ ...RESUMEN, change24h: null }))!;
    expect(data.bitcoin.cambio24h).toBeNull();
  });

  it('sin series históricas no dibuja ciclos ni caídas de ejemplo', () => {
    const data = buildMarketData(respuesta(RESUMEN))!;
    expect(data.cyclePrices).toEqual([]);
    expect(data.drawdowns).toEqual([]);
    expect(data.yearlyLows).toEqual([]);
    expect(data.rsiBottoms).toEqual([]);
    expect(data.whaleTimeline).toEqual([]);
    expect(data.fearGreedHistory).toEqual([]);
  });
});
