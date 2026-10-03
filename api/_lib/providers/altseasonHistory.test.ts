import { describe, expect, it } from 'vitest';
import { deriveBreadthHistory, detectAltseasons } from './altseasonHistory.js';

const DAY = 86_400_000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);

/**
 * Altcoins/BTC con la forma de la historia real: subida enorme hasta enero de
 * 2018, desangrado hasta 2020, subida en 2021 con máximo en enero de 2022, y
 * rebotes que NO son altseason (verano de 2018, marzo y diciembre de 2024,
 * agosto de 2025).
 */
const ANCLAS: [string, number][] = [
  ['2017-03-01', 1],
  ['2018-01-10', 6],
  ['2018-04-01', 3],
  ['2018-06-15', 4],
  ['2020-09-01', 0.6],
  ['2021-05-10', 2.5],
  ['2021-07-20', 1.4],
  ['2022-01-05', 2.8],
  ['2022-06-15', 1.2],
  ['2023-12-01', 0.6],
  ['2024-03-10', 0.9],
  ['2024-09-01', 0.5],
  ['2024-12-05', 0.8],
  ['2025-04-10', 0.45],
  ['2025-08-20', 0.7],
  ['2026-10-01', 0.5],
];

/** Valor del camino en `t`, interpolando en logaritmos entre anclas. */
function camino(t: number): number {
  for (let i = 1; i < ANCLAS.length; i++) {
    const [d0, v0] = ANCLAS[i - 1]!;
    const [d1, v1] = ANCLAS[i]!;
    if (t <= ms(d1)) {
      const f = (t - ms(d0)) / (ms(d1) - ms(d0));
      return Math.exp(Math.log(v0) + f * (Math.log(v1) - Math.log(v0)));
    }
  }
  return ANCLAS[ANCLAS.length - 1]![1];
}

/** BTC plano y 10 altcoins que siguen el camino: el índice ES el camino. */
function serie() {
  const s = new Map<string, Map<number, number>>();
  const fin = ms('2026-10-01');
  const add = (a: string, f: (t: number) => number) => {
    const m = new Map<number, number>();
    for (let t = ms('2017-03-01'); t <= fin; t += DAY) m.set(t, f(t));
    s.set(a, m);
  };
  add('btc', () => 10_000);
  for (let k = 0; k < 10; k++) add(`alt${k}`, (t) => camino(t) * (1 + k));
  return s;
}

describe('altcoins frente a Bitcoin desde 2017', () => {
  const h = deriveBreadthHistory(serie(), ms('2026-10-01'));

  it('índice diario base 100 que sigue a las altcoins medidas en BTC', () => {
    expect(h.desde).toBe('2017-03-02');
    expect(h.indice[0]).toBe(100);
    const enero18 = (ms('2018-01-10') - ms(h.desde)) / DAY;
    // El camino multiplica por 6 desde el 1 de marzo de 2017.
    expect(h.indice[enero18]! / 100).toBeCloseTo(6, 0);
    expect(h.pct[0]).toBeNull();
    expect(h.pct[200]).not.toBeNull();
  });

  it('solo cuenta los dos grandes máximos de ciclo, no los rebotes', () => {
    expect(h.periodos.map((p) => p.pico)).toEqual(['2018-01-10', '2022-01-05']);
    const [p18, p22] = h.periodos;
    expect(p18!.multiplo).toBeGreaterThanOrEqual(2);
    // La de 2021-22 abarca la subida de primavera de 2021 y el máximo de enero.
    expect(p22!.desde < '2021-05-10').toBe(true);
    expect(p22!.hasta >= '2022-01-05').toBe(true);
    expect(p22!.enCurso).toBe(false);
  });

  it('un movimiento diario disparatado (dato erróneo) no dispara el índice', () => {
    const s = serie();
    s.get('alt0')!.set(ms('2019-05-01'), 1e9);
    const g = deriveBreadthHistory(s, ms('2026-10-01'));
    expect(g.periodos.map((p) => p.pico)).toEqual(['2018-01-10', '2022-01-05']);
  });

  it('con menos de 8 altcoins no da dato', () => {
    const s = serie();
    for (const k of [0, 1, 2]) s.delete(`alt${k}`);
    expect(() => deriveBreadthHistory(s, ms('2026-10-01'))).toThrow(/suficientes/);
  });

  it('un máximo que no dobla el mínimo del año anterior no es altseason', () => {
    const plano = Array.from({ length: 900 }, (_, i) => 100 + 30 * Math.sin(i / 60)); // 130 / 70 < 2
    expect(detectAltseasons(ms('2020-01-01'), plano)).toEqual([]);
  });
});
