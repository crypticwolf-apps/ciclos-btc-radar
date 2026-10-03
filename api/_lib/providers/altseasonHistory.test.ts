import { describe, expect, it } from 'vitest';
import { ALTSEASON_LEVEL, deriveBreadthHistory, detectAltseasons } from './altseasonHistory.js';

const DAY = 86_400_000;
const T0 = Date.parse('2017-03-01T00:00:00Z');

/** BTC plano; 10 altcoins que suben más que BTC entre los días 200 y 300. */
function serie(dias = 500) {
  const s = new Map<string, Map<number, number>>();
  const add = (a: string, f: (i: number) => number) => {
    const m = new Map<number, number>();
    for (let i = 0; i < dias; i++) m.set(T0 + i * DAY, f(i));
    s.set(a, m);
  };
  add('btc', () => 10_000);
  for (let k = 0; k < 10; k++) add(`alt${k}`, (i) => (i < 200 ? 1 : i < 300 ? 1 + (i - 200) * 0.02 : 3 - (i - 300) * 0.01));
  return s;
}

describe('amplitud histórica', () => {
  it('un valor por día desde que hay 90 días de historia y suficientes altcoins', () => {
    const h = deriveBreadthHistory(serie(), T0 + 600 * DAY);
    expect(h.desde).toBe('2017-05-30');
    expect(h.pct).toHaveLength(500 - 90);
    expect(h.activos).toEqual({ inicio: 10, fin: 10 });
  });

  it('marca la altseason cuando la cesta supera a BTC de forma sostenida', () => {
    const h = deriveBreadthHistory(serie(), T0 + 600 * DAY);
    expect(h.periodos).toHaveLength(1);
    const p = h.periodos[0]!;
    // Las altcoins empiezan a batir a BTC el día 201: el periodo arranca ahí
    // (con la media de 7 días, unos días después) y dura más de dos semanas.
    expect(p.desde >= '2017-09-17' && p.desde <= '2017-09-30').toBe(true);
    expect(p.maximo).toBe(100);
    expect(p.enCurso).toBe(false);
  });

  it('con menos de 8 altcoins no da dato', () => {
    const s = serie();
    for (const k of [0, 1, 2]) s.delete(`alt${k}`);
    expect(() => deriveBreadthHistory(s, T0 + 600 * DAY)).toThrow(/suficientes/);
  });

  it('un pico de unos días no es una altseason; dos tramos muy cercanos son una sola', () => {
    const base = Array.from({ length: 200 }, () => 40);
    const corto = [...base];
    for (let i = 50; i < 58; i++) corto[i] = 100;
    expect(detectAltseasons(T0, corto)).toEqual([]);

    const doble = [...base];
    for (let i = 20; i < 50; i++) doble[i] = 90;
    for (let i = 60; i < 90; i++) doble[i] = 90;
    const p = detectAltseasons(T0, doble);
    expect(p).toHaveLength(1);
    expect(p[0]!.maximo).toBeGreaterThanOrEqual(ALTSEASON_LEVEL);
  });
});
