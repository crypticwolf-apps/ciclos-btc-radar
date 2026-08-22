import { describe, it, expect } from 'vitest';
import { deriveHistory, detectSwings } from './history.js';
import type { DailyClose } from './coinmetrics.js';

// =============================================================================
// Serie sintética con DOS ciclos completos y un tercero en curso, para poder
// comprobar los extremos exactos que debe encontrar el zigzag.
//
//   100 → 1.000 (pico)  → 150 (suelo, −85%) → 5.000 (pico) → 800 (suelo, −84%)
//       → 20.000 (pico) → 12.000 (caída en curso, −40%: NO cierra ciclo)
// =============================================================================

function ramp(from: number, to: number, days: number, startMs: number): DailyClose[] {
  const out: DailyClose[] = [];
  for (let i = 1; i <= days; i++) {
    const t = startMs + i * 86_400_000;
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ t: Date.parse(`${day}T00:00:00.000Z`), day, price: from + ((to - from) * i) / days });
  }
  return out;
}

function build(): DailyClose[] {
  const start = Date.parse('2014-01-01T00:00:00.000Z');
  const first: DailyClose = { t: start, day: '2014-01-01', price: 100 };
  const series = [first];
  const push = (to: number, days: number) => {
    const last = series[series.length - 1]!;
    series.push(...ramp(last.price, to, days, last.t));
  };
  push(1_000, 300);
  push(150, 300);
  push(5_000, 400);
  push(800, 300);
  push(20_000, 400);
  push(12_000, 200);
  return series;
}

describe('detectSwings', () => {
  const swings = detectSwings(build());

  it('encuentra los tres techos y los dos suelos, alternos', () => {
    expect(swings.map((s) => s.kind)).toEqual(['pico', 'suelo', 'pico', 'suelo', 'pico']);
  });

  it('clava el precio de cada extremo', () => {
    const prices = swings.map((s) => Math.round(s.point.price));
    expect(prices).toEqual([1_000, 150, 5_000, 800, 20_000]);
  });

  it('no parte el ciclo por una caída que no llega al umbral', () => {
    // La bajada final del 40% deja el último techo como extremo en curso.
    expect(swings[swings.length - 1]!.kind).toBe('pico');
  });

  it('con una serie vacía no revienta', () => {
    expect(detectSwings([])).toEqual([]);
  });
});

describe('deriveHistory', () => {
  const h = deriveHistory(build(), 'test');

  it('mide las caídas de techo a suelo', () => {
    expect(h.drawdowns.map((d) => d.drawdownPct)).toEqual([-85, -84, -40]);
  });

  it('mide el rally posterior y deja la caída en curso sin recuperación', () => {
    expect(h.drawdowns[0]!.recoveryPct).toBe(3_233); // 150 → 5.000
    expect(h.drawdowns[1]!.recoveryPct).toBe(2_400); // 800 → 20.000
    // La caída en curso no tiene rally posterior que contar.
    expect(h.drawdowns[2]!.recoveryPct).toBeNull();
    expect(h.drawdowns[2]!.current).toBe(true);
    expect(h.drawdowns[2]!.period).toBe('Actual');
  });

  it('arma los ciclos suelo → techo y deja abierto el último', () => {
    expect(h.cycles.map((c) => c.growthPct)).toEqual([3_233, 2_400]);
    expect(h.cycles[h.cycles.length - 1]!.open).toBe(true);
  });

  it('da un suelo por año natural', () => {
    const years = h.yearlyLows.map((y) => y.year);
    expect(new Set(years).size).toBe(years.length);
    expect(h.yearlyLows[0]!.low).toBeGreaterThan(0);
  });

  it('cierra el recorrido con el último cierre de la serie', () => {
    expect(h.cyclePoints[h.cyclePoints.length - 1]!.label).toBe('Actual');
    expect(h.cyclePoints[h.cyclePoints.length - 1]!.price).toBe(12_000);
  });

  it('encuentra suelos de RSI con su rendimiento a un año', () => {
    expect(h.rsiBottoms.length).toBeGreaterThan(0);
    for (const b of h.rsiBottoms) {
      expect(b.rsi).toBeLessThanOrEqual(30);
      if (b.return1yPct != null) expect(Number.isFinite(b.return1yPct)).toBe(true);
    }
  });
});
