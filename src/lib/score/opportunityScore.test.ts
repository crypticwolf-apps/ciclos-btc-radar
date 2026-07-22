import { describe, it, expect } from 'vitest';
import { computeOpportunityScore, type ScoreSources } from './opportunityScore';

/** Fuente vacía: ningún bloque tiene datos. */
const vacio: ScoreSources = {
  drawdownFromAthPct: null,
  price: null,
  mvrv: null,
  nupl: null,
  puell: null,
  cycleLow: null,
  cycleHigh: null,
  daysSinceHalving: null,
  rsi14: null,
  sma50: null,
  sma200: null,
  sma200w: null,
  cross: 'ninguno',
  return30d: null,
  return90d: null,
  fearGreed: null,
  fearGreedLabel: null,
  fundingRate: null,
  openInterestChange24hPct: null,
  longShortRatio: null,
  stablecoinChange30dPct: null,
  stablecoinTrend: null,
  hashrateEhs: null,
  nextDifficultyAdjustmentPct: null,
  mempoolBlocksToClear: null,
  volatility30d: null,
};

const con = (over: Partial<ScoreSources>): ScoreSources => ({ ...vacio, ...over });

describe('Score de oportunidad · rango y límites', () => {
  it('siempre queda entre 0 y 100', () => {
    const extremos: ScoreSources[] = [
      con({ drawdownFromAthPct: -99, mvrv: 0.1, nupl: -0.9, fearGreed: 0, rsi14: 1, volatility30d: 1 }),
      con({ drawdownFromAthPct: 0, mvrv: 12, nupl: 0.95, fearGreed: 100, rsi14: 99, volatility30d: 400 }),
    ];
    for (const fuente of extremos) {
      const r = computeOpportunityScore(fuente);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(Number.isFinite(r.score)).toBe(true);
    }
  });

  it('sin ningún dato devuelve 50 neutral y confianza baja', () => {
    const r = computeOpportunityScore(vacio);
    expect(r.score).toBe(50);
    expect(r.confianza).toBe('baja');
    expect(r.bloquesDisponibles).toBe(0);
    expect(r.faltantes).toHaveLength(7);
  });

  it('un contexto de miedo profundo puntúa más alto que uno de euforia', () => {
    const miedo = computeOpportunityScore(
      con({ drawdownFromAthPct: -68, fearGreed: 9, rsi14: 24, mvrv: 0.85, volatility30d: 40 }),
    );
    const euforia = computeOpportunityScore(
      con({ drawdownFromAthPct: -1, fearGreed: 92, rsi14: 82, mvrv: 3.6, volatility30d: 40 }),
    );
    expect(miedo.score).toBeGreaterThan(euforia.score);
    expect(miedo.score).toBeGreaterThan(60);
    expect(euforia.score).toBeLessThan(40);
  });
});

describe('Score de oportunidad · redistribución de pesos', () => {
  it('reparte el peso de los bloques sin datos entre los que sí lo tienen', () => {
    // Solo sentimiento (15) y liquidez (12) tienen datos: 27 de peso nominal.
    const r = computeOpportunityScore(con({ fearGreed: 50, stablecoinChange30dPct: 1 }));

    const sentimiento = r.bloques.find((b) => b.id === 'sentimiento')!;
    const liquidez = r.bloques.find((b) => b.id === 'liquidez')!;
    const ciclo = r.bloques.find((b) => b.id === 'ciclo')!;

    // Los pesos efectivos de los disponibles deben sumar 100.
    const suma = r.bloques.reduce((acc, b) => acc + b.effectiveWeight, 0);
    expect(suma).toBeCloseTo(100, 0);

    // Y mantener la proporción original entre ellos (15:12).
    expect(sentimiento.effectiveWeight / liquidez.effectiveWeight).toBeCloseTo(15 / 12, 1);

    // El bloque sin datos no aporta peso ni puntúa cero.
    expect(ciclo.score).toBeNull();
    expect(ciclo.effectiveWeight).toBe(0);
  });

  it('un dato ausente NO se trata como cero (no hunde el score)', () => {
    // Contexto claramente favorable pero con la mitad de las fuentes caídas.
    const completo = computeOpportunityScore(
      con({ drawdownFromAthPct: -60, fearGreed: 12, rsi14: 28, volatility30d: 35, stablecoinChange30dPct: 4 }),
    );
    const parcial = computeOpportunityScore(con({ drawdownFromAthPct: -60, fearGreed: 12 }));

    // Al perder fuentes el score se mueve poco; lo que baja es la confianza.
    expect(Math.abs(completo.score - parcial.score)).toBeLessThan(20);
    expect(parcial.score).toBeGreaterThan(55);
  });

  it('declara la confianza según la cobertura de peso disponible', () => {
    const todo = computeOpportunityScore(
      con({
        drawdownFromAthPct: -40,
        mvrv: 1.5,
        rsi14: 50,
        price: 60000,
        sma200: 60000,
        fearGreed: 50,
        fundingRate: 0.0001,
        stablecoinChange30dPct: 0,
        nextDifficultyAdjustmentPct: 1,
        volatility30d: 45,
      }),
    );
    expect(todo.confianza).toBe('alta');
    expect(todo.bloquesDisponibles).toBe(7);
    expect(todo.faltantes).toHaveLength(0);

    const poco = computeOpportunityScore(con({ fearGreed: 50 }));
    expect(poco.confianza).toBe('baja');
    expect(poco.cobertura).toBe(15);
  });
});

describe('Score de oportunidad · explicabilidad', () => {
  it('ningún bloque puede dominar el resultado por sí solo', () => {
    // El sentimiento en su extremo solo puede mover su peso (15/100).
    const base = computeOpportunityScore(
      con({ drawdownFromAthPct: -30, rsi14: 50, fearGreed: 50, volatility30d: 45, stablecoinChange30dPct: 0 }),
    );
    const extremo = computeOpportunityScore(
      con({ drawdownFromAthPct: -30, rsi14: 50, fearGreed: 0, volatility30d: 45, stablecoinChange30dPct: 0 }),
    );
    const movimiento = extremo.score - base.score;
    // Con esos bloques activos el sentimiento pesa ~24%: mover el índice de 50
    // a 0 no puede desplazar el total más de ~15 puntos.
    expect(movimiento).toBeGreaterThan(0);
    expect(movimiento).toBeLessThan(20);
  });

  it('cada bloque publica los datos que ha usado y una explicación', () => {
    const r = computeOpportunityScore(con({ fearGreed: 8, fearGreedLabel: 'Miedo extremo' }));
    const sentimiento = r.bloques.find((b) => b.id === 'sentimiento')!;
    expect(sentimiento.inputs).toContainEqual({
      label: 'Fear & Greed',
      value: '8 · Miedo extremo',
    });
    expect(sentimiento.explanation.length).toBeGreaterThan(20);
    expect(sentimiento.score).toBeGreaterThan(85);
  });

  it('enumera los motivos que suben y bajan el score', () => {
    const r = computeOpportunityScore(
      con({
        drawdownFromAthPct: -65, // sube
        mvrv: 0.9,
        fearGreed: 10, // sube
        fundingRate: 0.0012, // baja (largos pagando mucho)
        openInterestChange24hPct: 25, // baja
        volatility30d: 95, // baja
      }),
    );
    expect(r.suben.length).toBeGreaterThan(0);
    expect(r.bajan.length).toBeGreaterThan(0);
    expect(r.suben.join(' ')).toMatch(/Ciclo|Sentimiento/);
  });

  it('tolera valores no finitos sin romper el resultado', () => {
    const r = computeOpportunityScore(
      con({
        drawdownFromAthPct: Number.NaN,
        mvrv: Number.POSITIVE_INFINITY,
        fearGreed: 45,
      }),
    );
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
