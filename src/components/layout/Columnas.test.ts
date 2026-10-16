import { describe, expect, it } from 'vitest';
import { repartir, type ItemColumna } from './Columnas';

const item = (clave: string, alto: number, extra: Partial<ItemColumna> = {}): ItemColumna => ({ clave, alto, nodo: null, ...extra });
const claves = (cols: ItemColumna[][]) => cols.map((c) => c.map((i) => i.clave));

describe('reparto en columnas de escritorio', () => {
  it('pone cada tarjeta, en orden, en la columna que va más corta', () => {
    const items = [item('a', 500), item('b', 300), item('c', 300), item('d', 300)];
    expect(claves(repartir(items, 2))).toEqual([['a', 'd'], ['b', 'c']]);
    expect(claves(repartir(items, 3))).toEqual([['a'], ['b', 'd'], ['c']]);
  });

  it('respeta la columna fija que pida una tarjeta', () => {
    const items = [item('a', 100), item('b', 100, { col: { 2: 0, 3: 2 } }), item('c', 100)];
    expect(claves(repartir(items, 2))).toEqual([['a', 'b'], ['c']]);
    expect(claves(repartir(items, 3))).toEqual([['a'], ['c'], ['b']]);
  });

  it('una columna fija imposible cae en la más corta', () => {
    expect(claves(repartir([item('a', 100, { col: { 2: 5 } })], 2))).toEqual([['a'], []]);
  });

  it('no depende de las alturas reales: el mismo reparto siempre para el mismo ancho', () => {
    const items = [item('a', 400), item('b', 200), item('c', 250)];
    expect(repartir(items, 3)).toEqual(repartir(items, 3));
  });
});
