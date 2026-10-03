import { describe, it, expect } from 'vitest';
import { deriveHalvings } from './halvings.js';
import type { DailyClose } from './coinmetrics.js';

// =============================================================================
// Serie sintética de 2010 a una fecha de corte, con los hitos que importan:
// un techo dentro de la ventana de 18 meses de cada halving y un suelo antes
// del siguiente. Lo que se comprueba es la FILA DEL CICLO EN CURSO.
// =============================================================================

const DAY = 86_400_000;

/** Precio por tramos lineales entre hitos (fecha → precio). */
function series(until: string, hitos: [string, number][]): DailyClose[] {
  const out: DailyClose[] = [];
  const end = Date.parse(`${until}T00:00:00Z`);
  const pts = hitos.map(([d, p]) => [Date.parse(`${d}T00:00:00Z`), p] as const);
  for (let t = pts[0]![0]; t <= end; t += DAY) {
    const i = pts.findIndex(([pt]) => pt > t);
    const [t0, p0] = i <= 0 ? pts[pts.length - 1]! : pts[i - 1]!;
    const [t1, p1] = i <= 0 ? pts[pts.length - 1]! : pts[i]!;
    const price = t1 === t0 ? p0 : p0 + ((p1 - p0) * (t - t0)) / (t1 - t0);
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ t, day, price });
  }
  return out;
}

const HITOS: [string, number][] = [
  ['2010-07-01', 0.1],
  ['2011-06-08', 30], // techo previo al primer halving
  ['2011-11-18', 2], // suelo 2012
  ['2013-12-04', 1100], // techo 2012
  ['2015-01-14', 170], // suelo 2016
  ['2017-12-17', 19_000], // techo 2016
  ['2018-12-15', 3200], // suelo 2020
  ['2021-11-08', 67_500], // techo 2020
  ['2022-11-21', 15_800], // suelo 2024
  ['2025-10-06', 124_000], // techo 2024
  ['2026-04-01', 62_000], // mínimo tras el techo
  ['2026-10-02', 78_000], // rebote hasta hoy
];

describe('ciclo de halving en curso', () => {
  const records = deriveHalvings(series('2026-10-02', HITOS), '2028-04-14T10:00:00.000Z');
  const actual = records[records.length - 1]!;
  const ciclo2024 = records.find((r) => r.year === '2024')!;

  it('el ciclo 2024 queda cerrado: su techo ya no puede subir', () => {
    expect(ciclo2024.cycleOpen).toBe(false);
    expect(ciclo2024.current).toBe(false);
    expect(ciclo2024.cyclePeak).toBe(124_000);
  });

  it('añade el ciclo actual con el próximo halving como estimación', () => {
    expect(records).toHaveLength(5);
    expect(actual.current).toBe(true);
    expect(actual.year).toBe('2028');
    expect(actual.at).toBe('2028-04-14T10:00:00.000Z');
    expect(actual.halvingEstimated).toBe(true);
    expect(actual.block).toBe(1_050_000);
    expect(actual.reward).toBe('1,5625 BTC');
  });

  it('su suelo es el mínimo desde el techo anterior hasta hoy (provisional)', () => {
    expect(actual.cycleLow).toBe(62_000);
    expect(actual.cycleLowDate).toBe('2026-04-01T00:00:00.000Z');
  });

  it('lo que aún no ha ocurrido queda por determinar, sin inventarlo', () => {
    expect(actual.priceAtHalving).toBeNull();
    expect(actual.cyclePeak).toBeNull();
    expect(actual.cyclePeakDate).toBeNull();
    expect(actual.lowToPeakPct).toBeNull();
  });

  it('sin altura de bloque estima el halving con 10 minutos por bloque', () => {
    const sinRed = deriveHalvings(series('2026-10-02', HITOS), null);
    const fecha = sinRed[sinRed.length - 1]!.at;
    // 840.000 → 1.050.000 bloques a 10 min: abril de 2028.
    expect(fecha.slice(0, 7)).toBe('2028-04');
  });

  it('mientras la ventana del techo siga abierta, el ciclo vigente es ese', () => {
    // Corte en julio de 2025: el techo de 2024 aún podía subir.
    const antes = deriveHalvings(series('2025-07-01', HITOS.slice(0, 10)), null);
    expect(antes).toHaveLength(4);
    expect(antes[3]!.year).toBe('2024');
    expect(antes[3]!.cycleOpen).toBe(true);
    expect(antes[3]!.current).toBe(true);
  });

  it('mide cada ciclo a los mismos días de su halving que el actual', () => {
    const conDatos = records.filter((r) => r.sameDay);
    // Los cuatro halvings ocurridos; el estimado no tiene «mismo día».
    expect(conDatos.map((r) => r.year)).toEqual(['2012', '2016', '2020', '2024']);
    expect(new Set(conDatos.map((r) => r.sameDay!.days)).size).toBe(1);
    // En el ciclo vigente, el «mismo día» es el último cierre.
    expect(ciclo2024.sameDay!.date).toBe('2026-10-02T00:00:00.000Z');
    expect(ciclo2024.sameDay!.price).toBeCloseTo(78_000, 0);
    // Su techo ya pasó: se mide la distancia a él.
    expect(ciclo2024.sameDay!.fromPeakPct).toBe(Math.round((78_000 / 124_000 - 1) * 100));
    expect(actual.sameDay).toBeNull();
  });
});
